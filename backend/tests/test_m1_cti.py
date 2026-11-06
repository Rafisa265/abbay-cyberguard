import base64
import hashlib
import json
import logging
from unittest.mock import MagicMock, patch
import urllib.error
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import config, main
from app.cti import (
    BaseCTIAdapter,
    CTIResult,
    GoogleSafeBrowsingV5Adapter,
    GoogleWebRiskAdapter,
    MockCTIAdapter,
    LocalFeedCTIAdapter,
    MAX_LOCAL_FEED_FILE_SIZE_BYTES,
    MAX_LOCAL_FEED_RECORDS,
    SUPPORTED_FEED_FORMAT_VERSION,
    ALLOWED_INDICATOR_TYPES,
    canonicalize_url_for_cti,
    get_cti_adapter,
    encode_length_delimited,
    encode_varint_field,
    decode_search_hashes_response,
)

c = TestClient(main.app, base_url="http://127.0.0.1:8000", raise_server_exceptions=False)
J = {"Content-Type": "application/json"}


class TestCanonicalizationAndSafety:
    """Tests for URL canonicalization, scheme validation, and SSRF prevention."""

    def test_canonicalize_valid_urls(self):
        assert canonicalize_url_for_cti("https://example.com") == "https://example.com/"
        assert canonicalize_url_for_cti("http://example.com/path?arg=1#frag") == "http://example.com/path?arg=1"
        assert canonicalize_url_for_cti("HTTPS://EXAMPLE.COM:443/test") == "https://example.com/test"
        assert canonicalize_url_for_cti("http://example.com:80/test") == "http://example.com/test"
        assert canonicalize_url_for_cti("http://example.com:8080/test") == "http://example.com:8080/test"

    def test_strips_userinfo_credentials(self):
        # Crucial security guarantee: passwords and basic auth tokens are stripped before hashing/lookup
        url = "https://admin:supersecret@bank.example.com/transfer?account=123"
        canonical = canonicalize_url_for_cti(url)
        assert "supersecret" not in canonical
        assert "admin@" not in canonical
        assert canonical == "https://bank.example.com/transfer?account=123"

    @pytest.mark.parametrize("invalid_url", [
        "javascript:alert(1)",
        "file:///etc/passwd",
        "data:text/html,<script>alert(1)</script>",
        "ftp://ftp.example.com/resource",
        "blob:https://example.com/uuid",
        "about:blank",
        "not-a-url",
        "http://",
        "https://",
    ])
    def test_rejects_non_http_schemes(self, invalid_url):
        r = c.post("/api/v1/m1/check", json={"url": invalid_url}, headers=J)
        assert r.status_code == 400
        assert r.json()["error"]["code"] == "INVALID_REQUEST"

    def test_rejects_oversized_url(self):
        long_url = "https://example.com/" + "a" * 2050
        r = c.post("/api/v1/m1/check", json={"url": long_url}, headers=J)
        assert r.status_code == 400
        assert r.json()["error"]["code"] == "INVALID_REQUEST"


class TestGoogleSafeBrowsingV5Adapter:
    """Unit tests for Google Safe Browsing API v5 adapter logic."""

    def test_unconfigured_without_api_key(self):
        adapter = GoogleSafeBrowsingV5Adapter(api_key="")
        assert not adapter.is_configured()
        res = adapter.check_url("https://example.com/")
        assert res.status == "unavailable"
        assert res.unavailable_reason == "CONFIG_MISSING"
        assert res.threat_types == []

    def test_known_malicious_match(self):
        target_url = "http://malware.testing.example.com/bad"
        canonical = canonicalize_url_for_cti(target_url)
        full_hash = hashlib.sha256(canonical.encode("utf-8")).digest()
        full_hash_b64 = base64.b64encode(full_hash).decode("ascii")

        # Mock API v5 response containing matching full hash
        mock_response_data = {
            "fullHashes": [
                {
                    "fullHash": full_hash_b64,
                    "details": [{"threatType": "MALWARE"}, {"threatType": "SOCIAL_ENGINEERING"}],
                }
            ]
        }

        adapter = GoogleSafeBrowsingV5Adapter(api_key="fake_test_key_noncommercial")
        mock_resp = MagicMock()
        mock_resp.__enter__.return_value = mock_resp
        mock_resp.status = 200
        mock_resp.headers = {"Content-Type": "application/json"}
        mock_resp.read.return_value = json.dumps(mock_response_data).encode("utf-8")

        with patch("urllib.request.urlopen", return_value=mock_resp):
            res = adapter.check_url(canonical)
            assert res.status == "known_malicious"
            assert "MALWARE" in res.threat_types
            assert "SOCIAL_ENGINEERING" in res.threat_types
            assert res.unavailable_reason is None

    def test_no_threat_found_clean_url(self):
        target_url = "https://clean.example.com/"
        canonical = canonicalize_url_for_cti(target_url)

        # Mock response with no matching full hashes
        mock_response_data = {"fullHashes": []}

        adapter = GoogleSafeBrowsingV5Adapter(api_key="fake_test_key_noncommercial")
        mock_resp = MagicMock()
        mock_resp.__enter__.return_value = mock_resp
        mock_resp.status = 200
        mock_resp.headers = {"Content-Type": "application/json"}
        mock_resp.read.return_value = json.dumps(mock_response_data).encode("utf-8")

        with patch("urllib.request.urlopen", return_value=mock_resp):
            res = adapter.check_url(canonical)
            assert res.status == "no_threat_found"
            assert res.threat_types == []
            assert res.unavailable_reason is None

    def test_timeout_handling(self):
        adapter = GoogleSafeBrowsingV5Adapter(api_key="fake_test_key_noncommercial")
        with patch("urllib.request.urlopen", side_effect=TimeoutError("Request timed out")):
            res = adapter.check_url("https://example.com/")
            assert res.status == "unavailable"
            assert res.unavailable_reason == "TIMEOUT"

    def test_rate_limiting_handling(self):
        adapter = GoogleSafeBrowsingV5Adapter(api_key="fake_test_key_noncommercial")
        http_err = urllib.error.HTTPError("url", 429, "Too Many Requests", {}, None)
        with patch("urllib.request.urlopen", side_effect=http_err):
            res = adapter.check_url("https://example.com/")
            assert res.status == "unavailable"
            assert res.unavailable_reason == "RATE_LIMITED"

    def test_server_error_handling(self):
        adapter = GoogleSafeBrowsingV5Adapter(api_key="fake_test_key_noncommercial")
        http_err = urllib.error.HTTPError("url", 503, "Service Unavailable", {}, None)
        with patch("urllib.request.urlopen", side_effect=http_err):
            res = adapter.check_url("https://example.com/")
            assert res.status == "unavailable"
            assert res.unavailable_reason == "PROVIDER_ERROR"

    def test_malformed_json_response(self):
        adapter = GoogleSafeBrowsingV5Adapter(api_key="fake_test_key_noncommercial")
        mock_resp = MagicMock()
        mock_resp.__enter__.return_value = mock_resp
        mock_resp.status = 200
        mock_resp.headers = {"Content-Type": "application/json"}
        mock_resp.read.return_value = b"<!DOCTYPE html><html>Bad gateway</html>"
        with patch("urllib.request.urlopen", return_value=mock_resp):
            res = adapter.check_url("https://example.com/")
            assert res.status == "unavailable"
            assert res.unavailable_reason == "PROVIDER_ERROR"

    def test_protobuf_known_malicious_match(self):
        target_url = "http://malware.testing.example.com/bad"
        canonical = canonicalize_url_for_cti(target_url)
        full_hash_bytes = hashlib.sha256(canonical.encode("utf-8")).digest()

        # Build official Safe Browsing v5 protobuf message
        detail_malware = encode_varint_field(1, 1)  # MALWARE
        detail_social = encode_varint_field(1, 2)   # SOCIAL_ENGINEERING
        fh_payload = (
            encode_length_delimited(1, full_hash_bytes) +
            encode_length_delimited(2, detail_malware) +
            encode_length_delimited(2, detail_social)
        )
        duration_payload = encode_varint_field(1, 300)  # 300s
        proto_body = (
            encode_length_delimited(1, fh_payload) +
            encode_length_delimited(2, duration_payload)
        )

        adapter = GoogleSafeBrowsingV5Adapter(api_key="fake_test_key_noncommercial")
        mock_resp = MagicMock()
        mock_resp.__enter__.return_value = mock_resp
        mock_resp.status = 200
        mock_resp.headers = {"Content-Type": "application/x-protobuf"}
        mock_resp.read.return_value = proto_body

        with patch("urllib.request.urlopen", return_value=mock_resp):
            res = adapter.check_url(canonical)
            assert res.status == "known_malicious"
            assert "MALWARE" in res.threat_types
            assert "SOCIAL_ENGINEERING" in res.threat_types
            assert res.unavailable_reason is None

    def test_protobuf_no_threat_found_clean_url(self):
        target_url = "https://clean.example.com/"
        canonical = canonicalize_url_for_cti(target_url)

        # 5-byte official response with cacheDuration=300s, zero full hashes
        proto_body = b"\x12\x03\x08\xac\x02"

        adapter = GoogleSafeBrowsingV5Adapter(api_key="fake_test_key_noncommercial")
        mock_resp = MagicMock()
        mock_resp.__enter__.return_value = mock_resp
        mock_resp.status = 200
        mock_resp.headers = {"Content-Type": "application/x-protobuf"}
        mock_resp.read.return_value = proto_body

        with patch("urllib.request.urlopen", return_value=mock_resp):
            res = adapter.check_url(canonical)
            assert res.status == "no_threat_found"
            assert res.threat_types == []
            assert res.unavailable_reason is None

    def test_protobuf_empty_body(self):
        adapter = GoogleSafeBrowsingV5Adapter(api_key="fake_test_key_noncommercial")
        mock_resp = MagicMock()
        mock_resp.__enter__.return_value = mock_resp
        mock_resp.status = 200
        mock_resp.headers = {"Content-Type": "application/x-protobuf"}
        mock_resp.read.return_value = b""

        with patch("urllib.request.urlopen", return_value=mock_resp):
            res = adapter.check_url("https://example.com/")
            assert res.status == "no_threat_found"
            assert res.threat_types == []
            assert res.unavailable_reason is None

    def test_protobuf_malformed_payload(self):
        adapter = GoogleSafeBrowsingV5Adapter(api_key="fake_test_key_noncommercial")
        mock_resp = MagicMock()
        mock_resp.__enter__.return_value = mock_resp
        mock_resp.status = 200
        mock_resp.headers = {"Content-Type": "application/x-protobuf"}
        mock_resp.read.return_value = b"\x12\x05\x08\xac"  # truncated protobuf

        with patch("urllib.request.urlopen", return_value=mock_resp):
            res = adapter.check_url("https://example.com/")
            assert res.status == "unavailable"
            assert res.unavailable_reason == "PROVIDER_ERROR"
            assert "malformed" in res.details.lower()

    def test_unexpected_content_type_html(self):
        adapter = GoogleSafeBrowsingV5Adapter(api_key="fake_test_key_noncommercial")
        mock_resp = MagicMock()
        mock_resp.__enter__.return_value = mock_resp
        mock_resp.status = 200
        mock_resp.headers = {"Content-Type": "text/html; charset=utf-8"}
        mock_resp.read.return_value = b"<!DOCTYPE html><html><body>Blocked</body></html>"

        with patch("urllib.request.urlopen", return_value=mock_resp):
            res = adapter.check_url("https://example.com/")
            assert res.status == "unavailable"
            assert res.unavailable_reason == "PROVIDER_ERROR"
            assert "content type" in res.details.lower()

    def test_authentication_error_401(self):
        adapter = GoogleSafeBrowsingV5Adapter(api_key="fake_test_key_noncommercial")
        http_err = urllib.error.HTTPError("url", 401, "Unauthorized", {}, None)
        with patch("urllib.request.urlopen", side_effect=http_err):
            res = adapter.check_url("https://example.com/")
            assert res.status == "unavailable"
            assert res.unavailable_reason == "PROVIDER_ERROR"
            assert "authentication" in res.details.lower()

    def test_authentication_error_403(self):
        adapter = GoogleSafeBrowsingV5Adapter(api_key="fake_test_key_noncommercial")
        http_err = urllib.error.HTTPError("url", 403, "Forbidden", {}, None)
        with patch("urllib.request.urlopen", side_effect=http_err):
            res = adapter.check_url("https://example.com/")
            assert res.status == "unavailable"
            assert res.unavailable_reason == "PROVIDER_ERROR"
            assert "authentication" in res.details.lower()

    def test_forward_compatibility_unknown_threat_type(self):
        target_url = "http://unknown.threat.example.com/"
        canonical = canonicalize_url_for_cti(target_url)
        full_hash_bytes = hashlib.sha256(canonical.encode("utf-8")).digest()

        # ThreatType=999 (future/unknown)
        detail_unknown = encode_varint_field(1, 999)
        fh_payload = (
            encode_length_delimited(1, full_hash_bytes) +
            encode_length_delimited(2, detail_unknown)
        )
        proto_body = encode_length_delimited(1, fh_payload)

        adapter = GoogleSafeBrowsingV5Adapter(api_key="fake_test_key_noncommercial")
        mock_resp = MagicMock()
        mock_resp.__enter__.return_value = mock_resp
        mock_resp.status = 200
        mock_resp.headers = {"Content-Type": "application/x-protobuf"}
        mock_resp.read.return_value = proto_body

        with patch("urllib.request.urlopen", return_value=mock_resp):
            res = adapter.check_url(canonical)
            # Per Google spec: unknown threat types are ignored forward-compatibly
            assert res.status == "no_threat_found"
            assert res.threat_types == []
            assert res.unavailable_reason is None


class TestM1ApiEndpoints:
    """Integration tests for /api/v1/m1/check and /api/v1/m1/status."""

    def test_m1_status_endpoint(self):
        r = c.get("/api/v1/m1/status")
        assert r.status_code == 200
        body = r.json()
        assert "provider" in body
        assert "configured" in body
        assert body["educational_prototype"] is True
        assert "commercial_alternative" not in body
        # Guarantee: No API keys are leaked in status
        assert "key" not in body and "api_key" not in body

    def test_web_risk_placeholder_never_reports_clean(self):
        adapter = GoogleWebRiskAdapter()
        assert not adapter.is_configured()
        result = adapter.check_url("https://example.com/")
        assert result.status == "unavailable"
        assert result.unavailable_reason == "PROVIDER_ERROR"
        assert "not implemented" in result.details.lower()

    def test_check_with_mock_malicious_fixture(self, monkeypatch):
        monkeypatch.setattr(config, "CTI_PROVIDER", "mock")
        r = c.post("/api/v1/m1/check", json={"url": "http://malware.testing.cybershield.et/"}, headers=J)
        assert r.status_code == 200
        data = r.json()
        assert data["url"] == "http://malware.testing.cybershield.et/"
        assert data["cti"]["status"] == "known_malicious"
        assert "MALWARE" in data["cti"]["threat_types"]
        assert data["cti"]["source"] == "cti_provider"

    def test_check_with_mock_clean_fixture(self, monkeypatch):
        monkeypatch.setattr(config, "CTI_PROVIDER", "mock")
        r = c.post("/api/v1/m1/check", json={"url": "https://example.com/safe/page"}, headers=J)
        assert r.status_code == 200
        data = r.json()
        assert data["cti"]["status"] == "no_threat_found"
        assert data["cti"]["threat_types"] == []
        assert data["cti"]["unavailable_reason"] is None

    def test_check_with_mock_simulated_timeout(self, monkeypatch):
        monkeypatch.setattr(config, "CTI_PROVIDER", "mock")
        with patch.object(MockCTIAdapter, "check_url", return_value=CTIResult(
            provider="mock_cti",
            status="unavailable",
            unavailable_reason="TIMEOUT",
            details="Mock request timed out.",
        )):
            r = c.post("/api/v1/m1/check", json={"url": "https://example.com/"}, headers=J)
            assert r.status_code == 200
            data = r.json()
            assert data["cti"]["status"] == "unavailable"
            assert data["cti"]["unavailable_reason"] == "TIMEOUT"

    def test_no_secrets_in_check_response(self, monkeypatch):
        monkeypatch.setattr(config, "CTI_API_KEY", "SECRET_CANARY_API_KEY_12345")
        r = c.post("/api/v1/m1/check", json={"url": "https://example.com/"}, headers=J)
        assert r.status_code == 200
        assert "SECRET_CANARY_API_KEY_12345" not in r.text

    def test_m1_log_hygiene(self, caplog):
        caplog.set_level(logging.DEBUG)
        c.post("/api/v1/m1/check", json={"url": "https://example.com/query?token=CANARY_M1_TOKEN"}, headers=J)
        server_logs = [r.getMessage() for r in caplog.records if not r.name.startswith(("httpx", "httpcore"))]
        assert server_logs and not any("CANARY_M1_TOKEN" in m for m in server_logs)


class TestLocalFeedCTIAdapter:
    """Comprehensive test suite for LocalFeedCTIAdapter."""

    def test_missing_feed_file_returns_unavailable(self, tmp_path):
        feed_file = tmp_path / "non_existent_feed.json"
        adapter = LocalFeedCTIAdapter(feed_path=str(feed_file))
        assert not adapter.is_configured()

        res = adapter.check_url("https://example.com/")
        assert res.status == "unavailable"
        assert res.unavailable_reason == "FEED_MISSING"
        assert res.threat_types == []
        assert res.source == "local_database"
        assert res.checked_at is not None

    def test_empty_feed_file_returns_unavailable(self, tmp_path):
        feed_file = tmp_path / "empty_feed.json"
        feed_file.write_text("", encoding="utf-8")
        adapter = LocalFeedCTIAdapter(feed_path=str(feed_file))
        assert not adapter.is_configured()

        res = adapter.check_url("https://example.com/")
        assert res.status == "unavailable"
        assert res.unavailable_reason == "FEED_EMPTY"

    def test_malformed_json_returns_unavailable(self, tmp_path):
        feed_file = tmp_path / "corrupted_feed.json"
        feed_file.write_text("{not valid json", encoding="utf-8")
        adapter = LocalFeedCTIAdapter(feed_path=str(feed_file))
        assert not adapter.is_configured()

        res = adapter.check_url("https://example.com/")
        assert res.status == "unavailable"
        assert res.unavailable_reason == "FEED_MALFORMED"

    def test_feed_without_records_returns_unavailable(self, tmp_path):
        feed_file = tmp_path / "no_records.json"
        feed_file.write_text(json.dumps({"feed_format_version": "1.0", "records": []}), encoding="utf-8")
        adapter = LocalFeedCTIAdapter(feed_path=str(feed_file))
        assert not adapter.is_configured()

        res = adapter.check_url("https://example.com/")
        assert res.status == "unavailable"
        assert res.unavailable_reason == "FEED_EMPTY"

    def test_valid_feed_url_and_domain_matches(self, tmp_path):
        feed_data = {
            "feed_format_version": "1.0",
            "feed_name": "Test Local Threat Feed",
            "feed_updated_at": "2026-10-23T06:00:00Z",
            "source": "admin_test",
            "records": [
                {
                    "type": "url",
                    "target": "http://malware.testing.example.com/payload.exe",
                    "threat_type": "MALWARE",
                },
                {
                    "type": "domain",
                    "target": "phishing.testing.example.com",
                    "threat_type": "SOCIAL_ENGINEERING",
                },
                {
                    "type": "domain",
                    "target": "c2.testing.example.com",
                    "threat_type": "MALWARE",
                },
            ],
        }
        feed_file = tmp_path / "valid_threat_feed.json"
        feed_file.write_text(json.dumps(feed_data), encoding="utf-8")

        adapter = LocalFeedCTIAdapter(feed_path=str(feed_file))
        assert adapter.is_configured()

        # 1. Exact URL match
        res_url = adapter.check_url("http://malware.testing.example.com/payload.exe")
        assert res_url.status == "known_malicious"
        assert "MALWARE" in res_url.threat_types
        assert res_url.source == "local_database"
        assert res_url.feed_updated_at == "2026-10-23T06:00:00Z"
        assert res_url.checked_at is not None

        # 2. Domain match
        res_domain = adapter.check_url("https://phishing.testing.example.com/login?id=1")
        assert res_domain.status == "known_malicious"
        assert "SOCIAL_ENGINEERING" in res_domain.threat_types
        assert res_domain.source == "local_database"

        # 3. Clean URL (no match)
        res_clean = adapter.check_url("https://clean.example.com/")
        assert res_clean.status == "no_threat_found"
        assert res_clean.threat_types == []
        assert res_clean.source == "local_database"
        assert res_clean.feed_updated_at == "2026-10-23T06:00:00Z"

    def test_feed_lookup_never_makes_network_calls(self, tmp_path, monkeypatch):
        feed_data = {
            "feed_format_version": "1.0",
            "feed_updated_at": "2026-10-23T06:00:00Z",
            "records": [{"type": "domain", "target": "bad.test", "threat_type": "MALWARE"}],
        }
        feed_file = tmp_path / "feed.json"
        feed_file.write_text(json.dumps(feed_data), encoding="utf-8")

        # Mock urllib.request.urlopen to fail loudly if network is attempted
        def guard_network(*args, **kwargs):
            raise AssertionError("Network call attempted during local feed check!")

        monkeypatch.setattr(urllib.request, "urlopen", guard_network)

        adapter = LocalFeedCTIAdapter(feed_path=str(feed_file))
        res = adapter.check_url("https://bad.test/page")
        assert res.status == "known_malicious"

        res_clean = adapter.check_url("https://safe.test/page")
        assert res_clean.status == "no_threat_found"

    def test_auto_provider_selection(self, tmp_path, monkeypatch):
        # When local feed exists and is valid -> get_cti_adapter("auto") selects local_feed
        feed_data = {
            "feed_format_version": "1.0",
            "records": [{"type": "domain", "target": "bad.test", "threat_type": "MALWARE"}],
        }
        feed_file = tmp_path / "feed.json"
        feed_file.write_text(json.dumps(feed_data), encoding="utf-8")

        monkeypatch.setattr(config, "CTI_LOCAL_FEED_PATH", str(feed_file))
        adapter = get_cti_adapter("auto")
        assert adapter.name == "local_feed"
        assert adapter.is_configured()

        # When feed is missing -> falls back to GoogleSafeBrowsingV5Adapter
        monkeypatch.setattr(config, "CTI_LOCAL_FEED_PATH", str(tmp_path / "absent.json"))
        fallback_adapter = get_cti_adapter("auto")
        assert fallback_adapter.name == "google_safe_browsing_v5"

    def test_api_check_endpoint_with_local_feed(self, tmp_path, monkeypatch):
        feed_data = {
            "feed_format_version": "1.0",
            "feed_updated_at": "2026-10-23T07:00:00Z",
            "records": [{"type": "url", "target": "https://threat.test/login", "threat_type": "SOCIAL_ENGINEERING"}],
        }
        feed_file = tmp_path / "api_feed.json"
        feed_file.write_text(json.dumps(feed_data), encoding="utf-8")

        monkeypatch.setattr(config, "CTI_LOCAL_FEED_PATH", str(feed_file))
        monkeypatch.setattr(config, "CTI_PROVIDER", "local_feed")

        # 1. Malicious match
        r = c.post("/api/v1/m1/check", json={"url": "https://threat.test/login"}, headers=J)
        assert r.status_code == 200
        data = r.json()
        assert data["cti"]["status"] == "known_malicious"
        assert data["cti"]["source"] == "local_database"
        assert data["cti"]["threat_types"] == ["SOCIAL_ENGINEERING"]
        assert data["cti"]["feed_updated_at"] == "2026-10-23T07:00:00Z"
        assert data["cti"]["checked_at"] is not None

        # 2. Clean URL
        r_clean = c.post("/api/v1/m1/check", json={"url": "https://harmless.test/about"}, headers=J)
        assert r_clean.status_code == 200
        data_clean = r_clean.json()
        assert data_clean["cti"]["status"] == "no_threat_found"
        assert data_clean["cti"]["threat_types"] == []
        assert data_clean["cti"]["source"] == "local_database"

    def test_safe_domain_boundary_and_subdomain_matching(self, tmp_path):
        feed_data = {
            "feed_format_version": "1.0",
            "feed_name": "Boundary Test Feed",
            "feed_updated_at": "2026-10-23T08:00:00Z",
            "records": [
                {"type": "domain", "target": "malicious-bank.testing", "threat_type": "SOCIAL_ENGINEERING"},
                {"type": "domain", "target": "bad-host.testing", "threat_type": "MALWARE"},
            ],
        }
        feed_file = tmp_path / "boundary_feed.json"
        feed_file.write_text(json.dumps(feed_data), encoding="utf-8")

        adapter = LocalFeedCTIAdapter(feed_path=str(feed_file))
        assert adapter.is_configured()

        # Exact domain match
        res_exact = adapter.check_url("https://malicious-bank.testing/login")
        assert res_exact.status == "known_malicious"
        assert "SOCIAL_ENGINEERING" in res_exact.threat_types

        # Valid subdomain on '.' boundary must match
        res_sub = adapter.check_url("https://secure.login.malicious-bank.testing/auth")
        assert res_sub.status == "known_malicious"
        assert "SOCIAL_ENGINEERING" in res_sub.threat_types

        # Substring collision (different domain containing same string) MUST NOT MATCH
        res_collision = adapter.check_url("https://notmalicious-bank.testing/login")
        assert res_collision.status == "no_threat_found"

        res_collision2 = adapter.check_url("https://malicious-bank.testing.legitdomain.com/login")
        assert res_collision2.status == "no_threat_found"

        res_collision3 = adapter.check_url("https://mybad-host.testing/")
        assert res_collision3.status == "no_threat_found"

    def test_feed_reload_failure_clears_stale_cache_and_returns_unavailable(self, tmp_path):
        feed_file = tmp_path / "dynamic_feed.json"
        valid_feed = {
            "feed_format_version": "1.0",
            "feed_updated_at": "2026-10-23T08:00:00Z",
            "records": [{"type": "domain", "target": "stale-check.testing", "threat_type": "MALWARE"}],
        }
        feed_file.write_text(json.dumps(valid_feed), encoding="utf-8")

        adapter = LocalFeedCTIAdapter(feed_path=str(feed_file))
        assert adapter.is_configured()

        # Step 1: Initial load returns malicious match
        r1 = adapter.check_url("https://stale-check.testing/")
        assert r1.status == "known_malicious"

        # Step 2: Feed file becomes malformed (e.g., interrupted sync or corruption)
        feed_file.write_text("{ malformed json", encoding="utf-8")
        r2 = adapter.check_url("https://stale-check.testing/")
        assert r2.status == "unavailable"
        assert r2.unavailable_reason == "FEED_MALFORMED"
        assert r2.threat_types == []

        # Step 3: Feed file becomes empty (0 bytes)
        feed_file.write_text("", encoding="utf-8")
        r3 = adapter.check_url("https://stale-check.testing/")
        assert r3.status == "unavailable"
        assert r3.unavailable_reason == "FEED_EMPTY"

        # Step 4: Feed file is deleted entirely
        feed_file.unlink()
        r4 = adapter.check_url("https://stale-check.testing/")
        assert r4.status == "unavailable"
        assert r4.unavailable_reason == "FEED_MISSING"

    def test_feed_unreadable_os_error_handling(self, tmp_path, monkeypatch):
        feed_file = tmp_path / "unreadable_feed.json"
        feed_file.write_text(json.dumps({"feed_format_version": "1.0", "records": [{"type": "domain", "target": "x.test"}]}), encoding="utf-8")

        adapter = LocalFeedCTIAdapter(feed_path=str(feed_file))

        def raise_permission_error(*args, **kwargs):
            raise PermissionError("Access denied")

        monkeypatch.setattr(Path, "read_text", raise_permission_error)
        res = adapter.check_url("https://x.test/")
        assert res.status == "unavailable"
        assert res.unavailable_reason == "FEED_UNREADABLE"

    def test_threat_feed_template_returns_unavailable_feed_empty(self):
        # Verify the actual template JSON shipped in backend/app/data/
        template_path = Path(__file__).resolve().parents[1] / "app" / "data" / "threat_feed.template.json"
        assert template_path.is_file(), f"Template file not found at: {template_path}"

        adapter = LocalFeedCTIAdapter(feed_path=str(template_path))
        # Template has 0 threat records by design; must not be considered configured
        assert not adapter.is_configured()

        # Looking up any URL against the structural template MUST return unavailable with FEED_EMPTY
        res = adapter.check_url("https://example.com/test")
        assert res.status == "unavailable"
        assert res.unavailable_reason == "FEED_EMPTY"
        assert "no threat records" in res.details.lower()
        # Crucially: it must NEVER report no_threat_found or known_malicious
        assert res.status != "no_threat_found"
        assert res.status != "known_malicious"

    def test_mixed_case_normalization_and_matching(self, tmp_path):
        feed_data = {
            "feed_format_version": "1.0",
            "feed_updated_at": "2026-10-24T00:00:00Z",
            "records": [
                {
                    "type": "url",
                    "target": "HTTPS://MALWARE.TESTING.EXAMPLE.COM:443/Payload.exe",
                    "threat_type": "MALWARE",
                },
                {
                    "type": "domain",
                    "target": "PHISHING.Testing.EXAMPLE.COM",
                    "threat_type": "SOCIAL_ENGINEERING",
                },
            ],
        }
        feed_file = tmp_path / "mixed_case_feed.json"
        feed_file.write_text(json.dumps(feed_data), encoding="utf-8")

        adapter = LocalFeedCTIAdapter(feed_path=str(feed_file))
        assert adapter.is_configured()

        # 1. Lowercase scheme & host matches indexed uppercase target
        res1 = adapter.check_url("https://malware.testing.example.com/Payload.exe")
        assert res1.status == "known_malicious"
        assert "MALWARE" in res1.threat_types

        # 2. Uppercase lookup scheme & host matches
        res2 = adapter.check_url("HTTPS://MALWARE.TESTING.EXAMPLE.COM/Payload.exe")
        assert res2.status == "known_malicious"

        # 3. Mixed-case subdomain lookup matches domain target
        res3 = adapter.check_url("https://Login.PHISHING.testing.example.com/auth")
        assert res3.status == "known_malicious"
        assert "SOCIAL_ENGINEERING" in res3.threat_types

        # 4. Path casing sensitivity preserved per RFC 3986
        res4 = adapter.check_url("https://malware.testing.example.com/payload.exe")
        assert res4.status == "no_threat_found"

    def test_utf8_bom_handling(self, tmp_path):
        feed_data = {
            "feed_format_version": "1.0",
            "feed_name": "BOM Test Feed",
            "records": [
                {"type": "domain", "target": "bom-malware.testing", "threat_type": "MALWARE"}
            ],
        }
        raw_json_bytes = json.dumps(feed_data).encode("utf-8")
        # Prepend UTF-8 BOM byte sequence (\xef\xbb\xbf)
        bom_payload = b"\xef\xbb\xbf" + raw_json_bytes

        feed_file = tmp_path / "feed_with_bom.json"
        feed_file.write_bytes(bom_payload)

        adapter = LocalFeedCTIAdapter(feed_path=str(feed_file))
        assert adapter.is_configured()

        res = adapter.check_url("https://bom-malware.testing/landing")
        assert res.status == "known_malicious"
        assert "MALWARE" in res.threat_types

    def test_invalid_record_shapes_safely_skipped(self, tmp_path):
        feed_data = {
            "feed_format_version": "1.0",
            "records": [
                None,
                12345,
                "not-a-dictionary",
                [],
                {},  # empty dict
                {"type": "domain"},  # missing target
                {"type": "domain", "target": ""},  # empty string target
                {"type": "domain", "target": "   "},  # whitespace target
                {"type": "domain", "target": "com"},  # root TLD (lacks dot)
                {"type": "domain", "target": "bad domain.test"},  # contains space
                {"type": "domain", "target": "bad:domain.test"},  # contains colon
                {"type": "domain", "target": "user@bad.test"},  # contains at-sign
                {"type": "url", "target": "ftp://malicious.test/file.sh"},  # non-http/https
                {"type": "url", "target": "javascript:alert(1)"},  # invalid scheme
                # Exactly one valid record
                {"type": "domain", "target": "valid-threat.testing", "threat_type": "MALWARE"},
            ],
        }
        feed_file = tmp_path / "mixed_invalid_feed.json"
        feed_file.write_text(json.dumps(feed_data), encoding="utf-8")

        adapter = LocalFeedCTIAdapter(feed_path=str(feed_file))
        assert adapter.is_configured()

        # Valid record must match
        res_valid = adapter.check_url("https://valid-threat.testing/")
        assert res_valid.status == "known_malicious"

        # Invalid/skipped items must not cause matches
        res_tld = adapter.check_url("https://com/")
        assert res_tld.status == "no_threat_found"

    def test_feed_with_only_invalid_records_returns_unavailable_feed_empty(self, tmp_path):
        feed_data = {
            "feed_format_version": "1.0",
            "records": [
                {"type": "domain", "target": "com"},
                {"type": "url", "target": "ftp://bad.test/file"},
                {"type": "domain", "target": "invalid space.test"},
                {"type": "invalid_type", "target": "evil.test"},
            ],
        }
        feed_file = tmp_path / "all_invalid_feed.json"
        feed_file.write_text(json.dumps(feed_data), encoding="utf-8")

        adapter = LocalFeedCTIAdapter(feed_path=str(feed_file))
        assert not adapter.is_configured()

        res = adapter.check_url("https://evil.test/")
        assert res.status == "unavailable"
        assert res.unavailable_reason == "FEED_EMPTY"
        assert "zero valid threat records" in res.details.lower()

    def test_unsupported_feed_format_version_returns_unavailable(self, tmp_path):
        feed_data = {
            "feed_format_version": "2.0",  # unsupported future version
            "records": [
                {"type": "domain", "target": "bad.test", "threat_type": "MALWARE"}
            ],
        }
        feed_file = tmp_path / "unsupported_version_feed.json"
        feed_file.write_text(json.dumps(feed_data), encoding="utf-8")

        adapter = LocalFeedCTIAdapter(feed_path=str(feed_file))
        assert not adapter.is_configured()

        res = adapter.check_url("https://bad.test/")
        assert res.status == "unavailable"
        assert res.unavailable_reason == "FEED_MALFORMED"
        assert "unsupported feed format version" in res.details.lower()

    def test_unknown_indicator_types_safely_skipped(self, tmp_path):
        feed_data = {
            "feed_format_version": "1.0",
            "records": [
                {"type": "ip_address", "target": "192.0.2.1", "threat_type": "MALWARE"},
                {"type": "file_hash", "target": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"},
                {"type": "cve", "target": "CVE-2026-1234"},
                {"type": "domain", "target": "known-bad.testing", "threat_type": "MALWARE"},
            ],
        }
        feed_file = tmp_path / "unknown_types_feed.json"
        feed_file.write_text(json.dumps(feed_data), encoding="utf-8")

        adapter = LocalFeedCTIAdapter(feed_path=str(feed_file))
        assert adapter.is_configured()

        res_known = adapter.check_url("https://known-bad.testing/")
        assert res_known.status == "known_malicious"

        # IP address or unsupported indicators must not be indexed as domain
        res_ip = adapter.check_url("http://192.0.2.1/")
        assert res_ip.status == "no_threat_found"

    def test_duplicate_targets_and_threat_type_merging(self, tmp_path):
        feed_data = {
            "feed_format_version": "1.0",
            "records": [
                {"type": "domain", "target": "multi-threat.testing", "threat_type": "MALWARE"},
                {"type": "domain", "target": "multi-threat.testing", "threat_type": "SOCIAL_ENGINEERING"},
                {"type": "domain", "target": "multi-threat.testing", "threat_type": "MALWARE"},  # duplicate
                {"type": "url", "target": "https://threat-site.testing/page", "threat_type": "UNWANTED_SOFTWARE"},
                {"type": "url", "target": "https://threat-site.testing/page", "threat_type": "MALWARE"},
            ],
        }
        feed_file = tmp_path / "dedup_feed.json"
        feed_file.write_text(json.dumps(feed_data), encoding="utf-8")

        adapter = LocalFeedCTIAdapter(feed_path=str(feed_file))
        assert adapter.is_configured()

        res_domain = adapter.check_url("https://multi-threat.testing/login")
        assert res_domain.status == "known_malicious"
        assert sorted(res_domain.threat_types) == ["MALWARE", "SOCIAL_ENGINEERING"]

        res_url = adapter.check_url("https://threat-site.testing/page")
        assert res_url.status == "known_malicious"
        assert sorted(res_url.threat_types) == ["MALWARE", "UNWANTED_SOFTWARE"]

    def test_query_parameter_matching_semantics(self, tmp_path):
        feed_data = {
            "feed_format_version": "1.0",
            "records": [
                # 1. Path-only URL indicator
                {"type": "url", "target": "https://target-hub.testing/download", "threat_type": "MALWARE"},
                # 2. Exact URL with query parameters
                {"type": "url", "target": "https://target-hub.testing/search?q=bad&filter=1", "threat_type": "SOCIAL_ENGINEERING"},
                # 3. Domain indicator
                {"type": "domain", "target": "domain-threat.testing", "threat_type": "MALWARE"},
            ],
        }
        feed_file = tmp_path / "query_feed.json"
        feed_file.write_text(json.dumps(feed_data), encoding="utf-8")

        adapter = LocalFeedCTIAdapter(feed_path=str(feed_file))
        assert adapter.is_configured()

        # Exact URL with identical query string matches Tier 1
        res_exact = adapter.check_url("https://target-hub.testing/search?q=bad&filter=1")
        assert res_exact.status == "known_malicious"
        assert "SOCIAL_ENGINEERING" in res_exact.threat_types

        # Path-only URL in feed matches any query parameters via Tier 2
        res_path_with_query = adapter.check_url("https://target-hub.testing/download?ref=email&id=999")
        assert res_path_with_query.status == "known_malicious"
        assert "MALWARE" in res_path_with_query.threat_types

        # Domain in feed matches any path and arbitrary query string via Tier 3
        res_domain_query = adapter.check_url("https://domain-threat.testing/auth/step2?session=123&action=steal")
        assert res_domain_query.status == "known_malicious"
        assert "MALWARE" in res_domain_query.threat_types

    def test_feed_updated_at_metadata_handling(self, tmp_path):
        # 1. Valid ISO timestamp
        feed_file = tmp_path / "timestamp_feed.json"
        feed_file.write_text(json.dumps({
            "feed_format_version": "1.0",
            "feed_updated_at": "2026-10-24T18:30:00Z",
            "records": [{"type": "domain", "target": "ts.testing", "threat_type": "MALWARE"}],
        }), encoding="utf-8")

        adapter = LocalFeedCTIAdapter(feed_path=str(feed_file))
        res = adapter.check_url("https://ts.testing/")
        assert res.feed_updated_at == "2026-10-24T18:30:00Z"

        # 2. Missing feed_updated_at does not crash
        feed_file2 = tmp_path / "no_timestamp_feed.json"
        feed_file2.write_text(json.dumps({
            "feed_format_version": "1.0",
            "records": [{"type": "domain", "target": "ts2.testing", "threat_type": "MALWARE"}],
        }), encoding="utf-8")

        adapter2 = LocalFeedCTIAdapter(feed_path=str(feed_file2))
        res2 = adapter2.check_url("https://ts2.testing/")
        assert res2.feed_updated_at == ""

        # 3. Non-string feed_updated_at (e.g. integer or null) is handled safely
        feed_file3 = tmp_path / "int_timestamp_feed.json"
        feed_file3.write_text(json.dumps({
            "feed_format_version": "1.0",
            "feed_updated_at": 1792886400,
            "records": [{"type": "domain", "target": "ts3.testing", "threat_type": "MALWARE"}],
        }), encoding="utf-8")

        adapter3 = LocalFeedCTIAdapter(feed_path=str(feed_file3))
        res3 = adapter3.check_url("https://ts3.testing/")
        assert res3.feed_updated_at == "1792886400"

    def test_bounded_feed_file_size_limit(self, tmp_path, monkeypatch):
        feed_file = tmp_path / "oversized_feed.json"
        feed_file.write_text(json.dumps({
            "feed_format_version": "1.0",
            "records": [{"type": "domain", "target": "oversized.testing", "threat_type": "MALWARE"}],
        }), encoding="utf-8")

        # Mock stat().st_size to exceed MAX_LOCAL_FEED_FILE_SIZE_BYTES without creating huge file
        real_stat = Path.stat

        def mock_stat(self_path):
            st = real_stat(self_path)
            if self_path.name == "oversized_feed.json":
                mock_st = MagicMock()
                mock_st.st_mtime = st.st_mtime
                mock_st.st_size = MAX_LOCAL_FEED_FILE_SIZE_BYTES + 1024
                return mock_st
            return st

        monkeypatch.setattr(Path, "stat", mock_stat)

        adapter = LocalFeedCTIAdapter(feed_path=str(feed_file))
        assert not adapter.is_configured()

        res = adapter.check_url("https://oversized.testing/")
        assert res.status == "unavailable"
        assert res.unavailable_reason == "FEED_MALFORMED"
        assert "exceeds limit" in res.details.lower()

    def test_bounded_feed_record_count_limit(self, tmp_path, monkeypatch):
        # Temporarily reduce MAX_LOCAL_FEED_RECORDS to test boundary without huge array
        monkeypatch.setattr("app.cti.MAX_LOCAL_FEED_RECORDS", 5)

        feed_data = {
            "feed_format_version": "1.0",
            "records": [
                {"type": "domain", "target": f"bad{i}.testing", "threat_type": "MALWARE"}
                for i in range(10)  # 10 exceeds limit of 5
            ],
        }
        feed_file = tmp_path / "too_many_records.json"
        feed_file.write_text(json.dumps(feed_data), encoding="utf-8")

        adapter = LocalFeedCTIAdapter(feed_path=str(feed_file))
        assert not adapter.is_configured()

        res = adapter.check_url("https://bad1.testing/")
        assert res.status == "unavailable"
        assert res.unavailable_reason == "FEED_MALFORMED"
        assert "record count" in res.details.lower()

    def test_api_resilient_to_feed_failures_without_crash(self, tmp_path, monkeypatch):
        feed_file = tmp_path / "broken_feed.json"
        feed_file.write_text("{ corrupt json", encoding="utf-8")

        monkeypatch.setattr(config, "CTI_LOCAL_FEED_PATH", str(feed_file))
        monkeypatch.setattr(config, "CTI_PROVIDER", "local_feed")

        # API call must return HTTP 200 (not 500) with unavailable status
        r = c.post("/api/v1/m1/check", json={"url": "https://example.com/check"}, headers=J)
        assert r.status_code == 200
        data = r.json()
        assert data["cti"]["status"] == "unavailable"
        assert data["cti"]["unavailable_reason"] == "FEED_MALFORMED"

        # Status endpoint must report configured=False
        r_status = c.get("/api/v1/m1/status")
        assert r_status.status_code == 200
        assert r_status.json()["configured"] is False

    def test_clean_local_feed_cti_does_not_suppress_heuristics(self, tmp_path, monkeypatch):
        # Active local feed with 1 indicator
        feed_data = {
            "feed_format_version": "1.0",
            "records": [{"type": "domain", "target": "other-threat.testing", "threat_type": "MALWARE"}],
        }
        feed_file = tmp_path / "active_feed.json"
        feed_file.write_text(json.dumps(feed_data), encoding="utf-8")

        monkeypatch.setattr(config, "CTI_LOCAL_FEED_PATH", str(feed_file))
        monkeypatch.setattr(config, "CTI_PROVIDER", "local_feed")

        # Query a URL that has heuristic indicators (HTTP with IP host), but not in CTI feed
        r = c.post("/api/v1/m1/check", json={"url": "http://192.168.1.1/login"}, headers=J)
        assert r.status_code == 200
        data = r.json()
        # CTI confirms absence of known match
        assert data["cti"]["status"] == "no_threat_found"
        assert data["cti"]["threat_types"] == []
        # CTI does NOT overwrite heuristic findings; URL and canonical URL are faithfully returned
        assert data["url"] == "http://192.168.1.1/login"
        assert data["canonical_url"] == "http://192.168.1.1/login"

