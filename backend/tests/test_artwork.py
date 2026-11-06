import pytest
from fastapi.testclient import TestClient

from app import artwork, config, main

client = TestClient(main.app, base_url="http://127.0.0.1:8000", raise_server_exceptions=False)
HEADERS = {"Content-Type": "application/json", "Host": "127.0.0.1:8000"}


def test_artwork_status_endpoint_default():
    resp = client.get("/api/v1/journey/artwork/status", headers=HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    assert "enabled" in data
    assert "configured" in data
    assert "provider" in data
    assert "cached_images_count" in data
    assert "message" in data
    # By default, without environment variables, AI generation is disabled/unconfigured
    assert data["configured"] is False


def test_artwork_generate_unconfigured_fallback():
    payload = {
        "mission_id": "m01",
        "category": "phishing_advance_fee",
        "threat_type": "Scholarship scam",
        "character": "Sufian",
        "environment": "Dormitory",
        "difficulty": "intermediate",
    }
    resp = client.post("/api/v1/journey/artwork/generate", json=payload, headers=HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    assert data["mission_id"] == "m01"
    assert data["status"] == "unconfigured"
    assert data["is_ai_generated"] is False
    assert data["cached"] is False
    assert data["artwork_url"] == "/images/journey/m01_scholarship_phishing.svg"


def test_artwork_fallback_mapping_core_and_practice():
    # Core missions
    assert artwork.get_fallback_artwork_url("m01", "any") == "/images/journey/m01_scholarship_phishing.svg"
    assert artwork.get_fallback_artwork_url("m02", "any") == "/images/journey/m02_sim_upgrade.svg"
    assert artwork.get_fallback_artwork_url("m03", "any") == "/images/journey/m03_banking_bot.svg"
    assert artwork.get_fallback_artwork_url("m04", "any") == "/images/journey/m04_malicious_apk.svg"

    # Practice missions
    assert artwork.get_fallback_artwork_url("p01", "any") == "/images/journey/p01_fake_job.svg"
    assert artwork.get_fallback_artwork_url("p02", "any") == "/images/journey/p02_password_sync.svg"
    assert artwork.get_fallback_artwork_url("p03", "any") == "/images/journey/p03_qr_phishing.svg"
    assert artwork.get_fallback_artwork_url("p04", "any") == "/images/journey/p04_social_transfer.svg"
    assert artwork.get_fallback_artwork_url("p05", "any") == "/images/journey/p05_data_leak.svg"
    assert artwork.get_fallback_artwork_url("p06", "any") == "/images/journey/p06_compromised_peer.svg"

    # Generated mission ID does not get confused with campaign M01
    assert artwork.get_fallback_artwork_url("gen_m_p01_fake_job_offers", "fake_job_offers") == "/images/journey/p01_fake_job.svg"
    assert artwork.get_fallback_artwork_url("gen_m01_fake_job_offers_beginner", "fake_job_offers") == "/images/journey/p01_fake_job.svg"

    # Category matching
    assert artwork.get_fallback_artwork_url("custom_1", "fake_job_offers") == "/images/journey/p01_fake_job.svg"
    assert artwork.get_fallback_artwork_url("custom_2", "unknown_category", "beginner") == "/images/journey/diff_beginner.svg"
    assert artwork.get_fallback_artwork_url("custom_3", "unknown_category", "unknown_diff") == "/images/journey/practice_adaptive.svg"


def test_artwork_magic_bytes_validation():
    # Valid PNG
    assert artwork.validate_image_bytes(artwork.MOCK_PNG_BYTES) == "png"

    # Valid minimal JPEG magic bytes
    fake_jpeg = b"\xff\xd8\xff\xe0" + b"\x00" * 60
    assert artwork.validate_image_bytes(fake_jpeg) == "jpeg"

    # Valid minimal WebP magic bytes
    fake_webp = b"RIFF\x40\x00\x00\x00WEBPVP8 " + b"\x00" * 50
    assert artwork.validate_image_bytes(fake_webp) == "webp"

    # Corrupt or non-image payloads
    with pytest.raises(ValueError, match="too small"):
        artwork.validate_image_bytes(b"short")

    with pytest.raises(ValueError, match="Untrusted image format"):
        artwork.validate_image_bytes(b"<!DOCTYPE html><html><body><h1>Not an image</h1></body></html>")

    with pytest.raises(ValueError, match="exceeds 5MB limit"):
        artwork.validate_image_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * (5 * 1024 * 1024 + 10))


def test_artwork_generate_mock_provider_and_cache(monkeypatch, tmp_path):
    # Enable mock test provider
    monkeypatch.setattr(config, "AI_ARTWORK_ENABLED", True)
    monkeypatch.setattr(config, "AI_ARTWORK_PROVIDER", "mock_test")
    monkeypatch.setattr(config, "AI_ARTWORK_CACHE_DIR", tmp_path)

    payload = {
        "mission_id": "adaptive_999",
        "category": "phishing_advance_fee",
        "threat_type": "Automated simulated threat",
        "character": "Cyber cadet",
        "environment": "Simulation arena",
        "difficulty": "intermediate",
    }

    # 1. First generation: creates image and saves to cache
    resp1 = client.post("/api/v1/journey/artwork/generate", json=payload, headers=HEADERS)
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert data1["status"] == "available"
    assert data1["is_ai_generated"] is True
    assert data1["cached"] is False
    assert data1["artwork_url"].startswith("/images/journey/cache/")

    # 2. Second generation with identical payload: returns cached result
    resp2 = client.post("/api/v1/journey/artwork/generate", json=payload, headers=HEADERS)
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["status"] == "cached"
    assert data2["is_ai_generated"] is True
    assert data2["cached"] is True
    assert data2["artwork_url"] == data1["artwork_url"]


def test_artwork_generate_rejects_extra_fields():
    # Enforces privacy: raw credentials or unexpected metadata are rejected
    payload = {
        "mission_id": "m01",
        "category": "phishing_advance_fee",
        "sensitive_password": "super_secret_password",
        "user_url": "http://scanned.example.com",
    }
    resp = client.post("/api/v1/journey/artwork/generate", json=payload, headers=HEADERS)
    assert resp.status_code == 400
    err = resp.json()
    assert err["error"]["code"] == "INVALID_REQUEST"
