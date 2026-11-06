#!/usr/bin/env python3
"""
amharic_stt_runner.py — Standalone Amharic STT inference script.

Called by routes_voice.py as a subprocess for Amharic language inference.
Uses the b1n1yam/whisper-small-am fine-tuned model via HuggingFace Transformers.

Usage:
    python amharic_stt_runner.py <wav_path> <model_dir>

Output:
    JSON to stdout: {"transcript": "..."} or {"error": "..."}

The model runs entirely locally. No network calls during inference.
"""
import sys
import json
import os


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: amharic_stt_runner.py <wav_path> <model_dir>"}))
        sys.exit(1)

    wav_path = sys.argv[1]
    model_dir = sys.argv[2]

    if not os.path.isfile(wav_path):
        print(json.dumps({"error": f"Audio file not found: {wav_path}"}))
        sys.exit(1)

    if not os.path.isdir(model_dir):
        print(json.dumps({"error": f"Model directory not found: {model_dir}"}))
        sys.exit(1)

    import warnings
    warnings.filterwarnings("ignore")

    try:
        import torch
        import soundfile as sf
        import transformers
        transformers.logging.set_verbosity_error()
        from transformers import WhisperProcessor, WhisperForConditionalGeneration
        import numpy as np
    except ImportError as e:
        print(json.dumps({"error": f"Missing dependency: {e}"}))
        sys.exit(1)

    try:
        # Load audio (canonical 16kHz mono 16-bit PCM WAV)
        audio_data, sample_rate = sf.read(wav_path, dtype="float32")
        if audio_data.ndim > 1:
            audio_data = audio_data[:, 0]  # take first channel if multi-channel
        if sample_rate != 16000:
            print(json.dumps({"error": f"Expected 16000 Hz, got {sample_rate}"}))
            sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": f"Failed to read audio: {e}"}))
        sys.exit(1)

    try:
        # Load processor and model from local directory only (no network)
        processor = WhisperProcessor.from_pretrained(
            model_dir,
            local_files_only=True,
        )
        model = WhisperForConditionalGeneration.from_pretrained(
            model_dir,
            local_files_only=True,
            torch_dtype=torch.float32,
        )
        model.eval()
    except Exception as e:
        print(json.dumps({"error": f"Failed to load model: {e}"}))
        sys.exit(1)

    try:
        # Prepare features
        inputs = processor(
            audio_data,
            sampling_rate=16000,
            return_tensors="pt",
        )
        input_features = inputs.input_features

        # Forced decoder IDs for Amharic transcription (not translation)
        forced_decoder_ids = processor.get_decoder_prompt_ids(
            language="amharic",
            task="transcribe",
        )

        with torch.no_grad():
            predicted_ids = model.generate(
                input_features,
                forced_decoder_ids=forced_decoder_ids,
                max_new_tokens=256,
                num_beams=5,
                repetition_penalty=1.2,
                no_repeat_ngram_size=3,
            )

        transcript = processor.batch_decode(
            predicted_ids,
            skip_special_tokens=True,
        )[0].strip()

        print(json.dumps({"transcript": transcript}))

    except Exception as e:
        print(json.dumps({"error": f"Inference failed: {e}"}))
        sys.exit(1)


if __name__ == "__main__":
    main()

