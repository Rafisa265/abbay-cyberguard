"""
Unit tests for CyberShield Ethiopia Multilingual TTS Service.
Covers:
- Amharic text normalization (abbreviations, cyber terms, punctuation, digits)
- Numeral verbalization to Amharic words
- Afaan Oromoo normalization (abbreviations, cyber terms)
- Sentence segmentation preserving boundaries
- Model availability gates
- Synthesis to valid 16 kHz mono 16-bit PCM WAV
"""

import io
import pytest
from app import tts_service, config

def test_num_to_amharic():
    assert tts_service.num_to_amharic(0) == "ዜሮ"
    assert tts_service.num_to_amharic(5) == "አምስት"
    assert tts_service.num_to_amharic(15) == "አስራ አምስት"
    assert tts_service.num_to_amharic(42) == "አርባ ሁለት"
    assert tts_service.num_to_amharic(951) == "ዘጠኝ መቶ ኃምሳ አንድ"
    assert tts_service.num_to_amharic(2026) == "ሁለት ሺህ ሃያ ስድስት"

def test_clean_markdown_for_speech():
    raw = "# Header\n**Bold** text with `inline code` and [link](https://example.com) - bullet"
    cleaned = tts_service.clean_markdown_for_speech(raw)
    assert "#" not in cleaned
    assert "**" not in cleaned
    assert "`" not in cleaned
    assert "https://" not in cleaned
    assert "Bold text with inline code and link bullet" in " ".join(cleaned.split())

def test_normalize_amharic_for_tts():
    raw = "በ2026 ዓ.ም የይለፍ ቃልዎን እና 2FA ወይም OTP ይጠብቁ።"
    norm = tts_service.normalize_amharic_for_tts(raw)
    assert "ዓመተ ምሕረት" in norm
    assert "ሁለት ደረጃ ማረጋገጫ" in norm
    assert "ኦ ቲ ፒ" in norm
    assert "ሁለት ሺህ ሃያ ስድስት" in norm
    assert "2026" not in norm
    assert "2FA" not in norm
    assert "OTP" not in norm

def test_normalize_oromo_for_tts():
    raw = "Fkn. koodii OTP fi jecha darbee eeggadhaa."
    norm = tts_service.normalize_oromo_for_tts(raw)
    assert "Fakkeenyaaf" in norm
    assert "O T P" in norm

def test_sentence_segmentation():
    long_text = "አንደኛ ዓረፍተ ነገር ነው። ሁለተኛ ዓረፍተ ነገር ነው። ሦስተኛ ዓረፍተ ነገር ነው።"
    segs = tts_service.segment_text_for_speech(long_text, "am")
    assert isinstance(segs, list)
    assert len(segs) >= 1

def test_tts_model_availability():
    assert tts_service.is_tts_model_available("am") is True
    assert tts_service.is_tts_model_available("om") is True
    assert tts_service.is_tts_model_available("unsupported_lang") is False

def test_amharic_wav_synthesis():
    text = "ሰላም! የሳይበር ደህንነት ረዳት ነኝ።"
    wav_bytes, err = tts_service.synthesize_speech_to_wav(text, "am")
    assert err is None
    assert wav_bytes is not None
    assert len(wav_bytes) > 44
    assert wav_bytes[:4] == b"RIFF"
    assert wav_bytes[8:12] == b"WAVE"
    assert wav_bytes[12:16] == b"fmt "

def test_oromo_wav_synthesis():
    text = "Akkam jirtu? Baga nagaan dhuftan."
    wav_bytes, err = tts_service.synthesize_speech_to_wav(text, "om")
    assert err is None
    assert wav_bytes is not None
    assert len(wav_bytes) > 44
    assert wav_bytes[:4] == b"RIFF"
    assert wav_bytes[8:12] == b"WAVE"


def test_tts_empty_text():
    """Empty or whitespace-only text returns EMPTY_TEXT."""
    wav, err = tts_service.synthesize_speech_to_wav("   ", "am")
    assert wav is None
    assert err == "EMPTY_TEXT"


def test_tts_invalid_language():
    """Unsupported language returns INVALID_LANGUAGE."""
    wav, err = tts_service.synthesize_speech_to_wav("Hello", "fr")
    assert wav is None
    assert err == "INVALID_LANGUAGE"


def test_tts_english_browser_native():
    """English requests return BROWSER_NATIVE_PREFERRED."""
    wav, err = tts_service.synthesize_speech_to_wav("Hello world", "en")
    assert wav is None
    assert err == "BROWSER_NATIVE_PREFERRED"


def test_amharic_audio_properties():
    """Verifies Amharic WAV audio properties (16kHz, mono, 16-bit PCM)."""
    import struct
    text = "የይለፍ ቃልዎን ለማንም ሰው አያጋሩ።"
    wav_bytes, err = tts_service.synthesize_speech_to_wav(text, "am")
    assert err is None
    assert wav_bytes is not None
    assert len(wav_bytes) > 44

    channels = struct.unpack("<H", wav_bytes[22:24])[0]
    sample_rate = struct.unpack("<I", wav_bytes[24:28])[0]
    bits_per_sample = struct.unpack("<H", wav_bytes[34:36])[0]
    data_size = struct.unpack("<I", wav_bytes[40:44])[0]
    duration_s = (data_size / 2) / sample_rate

    assert channels == 1, f"Expected 1 channel, got {channels}"
    assert sample_rate == 16000, f"Expected 16000 Hz, got {sample_rate}"
    assert bits_per_sample == 16, f"Expected 16 bits, got {bits_per_sample}"
    assert duration_s > 0.5, f"Expected duration > 0.5s, got {duration_s:.2f}s"


def test_oromo_audio_properties():
    """Verifies Afaan Oromoo WAV audio properties (16kHz, mono, 16-bit PCM)."""
    import struct
    text = "Jecha darbii keessan nama kamiyyuuf hin kenninaa."
    wav_bytes, err = tts_service.synthesize_speech_to_wav(text, "om")
    assert err is None
    assert wav_bytes is not None
    assert len(wav_bytes) > 44

    channels = struct.unpack("<H", wav_bytes[22:24])[0]
    sample_rate = struct.unpack("<I", wav_bytes[24:28])[0]
    bits_per_sample = struct.unpack("<H", wav_bytes[34:36])[0]
    data_size = struct.unpack("<I", wav_bytes[40:44])[0]
    duration_s = (data_size / 2) / sample_rate

    assert channels == 1, f"Expected 1 channel, got {channels}"
    assert sample_rate == 16000, f"Expected 16000 Hz, got {sample_rate}"
    assert bits_per_sample == 16, f"Expected 16 bits, got {bits_per_sample}"
    assert duration_s > 0.5, f"Expected duration > 0.5s, got {duration_s:.2f}s"


