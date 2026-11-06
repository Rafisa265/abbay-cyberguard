"""
CyberShield Ethiopia — M3 Incident Report Text Classifier Tests
Verifies multilingual feature extraction across EN, OM, AM and model inference.
"""

from pathlib import Path
import pytest

from app.ml.m3_incident_features import (
    FEATURE_GROUP_NAMES,
    INCIDENT_CLASSES,
    extract_incident_features,
)
from app.ml.model import SoftmaxClassifier


ARTIFACT_PATH = Path(__file__).resolve().parents[1] / "app" / "data" / "ml_m3_incident_classifier.json"


def test_m3_incident_classifier_artifact_exists():
    assert ARTIFACT_PATH.is_file(), f"M3 ML artifact missing at {ARTIFACT_PATH}"
    model = SoftmaxClassifier.load(ARTIFACT_PATH)
    assert model.trained is True
    assert model.classes == INCIDENT_CLASSES
    assert model.num_features == len(FEATURE_GROUP_NAMES)


def test_m3_feature_extraction_english():
    text = "Someone sent me a link saying my CBE bank account is suspended and requested my OTP."
    vec, detected = extract_incident_features(text)
    assert len(vec) == 18
    assert any("otp" in d for d in detected)
    assert any("bank" in d for d in detected)


def test_m3_feature_extraction_amharic():
    text = "የቴሌኮም ሲም ካርድዎ ይታገዳል ብለው ኦቲፒ ሚስጥር ቁጥር ጠየቁኝ።"
    vec, detected = extract_incident_features(text)
    assert len(vec) == 18
    assert any("sim" in d or "otp" in d for d in detected)


def test_m3_feature_extraction_oromo():
    text = "Koodii mirkaneessaa fi herrega baankii daldalaa akka ergu na gaafatan."
    vec, detected = extract_incident_features(text)
    assert len(vec) == 18
    assert any("otp" in d or "bank" in d for d in detected)


def test_m3_model_predictions():
    model = SoftmaxClassifier.load(ARTIFACT_PATH)

    # SIM Swap / OTP Theft
    sim_text = "Ethio telecom customer care called saying my SIM card is disconnected, asked for OTP verification code"
    vec_sim, _ = extract_incident_features(sim_text)
    pred_sim, conf_sim = model.predict(vec_sim)
    assert pred_sim == "sim_otp"
    assert conf_sim >= 0.50

    # Malware APK
    malware_text = "Downloaded CBE booster APK app and granted accessibility administrator permission"
    vec_mal, _ = extract_incident_features(malware_text)
    pred_mal, conf_mal = model.predict(vec_mal)
    assert pred_mal == "malware"
    assert conf_mal >= 0.50

    # Advance fee lottery fraud
    fraud_text = "Telebirr anniversary lottery congratulations you won 100000 birr pay upfront registration fee"
    vec_fraud, _ = extract_incident_features(fraud_text)
    pred_fraud, conf_fraud = model.predict(vec_fraud)
    assert pred_fraud == "fraud"
    assert conf_fraud >= 0.50

