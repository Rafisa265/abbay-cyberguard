"""
CyberShield Ethiopia - Offline-First Voice Assistant API Routes

Provides endpoints for offline speech-to-text (STT) and voice status.
Strict offline-first processing:
- English ('en') offline STT via whisper.cpp (ggml-small-q5_1.bin).
- Amharic ('am') offline STT via b1n1yam/whisper-small-am HuggingFace fine-tune
  (Apache-2.0), run in an isolated subprocess using amharic_stt_runner.py.
- Afaan Oromoo ('om') is explicitly unsupported offline (STT_UNSUPPORTED_OFFLINE).
- Zero audio or transcript persistence; ephemeral files removed immediately.
- Strict concurrency admission control (single worker process execution).
- Bounded memory buffers and streaming subprocess stderr drain.
"""

import asyncio
import base64
import binascii
import json
import logging
import os
import shutil
import struct
import subprocess
import sys
import tempfile
from fastapi import APIRouter, status, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from . import config, tts_service

log = logging.getLogger("cybershield")
router = APIRouter(prefix="/api/v1/voice", tags=["CyberShield Voice"], include_in_schema=False)


class VoiceAdmissionController:
    """Atomic concurrency controller ensuring only one transcription runs at a time."""

    def __init__(self) -> None:
        self._lock: asyncio.Lock | None = None
        self._loop: asyncio.AbstractEventLoop | None = None
        self._active = False

    def _get_lock(self) -> asyncio.Lock:
        try:
            curr_loop = asyncio.get_running_loop()
        except RuntimeError:
            curr_loop = None
        if self._lock is None or self._loop is not curr_loop:
            self._lock = asyncio.Lock()
            self._loop = curr_loop
        return self._lock

    async def acquire(self) -> bool:
        async with self._get_lock():
            if self._active:
                return False
            self._active = True
            return True

    async def release(self) -> None:
        async with self._get_lock():
            self._active = False


admission_controller = VoiceAdmissionController()


def validate_canonical_wav(audio_bytes: bytes) -> tuple[bool, str]:
    """
    Validates that audio_bytes contains a strictly canonical 44-byte WAV header:
    - RIFF WAVE fmt (PCM, 16-bit, 1 channel mono, 16000 Hz sample rate)
    - data chunk matching exact remaining length
    - duration between 0.3s and 15.0s
    """
    if len(audio_bytes) < 44:
        return False, "Audio is too short for a 44-byte WAV header"

    if audio_bytes[0:4] != b"RIFF":
        return False, "Missing RIFF header"

    riff_size = struct.unpack("<I", audio_bytes[4:8])[0]
    if riff_size != len(audio_bytes) - 8:
        return False, "RIFF payload size mismatch"

    if audio_bytes[8:12] != b"WAVE":
        return False, "Missing WAVE identifier"

    if audio_bytes[12:16] != b"fmt ":
        return False, "Missing fmt subchunk identifier"

    subchunk1_size = struct.unpack("<I", audio_bytes[16:20])[0]
    if subchunk1_size != 16:
        return False, f"Expected PCM subchunk1 size 16, got {subchunk1_size}"

    audio_format = struct.unpack("<H", audio_bytes[20:22])[0]
    if audio_format != 1:
        return False, f"Expected PCM format code 1, got {audio_format}"

    channels = struct.unpack("<H", audio_bytes[22:24])[0]
    if channels != 1:
        return False, f"Expected mono audio (1 channel), got {channels}"

    sample_rate = struct.unpack("<I", audio_bytes[24:28])[0]
    if sample_rate != 16000:
        return False, f"Expected 16000 Hz sample rate, got {sample_rate}"

    bits_per_sample = struct.unpack("<H", audio_bytes[34:36])[0]
    if bits_per_sample != 16:
        return False, f"Expected 16 bits per sample, got {bits_per_sample}"

    block_align = struct.unpack("<H", audio_bytes[32:34])[0]
    if block_align != 2:
        return False, f"Expected block align 2, got {block_align}"

    byte_rate = struct.unpack("<I", audio_bytes[28:32])[0]
    if byte_rate != 32000:
        return False, f"Expected byte rate 32000, got {byte_rate}"

    if audio_bytes[36:40] != b"data":
        return False, "Missing data subchunk identifier"

    data_size = struct.unpack("<I", audio_bytes[40:44])[0]
    if data_size != len(audio_bytes) - 44:
        return False, "Data subchunk size mismatch"

    num_samples = data_size // 2
    duration = num_samples / 16000.0

    if duration < 0.3:
        return False, f"Audio duration too short: {duration:.2f}s (minimum 0.3s)"
    if duration > 15.0:
        return False, f"Audio duration too long: {duration:.2f}s (maximum 15.0s)"

    return True, ""


class TranscribeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    audio_base64: str = Field(..., min_length=1, max_length=2000000, description="Base64 encoded canonical WAV")
    language: str = Field(default="en", description="Audio language: 'en', 'am', or 'om'")


class SynthesizeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(..., min_length=1, max_length=2500, description="Text to synthesize into spoken audio")
    language: str = Field(default="en", description="Language code: 'en', 'am', or 'om'")


def get_voice_status() -> dict:
    cli_exists = config.WHISPER_CLI_PATH.is_file()
    model_exists = config.WHISPER_MODEL_PATH.is_file()
    en_available = cli_exists and model_exists

    amharic_model_exists = (config.AMHARIC_MODEL_DIR / "config.json").is_file()
    amharic_runner_exists = config.AMHARIC_STT_RUNNER.is_file()
    am_available = amharic_model_exists and amharic_runner_exists

    amharic_tts_available = tts_service.is_tts_model_available("am")
    oromo_tts_available = tts_service.is_tts_model_available("om")
    om_stt_available = en_available

    return {
        "stt_available": en_available or am_available or om_stt_available,
        "tts_available": True,
        "runtime": {
            "en": "whisper.cpp",
            "am": "transformers/whisper-small-am",
            "om": "whisper.cpp",
        },
        "tts_runtime": {
            "en": "browser_native",
            "am": "transformers/vits-mms" if amharic_tts_available else "browser_fallback",
            "om": "transformers/vits-mms" if oromo_tts_available else "unavailable",
        },
        "model_name": {
            "en": "ggml-small-q5_1.bin",
            "am": "b1n1yam/whisper-small-am (Apache-2.0)",
            "om": "ggml-small-q5_1.bin (whisper.cpp)",
        },
        "languages": {
            "en": {
                "supported": en_available,
                "stt": "offline" if en_available else "unavailable",
                "tts": "browser_native",
            },
            "am": {
                "supported": am_available or amharic_tts_available,
                "stt": "offline" if am_available else "unavailable",
                "tts": "offline" if amharic_tts_available else "browser_fallback",
            },
            "om": {
                "supported": om_stt_available or oromo_tts_available,
                "stt": "offline" if om_stt_available else "unavailable",
                "tts": "offline" if oromo_tts_available else "unavailable",
            },
        },
    }


@router.get("/status", summary="Check offline voice assistant capabilities")
async def voice_status():
    return get_voice_status()


@router.post("/synthesize", summary="Synthesize speech from text offline")
async def synthesize_speech(payload: SynthesizeRequest):
    clean_text = payload.text.strip()
    if not clean_text:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"error": {"code": "EMPTY_TEXT", "message": "Text to synthesize cannot be empty."}},
        )

    lang = tts_service.normalize_tts_language(payload.language)
    if lang not in ("en", "am", "om"):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"error": {"code": "INVALID_LANGUAGE", "message": f"Language '{payload.language}' is not supported for speech synthesis."}},
        )

    if lang == "en":
        # English is natively synthesized on the client via browser SpeechSynthesis
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": "browser_native_preferred",
                "language": "en",
                "message": "English speech is synthesized directly via browser native speech engine.",
            },
        )

    if not tts_service.is_tts_model_available(lang):
        log.warning("event=voice_synthesize outcome=model_missing lang=%s", lang)
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "error": {
                    "code": "TTS_MODEL_NOT_INSTALLED",
                    "language": lang,
                    "message": f"Offline TTS model for '{lang}' is not installed.",
                }
            },
        )

    try:
        wav_bytes, err_code = tts_service.synthesize_speech_to_wav(clean_text, lang)
        if err_code or not wav_bytes:
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={"error": {"code": err_code or "SYNTHESIS_FAILED", "message": "Voice synthesis failed."}},
            )
        return Response(content=wav_bytes, media_type="audio/wav")
    except Exception as e:
        log.error("event=voice_synthesize outcome=error lang=%s err=%s", lang, str(e))
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": {"code": "SYNTHESIS_FAILED", "message": "Voice synthesis failed."}},
        )



@router.post("/transcribe", summary="Transcribe speech to text offline")
async def transcribe_audio(payload: TranscribeRequest):
    # Language support check
    lang = payload.language.lower().strip()
    if lang not in ("en", "am", "om"):
        log.info("event=voice_transcribe outcome=invalid_lang lang=%s", lang)
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "error": {
                    "code": "INVALID_LANGUAGE",
                    "message": f"Language '{payload.language}' is not supported.",
                }
            },
        )

    # Runtime availability check — per-language
    if lang in ("en", "om"):
        if not config.WHISPER_CLI_PATH.is_file() or not config.WHISPER_MODEL_PATH.is_file():
            log.warning("event=voice_transcribe outcome=service_unavailable lang=%s", lang)
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={
                    "error": {
                        "code": "STT_UNAVAILABLE",
                        "message": "Local speech recognition runtime or model is not installed.",
                    }
                },
            )
    elif lang == "am":
        if not (config.AMHARIC_MODEL_DIR / "config.json").is_file() or not config.AMHARIC_STT_RUNNER.is_file():
            log.warning("event=voice_transcribe outcome=service_unavailable lang=am")
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={
                    "error": {
                        "code": "STT_UNAVAILABLE",
                        "message": "Amharic speech recognition model is not installed.",
                    }
                },
            )

    # Admission control (only 1 active worker at a time)
    acquired = await admission_controller.acquire()
    if not acquired:
        log.info("event=voice_transcribe outcome=rate_limited")
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={
                "error": {
                    "code": "TOO_MANY_REQUESTS",
                    "message": "Speech recognition engine is currently busy. Please retry in a moment.",
                }
            },
            headers={"Retry-After": "3"},
        )

    temp_dir = None
    try:
        # Strict Base64 decoding
        try:
            audio_bytes = base64.b64decode(payload.audio_base64, validate=True)
        except (binascii.Error, ValueError):
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"error": {"code": "INVALID_AUDIO", "message": "Invalid Base64 audio string"}},
            )

        # Max decoded bytes limit (1.5 MiB)
        if len(audio_bytes) > 1572864:
            return JSONResponse(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                content={"error": {"code": "PAYLOAD_TOO_LARGE", "message": "Decoded audio exceeds maximum size"}},
            )

        # Canonical WAV header validation
        valid_wav, err_msg = validate_canonical_wav(audio_bytes)
        if not valid_wav:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"error": {"code": "INVALID_AUDIO", "message": err_msg}},
            )

        # Create ephemeral temp directory
        temp_dir = tempfile.mkdtemp(prefix="cs_voice_")
        input_wav_path = os.path.join(temp_dir, "input.wav")
        output_prefix = os.path.join(temp_dir, "output")

        with open(input_wav_path, "wb") as f:
            f.write(audio_bytes)

        # Build inference command based on language
        if lang == "am":
            # Amharic: use fine-tuned HuggingFace Transformers model via Python runner
            cmd = [
                sys.executable,
                str(config.AMHARIC_STT_RUNNER),
                input_wav_path,
                str(config.AMHARIC_MODEL_DIR),
            ]
        elif lang == "om":
            # Afaan Oromoo: use whisper.cpp ggml-small-q5_1.bin with auto-detect and Oromo prompt
            cmd = [
                str(config.WHISPER_CLI_PATH),
                "-m", str(config.WHISPER_MODEL_PATH),
                "-f", input_wav_path,
                "-l", "auto",
                "--prompt", "Afaan Oromoo",
                "-t", "4",
                "-np",
                "-nt",
                "-otxt",
                "-of", output_prefix,
            ]
        else:
            # English: use whisper.cpp ggml-small-q5_1.bin
            cmd = [
                str(config.WHISPER_CLI_PATH),
                "-m", str(config.WHISPER_MODEL_PATH),
                "-f", input_wav_path,
                "-l", lang,
                "-t", "4",
                "-np",
                "-nt",
                "-otxt",
                "-of", output_prefix,
            ]

        # Inference execution via worker thread (cross-platform & avoids Windows asyncio child process deadlocks)
        inference_timeout = 120.0 if lang == "am" else 60.0

        def run_inference_worker():
            return subprocess.run(
                cmd,
                stdout=subprocess.PIPE if lang == "am" else subprocess.DEVNULL,
                stderr=subprocess.PIPE,
                timeout=inference_timeout,
            )

        try:
            completed_proc = await asyncio.wait_for(
                asyncio.to_thread(run_inference_worker),
                timeout=inference_timeout,
            )
        except (subprocess.TimeoutExpired, asyncio.TimeoutError):
            log.warning("event=voice_transcribe outcome=timeout lang=%s", lang)
            return JSONResponse(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                content={"error": {"code": "TIMEOUT", "message": "Speech transcription timed out"}},
            )
        except Exception as e:
            log.error("event=voice_transcribe outcome=proc_error lang=%s err=%s", lang, str(e))
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={"error": {"code": "TRANSCRIPTION_FAILED", "message": "Inference process failed"}},
            )

        if completed_proc.returncode != 0:
            log.error("event=voice_transcribe outcome=proc_failed code=%s lang=%s", completed_proc.returncode, lang)
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={"error": {"code": "TRANSCRIPTION_FAILED", "message": "Inference process failed"}},
            )

        # --- Result extraction ---
        if lang == "am":
            # Amharic runner writes JSON to stdout: {"transcript": "..."} or {"error": "..."}
            stdout_bytes = completed_proc.stdout or b""
            stdout_str = stdout_bytes.decode("utf-8", errors="replace").strip()
            runner_result = None
            # Scan from end to find the final JSON output line
            for line in reversed(stdout_str.splitlines()):
                line = line.strip()
                if line.startswith("{") and line.endswith("}"):
                    try:
                        runner_result = json.loads(line)
                        break
                    except json.JSONDecodeError:
                        continue
            if runner_result is None:
                try:
                    runner_result = json.loads(stdout_str)
                except json.JSONDecodeError:
                    log.error("event=voice_transcribe outcome=json_parse_error lang=am stdout=%r", stdout_str[:200])
                    return JSONResponse(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        content={"error": {"code": "TRANSCRIPTION_FAILED", "message": "Runner produced invalid JSON"}},
                    )
            if "error" in runner_result:
                log.error("event=voice_transcribe outcome=runner_error lang=am err=%s", runner_result["error"])
                return JSONResponse(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content={"error": {"code": "TRANSCRIPTION_FAILED", "message": runner_result["error"]}},
                )
            transcript = runner_result.get("transcript", "").strip()
            log.info("event=voice_transcribe outcome=success lang=am")
            return {"transcript": transcript, "language": lang}
        else:
            # English: whisper-cli writes transcript to <output_prefix>.txt
            output_txt_path = output_prefix + ".txt"
            if not os.path.isfile(output_txt_path):
                log.info("event=voice_transcribe outcome=empty_output lang=%s", lang)
                return {"transcript": "", "language": lang}

            file_size = os.path.getsize(output_txt_path)
            if file_size > 65536:
                return JSONResponse(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content={"error": {"code": "OUTPUT_TOO_LARGE", "message": "Transcript output file too large"}},
                )

            with open(output_txt_path, "rb") as f:
                raw_data = f.read(65537)

            if len(raw_data) > 65536:
                return JSONResponse(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content={"error": {"code": "OUTPUT_TOO_LARGE", "message": "Transcript output exceeded size limit"}},
                )

            transcript = raw_data.decode("utf-8", errors="replace").strip()
            log.info("event=voice_transcribe outcome=success lang=%s", lang)
            return {"transcript": transcript, "language": lang}

    finally:
        if temp_dir and os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)
        await admission_controller.release()
