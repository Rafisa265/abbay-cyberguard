"""
CyberShield Ethiopia — M1 URL Dataset Pilot Pipeline Tests
Tests unit normalization, privacy, deduplication, conflict quarantine,
domain-grouped splitting, and zero-network parsing.
"""

import socket
import sys
from pathlib import Path
from unittest.mock import patch
import pytest

# Ensure repo root is on sys.path
REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from data.m1_url_pilot.pipeline.audit import perform_quality_audit
from data.m1_url_pilot.pipeline.deduplicate import deduplicate_records
from data.m1_url_pilot.pipeline.ingest_phishtank import (
    check_phishtank_availability,
    ingest_phishtank_records,
)
from data.m1_url_pilot.pipeline.ingest_urlhaus import (
    check_urlhaus_availability,
    fetch_urlhaus_feed,
    parse_urlhaus_csv,
)
from data.m1_url_pilot.pipeline.ingest_tranco import ingest_tranco_records
from data.m1_url_pilot.pipeline.normalize import (
    extract_domain_components,
    normalize_url,
)
from data.m1_url_pilot.pipeline.provenance import (
    ProvenanceLock,
    append_provenance_events,
    compute_event_fingerprint,
    read_provenance_audit_log,
)
from data.m1_url_pilot.pipeline.psl import (
    DEFAULT_PSL_PATH,
    EXPECTED_PSL_SHA256,
    PSLResourceError,
    PublicSuffixList,
    get_psl,
)
from data.m1_url_pilot.pipeline.config import (
    RECORD_SCHEMA_FIELDS,
    VALID_LABELS,
    VALID_LABEL_STATUSES,
    VALID_ORIGINAL_DATA_TYPES,
    validate_record_schema,
)
from data.m1_url_pilot.pipeline.ingest_wangchuk import (
    WangchukSchemaError,
    ingest_wangchuk_records,
)
from data.m1_url_pilot.pipeline.split_domains import (
    BenchmarkIsolationError,
    assign_domain_split,
    extract_canonical_registered_domain,
    load_benchmark_registered_domains,
    partition_records_by_domain,
    quarantine_benchmark_collisions,
    quarantine_compromised_domain_hazards,
)


class TestURLNormalization:
    """Tests for URL canonicalization and edge cases."""

    def test_standard_http_https(self):
        r1 = normalize_url("https://example.com/login")
        assert r1.is_valid
        assert r1.normalized_url == "https://example.com/login"
        assert r1.scheme == "https"
        assert r1.hostname == "example.com"
        assert not r1.scheme_defaulted

        r2 = normalize_url("http://example.com/login")
        assert r2.is_valid
        assert r2.normalized_url == "http://example.com/login"
        assert r2.scheme == "http"

    def test_scheme_defaulting(self):
        r = normalize_url("example.com/path")
        assert r.is_valid
        assert r.scheme_defaulted
        assert r.normalized_url == "http://example.com/path"

    def test_whitespace_and_bounds(self):
        r_empty = normalize_url("   ")
        assert not r_empty.is_valid
        assert r_empty.error == "EMPTY_URL"

        r_long = normalize_url("http://example.com/" + "a" * 2050)
        assert not r_long.is_valid
        assert r_long.error == "URL_TOO_LONG"

    def test_port_normalization(self):
        # Default ports stripped
        assert normalize_url("http://example.com:80/test").normalized_url == "http://example.com/test"
        assert normalize_url("https://example.com:443/test").normalized_url == "https://example.com/test"

        # Non-default ports preserved
        assert normalize_url("http://example.com:8080/test").normalized_url == "http://example.com:8080/test"
        assert normalize_url("https://example.com:8443/test").normalized_url == "https://example.com:8443/test"

    def test_path_and_query_casing_preserved(self):
        # Security signal: path and query casing must NEVER be lowercased
        url = "https://EXAMPLE.COM/Auth/TokenVerification?SessionID=AbCdEf123&action=Check"
        r = normalize_url(url)
        assert r.is_valid
        assert r.hostname == "example.com"
        assert r.normalized_url == "https://example.com/Auth/TokenVerification?SessionID=AbCdEf123&action=Check"

    def test_fragment_stripped(self):
        # Client-side fragments must be dropped
        r = normalize_url("https://example.com/page?query=1#section-heading")
        assert r.normalized_url == "https://example.com/page?query=1"

    @pytest.mark.parametrize("scheme", [
        "javascript:alert(1)",
        "file:///etc/passwd",
        "data:text/html,<script>alert(1)</script>",
        "ftp://ftp.example.com/file",
        "blob:https://example.com/uuid",
        "about:blank",
    ])
    def test_rejects_unsupported_schemes(self, scheme):
        r = normalize_url(scheme)
        assert not r.is_valid
        assert "UNSUPPORTED_SCHEME" in r.error


class TestPunycodeAndIDN:
    """Tests for Internationalized Domain Names and Punycode preservation."""

    def test_punycode_ascii_preserved(self):
        url = "https://xn--pypal-4ve.example/login"
        r = normalize_url(url)
        assert r.is_valid
        assert r.has_punycode
        # Critical: punycode must NOT be decoded to unicode in normalized representation
        assert "xn--pypal-4ve.example" in r.normalized_url

    def test_standard_ascii_no_punycode(self):
        r = normalize_url("https://paypal.example.com/")
        assert r.is_valid
        assert not r.has_punycode


class TestCredentialStrippingAndPrivacy:
    """Tests for safe treatment of user-info and authentication credentials."""

    def test_strips_credentials_and_sets_flag(self):
        sensitive_url = "https://admin:SuperSecretPass123!@banking.portal.example/transfer"
        r = normalize_url(sensitive_url)
        assert r.is_valid
        assert r.has_userinfo
        # Passwords and username must NEVER appear in normalized representation
        assert "SuperSecretPass123!" not in r.normalized_url
        assert "admin@" not in r.normalized_url
        assert r.normalized_url == "https://banking.portal.example/transfer"


class TestIPAddressDetection:
    """Tests for IPv4 and IPv6 detection."""

    def test_detects_standard_ipv4(self):
        r = normalize_url("http://192.168.1.1:8080/admin")
        assert r.is_valid
        assert r.has_ip_host

    def test_detects_ipv6(self):
        r = normalize_url("http://[::1]:8080/index")
        assert r.is_valid
        assert r.has_ip_host

    def test_detects_hex_ipv4(self):
        r = normalize_url("http://0x7f.0.0.1/test")
        assert r.is_valid
        assert r.has_ip_host

    def test_domain_is_not_ip(self):
        r = normalize_url("http://example.com/")
        assert r.is_valid
        assert not r.has_ip_host


class TestDeduplicationAndConflictingLabels:
    """Tests for duplicate URL detection and conflicting-label quarantine."""

    def test_exact_duplicates_deduplicated(self):
        records = [
            {"normalized_url": "http://example.com/login", "label": "phishing", "id": "1"},
            {"normalized_url": "http://example.com/login", "label": "phishing", "id": "2"},
            {"normalized_url": "http://example.com/about", "label": "candidate_benign_domain", "id": "3"},
        ]
        accepted, dups, conflicts = deduplicate_records(records)
        assert len(accepted) == 2
        assert len(dups) == 1
        assert len(conflicts) == 0
        assert dups[0]["id"] == "2"

    def test_conflicting_labels_quarantined(self):
        # When same URL has contradictory labels from different feeds
        records = [
            {"normalized_url": "http://ambiguous.example/page", "label": "phishing", "id": "1"},
            {"normalized_url": "http://ambiguous.example/page", "label": "candidate_benign_domain", "id": "2"},
            {"normalized_url": "http://clean.example/page", "label": "candidate_benign_domain", "id": "3"},
        ]
        accepted, dups, conflicts = deduplicate_records(records)
        assert len(accepted) == 1
        assert accepted[0]["id"] == "3"
        assert len(conflicts) == 2
        assert all(c["label"] == "quarantine" for c in conflicts)
        assert all("CONFLICTING_SOURCE_LABELS" in c["quarantine_reason"] for c in conflicts)


class TestCandidateVsVerifiedLabels:
    """Tests that candidate benign domains are never misrepresented as verified benign URLs."""

    def test_tranco_records_remain_candidate_benign(self):
        raw_csv = "1,example.com\n2,test-portal.org\n"
        accepted, quarantined = ingest_tranco_records(raw_csv, limit=10, quarantine_multi_tenant=False)
        assert len(accepted) == 2
        for rec in accepted:
            assert rec["label"] == "candidate_benign_domain"
            assert rec["label_status"] == "candidate"
            assert rec["verification_status"] == "tranco_ranked_pld"

    def test_phishtank_requires_verified_and_online(self):
        fixtures = [
            # 1. Verified and online -> accepted
            {"phish_id": 101, "url": "http://phish1.test/login", "verified": "yes", "online": "yes"},
            # 2. Unverified -> quarantined
            {"phish_id": 102, "url": "http://phish2.test/login", "verified": "no", "online": "yes"},
            # 3. Offline -> quarantined
            {"phish_id": 103, "url": "http://phish3.test/login", "verified": "yes", "online": "no"},
        ]
        accepted, quarantined = ingest_phishtank_records(fixtures)
        assert len(accepted) == 1
        assert accepted[0]["source_record_id"] == "101"
        assert accepted[0]["label"] == "phishing"
        assert accepted[0]["label_status"] == "verified"

        assert len(quarantined) == 2
        reasons = [q["quarantine_reason"] for q in quarantined]
        assert any("UNVERIFIED_PHISHTANK_RECORD" in r for r in reasons)
        assert any("OFFLINE_PHISHTANK_RECORD" in r for r in reasons)


class TestDomainGroupedSplitting:
    """Tests for zero domain leakage across splits."""

    def test_domain_isolation_guarantee(self):
        # 10 URLs across 3 distinct domains
        records = [
            {"registered_domain": "alpha.test", "normalized_url": f"http://alpha.test/{i}", "label": "phishing"}
            for i in range(5)
        ] + [
            {"registered_domain": "beta.test", "normalized_url": f"http://beta.test/{i}", "label": "candidate_benign_domain"}
            for i in range(3)
        ] + [
            {"registered_domain": "gamma.test", "normalized_url": f"http://gamma.test/{i}", "label": "phishing"}
            for i in range(2)
        ]

        train_recs, val_recs, test_recs, domain_sets = partition_records_by_domain(records)

        # Confirm all alpha.test URLs are in exactly ONE split
        alpha_splits = {
            r["split"] for r in (train_recs + val_recs + test_recs) if r["registered_domain"] == "alpha.test"
        }
        assert len(alpha_splits) == 1

        # Confirm zero leakage across domain sets
        assert domain_sets["train"].isdisjoint(domain_sets["val"])
        assert domain_sets["train"].isdisjoint(domain_sets["test"])
        assert domain_sets["val"].isdisjoint(domain_sets["test"])

    def test_deterministic_assignment(self):
        # assign_domain_split must be deterministic across executions
        domain = "secure-login.ethiopia.test"
        s1 = assign_domain_split(domain)
        s2 = assign_domain_split(domain)
        assert s1 == s2
        assert s1 in {"train", "val", "test"}


class TestZeroNetworkDuringParsingAndAuditing:
    """Ensures no socket connections or HTTP requests occur during parsing or auditing."""

    def test_offline_execution_guarantee(self, monkeypatch):
        def forbidden_connect(*args, **kwargs):
            raise RuntimeError("FORBIDDEN_NETWORK_CALL: Network access is prohibited during URL parsing/auditing!")

        # Block socket connects
        monkeypatch.setattr(socket.socket, "connect", forbidden_connect)

        # 1. Normalization does zero network lookups
        res = normalize_url("https://bank.example.com/transfer?id=123")
        assert res.is_valid

        # 2. Extract domain does zero network lookups
        sub, reg, tld = extract_domain_components("portal.ethiopia.gov.et")
        assert reg == "ethiopia.gov.et"
        assert tld == "gov.et"

        # 3. Deduplication is purely in-memory
        recs = [{"normalized_url": "http://a.test/", "label": "phishing"}]
        accepted, dups, conflicts = deduplicate_records(recs)
        assert len(accepted) == 1

        # 4. Audit runs purely offline
        audit = perform_quality_audit(
            all_raw_counts={"synthetic": 1},
            accepted_records=accepted,
            quarantined_records=[],
            duplicate_records=[],
        )
        assert audit["summary"]["total_accepted"] == 1


class TestURLhausIngestionAdapter:
    """Tests for the isolated abuse.ch URLhaus ingestion adapter."""

    SYNTHETIC_FEED = (
        "# URLhaus Database Snapshot (Synthetic Unit Test Fixture)\n"
        "# id,dateadded,url,url_status,last_online,threat,tags,urlhaus_link,reporter\n"
        '1001,2026-10-26 10:00:00,http://phish-target1.test/login,online,2026-10-26 10:05:00,phishing,banking;cbe,https://urlhaus.abuse.ch/url/1001/,analyst1\n'
        '1002,2026-10-26 10:01:00,http://phish-target2.test/auth,online,2026-10-26 10:06:00,malware_download,stealer;phishing;apk,https://urlhaus.abuse.ch/url/1002/,analyst2\n'
        '1003,2026-10-26 10:02:00,http://malware-only.test/dropper.exe,online,2026-10-26 10:07:00,malware_download,elf;mirai,https://urlhaus.abuse.ch/url/1003/,analyst3\n'
        '1004,2026-10-26 10:03:00,http://offline-site.test/login,offline,2026-10-25 12:00:00,phishing,banking,https://urlhaus.abuse.ch/url/1004/,analyst4\n'
        '1005,malformed_incomplete_row\n'
    )

    def test_schema_parsing_and_threat_filtering(self):
        accepted, quarantined = parse_urlhaus_csv(
            self.SYNTHETIC_FEED, content_checksum="synthetic_sha256_hash"
        )

        # Only rows 1001 (threat=phishing) and 1002 (tag=phishing) should be accepted as phishing
        assert len(accepted) == 2
        acc_ids = [r["source_record_id"] for r in accepted]
        assert acc_ids == ["1001", "1002"]

        for rec in accepted:
            assert rec["source"] == "urlhaus"
            assert rec["label"] == "phishing"
            assert rec["label_status"] == "verified"
            assert rec["verification_status"] == "urlhaus_verified_phishing"

        # Rows 1003 (generic malware), 1004 (offline), 1005 (malformed) must be quarantined
        assert len(quarantined) == 3
        reasons = [q["quarantine_reason"] for q in quarantined]
        assert any("URLHAUS_NON_PHISHING_MALWARE" in r for r in reasons)
        assert any("OFFLINE_URLHAUS_RECORD" in r for r in reasons)
        assert any("MALFORMED_CSV_ROW" in r for r in reasons)

    def test_provenance_and_checksum_recording(self):
        checksum_val = "fe9876543210abcdef0123456789abcdef0123456789abcdef0123456789abcd"
        accepted, quarantined = parse_urlhaus_csv(self.SYNTHETIC_FEED, content_checksum=checksum_val)
        rec = accepted[0]
        meta = rec["_metadata"]
        assert meta["content_checksum"] == checksum_val
        assert meta["reporter"] == "analyst1"
        assert meta["urlhaus_link"] == "https://urlhaus.abuse.ch/url/1001/"
        assert meta["dateadded"] == "2026-10-26 10:00:00"

    def test_deterministic_parsing(self):
        acc1, quar1 = parse_urlhaus_csv(self.SYNTHETIC_FEED)
        acc2, quar2 = parse_urlhaus_csv(self.SYNTHETIC_FEED)
        assert [r["record_id"] for r in acc1] == [r["record_id"] for r in acc2]
        assert [q["record_id"] for q in quar1] == [q["record_id"] for q in quar2]

    def test_network_guard_urlhaus(self, monkeypatch):
        def forbidden_connect(*args, **kwargs):
            raise RuntimeError("FORBIDDEN_NETWORK_CALL: URLhaus parser must be 100% offline!")

        monkeypatch.setattr(socket.socket, "connect", forbidden_connect)
        accepted, quarantined = parse_urlhaus_csv(self.SYNTHETIC_FEED)
        assert len(accepted) == 2

    def test_availability_guard_without_auth_key(self, monkeypatch, tmp_path):
        monkeypatch.delenv("CYBERSHIELD_URLHAUS_AUTH_KEY", raising=False)
        # Point to empty dir so local raw cache doesn't exist
        with patch("data.m1_url_pilot.pipeline.ingest_urlhaus.RAW_DIR", tmp_path):
            available, msg = check_urlhaus_availability()
            assert not available
            assert "Auth-Key" in msg
            assert "410 Gone" in msg


class TestLoggingAndReportPrivacy:
    """Verifies that full sensitive or malicious URLs do not leak into console logs or audit summaries."""

    def test_audit_summary_excludes_full_urls(self):
        records = [
            {
                "record_id": "test:1",
                "source": "synthetic",
                "normalized_url": "https://malicious-lure.test/path/to/credential_stealer?token=SECRET123",
                "registered_domain": "malicious-lure.test",
                "label": "phishing",
                "label_status": "verified",
                "verification_status": "synthetic",
            }
        ]
        audit = perform_quality_audit(
            all_raw_counts={"synthetic": 1},
            accepted_records=records,
            quarantined_records=[],
            duplicate_records=[],
        )
        import json
        summary_str = json.dumps(audit["summary"])
        # Ensure full path and tokens do not appear in top-level summary
        assert "credential_stealer" not in summary_str
        assert "SECRET123" not in summary_str
        assert "https://malicious-lure.test" not in summary_str


class TestSecurityTaxonomyIntegrity:
    """Ensures honest distinctions among phishing, non-phishing malware, and candidate benign domains."""

    def test_never_conflates_malware_with_phishing(self):
        # Synthetic row with malware_download and no phishing tag
        row = (
            "# id,dateadded,url,url_status,last_online,threat,tags,urlhaus_link,reporter\n"
            "2001,2026-10-26 12:00:00,http://trojan.example.test/payload.bin,online,2026-10-26 12:01:00,malware_download,elf;mirai,https://urlhaus.abuse.ch/url/2001/,analyst\n"
        )
        accepted, quarantined = parse_urlhaus_csv(row)
        assert len(accepted) == 0, "Non-phishing malware must never be accepted as phishing"
        assert len(quarantined) == 1
        q = quarantined[0]
        assert q["label"] == "quarantine"
        assert "URLHAUS_NON_PHISHING_MALWARE" in q["quarantine_reason"]
        assert q["verification_status"] == "urlhaus_malware_distribution"

    def test_candidate_benign_distinct_from_confirmed_benign(self):
        # Tranco records must remain candidate_benign_domain
        tranco_sample = "1,wikipedia.org\n"
        accepted, quarantined = ingest_tranco_records(tranco_sample, limit=1)
        assert len(accepted) == 1
        rec = accepted[0]
        assert rec["label"] == "candidate_benign_domain"
        assert rec["label"] != "legitimate"
        assert rec["label_status"] == "candidate"
        assert rec["label_status"] != "verified"


class TestProvenanceAuditLogger:
    """Tests for idempotent, concurrency-safe, and deterministic provenance logging."""

    def test_deterministic_fingerprint_ignores_timestamp(self):
        ev1 = {
            "event": "ingest_tranco",
            "source": "tranco",
            "list_id": "W3ZV9",
            "raw_input": 1000,
            "accepted": 988,
            "quarantined": 12,
            "timestamp": "2026-10-26T18:28:56.514960+00:00",
        }
        ev2 = {
            # Different key order, different timestamp
            "timestamp": "2026-10-26T19:59:59.999999+00:00",
            "quarantined": 12,
            "accepted": 988,
            "raw_input": 1000,
            "list_id": "W3ZV9",
            "source": "tranco",
            "event": "ingest_tranco",
        }
        fp1 = compute_event_fingerprint(ev1)
        fp2 = compute_event_fingerprint(ev2)
        assert fp1 == fp2
        assert len(fp1) == 64

    def test_different_events_produce_different_fingerprints(self):
        ev1 = {"event": "check_phishtank", "source": "phishtank", "available": False}
        ev2 = {"event": "check_phishtank", "source": "phishtank", "available": True}
        assert compute_event_fingerprint(ev1) != compute_event_fingerprint(ev2)

    def test_idempotent_append_prevents_duplicate_entries(self, tmp_path):
        log_file = tmp_path / "provenance_audit.jsonl"
        ev = {
            "event": "ingest_tranco",
            "source": "tranco",
            "list_id": "W3ZV9",
            "raw_input": 1000,
            "accepted": 988,
            "quarantined": 12,
            "timestamp": "2026-10-26T18:00:00+00:00",
        }
        # First append: 1 new event
        appended1 = append_provenance_events(log_file, [ev])
        assert len(appended1) == 1
        lines1 = log_file.read_text(encoding="utf-8").splitlines()
        assert len(lines1) == 1

        # Second append with identical payload but new timestamp: 0 new events
        ev_repeat = dict(ev)
        ev_repeat["timestamp"] = "2026-10-26T19:00:00+00:00"
        appended2 = append_provenance_events(log_file, [ev_repeat])
        assert len(appended2) == 0
        lines2 = log_file.read_text(encoding="utf-8").splitlines()
        assert len(lines2) == 1
        assert lines1 == lines2

    def test_append_genuinely_new_event(self, tmp_path):
        log_file = tmp_path / "provenance_audit.jsonl"
        ev1 = {"event": "event_a", "source": "source_a", "timestamp": "2026-10-26T10:00:00Z"}
        ev2 = {"event": "event_b", "source": "source_b", "timestamp": "2026-10-26T10:01:00Z"}

        append_provenance_events(log_file, [ev1])
        appended = append_provenance_events(log_file, [ev1, ev2])

        assert len(appended) == 1
        assert appended[0]["event"] == "event_b"
        assert "event_fingerprint" in appended[0]

        lines = log_file.read_text(encoding="utf-8").splitlines()
        assert len(lines) == 2

    def test_safe_handling_of_malformed_historical_lines(self, tmp_path):
        log_file = tmp_path / "provenance_audit.jsonl"
        # Seed log with valid line, a malformed JSON line, and a blank line
        initial_content = (
            '{"event": "historical_1", "source": "src1", "timestamp": "2026-10-26T00:00:00Z"}\n'
            'CORRUPTED_NON_JSON_LINE_THAT_MUST_BE_PRESERVED\n'
            '\n'
            '{"event": "historical_2", "source": "src2", "timestamp": "2026-10-26T01:00:00Z"}\n'
        )
        log_file.write_text(initial_content, encoding="utf-8")

        raw_lines, known_fps, malformed = read_provenance_audit_log(log_file)
        assert len(known_fps) == 2
        assert len(malformed) == 1
        assert malformed[0][0] == 2  # Line 2 is malformed

        # Append a new event
        new_ev = {"event": "historical_3", "source": "src3", "timestamp": "2026-10-26T02:00:00Z"}
        appended = append_provenance_events(log_file, [new_ev])
        assert len(appended) == 1

        # Confirm corrupted line was NOT erased, truncated, or rewritten
        updated_content = log_file.read_text(encoding="utf-8")
        assert "CORRUPTED_NON_JSON_LINE_THAT_MUST_BE_PRESERVED" in updated_content
        updated_lines = updated_content.splitlines()
        assert updated_lines[1] == "CORRUPTED_NON_JSON_LINE_THAT_MUST_BE_PRESERVED"
        assert len([l for l in updated_lines if l.strip()]) == 4

    def test_concurrency_file_locking(self, tmp_path):
        lock_file = tmp_path / "test.lock"
        with ProvenanceLock(lock_file, timeout=2.0) as lock1:
            assert lock_file.exists()
            # Attempting to acquire second lock should timeout
            with pytest.raises(TimeoutError):
                with ProvenanceLock(lock_file, timeout=0.1, poll_interval=0.02):
                    pass
        # Once released, lock file is cleaned up
        assert not lock_file.exists()


class TestPSLEthiopianAndInternationalDomains:
    """Verifies PSL resolution for Ethiopian ccTLDs, international ccTLDs, and standard gTLDs."""

    def test_ethiopian_domains(self):
        # 1. Commercial 2-level ccTLD
        r1 = normalize_url("https://cbe.com.et/en/banking")
        assert r1.is_valid
        assert r1.registered_domain == "cbe.com.et"
        assert r1.tld == "com.et"
        assert r1.subdomain is None

        # 2. Government 2-level ccTLD with subdomain
        r2 = normalize_url("https://portal.ethiopia.gov.et/services")
        assert r2.is_valid
        assert r2.registered_domain == "ethiopia.gov.et"
        assert r2.tld == "gov.et"
        assert r2.subdomain == "portal"

        # 3. Education 2-level ccTLD
        r3 = normalize_url("https://aau.edu.et/academics")
        assert r3.is_valid
        assert r3.registered_domain == "aau.edu.et"
        assert r3.tld == "edu.et"
        assert r3.subdomain is None

        # 4. Single-level .et ccTLD
        r4 = normalize_url("https://telecom.et/plans")
        assert r4.is_valid
        assert r4.registered_domain == "telecom.et"
        assert r4.tld == "et"
        assert r4.subdomain is None

        # 5. Verified Ethiopian ccTLD in PSL missing from legacy 42 rules (biz.et, info.et, name.et)
        sub5, reg5, tld5 = extract_domain_components("company.biz.et")
        assert reg5 == "company.biz.et"
        assert tld5 == "biz.et"
        assert sub5 is None

        # 6. Unlisted 2-level name under .et defaults to .et as public suffix
        sub6, reg6, tld6 = extract_domain_components("army.mil.et")
        assert reg6 == "mil.et"
        assert tld6 == "et"
        assert sub6 == "army"

    def test_international_cctlds_and_fixes_legacy_domain_collapse(self):
        # google.com.hk (Hong Kong commercial)
        r_hk = normalize_url("https://google.com.hk/search?q=test")
        assert r_hk.registered_domain == "google.com.hk"
        assert r_hk.tld == "com.hk"
        assert r_hk.subdomain is None

        # shopee.co.id (Indonesia commercial)
        r_id = normalize_url("https://shopee.co.id/deals")
        assert r_id.registered_domain == "shopee.co.id"
        assert r_id.tld == "co.id"
        assert r_id.subdomain is None

        # mercadolibre.com.ar (Argentina commercial)
        r_ar = normalize_url("https://mercadolibre.com.ar/items")
        assert r_ar.registered_domain == "mercadolibre.com.ar"
        assert r_ar.tld == "com.ar"
        assert r_ar.subdomain is None

        # UK ccTLD with and without www
        r_uk1 = normalize_url("https://example.co.uk/")
        assert r_uk1.registered_domain == "example.co.uk"
        assert r_uk1.tld == "co.uk"
        assert r_uk1.subdomain is None

        r_uk2 = normalize_url("https://www.bbc.co.uk/news")
        assert r_uk2.registered_domain == "bbc.co.uk"
        assert r_uk2.tld == "co.uk"
        assert r_uk2.subdomain == "www"

    def test_prevents_domain_collapse_on_unrelated_sites(self):
        # Two distinct Argentine commercial domains must NOT be collapsed to com.ar
        sub1, reg1, tld1 = extract_domain_components("primitivourbano.com.ar")
        sub2, reg2, tld2 = extract_domain_components("dgcv.com.ar")
        assert reg1 == "primitivourbano.com.ar"
        assert reg2 == "dgcv.com.ar"
        assert reg1 != reg2
        assert tld1 == "com.ar"
        assert tld2 == "com.ar"

        # Two distinct Indonesian university domains must NOT be collapsed to ac.id
        sub3, reg3, tld3 = extract_domain_components("iain-ternate.ac.id")
        sub4, reg4, tld4 = extract_domain_components("unmerpas.ac.id")
        assert reg3 == "iain-ternate.ac.id"
        assert reg4 == "unmerpas.ac.id"
        assert reg3 != reg4
        assert tld3 == "ac.id"
        assert tld4 == "ac.id"


class TestPSLMultiTenantPrivateSuffixes:
    """Verifies tenant separation under private multi-tenant infrastructure."""

    def test_github_pages_tenant_isolation(self):
        url_attacker = "https://attacker.github.io/phish/login"
        url_victim = "https://victim.github.io/profile"

        # When include_private=True (default for dataset splitting):
        r_att = normalize_url(url_attacker, include_private=True)
        r_vic = normalize_url(url_victim, include_private=True)
        assert r_att.registered_domain == "attacker.github.io"
        assert r_vic.registered_domain == "victim.github.io"
        assert r_att.registered_domain != r_vic.registered_domain
        assert r_att.tld == "github.io"
        assert r_vic.tld == "github.io"

        # When include_private=False (ICANN-only mode):
        r_att_icann = normalize_url(url_attacker, include_private=False)
        r_vic_icann = normalize_url(url_victim, include_private=False)
        assert r_att_icann.registered_domain == "github.io"
        assert r_vic_icann.registered_domain == "github.io"
        assert r_att_icann.tld == "io"

    def test_pages_dev_and_workers_dev_tenant_isolation(self):
        # Cloudflare Pages
        sub1, reg1, tld1 = extract_domain_components("project1.pages.dev", include_private=True)
        sub2, reg2, tld2 = extract_domain_components("project2.pages.dev", include_private=True)
        assert reg1 == "project1.pages.dev"
        assert reg2 == "project2.pages.dev"
        assert reg1 != reg2
        assert tld1 == "pages.dev"

        # Cloudflare Workers
        sub3, reg3, tld3 = extract_domain_components("api.workers.dev", include_private=True)
        assert reg3 == "api.workers.dev"
        assert tld3 == "workers.dev"


class TestPSLWildcardsAndExceptions:
    """Verifies PSL wildcard (*.rule) and exception (!rule) rule compliance."""

    def test_kawasaki_jp_exception_rule(self):
        # Kawasaki has rule: *.kawasaki.jp and exception: !city.kawasaki.jp
        # 1. city.kawasaki.jp (exception matches: city.kawasaki.jp is registrable domain under kawasaki.jp)
        sub1, reg1, tld1 = extract_domain_components("city.kawasaki.jp")
        assert reg1 == "city.kawasaki.jp"
        assert tld1 == "kawasaki.jp"
        assert sub1 is None

        # 2. www.city.kawasaki.jp
        sub2, reg2, tld2 = extract_domain_components("www.city.kawasaki.jp")
        assert reg2 == "city.kawasaki.jp"
        assert tld2 == "kawasaki.jp"
        assert sub2 == "www"

        # 3. Wildcard match: sub.foo.kawasaki.jp (*.kawasaki.jp matches foo.kawasaki.jp)
        sub3, reg3, tld3 = extract_domain_components("sub.foo.kawasaki.jp")
        assert reg3 == "sub.foo.kawasaki.jp"
        assert tld3 == "foo.kawasaki.jp"
        assert sub3 is None

        # 4. Public suffix only under wildcard: foo.kawasaki.jp has no label to the left
        sub4, reg4, tld4 = extract_domain_components("foo.kawasaki.jp")
        assert reg4 is None
        assert tld4 == "foo.kawasaki.jp"

    def test_cook_islands_exception_rule(self):
        # Cook Islands has *.ck and !www.ck
        # 1. www.ck is registrable domain
        sub1, reg1, tld1 = extract_domain_components("www.ck")
        assert reg1 == "www.ck"
        assert tld1 == "ck"
        assert sub1 is None

        # 2. foo.www.ck
        sub2, reg2, tld2 = extract_domain_components("foo.www.ck")
        assert reg2 == "www.ck"
        assert tld2 == "ck"
        assert sub2 == "foo"

        # 3. bar.foo.ck (wildcard matches foo.ck)
        sub3, reg3, tld3 = extract_domain_components("bar.foo.ck")
        assert reg3 == "bar.foo.ck"
        assert tld3 == "foo.ck"

    def test_uk_schools_wildcard(self):
        # UK schools rule: *.sch.uk
        sub, reg, tld = extract_domain_components("highschool.herts.sch.uk")
        assert reg == "highschool.herts.sch.uk"
        assert tld == "herts.sch.uk"


class TestPSLEdgeCasesAndIPHosts:
    """Verifies robust handling of IP addresses, localhost, IDNs, and suffix-only inputs."""

    def test_ipv4_and_ipv6_detection(self):
        r_v4 = normalize_url("http://192.168.1.1:8080/admin")
        assert r_v4.is_valid
        assert r_v4.has_ip_host
        assert r_v4.registered_domain == "192.168.1.1"
        assert r_v4.tld is None

        r_v6 = normalize_url("http://[::1]:8443/login")
        assert r_v6.is_valid
        assert r_v6.has_ip_host
        assert r_v6.registered_domain == "[::1]"
        assert r_v6.tld is None

        r_hex = normalize_url("http://0x7f.0.0.1/test")
        assert r_hex.is_valid
        assert r_hex.has_ip_host
        assert r_hex.registered_domain == "0x7f.0.0.1"

    def test_localhost_and_single_label(self):
        r_local = normalize_url("http://localhost:3000/dashboard")
        assert r_local.is_valid
        assert r_local.registered_domain == "localhost"
        assert r_local.tld is None

        r_intranet = normalize_url("http://intranet/wiki")
        assert r_intranet.is_valid
        assert r_intranet.registered_domain == "intranet"
        assert r_intranet.tld is None

    def test_public_suffix_only_never_misidentified_as_registered_domain(self):
        # Passing suffix-only strings must return registered_domain=None
        sub1, reg1, tld1 = extract_domain_components("com")
        assert reg1 is None
        assert tld1 == "com"

        sub2, reg2, tld2 = extract_domain_components("co.uk")
        assert reg2 is None
        assert tld2 == "co.uk"

        sub3, reg3, tld3 = extract_domain_components("gov.et")
        assert reg3 is None
        assert tld3 == "gov.et"

    def test_idn_and_punycode_handling(self):
        r = normalize_url("https://xn--pypal-4ve.example/login")
        assert r.is_valid
        assert r.has_punycode
        assert r.registered_domain == "xn--pypal-4ve.example"
        assert r.tld == "example"

    def test_malformed_hostnames_rejected(self):
        assert not normalize_url("http://.example.com/").is_valid
        assert not normalize_url("http://example..com/").is_valid
        assert not normalize_url("http:///").is_valid


class TestPSLSplittingAndLeakageGuarantees:
    """Verifies deterministic domain-grouped splitting and zero cross-partition leakage."""

    def test_same_registered_domain_always_in_same_split(self):
        records = [
            {"registered_domain": "bbc.co.uk", "normalized_url": "http://bbc.co.uk/news", "label": "candidate_benign_domain"},
            {"registered_domain": "bbc.co.uk", "normalized_url": "http://www.bbc.co.uk/sport", "label": "candidate_benign_domain"},
            {"registered_domain": "bbc.co.uk", "normalized_url": "http://weather.bbc.co.uk/", "label": "candidate_benign_domain"},
            {"registered_domain": "amazon.co.uk", "normalized_url": "http://amazon.co.uk/dp/1", "label": "candidate_benign_domain"},
            {"registered_domain": "cbe.com.et", "normalized_url": "http://cbe.com.et/rates", "label": "candidate_benign_domain"},
        ]
        train_recs, val_recs, test_recs, domain_sets = partition_records_by_domain(records)

        # All 3 bbc.co.uk records must be in the EXACT same split
        bbc_splits = {r["split"] for r in (train_recs + val_recs + test_recs) if r["registered_domain"] == "bbc.co.uk"}
        assert len(bbc_splits) == 1

        # Zero domain leakage across splits
        assert domain_sets["train"].isdisjoint(domain_sets["val"])
        assert domain_sets["train"].isdisjoint(domain_sets["test"])
        assert domain_sets["val"].isdisjoint(domain_sets["test"])

    def test_private_suffix_tenants_partition_independently(self):
        # Two distinct GitHub Pages tenants
        s_att = assign_domain_split("attacker.github.io")
        s_vic = assign_domain_split("victim.github.io")
        assert s_att in {"train", "val", "test"}
        assert s_vic in {"train", "val", "test"}
        # Both map deterministically
        assert assign_domain_split("attacker.github.io") == s_att
        assert assign_domain_split("victim.github.io") == s_vic

    def test_benchmark_split_isolation_preserved(self):
        records = [
            {"registered_domain": "bench1.test", "normalized_url": "http://bench1.test/", "source": "phiusiil_benchmark", "split": "benchmark"},
            {"registered_domain": "normal.test", "normalized_url": "http://normal.test/", "source": "tranco", "label": "candidate_benign_domain"},
        ]
        train, val, test, domain_sets = partition_records_by_domain(records)
        all_partitioned = train + val + test
        assert not any(r["source"] == "phiusiil_benchmark" for r in all_partitioned)
        assert len(all_partitioned) == 1
        assert all_partitioned[0]["registered_domain"] == "normal.test"

    def test_unresolvable_record_missing_both_domain_and_hostname(self):
        # Record with no registered_domain and no hostname
        unresolvable_rec = {
            "record_id": "test:unresolvable:1",
            "raw_url": "http:///invalid",
            "label": "candidate_benign_domain",
        }
        quarantined = []
        train, val, test, domain_sets = partition_records_by_domain(
            [unresolvable_rec], quarantined_records=quarantined
        )

        # Must NOT be in train, val, or test
        assert len(train) == 0
        assert len(val) == 0
        assert len(test) == 0

        # Must be explicitly quarantined
        assert len(quarantined) == 1
        q = quarantined[0]
        assert q["split"] == "quarantine"
        assert q["label"] == "quarantine"
        assert q["original_label"] == "candidate_benign_domain"
        assert "UNRESOLVABLE_DOMAIN" in q["quarantine_reason"]

        # domain_sets integrity
        assert "unresolvable" in domain_sets["quarantine"]
        assert len(domain_sets["train"]) == 0
        assert len(domain_sets["val"]) == 0
        assert len(domain_sets["test"]) == 0

    def test_empty_and_whitespace_domain_values_quarantined(self):
        # Empty string, whitespace, tabs, and newlines
        assert assign_domain_split("") == "quarantine"
        assert assign_domain_split("   ") == "quarantine"
        assert assign_domain_split("\t\n") == "quarantine"
        assert assign_domain_split(None) == "quarantine"

        recs = [
            {"record_id": "empty:1", "registered_domain": "", "hostname": "", "label": "phishing"},
            {"record_id": "empty:2", "registered_domain": "   ", "hostname": None, "label": "candidate_benign_domain"},
            {"record_id": "empty:3", "registered_domain": "\t\n", "hostname": "  ", "label": "phishing"},
        ]
        quarantined = []
        train, val, test, domain_sets = partition_records_by_domain(recs, quarantined_records=quarantined)
        assert len(train) == 0
        assert len(val) == 0
        assert len(test) == 0
        assert len(quarantined) == 3
        assert all(q["split"] == "quarantine" for q in quarantined)
        assert quarantined[0]["original_label"] == "phishing"
        assert quarantined[1]["original_label"] == "candidate_benign_domain"

    def test_non_string_domain_values_handled_safely(self):
        # Non-string domain types must not crash and must be safely quarantined
        assert assign_domain_split(12345) == "quarantine"  # type: ignore
        assert assign_domain_split(["invalid.com"]) == "quarantine"  # type: ignore
        assert assign_domain_split(False) == "quarantine"  # type: ignore

        recs = [
            {"record_id": "non_str:1", "registered_domain": 12345, "hostname": None, "label": "phishing"},
            {"record_id": "non_str:2", "registered_domain": None, "hostname": ["bad_type"], "label": "candidate_benign_domain"},
        ]
        quarantined = []
        train, val, test, domain_sets = partition_records_by_domain(recs, quarantined_records=quarantined)
        assert len(train) == 0
        assert len(val) == 0
        assert len(test) == 0
        assert len(quarantined) == 2
        assert quarantined[0]["original_label"] == "phishing"
        assert quarantined[1]["original_label"] == "candidate_benign_domain"

    def test_public_suffix_only_hostname_not_treated_as_registrable(self):
        # Hostnames that are bare public suffixes without a preceding registrable label
        assert assign_domain_split("co.uk") == "quarantine"
        assert assign_domain_split("com") == "quarantine"
        assert assign_domain_split("gov.et") == "quarantine"
        assert assign_domain_split("github.io") == "quarantine"

        recs = [
            {"record_id": "psl_only:1", "registered_domain": None, "hostname": "co.uk", "label": "candidate_benign_domain"},
            {"record_id": "psl_only:2", "registered_domain": "gov.et", "hostname": "gov.et", "label": "candidate_benign_domain"},
            {"record_id": "psl_only:3", "registered_domain": None, "hostname": "com", "label": "phishing"},
        ]
        quarantined = []
        train, val, test, domain_sets = partition_records_by_domain(recs, quarantined_records=quarantined)
        assert len(train) == 0
        assert len(val) == 0
        assert len(test) == 0
        assert len(quarantined) == 3
        assert all(q["split"] == "quarantine" for q in quarantined)

    def test_splitter_without_optional_collector_does_not_raise(self):
        # Calling partition_records_by_domain without quarantined_records collector must work cleanly
        recs = [
            {"record_id": "no_col:1", "registered_domain": None, "hostname": None, "label": "candidate_benign_domain"},
            {"record_id": "no_col:2", "registered_domain": "bbc.co.uk", "normalized_url": "http://bbc.co.uk/", "label": "candidate_benign_domain"},
            {"record_id": "no_col:3", "registered_domain": None, "hostname": "co.uk", "label": "phishing"},
        ]
        # Should execute without raising any exception and return the 4-tuple
        train, val, test, domain_sets = partition_records_by_domain(recs)
        assert len(train) + len(val) + len(test) == 1
        assert not any(r.get("split") == "quarantine" for r in (train + val + test))
        assert "unresolvable" in domain_sets["quarantine"]

    def test_existing_quarantine_reasons_preserved(self):
        # Pre-existing quarantine reasons must not be overwritten by UNRESOLVABLE_DOMAIN
        recs = [
            {
                "record_id": "pre_reason:1",
                "registered_domain": None,
                "hostname": None,
                "label": "phishing",
                "quarantine_reason": "PRE_EXISTING_NORMALIZATION_ERROR: Invalid hex sequence",
            }
        ]
        quarantined = []
        train, val, test, domain_sets = partition_records_by_domain(recs, quarantined_records=quarantined)
        assert len(quarantined) == 1
        assert quarantined[0]["quarantine_reason"] == "PRE_EXISTING_NORMALIZATION_ERROR: Invalid hex sequence"
        assert quarantined[0]["original_label"] == "phishing"

    def test_duplicate_quarantine_records_avoided(self):
        # If a record ID is already in quarantined_records, it must not be duplicated
        existing_q = {"record_id": "dup:1", "split": "quarantine", "label": "quarantine"}
        quarantined = [existing_q]

        recs = [
            {"record_id": "dup:1", "registered_domain": None, "hostname": None, "label": "candidate_benign_domain"},
            {"record_id": "dup:2", "registered_domain": None, "hostname": None, "label": "phishing"},
        ]
        partition_records_by_domain(recs, quarantined_records=quarantined)
        # dup:1 should be skipped; dup:2 should be appended -> total 2 records
        assert len(quarantined) == 2
        assert [q["record_id"] for q in quarantined] == ["dup:1", "dup:2"]

    def test_pipeline_quarantine_collector_wiring_mock(self):
        # Verifies the run_pipeline.py quarantine collector integration logic
        all_quarantined = [{"record_id": "tranco:multi:1", "split": "quarantine", "label": "candidate_benign_domain"}]
        accepted_clean = [
            {"record_id": "good:1", "registered_domain": "ethiopia.gov.et", "split": None, "label": "candidate_benign_domain"},
            {"record_id": "good:2", "registered_domain": "cbe.com.et", "split": None, "label": "candidate_benign_domain"},
            {"record_id": "bad:1", "registered_domain": None, "hostname": "co.uk", "split": None, "label": "candidate_benign_domain"},
        ]

        train_recs, val_recs, test_recs, domain_sets = partition_records_by_domain(
            accepted_clean, quarantined_records=all_quarantined
        )

        # Pipeline filtering logic: exclude newly quarantined records from accepted_clean
        quarantined_ids = {r.get("record_id") for r in all_quarantined if r.get("record_id")}
        accepted_clean = [r for r in accepted_clean if r.get("record_id") not in quarantined_ids]

        assert len(all_quarantined) == 2
        assert any(q.get("record_id") == "bad:1" for q in all_quarantined)
        assert len(accepted_clean) == 2
        assert set(r["record_id"] for r in accepted_clean) == {"good:1", "good:2"}
        assert len(accepted_clean) == len(train_recs) + len(val_recs) + len(test_recs)

    def test_quarantine_records_never_mislabeled_as_test_records(self):
        # Mixed batch: 4 valid records + 2 unresolvable records
        batch = [
            {"registered_domain": "alpha.test", "normalized_url": "http://alpha.test/1", "label": "candidate_benign_domain"},
            {"registered_domain": "beta.test", "normalized_url": "http://beta.test/2", "label": "phishing"},
            {"registered_domain": "gamma.test", "normalized_url": "http://gamma.test/3", "label": "candidate_benign_domain"},
            {"registered_domain": "delta.test", "normalized_url": "http://delta.test/4", "label": "phishing"},
            {"raw_url": "malformed:1", "registered_domain": None, "hostname": None},
            {"raw_url": "malformed:2", "registered_domain": "", "hostname": "  "},
        ]
        quarantined = []
        train, val, test, domain_sets = partition_records_by_domain(batch, quarantined_records=quarantined)

        # Quarantined records must be isolated
        assert len(quarantined) == 2
        assert len(train) + len(val) + len(test) == 4

        # Crucial check: NO record in test partition may have split="quarantine"
        assert not any(r.get("split") == "quarantine" for r in test)
        assert not any(r.get("split") == "quarantine" for r in train)
        assert not any(r.get("split") == "quarantine" for r in val)

        # All records in each split must strictly match the partition name
        assert all(r.get("split") == "test" for r in test)
        assert all(r.get("split") == "val" for r in val)
        assert all(r.get("split") == "train" for r in train)

        # Zero domain leakage across train, val, and test
        assert domain_sets["train"].isdisjoint(domain_sets["val"])
        assert domain_sets["train"].isdisjoint(domain_sets["test"])
        assert domain_sets["val"].isdisjoint(domain_sets["test"])


class TestPSLDeterminismAndSnapshotIntegrity:
    """Verifies deterministic execution, offline guarantee, and fast failure on corrupt/missing snapshot."""

    def test_deterministic_output_across_repeated_runs(self):
        hostnames = [
            "google.com.hk", "cbe.com.et", "portal.ethiopia.gov.et",
            "shopee.co.id", "attacker.github.io", "city.kawasaki.jp"
        ]
        results_run1 = [extract_domain_components(h) for h in hostnames]
        results_run2 = [extract_domain_components(h) for h in hostnames]
        assert results_run1 == results_run2

    def test_zero_network_access_during_psl_operations(self, monkeypatch):
        def forbidden_connect(*args, **kwargs):
            raise RuntimeError("FORBIDDEN_NETWORK_CALL: PSL engine must be 100% offline!")

        monkeypatch.setattr(socket.socket, "connect", forbidden_connect)

        # Extraction must complete purely offline
        for h in ["portal.ethiopia.gov.et", "attacker.github.io", "city.kawasaki.jp"]:
            sub, reg, tld = extract_domain_components(h)
            assert reg is not None

    def test_missing_snapshot_fails_fast_with_actionable_error(self, tmp_path):
        missing_file = tmp_path / "missing_public_suffix_list.dat"
        with pytest.raises(PSLResourceError) as exc_info:
            PublicSuffixList(psl_path=missing_file)
        assert "not found" in str(exc_info.value).lower()
        assert "offline-first execution requires the pinned snapshot" in str(exc_info.value).lower()

    def test_checksum_mismatch_fails_fast_with_actionable_error(self, tmp_path):
        corrupt_file = tmp_path / "corrupt_psl.dat"
        corrupt_file.write_text("// Corrupted snapshot without valid data", encoding="utf-8")
        with pytest.raises(PSLResourceError) as exc_info:
            PublicSuffixList(psl_path=corrupt_file, verify_checksum=True)
        assert "checksum verification failed" in str(exc_info.value).lower()
        assert EXPECTED_PSL_SHA256 in str(exc_info.value)


class TestWangchukIngestionAdapter:
    """Verifies feature stripping, honest label mapping, offline execution, and schema safety."""

    SYNTHETIC_WANGCHUK_CSV = (
        "url,length_url,nb_dots,nb_hyphens,ratio_digits_url,ratio_digits_host,tld_in_subdomain,status\n"
        "http://observed-legit.example.org/path/resource,46,2,1,0.0,0.0,0,0\n"
        "http://phish-attack.example.net/secure/login,43,2,1,0.0,0.0,0,1\n"
        "http://.invalid-host.test/path,39,1,1,0.0,0.0,0,1\n"
        "http://ambiguous-label.example.com/test,38,2,1,0.0,0.0,0,99\n"
        ",0,0,0,0.0,0.0,0,0\n"
    )

    def test_wangchuk_feature_stripping_and_field_isolation(self):
        """Precomputed features (e.g. length_url, nb_dots) must NEVER be ingested into standardized records."""
        accepted, quarantined = ingest_wangchuk_records(self.SYNTHETIC_WANGCHUK_CSV)
        assert len(accepted) == 2
        for rec in accepted:
            # Confirm NO upstream precomputed feature leaked into record
            assert "length_url" not in rec
            assert "nb_dots" not in rec
            assert "ratio_digits_url" not in rec
            assert "ratio_digits_host" not in rec
            assert "tld_in_subdomain" not in rec
            assert "status" not in rec

            # Confirm canonical schema keys exist
            assert rec["source"] == "wangchuk_2026"
            assert rec["original_data_type"] == "full_url"
            assert rec["split"] is None

    def test_wangchuk_label_mapping_integrity(self):
        """Common Crawl mapped to observed_legitimate_url (candidate); PhishTank mapped to phishing (unverified)."""
        accepted, quarantined = ingest_wangchuk_records(self.SYNTHETIC_WANGCHUK_CSV)
        rec_legit = next(r for r in accepted if "observed-legit" in r["normalized_url"])
        rec_phish = next(r for r in accepted if "phish-attack" in r["normalized_url"])

        # Legitimate row (status=0)
        assert rec_legit["label"] == "observed_legitimate_url"
        assert rec_legit["label_status"] == "candidate"
        assert rec_legit["verification_status"] == "common_crawl_observed_candidate"

        # Phishing row (status=1) — MUST NOT fabricate 'verified' status
        assert rec_phish["label"] == "phishing"
        assert rec_phish["label_status"] == "unverified"
        assert rec_phish["verification_status"] == "wangchuk_unverified_phishing"

    def test_wangchuk_quarantine_reasons(self):
        """Malformed URLs, empty URLs, and ambiguous labels are quarantined with actionable reasons."""
        accepted, quarantined = ingest_wangchuk_records(self.SYNTHETIC_WANGCHUK_CSV)
        assert len(quarantined) == 3
        reasons = [q["quarantine_reason"] for q in quarantined]
        assert any("EMPTY_RAW_URL" in r for r in reasons)
        assert any("NORMALIZATION" in r or "INVALID" in r or "UNSUPPORTED" in r for r in reasons)
        assert any("AMBIGUOUS_SOURCE_LABEL" in r for r in reasons)

    def test_wangchuk_malformed_schema_rejection(self):
        """CSV without recognizable URL or label columns must raise WangchukSchemaError."""
        bad_csv1 = "feature1,feature2,feature3\n1,2,3\n"
        with pytest.raises(WangchukSchemaError) as exc1:
            ingest_wangchuk_records(bad_csv1)
        assert "MALFORMED_INPUT_SCHEMA" in str(exc1.value)

        bad_csv2 = "url,feature2,feature3\nhttp://example.com,2,3\n"
        with pytest.raises(WangchukSchemaError) as exc2:
            ingest_wangchuk_records(bad_csv2)
        assert "label column" in str(exc2.value).lower()

    def test_wangchuk_offline_guarantee(self, monkeypatch):
        """Wangchuk ingestion adapter must execute 100% offline with zero network lookups."""
        def forbidden_connect(*args, **kwargs):
            raise RuntimeError("FORBIDDEN_NETWORK_CALL: Ingestion adapter must be offline!")

        monkeypatch.setattr(socket.socket, "connect", forbidden_connect)
        accepted, quarantined = ingest_wangchuk_records(self.SYNTHETIC_WANGCHUK_CSV)
        assert len(accepted) == 2


class TestSchemaTaxonomyAndLegacyCompatibility:
    """Verifies schema taxonomy updates and non-breaking backward compatibility with existing corpus."""

    def test_taxonomy_valid_labels_and_types(self):
        assert "observed_legitimate_url" in VALID_LABELS
        assert "candidate_benign_domain" in VALID_LABELS
        assert "phishing" in VALID_LABELS
        assert "root_domain" in VALID_ORIGINAL_DATA_TYPES
        assert "full_url" in VALID_ORIGINAL_DATA_TYPES
        assert "original_data_type" in RECORD_SCHEMA_FIELDS

    def test_legacy_record_backward_compatibility(self):
        """Legacy records without original_data_type must validate cleanly under backward-compatibility mode."""
        legacy_rec = {
            "record_id": "tranco:1:abcdef123456",
            "source": "tranco",
            "raw_url": "google.com",
            "normalized_url": "http://google.com/",
            "registered_domain": "google.com",
            "label": "candidate_benign_domain",
            "label_status": "candidate",
            "verification_status": "tranco_ranked_pld",
        }
        # In legacy mode (default):
        valid, err = validate_record_schema(legacy_rec, allow_legacy_missing_datatype=True)
        assert valid
        assert err is None

        # In strict mode:
        valid_strict, err_strict = validate_record_schema(legacy_rec, allow_legacy_missing_datatype=False)
        assert not valid_strict
        assert "Missing original_data_type" in err_strict

    def test_new_records_with_original_data_type(self):
        rec_domain = {
            "label": "candidate_benign_domain",
            "label_status": "candidate",
            "original_data_type": "root_domain",
        }
        valid1, _ = validate_record_schema(rec_domain)
        assert valid1

        rec_url = {
            "label": "observed_legitimate_url",
            "label_status": "candidate",
            "original_data_type": "full_url",
        }
        valid2, _ = validate_record_schema(rec_url)
        assert valid2

        rec_bad = {
            "label": "observed_legitimate_url",
            "label_status": "candidate",
            "original_data_type": "invalid_type_name",
        }
        valid3, err3 = validate_record_schema(rec_bad)
        assert not valid3
        assert "Invalid original_data_type" in err3


class TestBenchmarkCollisionQuarantine:
    """Verifies fail-closed benchmark isolation, canonical domain extraction, and proactive collision quarantine."""

    def test_benchmark_fail_closed_on_missing_file(self, tmp_path):
        """If benchmark file does not exist, fail-closed security raises BenchmarkIsolationError."""
        missing = tmp_path / "non_existent_benchmark.jsonl"
        with pytest.raises(BenchmarkIsolationError) as exc_info:
            load_benchmark_registered_domains(missing)
        assert "BENCHMARK_ISOLATION_FAILURE" in str(exc_info.value)
        assert "Failing closed" in str(exc_info.value)

    def test_benchmark_fail_closed_on_empty_file(self, tmp_path):
        """If benchmark file has 0 valid registered domains, fail-closed security raises BenchmarkIsolationError."""
        empty_file = tmp_path / "empty_benchmark.jsonl"
        empty_file.write_text("", encoding="utf-8")
        with pytest.raises(BenchmarkIsolationError) as exc_info:
            load_benchmark_registered_domains(empty_file)
        assert "zero valid registered domains" in str(exc_info.value).lower()

    def test_benchmark_fail_closed_on_corrupt_json(self, tmp_path):
        """If benchmark file contains any corrupted non-JSON line, fail closed with BenchmarkIsolationError."""
        corrupt_file = tmp_path / "corrupt_benchmark.jsonl"
        corrupt_file.write_text(
            '{"record_id": "b1", "normalized_url": "http://valid.test/1"}\n'
            'NOT_VALID_JSON_LINE\n'
            '{"record_id": "b2", "normalized_url": "http://valid.test/2"}\n',
            encoding="utf-8",
        )
        with pytest.raises(BenchmarkIsolationError) as exc_info:
            load_benchmark_registered_domains(corrupt_file)
        assert "malformed JSON" in str(exc_info.value)

    def test_benchmark_fail_closed_on_unresolvable_record(self, tmp_path):
        """If any benchmark record cannot be resolved to a canonical domain, fail closed."""
        unresolvable_file = tmp_path / "unresolvable_benchmark.jsonl"
        unresolvable_file.write_text(
            '{"record_id": "b1", "raw_url": "http:///missing-host"}\n',
            encoding="utf-8",
        )
        with pytest.raises(BenchmarkIsolationError) as exc_info:
            load_benchmark_registered_domains(unresolvable_file)
        assert "could not be resolved to a canonical registered domain" in str(exc_info.value)

    def test_extract_canonical_registered_domain_helper(self):
        """Verifies canonical registered domain extraction across ordinary, ccTLD, and private suffixes."""
        # Ordinary domain
        rec_ord = {"normalized_url": "https://sub.example.com/path", "registered_domain": "example.com"}
        assert extract_canonical_registered_domain(rec_ord) == "example.com"

        # Ethiopian ccTLD
        rec_et = {"normalized_url": "https://portal.ethiopia.gov.et/serv", "registered_domain": "ethiopia.gov.et"}
        assert extract_canonical_registered_domain(rec_et) == "ethiopia.gov.et"

        # International ccTLD
        rec_id = {"normalized_url": "https://shopee.co.id/item", "registered_domain": "shopee.co.id"}
        assert extract_canonical_registered_domain(rec_id) == "shopee.co.id"

        # Private suffix github.io tenant
        rec_gh = {"normalized_url": "https://my-app.github.io/demo", "registered_domain": "my-app.github.io"}
        assert extract_canonical_registered_domain(rec_gh) == "my-app.github.io"

        # Private suffix appspot.com tenant
        rec_as = {"normalized_url": "https://secure-auth.appspot.com/login", "registered_domain": "secure-auth.appspot.com"}
        assert extract_canonical_registered_domain(rec_as) == "secure-auth.appspot.com"

        # Multi-tenant root fallback (e.g. s3.amazonaws.com without tenant subdomain falls back to ICANN amazonaws.com)
        rec_s3 = {"raw_url": "https://s3.amazonaws.com/bucket/key", "registered_domain": "s3.amazonaws.com"}
        assert extract_canonical_registered_domain(rec_s3) == "amazonaws.com"

        # Fallback to hostname when URL not present
        rec_host = {"hostname": "victim.github.io"}
        assert extract_canonical_registered_domain(rec_host) == "victim.github.io"

        # Legacy record with bare public suffix registered_domain string
        rec_legacy_bare = {"registered_domain": "github.io"}
        assert extract_canonical_registered_domain(rec_legacy_bare) == "github.io"

        # Malformed or unresolvable
        assert extract_canonical_registered_domain({"raw_url": "http:///"}) is None
        assert extract_canonical_registered_domain({}) is None

    def test_benchmark_collision_ordinary_domains(self, tmp_path):
        """Ordinary domain collisions are caught and quarantined while disjoint domains pass cleanly."""
        bench_file = tmp_path / "ordinary_benchmark.jsonl"
        bench_file.write_text(
            '{"record_id": "b1", "normalized_url": "https://benchmark-bank.com/portal"}\n'
            '{"record_id": "b2", "normalized_url": "https://benchmark-shop.org/cart"}\n',
            encoding="utf-8",
        )
        benchmark_domains = load_benchmark_registered_domains(bench_file)
        assert benchmark_domains == {"benchmark-bank.com", "benchmark-shop.org"}

        candidates = [
            {"record_id": "c1", "raw_url": "https://sub.benchmark-bank.com/login", "label": "phishing"},
            {"record_id": "c2", "raw_url": "https://innocent-site.net/page", "label": "observed_legitimate_url"},
            {"record_id": "c3", "raw_url": "https://benchmark-shop.org/item/42", "label": "phishing"},
        ]
        quarantined = []
        clean, collisions = quarantine_benchmark_collisions(candidates, benchmark_domains, quarantined_records=quarantined)

        assert len(clean) == 1
        assert clean[0]["record_id"] == "c2"

        assert len(collisions) == 2
        collision_ids = {c["record_id"] for c in collisions}
        assert collision_ids == {"c1", "c3"}
        assert all(c["split"] == "quarantine" for c in collisions)
        assert all("BENCHMARK_DOMAIN_COLLISION" in c["quarantine_reason"] for c in collisions)

    def test_benchmark_collision_private_suffixes_github_io_and_appspot(self, tmp_path):
        """
        Multi-tenant platform private suffixes (github.io, appspot.com):
        Candidate on the SAME tenant MUST collide and be quarantined.
        Candidate on a DIFFERENT tenant under the same platform MUST NOT collide.
        """
        bench_file = tmp_path / "private_suffix_benchmark.jsonl"
        bench_file.write_text(
            '{"record_id": "b1", "normalized_url": "https://eval-victim.github.io/index.html"}\n'
            '{"record_id": "b2", "normalized_url": "https://cloud-eval.appspot.com/api/v1"}\n',
            encoding="utf-8",
        )
        benchmark_domains = load_benchmark_registered_domains(bench_file)
        # Expected canonical domains are the tenant domains, NOT the bare 'github.io' or 'appspot.com'
        assert benchmark_domains == {"eval-victim.github.io", "cloud-eval.appspot.com"}
        assert "github.io" not in benchmark_domains
        assert "appspot.com" not in benchmark_domains

        candidates = [
            # Candidate 1: Same tenant on github.io -> MUST COLLIDE
            {"record_id": "c_gh_same", "raw_url": "https://eval-victim.github.io/phish/login", "label": "phishing"},
            # Candidate 2: Different tenant on github.io -> MUST NOT COLLIDE
            {"record_id": "c_gh_diff", "raw_url": "https://independent-dev.github.io/project", "label": "observed_legitimate_url"},
            # Candidate 3: Same tenant on appspot.com -> MUST COLLIDE
            {"record_id": "c_as_same", "raw_url": "https://cloud-eval.appspot.com/login", "label": "phishing"},
            # Candidate 4: Different tenant on appspot.com -> MUST NOT COLLIDE
            {"record_id": "c_as_diff", "raw_url": "https://other-customer.appspot.com/dashboard", "label": "observed_legitimate_url"},
        ]
        quarantined = []
        clean, collisions = quarantine_benchmark_collisions(candidates, benchmark_domains, quarantined_records=quarantined)

        clean_ids = {r["record_id"] for r in clean}
        collision_ids = {r["record_id"] for r in collisions}

        assert clean_ids == {"c_gh_diff", "c_as_diff"}
        assert collision_ids == {"c_gh_same", "c_as_same"}

    def test_benchmark_collision_with_malformed_candidate_urls(self):
        """Malformed candidate URLs without determinable canonical domain are safely quarantined."""
        benchmark_domains = {"legit-eval.com"}
        candidates = [
            {"record_id": "c_malformed", "raw_url": "http:///invalid-no-host", "label": "phishing"},
            {"record_id": "c_valid", "raw_url": "https://fresh-candidate.org/path", "label": "phishing"},
        ]
        quarantined = []
        clean, collisions = quarantine_benchmark_collisions(candidates, benchmark_domains, quarantined_records=quarantined)

        # c_valid passes cleanly
        assert len(clean) == 1
        assert clean[0]["record_id"] == "c_valid"

        # c_malformed is quarantined for unresolvable domain
        assert len(collisions) == 1
        assert collisions[0]["record_id"] == "c_malformed"
        assert collisions[0]["split"] == "quarantine"
        assert "UNRESOLVABLE_DOMAIN" in collisions[0]["quarantine_reason"]

    def test_real_benchmark_loader_canonical_domain_count(self):
        """
        Verifies against the actual benchmark_phiusiil.jsonl artifact:
        - Exactly 941 unique canonical registered domains are loaded.
        - Zero bare public suffixes exist in the benchmark domain set.
        - Multi-tenant subdomains exist as isolated tenant domains.
        """
        benchmark_domains = load_benchmark_registered_domains()
        assert len(benchmark_domains) == 941

        # Bare public suffixes must NOT be present as domains
        assert "github.io" not in benchmark_domains
        assert "appspot.com" not in benchmark_domains
        assert "firebaseapp.com" not in benchmark_domains
        assert "web.app" not in benchmark_domains
        assert "com.ar" not in benchmark_domains
        assert "ac.id" not in benchmark_domains
        assert "amazonaws.com" in benchmark_domains  # Path-style s3.amazonaws.com fallback

        # Specific private suffix tenants must be present
        assert "anilreddydev.github.io" in benchmark_domains
        assert "ssd1ku1qyf.firebaseapp.com" in benchmark_domains



class TestCompromisedDomainSplitHazardHandling:
    """Verifies distinction between exact URL conflicts and compromised domains with mixed labels across paths."""

    def test_exact_canonical_url_conflict_vs_different_paths(self):
        """
        Exact canonical URLs with contradictory labels -> CONFLICTING_SOURCE_LABELS
        Different paths on same domain with contradictory labels -> COMPROMISED_DOMAIN_SPLIT_HAZARD
        """
        # Exact URL duplicate conflict:
        exact_conflict_records = [
            {"normalized_url": "http://exact.test/login", "label": "phishing", "id": "1"},
            {"normalized_url": "http://exact.test/login", "label": "observed_legitimate_url", "id": "2"},
        ]
        accepted, dups, conflicts = deduplicate_records(exact_conflict_records)
        assert len(accepted) == 0
        assert len(conflicts) == 2
        assert all("CONFLICTING_SOURCE_LABELS" in c["quarantine_reason"] for c in conflicts)

        # Different paths on same registered domain:
        mixed_path_records = [
            {"record_id": "p1", "registered_domain": "compromised.test", "normalized_url": "http://compromised.test/clean_about", "label": "observed_legitimate_url"},
            {"record_id": "p2", "registered_domain": "compromised.test", "normalized_url": "http://compromised.test/hacked_lure", "label": "phishing"},
        ]
        # deduplicate_records must NOT treat them as exact duplicate conflicts:
        acc_dedup, dups_dedup, conf_dedup = deduplicate_records(mixed_path_records)
        assert len(acc_dedup) == 2
        assert len(conf_dedup) == 0

        # But quarantine_compromised_domain_hazards MUST quarantine them:
        clean, hazard_q = quarantine_compromised_domain_hazards(mixed_path_records)
        assert len(clean) == 0
        assert len(hazard_q) == 2
        assert all("COMPROMISED_DOMAIN_SPLIT_HAZARD" in q["quarantine_reason"] for q in hazard_q)

    def test_same_domain_pure_benign_paths_not_quarantined(self):
        """Multiple legitimate paths on the same registered domain must NOT be quarantined and stay together."""
        records = [
            {"record_id": "b1", "registered_domain": "portal.gov.et", "normalized_url": "http://portal.gov.et/news", "label": "observed_legitimate_url"},
            {"record_id": "b2", "registered_domain": "portal.gov.et", "normalized_url": "http://portal.gov.et/services", "label": "candidate_benign_domain"},
        ]
        clean, hazard_q = quarantine_compromised_domain_hazards(records)
        assert len(clean) == 2
        assert len(hazard_q) == 0

        # When partitioned by domain:
        train, val, test, domain_sets = partition_records_by_domain(records)
        all_assigned = train + val + test
        assert len(all_assigned) == 2
        splits = {r["split"] for r in all_assigned}
        assert len(splits) == 1  # Both URLs are in the exact same split!

    def test_same_domain_pure_phishing_paths_not_quarantined(self):
        """Multiple phishing lures on the same registered domain must NOT be quarantined as compromised."""
        records = [
            {"record_id": "ph1", "registered_domain": "attacker-infra.test", "normalized_url": "http://attacker-infra.test/lure1", "label": "phishing"},
            {"record_id": "ph2", "registered_domain": "attacker-infra.test", "normalized_url": "http://attacker-infra.test/lure2", "label": "phishing"},
        ]
        clean, hazard_q = quarantine_compromised_domain_hazards(records)
        assert len(clean) == 2
        assert len(hazard_q) == 0

        train, val, test, domain_sets = partition_records_by_domain(records)
        all_assigned = train + val + test
        assert len(all_assigned) == 2
        splits = {r["split"] for r in all_assigned}
        assert len(splits) == 1  # Both lures are in the exact same split!


