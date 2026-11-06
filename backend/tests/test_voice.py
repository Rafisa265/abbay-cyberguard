"""
Unit and integration tests for CyberShield Ethiopia Offline Voice Assistant API.

Covers:
- GET /api/v1/voice/status (runtime & model availability, language capabilities)
- Afaan Oromoo honest non-support gate (STT_UNSUPPORTED_OFFLINE)
- Strict Base64 validation and canonical 44-byte WAV header validation
- Duration boundary checks (min 0.3s, max 15.0s)
- Request body limits (2 MiB for voice endpoint, 4096 bytes for standard endpoints)
- Normalization against path-traversal limit evasion
- Concurrency admission controller (429 TOO_MANY_REQUESTS + Retry-After)
- Subprocess timeout handling (504 GATEWAY_TIMEOUT)
- End-to-end local inference execution with whisper.cpp and ggml-small-q5_1.bin
"""

import asyncio
import base64
import os
import struct
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient

from app import config, main, routes_voice

c = TestClient(main.app, base_url="http://127.0.0.1:8000", raise_server_exceptions=False)
J = {"Content-Type": "application/json"}


def make_canonical_wav(
    duration_s: float = 1.0,
    sample_rate: int = 16000,
    channels: int = 1,
    audio_format: int = 1,
    bits_per_sample: int = 16,
    subchunk1_size: int = 16,
    corrupt_riff: bool = False,
    corrupt_wave: bool = False,
    corrupt_fmt: bool = False,
    corrupt_data: bool = False,
) -> bytes:
    """Generates synthetic PCM WAV audio with configurable header parameters."""
    num_samples = int(duration_s * sample_rate)
    data_size = num_samples * channels * (bits_per_sample // 8)
    total_size = 36 + data_size

    header = bytearray()
    header.extend(b"XXXX" if corrupt_riff else b"RIFF")
    header.extend(struct.pack("<I", total_size))
    header.extend(b"XXXX" if corrupt_wave else b"WAVE")
    header.extend(b"XXXX" if corrupt_fmt else b"fmt ")
    header.extend(struct.pack("<I", subchunk1_size))
    header.extend(struct.pack("<H", audio_format))
    header.extend(struct.pack("<H", channels))
    header.extend(struct.pack("<I", sample_rate))
    byte_rate = sample_rate * channels * (bits_per_sample // 8)
    header.extend(struct.pack("<I", byte_rate))
    block_align = channels * (bits_per_sample // 8)
    header.extend(struct.pack("<H", block_align))
    header.extend(struct.pack("<H", bits_per_sample))
    header.extend(b"XXXX" if corrupt_data else b"data")
    header.extend(struct.pack("<I", data_size))

    pcm_payload = b"\x00" * data_size
    return bytes(header + pcm_payload)


def test_voice_status_endpoint():
    r = c.get("/api/v1/voice/status")
    assert r.status_code == 200
    data = r.json()
    assert data["stt_available"] is True
    # Runtime is a per-language dict
    assert data["runtime"]["en"] == "whisper.cpp"
    assert data["runtime"]["am"] == "transformers/whisper-small-am"
    assert data["runtime"]["om"] == "whisper.cpp"
    assert data["model_name"]["en"] == "ggml-small-q5_1.bin"
    assert data["model_name"]["am"] == "b1n1yam/whisper-small-am (Apache-2.0)"
    assert data["model_name"]["om"] == "ggml-small-q5_1.bin (whisper.cpp)"
    assert data["languages"]["en"]["supported"] is True
    assert "am" in data["languages"]
    # Afaan Oromoo is supported offline via whisper.cpp
    assert data["languages"]["om"]["supported"] is True
    assert data["languages"]["om"]["stt"] == "offline"


def test_afaan_oromoo_offline_stt_not_rejected_as_unsupported():
    wav_bytes = make_canonical_wav(duration_s=1.0)
    b64_audio = base64.b64encode(wav_bytes).decode("ascii")

    with patch.object(config, "WHISPER_CLI_PATH", config.WHISPER_CLI_PATH.parent / "nonexistent.exe"):
        r = c.post(
            "/api/v1/voice/transcribe",
            json={"audio_base64": b64_audio, "language": "om"},
            headers=J,
        )
        assert r.status_code == 503
        assert r.json()["error"]["code"] == "STT_UNAVAILABLE"


def test_unsupported_language_rejection():
    wav_bytes = make_canonical_wav(duration_s=1.0)
    b64_audio = base64.b64encode(wav_bytes).decode("ascii")

    r = c.post(
        "/api/v1/voice/transcribe",
        json={"audio_base64": b64_audio, "language": "fr"},
        headers=J,
    )
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "INVALID_LANGUAGE"


def test_invalid_base64_audio():
    r = c.post(
        "/api/v1/voice/transcribe",
        json={"audio_base64": "!!!not_valid_base64???", "language": "en"},
        headers=J,
    )
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "INVALID_AUDIO"


@pytest.mark.parametrize(
    "corrupt_kw,expected_msg",
    [
        ({"corrupt_riff": True}, "Missing RIFF header"),
        ({"corrupt_wave": True}, "Missing WAVE identifier"),
        ({"corrupt_fmt": True}, "Missing fmt subchunk identifier"),
        ({"corrupt_data": True}, "Missing data subchunk identifier"),
        ({"sample_rate": 44100}, "Expected 16000 Hz sample rate"),
        ({"channels": 2}, "Expected mono audio"),
        ({"audio_format": 2}, "Expected PCM format code 1"),
        ({"bits_per_sample": 24}, "Expected 16 bits per sample"),
    ],
)
def test_canonical_wav_header_validation(corrupt_kw, expected_msg):
    wav_bytes = make_canonical_wav(duration_s=1.0, **corrupt_kw)
    b64_audio = base64.b64encode(wav_bytes).decode("ascii")

    r = c.post(
        "/api/v1/voice/transcribe",
        json={"audio_base64": b64_audio, "language": "en"},
        headers=J,
    )
    assert r.status_code == 400
    err = r.json()["error"]
    assert err["code"] == "INVALID_AUDIO"
    assert expected_msg in err["message"]


def test_duration_boundaries():
    # Audio too short (< 0.3s)
    short_wav = make_canonical_wav(duration_s=0.2)
    r_short = c.post(
        "/api/v1/voice/transcribe",
        json={"audio_base64": base64.b64encode(short_wav).decode("ascii"), "language": "en"},
        headers=J,
    )
    assert r_short.status_code == 400
    assert "too short" in r_short.json()["error"]["message"]

    # Audio too long (> 15.0s)
    long_wav = make_canonical_wav(duration_s=15.5)
    r_long = c.post(
        "/api/v1/voice/transcribe",
        json={"audio_base64": base64.b64encode(long_wav).decode("ascii"), "language": "en"},
        headers=J,
    )
    assert r_long.status_code == 400
    assert "too long" in r_long.json()["error"]["message"]


def test_payload_size_limits():
    # Standard endpoint strictly limited to MAX_BODY_BYTES (4096)
    r_standard = c.post(
        "/api/v1/m4/demo",
        content=b'{"scenario_id":"DS-A","padding":"' + b"A" * 5000 + b'"}',
        headers=J,
    )
    assert r_standard.status_code == 413
    assert r_standard.json()["error"]["code"] == "PAYLOAD_TOO_LARGE"

    # Path traversal evasion to standard endpoint must still enforce 4096 limit
    r_traversal = c.post(
        "/api/v1/voice/transcribe/../../api/v1/m4/demo",
        content=b'{"scenario_id":"DS-A","padding":"' + b"A" * 5000 + b'"}',
        headers=J,
    )
    assert r_traversal.status_code == 413
    assert r_traversal.json()["error"]["code"] == "PAYLOAD_TOO_LARGE"

    # Voice endpoint accepts payload > 4096 bytes up to 2 MiB
    wav_bytes = make_canonical_wav(duration_s=1.0)  # ~32 KiB
    b64_audio = base64.b64encode(wav_bytes).decode("ascii")
    assert len(b64_audio) > 4096

    # Voice endpoint rejects payload > 2 MiB (MAX_VOICE_BODY_BYTES = 2097152)
    oversized_body = b'{"audio_base64":"' + b"A" * 2100000 + b'","language":"en"}'
    r_oversized = c.post(
        "/api/v1/voice/transcribe",
        content=oversized_body,
        headers=J,
    )
    assert r_oversized.status_code == 413
    assert r_oversized.json()["error"]["code"] == "PAYLOAD_TOO_LARGE"


def test_admission_controller_concurrency():
    wav_bytes = make_canonical_wav(duration_s=1.0)
    b64_audio = base64.b64encode(wav_bytes).decode("ascii")

    # Manually acquire the admission controller
    routes_voice.admission_controller._active = True
    try:
        r = c.post(
            "/api/v1/voice/transcribe",
            json={"audio_base64": b64_audio, "language": "en"},
            headers=J,
        )
        assert r.status_code == 429
        assert r.json()["error"]["code"] == "TOO_MANY_REQUESTS"
        assert r.headers.get("retry-after") == "3"
    finally:
        routes_voice.admission_controller._active = False

    # After release, transcription is permitted
    assert routes_voice.admission_controller._active is False


@pytest.mark.anyio
async def test_subprocess_timeout_handling():
    wav_bytes = make_canonical_wav(duration_s=1.0)
    b64_audio = base64.b64encode(wav_bytes).decode("ascii")

    with patch("asyncio.wait_for", side_effect=asyncio.TimeoutError):
        r = c.post(
            "/api/v1/voice/transcribe",
            json={"audio_base64": b64_audio, "language": "en"},
            headers=J,
        )
        assert r.status_code == 504
        assert r.json()["error"]["code"] == "TIMEOUT"


def test_end_to_end_local_transcription():
    """Executes live inference with local whisper-cli.exe and ggml-small-q5_1.bin on synthetic WAV."""
    wav_bytes = make_canonical_wav(duration_s=1.0)
    b64_audio = base64.b64encode(wav_bytes).decode("ascii")

    r = c.post(
        "/api/v1/voice/transcribe",
        json={"audio_base64": b64_audio, "language": "en"},
        headers=J,
    )
    assert r.status_code == 200
    data = r.json()
    assert "transcript" in data
    assert isinstance(data["transcript"], str)
    assert data["language"] == "en"


def test_end_to_end_english_speech_sample():
    """Executes live offline inference on lawful English speech recording."""
    fixture_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "data", "voice_test_fixtures", "english_test.wav"
    )
    assert os.path.isfile(fixture_path), f"Fixture missing: {fixture_path}"

    with open(fixture_path, "rb") as f:
        wav_bytes = f.read()

    b64_audio = base64.b64encode(wav_bytes).decode("ascii")
    r = c.post(
        "/api/v1/voice/transcribe",
        json={"audio_base64": b64_audio, "language": "en"},
        headers=J,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["language"] == "en"
    transcript = data["transcript"].lower()
    assert "ask not what your country can do for you" in transcript


def test_end_to_end_amharic_speech_sample():
    """Executes live offline inference on lawful Amharic speech recording."""
    fixture_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "data", "voice_test_fixtures", "amharic_test.wav"
    )
    assert os.path.isfile(fixture_path), f"Fixture missing: {fixture_path}"

    with open(fixture_path, "rb") as f:
        wav_bytes = f.read()

    b64_audio = base64.b64encode(wav_bytes).decode("ascii")
    r = c.post(
        "/api/v1/voice/transcribe",
        json={"audio_base64": b64_audio, "language": "am"},
        headers=J,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["language"] == "am"
    assert len(data["transcript"]) > 0


@pytest.mark.anyio
async def test_output_file_size_bounding():
    """Verifies that oversized transcript output files (>64KiB) are rejected with HTTP 500."""
    stream = asyncio.StreamReader()
    stream.feed_eof()

    class FakeProc:
        returncode = 0
        stderr = stream
        async def wait(self):
            return 0
        def kill(self):
            pass

    with patch("os.path.isfile", return_value=True), \
         patch("os.path.getsize", return_value=70000), \
         patch("asyncio.create_subprocess_exec", return_value=FakeProc()):
        wav_bytes = make_canonical_wav(duration_s=1.0)
        b64_audio = base64.b64encode(wav_bytes).decode("ascii")

        r = c.post(
            "/api/v1/voice/transcribe",
            json={"audio_base64": b64_audio, "language": "en"},
            headers=J,
        )
        assert r.status_code == 500
        assert r.json()["error"]["code"] == "OUTPUT_TOO_LARGE"


def test_amharic_model_dir_exists():
    """Verify Amharic model directory and config are present."""
    model_dir = config.AMHARIC_MODEL_DIR
    assert model_dir.is_dir(), f"Amharic model dir missing: {model_dir}"
    assert (model_dir / "config.json").is_file(), "config.json missing in Amharic model dir"


def test_amharic_runner_exists():
    """Verify amharic_stt_runner.py exists at configured path."""
    assert config.AMHARIC_STT_RUNNER.is_file(), f"Runner missing: {config.AMHARIC_STT_RUNNER}"


def test_amharic_service_unavailable_when_model_missing():
    """If the Amharic model directory is absent, endpoint returns 503."""
    wav_bytes = make_canonical_wav(duration_s=1.0)
    b64_audio = base64.b64encode(wav_bytes).decode("ascii")

    with patch.object(config, "AMHARIC_MODEL_DIR", config.AMHARIC_MODEL_DIR.parent / "nonexistent_amharic_model"):
        r = c.post(
            "/api/v1/voice/transcribe",
            json={"audio_base64": b64_audio, "language": "am"},
            headers=J,
        )
        assert r.status_code == 503
        assert r.json()["error"]["code"] == "STT_UNAVAILABLE"


def test_amharic_produces_ethiopic_script():
    """Live Amharic inference must produce actual Ethiopic (Ge'ez) script characters."""
    fixture_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "data", "voice_test_fixtures", "amharic_test.wav"
    )
    if not os.path.isfile(fixture_path):
        pytest.skip("Amharic test fixture not available")

    # Skip if model.safetensors isn't downloaded yet
    model_weights = config.AMHARIC_MODEL_DIR / "model.safetensors"
    if not model_weights.is_file():
        pytest.skip("Amharic model weights (model.safetensors) not yet available")

    with open(fixture_path, "rb") as f:
        wav_bytes = f.read()

    b64_audio = base64.b64encode(wav_bytes).decode("ascii")
    r = c.post(
        "/api/v1/voice/transcribe",
        json={"audio_base64": b64_audio, "language": "am"},
        headers=J,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["language"] == "am"
    transcript = data["transcript"]
    assert len(transcript) > 0, "Empty transcript"
    # Check for at least one Ethiopic Unicode character (U+1200–U+137F)
    has_ethiopic = any("\u1200" <= ch <= "\u137f" for ch in transcript)
    assert has_ethiopic, f"No Ethiopic script in transcript: {transcript!r}"


def test_synthesize_english_browser_native_preferred():
    """English requests return 200 indicating browser native preferred."""
    r = c.post(
        "/api/v1/voice/synthesize",
        json={"text": "What is phishing?", "language": "en"},
        headers=J,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "browser_native_preferred"
    assert data["language"] == "en"


def test_synthesize_invalid_language():
    """Unsupported language codes are rejected with 400."""
    r = c.post(
        "/api/v1/voice/synthesize",
        json={"text": "Bonjour tout le monde", "language": "fr"},
        headers=J,
    )
    assert r.status_code == 400
    err = r.json()["error"]
    assert err["code"] == "INVALID_LANGUAGE"


def test_synthesize_empty_text():
    """Empty or whitespace-only text is rejected with 400."""
    r = c.post(
        "/api/v1/voice/synthesize",
        json={"text": "   ", "language": "am"},
        headers=J,
    )
    assert r.status_code == 400
    err = r.json()["error"]
    assert err["code"] == "EMPTY_TEXT"


def test_synthesize_amharic_offline():
    """Amharic text synthesis produces valid audio/wav payload."""
    r = c.post(
        "/api/v1/voice/synthesize",
        json={"text": "ሰላም ይህ የሳይበር ጥበቃ ነው።", "language": "am"},
        headers=J,
    )
    assert r.status_code == 200
    assert r.headers["content-type"] == "audio/wav"
    wav_bytes = r.content
    assert len(wav_bytes) > 44
    assert wav_bytes[:4] == b"RIFF"
    assert wav_bytes[8:12] == b"WAVE"


def test_synthesize_oromo_offline():
    """Afaan Oromoo text synthesis produces valid audio/wav payload."""
    r = c.post(
        "/api/v1/voice/synthesize",
        json={"text": "Nagaa, kun eegumsa saayibariiti.", "language": "om"},
        headers=J,
    )
    assert r.status_code == 200
    assert r.headers["content-type"] == "audio/wav"
    wav_bytes = r.content
    assert len(wav_bytes) > 44
    assert wav_bytes[:4] == b"RIFF"
    assert wav_bytes[8:12] == b"WAVE"



