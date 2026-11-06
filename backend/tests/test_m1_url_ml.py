"""
CyberShield Ethiopia — M1 URL Phishing ML Subsystem Tests
Verifies feature extraction, model inference, metric bounds, and backend API integration.
"""

from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.ml.m1_url_features import (
    URL_FEATURE_NAMES,
    compute_shannon_entropy,
    extract_url_feature_dict,
    extract_url_feature_vector,
    is_ip_address_host,
)
from app.ml.model import SoftmaxClassifier
from app.routes_m1 import get_m1_model


client = TestClient(app, base_url="http://127.0.0.1:8000")


def test_url_shannon_entropy():
    assert compute_shannon_entropy("") == 0.0
    assert compute_shannon_entropy("aaaa") == 0.0
    ent = compute_shannon_entropy("abcdefgh")
    assert ent > 2.5


def test_is_ip_address_host():
    assert is_ip_address_host("192.168.1.1") is True
    assert is_ip_address_host("10.0.0.1") is True
    assert is_ip_address_host("google.com") is False
    assert is_ip_address_host("") is False


def test_extract_url_feature_vector_bounds():
    test_urls = [
        "https://google.com",
        "http://192.0.2.10:8080/cbe/login/verify?token=12345",
        "http://bit.ly/secure-account-update-telebirr",
        "",
        "https://example.com/very/deep/path/structure/with-many-hyphens-and-digits-1234567890",
    ]
    for url in test_urls:
        vec = extract_url_feature_vector(url)
        assert len(vec) == len(URL_FEATURE_NAMES)
        for val in vec:
            assert 0.0 <= val <= 1.0, f"Value {val} out of bounds for URL: {url}"


def test_m1_classifier_loading_and_prediction():
    model = get_m1_model()
    assert model is not None
    assert model.trained is True
    assert model.classes == ["legitimate", "phishing"]
    assert model.num_features == 12

    # High-risk phishing fixture
    phish_url = "http://192.0.2.10:8080/telebirr-account-login-verify-update?id=12345678"
    vec_phish = extract_url_feature_vector(phish_url)
    pred_phish, conf_phish = model.predict(vec_phish)
    probs_phish = model.predict_proba(vec_phish)

    assert pred_phish == "phishing"
    assert probs_phish["phishing"] > 0.50

    # Legitimate fixture
    benign_url = "https://google.com"
    vec_benign = extract_url_feature_vector(benign_url)
    pred_benign, conf_benign = model.predict(vec_benign)
    probs_benign = model.predict_proba(vec_benign)

    assert pred_benign == "legitimate"
    assert probs_benign["legitimate"] > 0.50


def test_m1_ml_predict_api_endpoint():
    response = client.post(
        "/api/v1/m1/ml-predict",
        json={"url": "http://192.0.2.10/cbe-login-verify-account"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["engine"] == "ml_url_lexical_v1"
    assert "predicted_class" in data
    assert "phishing_probability" in data
    assert "confidence" in data
    assert "features" in data
    assert "probabilities" in data
    assert data["predicted_class"] == "phishing"
    assert data["phishing_probability"] >= 0.50
    assert data["confidence"] >= 0.50
    assert data["confidence_calibrated"] is False
    assert "benchmark_metrics" in data
    assert data["benchmark_metrics"]["held_out_accuracy"] == 0.925
