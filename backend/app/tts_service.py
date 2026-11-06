"""
CyberShield Ethiopia — Offline Text-to-Speech (TTS) Service

Provides local speech synthesis for:
- Amharic ('am', 'am-ET'): facebook/mms-tts-amh via VitsModel & AutoTokenizer
- Afaan Oromoo ('om', 'om-ET'): facebook/mms-tts-orm via VitsModel & VitsTokenizer
- English ('en', 'en-US'): primary execution in browser native speech synthesis;
  backend provides validation and fallback status.

Invariants:
1. 100% Privacy-preserving: zero audio or text logging to disk or external services.
2. Honest status: returns MODEL_NOT_INSTALLED when model directory/weights are absent.
3. Safe concurrency: bounded memory and single-inference locking.
4. Native-language normalization: Amharic and Oromo text preprocessed for accurate pronunciation.
"""

import io
import logging
import re
import threading
from pathlib import Path
import numpy as np

from . import config

log = logging.getLogger("cybershield")

_model_cache: dict[str, dict] = {}
_cache_lock = threading.Lock()
_synthesis_lock = threading.Lock()

# Amharic numeral pronunciations
AMHARIC_DIGITS = {
    "0": "ዜሮ", "1": "አንድ", "2": "ሁለት", "3": "ሦስት", "4": "አራት",
    "5": "አምስት", "6": "ስድስት", "7": "ሰባት", "8": "ስምንት", "9": "ዘጠኝ",
    "10": "አስር", "20": "ሃያ", "30": "ሠላሳ", "40": "አርባ", "50": "ኃምሳ",
    "60": "ስድሳ", "70": "ሰባ", "80": "ሰማንያ", "90": "ዘጠና",
    "100": "መቶ", "1000": "ሺህ"
}

ETHIOPIC_NUMERALS = {
    "፩": "አንድ", "፪": "ሁለት", "፫": "ሦስት", "፬": "አራት", "፭": "አምስት",
    "፮": "ስድስት", "፯": "ሰባት", "፰": "ስምንት", "፱": "ዘጠኝ", "፲": "አስር",
    "፳": "ሃያ", "፴": "ሠላሳ", "፵": "አርባ", "፶": "ኃምሳ",
    "፷": "ስድሳ", "፸": "ሰባ", "፹": "ሰማንያ", "፺": "ዘጠና", "፻": "መቶ", "፼": "አስር ሺህ"
}

# Common Amharic Abbreviations -> Spoken Form
AMHARIC_ABBREVIATIONS = {
    r"\bዓ\.ም\b": "ዓመተ ምሕረት",
    r"\bዓ/ም\b": "ዓመተ ምሕረት",
    r"\bእ\.ኤ\.አ\b": "እንደ አውሮፓውያን አቆጣጠር",
    r"\bእ/ኤ/አ\b": "እንደ አውሮፓውያን አቆጣጠር",
    r"\bወ/ሮ\b": "ወይዘሮ",
    r"\bወ/ሪት\b": "ወይዘሪት",
    r"\bዶ/ር\b": "ዶክተር",
    r"\bፕ/ር\b": "ፕሮፌሰር",
    r"\bፕሮ/ር\b": "ፕሮፌሰር",
    r"\bክ/ከተማ\b": "ክፍለ ከተማ",
    r"\bት/ቤት\b": "ትምህርት ቤት",
    r"\bመ/ቤት\b": "መስሪያ ቤት",
    r"\bቴ/ር\b": "ቴሌግራም",
}

# Technical & Cybersecurity Terminology -> Amharic Phonetic Form
AMHARIC_CYBER_TERMS = {
    r"\b2FA\b": "ሁለት ደረጃ ማረጋገጫ",
    r"\b2fa\b": "ሁለት ደረጃ ማረጋገጫ",
    r"\bMFA\b": "ባለብዙ ደረጃ ማረጋገጫ",
    r"\bmfa\b": "ባለብዙ ደረጃ ማረጋገጫ",
    r"\bOTP\b": "ኦ ቲ ፒ",
    r"\botp\b": "ኦ ቲ ፒ",
    r"\bPIN\b": "ፒን",
    r"\bpin\b": "ፒን",
    r"\bVPN\b": "ቪ ፒ ኤን",
    r"\bvpn\b": "ቪ ፒ ኤን",
    r"\bURL\b": "ዩ አር ኤል",
    r"\burl\b": "ዩ አር ኤል",
    r"\bSMS\b": "ኤስ ኤም ኤስ",
    r"\bsms\b": "ኤስ ኤም ኤስ",
    r"\bAI\b": "ኤ አይ",
    r"\bai\b": "ኤ አይ",
    r"\bCyberShield\b": "ሳይበርሺልድ",
    r"\bcybershield\b": "ሳይበርሺልድ",
    r"\bphishing\b": "ፊሺንግ",
    r"\bPhishing\b": "ፊሺንግ",
    r"\bmalware\b": "ማልዌር",
    r"\bMalware\b": "ማልዌር",
    r"\bransomware\b": "ራንሰምዌር",
    r"\bRansomware\b": "ራንሰምዌር",
    r"\bfirewall\b": "ፋየርዎል",
    r"\bFirewall\b": "ፋየርዎል",
    r"\bhacker\b": "ሀከር",
    r"\bHacker\b": "ሀከር",
    r"\bpassword\b": "የይለፍ ቃል",
    r"\bPassword\b": "የይለፍ ቃል",
    r"\bemail\b": "ኢሜይል",
    r"\bEmail\b": "ኢሜይል",
    r"\blink\b": "ሊንክ",
    r"\bLink\b": "ሊንክ",
    r"\bwebsite\b": "ድረ-ገጽ",
    r"\bWebsite\b": "ድረ-ገጽ",
}

# Common Afaan Oromoo Abbreviations -> Spoken Form
OROMO_ABBREVIATIONS = {
    r"\bFkn\.": "Fakkeenyaaf",
    r"\bfkn\.": "fakkeenyaaf",
    r"\bk\.k\.f\.": "fi kan kana fakkaatan",
    r"\bkkf\b": "fi kan kana fakkaatan",
    r"\bOTP\b": "O T P",
    r"\b2FA\b": "mallattoo lammataa",
    r"\bPIN\b": "koodii PIN",
}

# Afaan Oromoo Technical & Cybersecurity Terminology -> Spoken Form
OROMO_CYBER_TERMS = {
    r"\b2FA\b": "mallattoo lammataa",
    r"\b2fa\b": "mallattoo lammataa",
    r"\bMFA\b": "mallattoo baay'ee",
    r"\bmfa\b": "mallattoo baay'ee",
    r"\botp\b": "O T P",
    r"\bpin\b": "koodii PIN",
    r"\bVPN\b": "vii pii en",
    r"\bvpn\b": "vii pii en",
    r"\bURL\b": "yuu aar el",
    r"\burl\b": "yuu aar el",
    r"\bSMS\b": "es em es",
    r"\bsms\b": "es em es",
    r"\bAI\b": "ee ayi",
    r"\bai\b": "ee ayi",
    r"\bCyberShield\b": "saayibarshiildii",
    r"\bcybershield\b": "saayibarshiildii",
    r"\bphishing\b": "fiishiingii",
    r"\bPhishing\b": "fiishiingii",
    r"\bmalware\b": "maalweerii",
    r"\bMalware\b": "maalweerii",
    r"\bransomware\b": "raansamweerii",
    r"\bRansomware\b": "raansamweerii",
    r"\bfirewall\b": "faayariwooli",
    r"\bFirewall\b": "faayariwooli",
    r"\bhacker\b": "haakkarii",
    r"\bHacker\b": "haakkarii",
    r"\bpassword\b": "jecha icciitii",
    r"\bPassword\b": "jecha icciitii",
    r"\bemail\b": "iimeeyilii",
    r"\bEmail\b": "iimeeyilii",
    r"\blink\b": "liinkii",
    r"\bLink\b": "liinkii",
    r"\bwebsite\b": "weebsaayitii",
    r"\bWebsite\b": "weebsaayitii",
}

# Afaan Oromoo numeral pronunciations
OROMO_DIGITS = {
    "0": "zeeroo", "1": "tokko", "2": "lama", "3": "sadii", "4": "afur",
    "5": "shan", "6": "ja'a", "7": "torba", "8": "saddeet", "9": "sagal",
    "10": "kudhan", "20": "digdama", "30": "soddoma", "40": "afurtama", "50": "shantama",
    "60": "jaatama", "70": "torbaatama", "80": "saddeettama", "90": "sagaltama",
    "100": "dhibba", "1000": "kuma"
}


def num_to_oromo(n: int) -> str:
    """Converts an integer between 0 and 9999 to spoken Afaan Oromoo words."""
    if n < 0 or n > 9999:
        return " ".join(OROMO_DIGITS.get(d, d) for d in str(n))
    if n <= 10:
        return OROMO_DIGITS[str(n)]
    if n < 20:
        return f"kudha {OROMO_DIGITS[str(n - 10)]}"
    if n < 100:
        tens = (n // 10) * 10
        rem = n % 10
        if rem == 0:
            return OROMO_DIGITS[str(tens)]
        return f"{OROMO_DIGITS[str(tens)]} {OROMO_DIGITS[str(rem)]}"
    if n < 1000:
        h = n // 100
        rem = n % 100
        prefix = "dhibba" if h == 1 else f"{num_to_oromo(h)} dhibba"
        if rem == 0:
            return prefix
        return f"{prefix} {num_to_oromo(rem)}"
    th = n // 1000
    rem = n % 1000
    prefix = "kuma tokko" if th == 1 else f"{num_to_oromo(th)} kuma"
    if rem == 0:
        return prefix
    return f"{prefix} {num_to_oromo(rem)}"


def num_to_amharic(n: int) -> str:
    """Converts an integer between 0 and 9999 to spoken Amharic words."""
    if n < 0 or n > 9999:
        return " ".join(AMHARIC_DIGITS.get(d, d) for d in str(n))
    if n <= 10:
        return AMHARIC_DIGITS[str(n)]
    if n < 20:
        return f"አስራ {AMHARIC_DIGITS[str(n - 10)]}"
    if n < 100:
        tens = (n // 10) * 10
        rem = n % 10
        if rem == 0:
            return AMHARIC_DIGITS[str(tens)]
        return f"{AMHARIC_DIGITS[str(tens)]} {AMHARIC_DIGITS[str(rem)]}"
    if n < 1000:
        h = n // 100
        rem = n % 100
        prefix = "መቶ" if h == 1 else f"{AMHARIC_DIGITS[str(h)]} መቶ"
        if rem == 0:
            return prefix
        return f"{prefix} {num_to_amharic(rem)}"
    th = n // 1000
    rem = n % 1000
    prefix = "አንድ ሺህ" if th == 1 else f"{num_to_amharic(th)} ሺህ"
    if rem == 0:
        return prefix
    return f"{prefix} {num_to_amharic(rem)}"


def clean_markdown_for_speech(text: str) -> str:
    """Strips Markdown syntax that would corrupt or confuse speech synthesis."""
    if not text:
        return ""
    # Strip fenced code blocks
    cleaned = re.sub(r"```[\s\S]*?```", " ", text)
    # Strip inline code
    cleaned = re.sub(r"`([^`]+)`", r"\1", cleaned)
    # Convert markdown links [anchor](url) -> anchor
    cleaned = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", cleaned)
    # Strip images
    cleaned = re.sub(r"!\[[^\]]*\]\([^)]+\)", " ", cleaned)
    # Strip headers #
    cleaned = re.sub(r"^\s*#+\s*", "", cleaned, flags=re.MULTILINE)
    # Strip bold / italic markers
    cleaned = re.sub(r"[*_]{1,3}([^*_]+)[*_]{1,3}", r"\1", cleaned)
    # Strip bullet points and list markers
    cleaned = re.sub(r"(?:^|\s)[-*+]\s+", " ", cleaned)
    cleaned = re.sub(r"(?:^|\s)\d+\.\s+", " ", cleaned)
    return cleaned.strip()


def normalize_amharic_for_tts(text: str) -> str:
    """Preprocesses Amharic text for natural VITS synthesis and proper pronunciation."""
    norm = clean_markdown_for_speech(text)

    # 1. Expand abbreviations
    for pattern, replacement in AMHARIC_ABBREVIATIONS.items():
        norm = re.sub(pattern, replacement, norm)

    # 2. Expand cyber & technical terminology
    for pattern, replacement in AMHARIC_CYBER_TERMS.items():
        norm = re.sub(pattern, replacement, norm)

    # 3. Expand Ethiopic numerals
    for eth_num, spoken in ETHIOPIC_NUMERALS.items():
        norm = norm.replace(eth_num, f" {spoken} ")

    # 4. Expand Arabic numerals (e.g. 2026 -> ሁለት ሺህ ሃያ ስድስት, or በ2026 -> በ ሁለት ሺህ ሃያ ስድስት)
    def _replace_num(match):
        prefix = match.group(1)
        digits = match.group(2)
        suffix = match.group(3)
        try:
            val = int(digits)
            spoken = num_to_amharic(val)
            return f"{prefix} {spoken} {suffix}"
        except Exception:
            return match.group(0)

    norm = re.sub(r"(^|[^\d])(\d{1,4})([^\d]|$)", _replace_num, norm)
    norm = re.sub(r"(^|[^\d])(\d{1,4})([^\d]|$)", _replace_num, norm)

    # 5. Ethiopic punctuation to spoken pauses
    norm = norm.replace("፡", " ")  # Ethiopic word separator -> space
    norm = re.sub(r"።+", "። ", norm)  # Ethiopic full stop
    norm = re.sub(r"፣+", "፣ ", norm)  # Ethiopic comma
    norm = re.sub(r"፤+", "፤ ", norm)  # Ethiopic semicolon
    norm = norm.replace("፧", "? ")  # Ethiopic question mark

    # Clean redundant whitespace
    norm = re.sub(r"\s+", " ", norm).strip()
    return norm


def normalize_oromo_for_tts(text: str) -> str:
    """Preprocesses Afaan Oromoo text for natural VITS synthesis and authentic pronunciation."""
    norm = clean_markdown_for_speech(text)

    # 1. Expand curly apostrophes to ASCII single quote (hudhaa)
    norm = norm.replace("’", "'").replace("‘", "'").replace("`", "'")

    # 2. Expand cyber & technical terminology
    for pattern, replacement in OROMO_CYBER_TERMS.items():
        norm = re.sub(pattern, replacement, norm)

    # 3. Expand abbreviations
    for pattern, replacement in OROMO_ABBREVIATIONS.items():
        norm = re.sub(pattern, replacement, norm)

    # 4. Expand digits to spoken Afaan Oromoo words
    def _replace_oromo_num(match):
        prefix = match.group(1)
        digits = match.group(2)
        suffix = match.group(3)
        try:
            val = int(digits)
            spoken = num_to_oromo(val)
            return f"{prefix} {spoken} {suffix}"
        except Exception:
            return match.group(0)

    norm = re.sub(r"(^|[^\d])(\d{1,4})([^\d]|$)", _replace_oromo_num, norm)
    norm = re.sub(r"(^|[^\d])(\d{1,4})([^\d]|$)", _replace_oromo_num, norm)

    # Clean redundant whitespace
    norm = re.sub(r"\s+", " ", norm).strip()
    return norm


def segment_text_for_speech(text: str, language: str) -> list[str]:
    """
    Splits long responses into natural sentence units (max ~200 chars)
    to ensure smooth audio delivery and avoid memory spikes.
    """
    if len(text) <= 180:
        return [text]

    # Sentence boundary delimiters
    if language == "am":
        delimiters = r"(?<=[።.!?;\n])\s+"
    else:
        delimiters = r"(?<=[.!?;\n])\s+"

    raw_segments = re.split(delimiters, text)
    segments = []
    current = ""

    for s in raw_segments:
        s = s.strip()
        if not s:
            continue
        if len(current) + len(s) + 1 <= 200:
            current = f"{current} {s}".strip() if current else s
        else:
            if current:
                segments.append(current)
            current = s

    if current:
        segments.append(current)

    return segments if segments else [text]


def normalize_tts_language(language: str) -> str:
    """Normalizes BCP-47 or ISO language code to 'en', 'am', or 'om'."""
    lang = (language or "en").lower().strip()
    if lang in ("am", "am-et", "amh"):
        return "am"
    if lang in ("om", "om-et", "orm", "gaz"):
        return "om"
    if lang in ("en", "en-us", "en-gb", "eng"):
        return "en"
    return lang


def get_tts_model_dir(language: str) -> Path | None:
    norm_lang = normalize_tts_language(language)
    if norm_lang == "am":
        return config.AMHARIC_TTS_MODEL_DIR
    if norm_lang == "om":
        return config.OROMO_TTS_MODEL_DIR
    return None


def is_tts_model_available(language: str) -> bool:
    """Checks whether the offline TTS model weights are present on disk."""
    model_dir = get_tts_model_dir(language)
    if not model_dir or not model_dir.is_dir():
        return False
    # Model directory must have config.json and model weights (.safetensors or .bin)
    has_config = (model_dir / "config.json").is_file()
    has_weights = (
        (model_dir / "model.safetensors").is_file()
        or (model_dir / "pytorch_model.bin").is_file()
    )
    return has_config and has_weights


def load_tts_model(language: str):
    """Loads and caches the VITS model and tokenizer for the requested language."""
    norm_lang = normalize_tts_language(language)
    with _cache_lock:
        if norm_lang in _model_cache:
            return _model_cache[norm_lang]["model"], _model_cache[norm_lang]["tokenizer"]

        model_dir = get_tts_model_dir(norm_lang)
        if not model_dir or not is_tts_model_available(norm_lang):
            raise FileNotFoundError(f"Offline TTS model for '{norm_lang}' is not installed at {model_dir}")

        import torch
        from transformers import VitsModel, AutoTokenizer

        log.info("event=load_tts_model language=%s dir=%s", norm_lang, model_dir)
        tokenizer = AutoTokenizer.from_pretrained(str(model_dir), local_files_only=True)
        model = VitsModel.from_pretrained(str(model_dir), local_files_only=True)
        model.eval()

        _model_cache[norm_lang] = {
            "model": model,
            "tokenizer": tokenizer,
        }
        return model, tokenizer


def warm_tts_models(languages=("om", "am")):
    """
    Pre-warms offline TTS models and tokenizers in memory on server startup.
    Eliminates first-request cold-start latency and JIT graph compilation pauses.
    """
    for lang in languages:
        try:
            if is_tts_model_available(lang):
                log.info("event=warm_tts_models starting lang=%s", lang)
                model, tokenizer = load_tts_model(lang)
                sample_text = "nagaa" if lang == "om" else "ሰላም"
                inputs = tokenizer(sample_text, return_tensors="pt")
                import torch
                with torch.inference_mode():
                    _ = model(**inputs).waveform
                log.info("event=warm_tts_models ready lang=%s", lang)
        except Exception as e:
            log.warning("event=warm_tts_models failed lang=%s err=%s", lang, str(e))



def synthesize_speech_to_wav(text: str, language: str) -> tuple[bytes | None, str | None]:
    """
    Synthesizes text into 16kHz mono 16-bit PCM WAV bytes with native normalization and pause pacing.
    Returns: (wav_bytes, error_code)
    """
    raw_text = (text or "").strip()
    if not raw_text:
        return None, "EMPTY_TEXT"

    if len(raw_text) > 2500:
        return None, "TEXT_TOO_LONG"

    norm_lang = normalize_tts_language(language)
    if norm_lang not in ("am", "om", "en"):
        return None, "INVALID_LANGUAGE"

    if norm_lang == "en":
        # English is handled directly via browser-native SpeechSynthesis
        return None, "BROWSER_NATIVE_PREFERRED"

    if not is_tts_model_available(norm_lang):
        return None, "TTS_MODEL_NOT_INSTALLED"

    # Normalize text for speech synthesis
    if norm_lang == "am":
        clean_text = normalize_amharic_for_tts(raw_text)
    elif norm_lang == "om":
        clean_text = normalize_oromo_for_tts(raw_text)
    else:
        clean_text = clean_markdown_for_speech(raw_text)

    if not clean_text:
        return None, "EMPTY_TEXT"

    # Single-synthesis concurrency gate to prevent high CPU / memory pressure
    acquired = _synthesis_lock.acquire(blocking=True, timeout=30.0)
    if not acquired:
        return None, "TOO_MANY_REQUESTS"

    try:
        import torch
        import soundfile as sf

        model, tokenizer = load_tts_model(norm_lang)
        sampling_rate = getattr(model.config, "sampling_rate", 16000)

        # Segment text into natural sentence units
        segments = segment_text_for_speech(clean_text, norm_lang)
        waveforms = []

        # For Afaan Oromoo: prepend 150ms silence lead-in to prevent hardware DAC / unmute clipping first word
        if norm_lang == "om":
            lead_in_samples = int(0.15 * sampling_rate)
            waveforms.append(np.zeros(lead_in_samples, dtype=np.float32))

        # 160ms silence pause between sentences (0.16s * 16000 = 2560 samples)
        pause_samples = int(0.16 * sampling_rate)
        pause_gap = np.zeros(pause_samples, dtype=np.float32)

        for idx, seg in enumerate(segments):
            # Clean segment characters for model vocabulary
            if norm_lang == "om":
                # MMS-ORM vocabulary supports lowercase Latin, apostrophe (hudhaa), hyphen, space
                seg_input = re.sub(r"[^a-zA-Z'\- ]", " ", seg).lower()
                seg_input = re.sub(r"\s+", " ", seg_input).strip()
            else:
                seg_input = seg.strip()

            if not seg_input:
                continue

            inputs = tokenizer(seg_input, return_tensors="pt")
            with torch.inference_mode():
                output = model(**inputs).waveform
            wf = output.squeeze().cpu().numpy()
            wf = np.clip(wf, -1.0, 1.0)
            waveforms.append(wf)
            if idx < len(segments) - 1:
                waveforms.append(pause_gap)

        if not waveforms:
            return None, "EMPTY_TEXT"

        final_waveform = np.concatenate(waveforms, axis=0) if len(waveforms) > 1 else waveforms[0]

        buffer = io.BytesIO()
        sf.write(buffer, final_waveform, sampling_rate, format="WAV", subtype="PCM_16")
        wav_bytes = buffer.getvalue()

        log.info(
            "event=tts_synthesize outcome=success lang=%s chars=%d segments=%d bytes=%d",
            norm_lang, len(clean_text), len(segments), len(wav_bytes)
        )
        return wav_bytes, None

    except Exception as e:
        log.error("event=tts_synthesize outcome=error lang=%s err=%s", norm_lang, str(e))
        return None, "SYNTHESIS_FAILED"
    finally:
        _synthesis_lock.release()
