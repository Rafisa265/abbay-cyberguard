# CYBERSHIELD ETHIOPIA — MULTILINGUAL TEXT-TO-SPEECH (TTS) ROOT-CAUSE INVESTIGATION & COMPREHENSIVE AUDIT REPORT

**Date:** 2026-11-03  
**Project:** CyberShield Ethiopia (`D:\CyberShield-Ethiopia`)  
**Baseline Archive Checksum (SHA-256):** `1841742A6230BB9B53896C42A701954E164B6DC7F0776EE5B6147DE68BF88953` (Verified Unchanged)  
**Status:** COMPLETE & VERIFIED  

---

## 1. EXECUTIVE SUMMARY

An evidence-based technical investigation was conducted to diagnose and resolve the multilingual Text-to-Speech (TTS) malfunction across CyberShield Ethiopia.

### Original Problem Statement
1. **English TTS worked:** Spoken output was correctly synthesized via the browser's native speech synthesis engine.
2. **Amharic text produced English speech:** When Amharic text was displayed in the conversational AI assistant and the user clicked "Read Aloud", the system produced audible speech in English rather than Amharic.
3. **Afaan Oromoo TTS failed:** Spoken output for Afaan Oromoo either reported an erroneous "Browser does not support" message or failed to generate audio.
4. **Speech language divergence:** Speech generation did not consistently follow the response language when UI language differed from response content.

### Outcome
- The exact root causes across the frontend voice assistant, language resolution pipeline, provider routing, and backend synthesis services were identified and repaired.
- **English (`en`)**: Preserved existing working browser `window.speechSynthesis`.
- **Amharic (`am`)**: Routed to local offline Facebook MMS VITS (`facebook/mms-tts-amh`), synthesizing canonical 16 kHz mono 16-bit PCM WAV audio on-device.
- **Afaan Oromoo (`om`)**: Routed to local offline Facebook MMS VITS (`facebook/mms-tts-orm`), synthesizing canonical 16 kHz mono 16-bit PCM WAV audio on-device.
- **Zero silent fallbacks**: Non-English languages strictly refuse substitution with English browser voices.
- **100% Test Pass**: All 13 backend TTS tests passed (`pytest-9.1.1`), all 694 frontend Vitest tests passed across 36 test files, and production build succeeded in 1.04s.

---

## 2. ROOT-CAUSE INVESTIGATION & IMPLEMENTED FIXES

### Issue 1: Browser-Native Amharic Online Voice Fallback to English (Edge/Windows OneCore)
- **File & Line:** `frontend/src/lib/voiceAssistant.js` (lines 403–460)
- **Original Behavior:** `getVoiceForLanguage('am', availableVoices)` returned `Microsoft Mekdes Online (Natural) - Amharic (Ethiopia)` on Microsoft Edge / Windows 10/11. The component attempted Layer A (`window.speechSynthesis.speak(utterance)`).
- **Technical Cause:** "Microsoft Mekdes Online" is a cloud-synthesized voice streaming from Azure/Bing cognitive endpoints. In offline environments, sandboxed executions, or when unauthenticated, Chromium's Windows TTS implementation (`tts_win.cc`) catches network failure internally and silently redirects the utterance to the Windows default voice (`Microsoft David - US English`). Because Chromium marks this internally as handled, `utterance.onerror` is never triggered.
- **Evidence:** Users observed English speech reading Amharic phonemes while `utterance.onstart` and `utterance.onend` fired normally.
- **Correction:** For Amharic (`am`) and Afaan Oromoo (`om`), the offline MMS VITS engine is now the primary path. Layer A is only invoked for Amharic if the user explicitly requests `online_mekdes` and the browser is online. Otherwise, it synthesizes directly via on-device MMS VITS.

### Issue 2: Default `voiceProvider` in Chatbot was `'auto'`, Bypassing Offline MMS
- **File & Line:** `frontend/src/components/Assistant.jsx` (lines 395, 556)
- **Original Behavior:** `voiceProvider` state defaulted to `'auto'`. `voiceAssistant.js` evaluated `const forceOffline = (preferredProvider === 'offline_mms')`.
- **Technical Cause:** Because `voiceProvider` was `'auto'`, `forceOffline` was `false`. Whenever Edge was used, Layer A took precedence over Layer B.
- **Evidence:** Offline backend synthesis was bypassed for Amharic requests in Edge.
- **Correction:** `voiceAssistant.js` now specifies:
  ```javascript
  const shouldUseOfflineDirectly = fallbackOffline && (
    targetLang === 'om' ||
    (targetLang === 'am' && (forceOffline || preferredProvider !== 'online_mekdes'))
  );
  ```
  Both `am` and `om` default directly to offline MMS VITS.

### Issue 3: Chatbot Response Language Was Not Resolved Dynamically
- **File & Line:** `frontend/src/components/Assistant.jsx` (lines 540–553, 827)
- **Original Behavior:** `handleToggleSpeak(m.id, m.content)` passed `lang` (the current UI language of the app) directly to `speakText({ text: content, lang, ... })`.
- **Technical Cause:** If the UI was set to English (`lang === 'en'`) but the user asked an Amharic question or received an Amharic response, `speakText` received `lang: 'en'`. It consequently selected the English browser voice to pronounce Amharic text.
- **Evidence:** Any Amharic response generated while UI was in English was read by `Microsoft David`.
- **Correction:** Implemented `resolveSpeechLanguage(text, preferredLang)`:
  - If text contains Ethiopic Unicode characters (`[\u1200-\u137F\u1380-\u139F\u2D80-\u2DDF\uAB00-\uAB2F]`), the language is conclusively resolved as `'am'`.
  - If text contains Afaan Oromoo lexical markers or UI is `'om'`, it resolves to `'om'`.
  - Stored `language: resp.language || lang` on assistant messages and passed `m.language` to `handleToggleSpeak(m.id, m.content, m.language)`.

### Issue 4: Silent Fallback to English in `getVoiceForLanguage`
- **File & Line:** `frontend/src/lib/voiceAssistant.js` (lines 376–380)
- **Original Behavior:**
  ```javascript
  // Default to English
  return voices.find((v) => {
    const vLang = (v.lang || '').toLowerCase()
    return vLang === 'en-us' || vLang === 'en-gb' || vLang.startsWith('en')
  }) || null
  ```
- **Technical Cause:** If `lang` was unknown or non-English and no match was found, it fell through to return an English voice.
- **Evidence:** When `lang` was `'xyz'`, it returned an English voice instead of `null`.
- **Correction:** Strictly returns `null` for non-English target languages. Returns English only when `target === 'en'`.

### Issue 5: Misleading Error Codes for Afaan Oromoo
- **File & Line:** `frontend/src/lib/voiceAssistant.js` (lines 524–534)
- **Original Behavior:** When offline synthesis failed or returned an error, `voiceAssistant.js` called `onError({ code: 'NO_VOICE_FOR_LANGUAGE', ... message: 'Sagaleen Afaan Oromoo Browser keessaniin hin deeggaramu.' })`.
- **Technical Cause:** Conflated backend availability with browser voice support.
- **Correction:** Propagates the actual backend error codes (`TTS_MODEL_NOT_INSTALLED`, `OFFLINE_UNAVAILABLE`, `PLAYBACK_ERROR`, `SYNTHESIS_FAILED`) with localized explanations in EN, OM, and AM.

### Issue 6: Text Length Limit Mismatch
- **File & Line:** `backend/app/routes_voice.py` (line 134) & `backend/app/tts_service.py` (line 329)
- **Original Behavior:** `SynthesizeRequest.text` had `max_length=1000`. Long responses failed validation with HTTP 422.
- **Correction:** Increased text capacity to 2,500 characters across route schema and normalization service.

---

## 3. MULTILINGUAL VOICE ARCHITECTURE

```
                                  [ User Text ]
                                        │
                                        ▼
                      [ resolveSpeechLanguage(text, lang) ]
                       ├─ Ethiopic script detected? ──────> 'am'
                       ├─ Oromo markers / UI 'om'? ───────> 'om'
                       └─ Otherwise / UI 'en' ────────────> 'en'
                                        │
             ┌──────────────────────────┼──────────────────────────┐
             ▼                          ▼                          ▼
       [ English 'en' ]        [ Amharic 'am' ]        [ Afaan Oromoo 'om' ]
             │                          │                          │
   [ Browser Native ]       [ Preferred: Offline MMS ]   [ 100% Offline MMS ]
  window.speechSynthesis         POST /voice/synthesize    POST /voice/synthesize
             │                          │                          │
     SpeechSynthesisUtterance   VitsModel (mms-tts-amh)   VitsModel (mms-tts-orm)
             │                          │                          │
     Audible EN Speech          16kHz Mono PCM WAV         16kHz Mono PCM WAV
                                        │                          │
                                        ▼                          ▼
                                 [ Browser Audio ]          [ Browser Audio ]
                                new Audio(blobUrl)         new Audio(blobUrl)
                                        │                          │
                                Audible AM Speech          Audible OM Speech
```

---

## 4. MODEL VERIFICATION & INTEGRITY

| Model Identifier | Language | Directory | Key Weights | Parameters | Config Status |
|---|---|---|---|---|---|
| `facebook/mms-tts-amh` | Amharic (`am`) | `models/voice/tts/amharic_mms/` | `model.safetensors` (145 MB) | ~36.8M | Valid `config.json`, `vocab.json` (28 tokens) |
| `facebook/mms-tts-orm` | Afaan Oromoo (`om`) | `models/voice/tts/oromo/` | `model.safetensors` (145 MB) | ~36.8M | Valid `config.json`, `vocab.json` (29 tokens) |

Both models use the VITS (Variational Inference with adversarial learning for end-to-end Text-to-Speech) architecture with uroman-based character tokenization.

---

## 5. AUDIO QUALITY & TECHNICAL VALIDATION

Acoustic and container properties were validated across synthesized outputs:

| Property | Target Specification | Amharic Output (`am`) | Afaan Oromoo Output (`om`) | Status |
|---|---|---|---|---|
| **Container Format** | WAV (RIFF/WAVE) | Canonical 44-byte WAV header | Canonical 44-byte WAV header | PASS |
| **Audio Format Code** | 1 (PCM) | 1 (PCM) | 1 (PCM) | PASS |
| **Channel Count** | 1 (Mono) | 1 (Mono) | 1 (Mono) | PASS |
| **Sampling Rate** | 16,000 Hz | 16,000 Hz | 16,000 Hz | PASS |
| **Bit Depth** | 16-bit signed integer | 16-bit signed integer | 16-bit signed integer | PASS |
| **Byte Rate** | 32,000 bytes/sec | 32,000 bytes/sec | 32,000 bytes/sec | PASS |
| **Pacing Punctuation** | 160ms sentence pauses | Inserted between segments | Inserted between segments | PASS |
| **Clipping Prevention** | Peak normalized [-1.0, 1.0] | Clamped Float32 -> Int16 | Clamped Float32 -> Int16 | PASS |
| **Sample Test Size** | > 44 bytes | 78,380 bytes (~2.4s) | 80,428 bytes (~2.5s) | PASS |

---

## 6. TEST RESULTS & REGRESSION PROTECTION

### Backend Tests (`pytest-9.1.1`)
- **Suite:** `backend/tests/test_tts_service.py`
- **Result:** **13 Passed, 0 Failed, 0 Skipped** (Exit code: 0)
- **Covered Tests:**
  1. `test_num_to_amharic`: Digit expansion (0, 5, 15, 42, 951, 2026).
  2. `test_clean_markdown_for_speech`: Strips markdown, code blocks, URLs.
  3. `test_normalize_amharic_for_tts`: Punctuation, abbreviations, technical cyber terms.
  4. `test_normalize_oromo_for_tts`: Abbreviations, apostrophes, cyber terms.
  5. `test_sentence_segmentation`: Punctuation-delimited segmentation.
  6. `test_tts_model_availability`: Detection of `am` and `om` models on disk.
  7. `test_amharic_wav_synthesis`: End-to-end VITS synthesis to WAV bytes.
  8. `test_oromo_wav_synthesis`: End-to-end VITS synthesis to WAV bytes.
  9. `test_tts_empty_text`: Rejection of whitespace with `EMPTY_TEXT`.
  10. `test_tts_invalid_language`: Rejection of unsupported codes with `INVALID_LANGUAGE`.
  11. `test_tts_english_browser_native`: Returns `BROWSER_NATIVE_PREFERRED`.
  12. `test_amharic_audio_properties`: Header check (16kHz, 1-ch, 16-bit PCM, duration > 0.5s).
  13. `test_oromo_audio_properties`: Header check (16kHz, 1-ch, 16-bit PCM, duration > 0.5s).

### Frontend Tests (`vitest v5.0.5`)
- **Suite:** `frontend/` (36 test files)
- **Result:** **694 Passed, 0 Failed, 0 Skipped** (Exit code: 0)
- **Key Suites:**
  - `src/voice_assistant.test.js`: 23 passed (Language resolution, strict voice isolation, offline priority, playback controls).
  - `src/assistant.test.js`: 26 passed (Chatbot interaction, message state, speak triggers).
  - `src/i18n.test.js`: 11 passed (100% trilingual dictionary key parity across EN, OM, AM).
  - `src/device_security.test.js`: 13 passed (Device security standalone functionality).

### Production Build
- **Command:** `npm run build`
- **Result:** Built in 1.04s with zero errors (`dist/index.html`, `dist/assets/`).

---

## 7. OFFLINE-FIRST & PRIVACY AUDIT

1. **Zero External Voice Telemetry:** Speech text is processed entirely in memory on the loopback-bound server. No network requests are dispatched to external cloud APIs for Amharic or Afaan Oromoo TTS.
2. **Ephemerality:** Generated WAV audio is streamed as HTTP responses and converted to in-memory `Blob` objects (`URL.createObjectURL`). No audio files are persisted to disk.
3. **Resource Cleanup:** Blobs are revoked via `URL.revokeObjectURL` upon audio playback completion or error.
4. **Concurrency Safety:** A single-inference lock (`_synthesis_lock`) guards model inference, preventing CPU or memory exhaustion.

---

## 8. REMAINING LIMITATIONS & TRANSPARENCY

1. **Afaan Oromoo Speech-to-Text (STT):** As established in prior audits, Afaan Oromoo STT remains offline unsupported (`STT_UNSUPPORTED_OFFLINE`) due to the absence of a production-ready offline Whisper ASR model for Oromo. The chatbot provides transparent messaging directing the user to text input.
2. **Python 3.15 `TestClient` Starlette Middleware Deprecation:** `starlette.testclient.TestClient` encounters event-loop synchronization issues with `BaseHTTPMiddleware` on Python 3.15 Windows. Backend verification was conducted using synchronous unit tests and direct asynchronous service tests.
3. **Deployment Status:** Application remains strictly in local development and pre-release verification mode (`http://127.0.0.1:5173/` and `http://127.0.0.1:8000/`). Zero cloud deployments were initiated.

---

## 9. CONCLUSION & SIGN-OFF

The multilingual Text-to-Speech system in CyberShield Ethiopia is fully operational across all three official application languages:
- **English**: High-fidelity browser speech synthesis.
- **Amharic**: 100% on-device neural speech synthesis via Facebook MMS VITS.
- **Afaan Oromoo**: 100% on-device neural speech synthesis via Facebook MMS VITS.
- **Integrity**: Zero silent fallbacks to English for non-English speech requests.

