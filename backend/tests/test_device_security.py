"""Unit and Integration Tests for CyberShield Ethiopia Device Security Check Subsystem."""

import datetime
import os
import platform
import subprocess
import pytest
from unittest.mock import patch, MagicMock

from app import device_security_service
from app.routes_device_security import DeviceScanRequest, FileScanRequest, router


ALLOWED_STATUSES = {"PASS", "WARNING", "FAIL", "NOT CHECKED", "NOT SUPPORTED"}
ALLOWED_SEVERITIES = {"CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"}


def test_mask_identifier():
    # Long identifier
    assert device_security_service.mask_identifier("DESKTOP-4OMINM6", prefix_len=7) == "DESKTOP***"
    # Short identifier
    assert device_security_service.mask_identifier("PC", prefix_len=5) == "***"
    assert device_security_service.mask_identifier("PRO", prefix_len=5) == "PR***"
    # Empty identifier
    assert device_security_service.mask_identifier("", prefix_len=7) == "DEVICE-***"
    assert device_security_service.mask_identifier(None, prefix_len=7) == "DEVICE-***"


def test_filetime_to_datetime():
    # Known FILETIME from Windows Defender registry: b'\xe0\xbaC\x08\xc3j\xdd\x01' -> 2026-11-02 12:09:38 UTC
    raw = b"\xe0\xbaC\x08\xc3j\xdd\x01"
    dt = device_security_service.filetime_to_datetime(raw)
    assert dt is not None
    assert dt.year == 2026
    assert dt.month == 11
    assert dt.day == 2

    # Invalid cases
    assert device_security_service.filetime_to_datetime(b"short") is None
    assert device_security_service.filetime_to_datetime(0) is None
    assert device_security_service.filetime_to_datetime(-100) is None


def test_windows_defender_assessment_structure():
    findings = device_security_service.assess_windows_defender()
    assert isinstance(findings, list)
    assert len(findings) >= 1

    ids = [f["id"] for f in findings]
    assert "DEF-SIG" in ids
    assert "DEF-RTP" in ids
    assert "DEF-CLI" in ids
    assert "DEF-LAST-SCAN" in ids

    for f in findings:
        assert "id" in f
        assert "category" in f
        assert "name" in f
        assert "status" in f
        assert "severity" in f
        assert "evidence" in f
        assert "remediation" in f
        assert f["status"] in ALLOWED_STATUSES
        assert f["severity"] in ALLOWED_SEVERITIES


def test_windows_firewall_assessment_structure():
    findings = device_security_service.assess_windows_firewall()
    assert isinstance(findings, list)
    assert len(findings) >= 1

    ids = [f["id"] for f in findings]
    assert "FW-DOM" in ids
    assert "FW-PRIV" in ids
    assert "FW-PUB" in ids
    assert "FW-SVC" in ids

    for f in findings:
        assert f["status"] in ALLOWED_STATUSES
        assert f["severity"] in ALLOWED_SEVERITIES
        assert f["category"] == "Firewall"


def test_windows_updates_assessment_structure():
    findings = device_security_service.assess_windows_updates()
    assert isinstance(findings, list)
    assert len(findings) >= 1

    for f in findings:
        assert f["status"] in ALLOWED_STATUSES
        assert f["severity"] in ALLOWED_SEVERITIES
        assert f["category"] == "OS Updates"


def test_system_hardening_assessment_structure():
    findings = device_security_service.assess_system_hardening()
    assert isinstance(findings, list)
    if platform.system() == "Windows":
        assert len(findings) >= 1
        for f in findings:
            assert f["status"] in ALLOWED_STATUSES
            assert f["category"] == "System Hardening"


def test_android_device_assessment_honesty():
    res = device_security_service.assess_android_device()
    assert isinstance(res, dict)
    assert "status" in res
    assert "device_summary" in res
    assert "findings" in res
    assert "limitations" in res
    assert res["status"] in ALLOWED_STATUSES

    # Check that Google Play Protect is never claimed to be scanned if unsupported
    pp_finding = next((f for f in res["findings"] if f["id"] == "AND-PLAY-PROTECT"), None)
    if pp_finding:
        assert pp_finding["status"] in ("NOT SUPPORTED", "WARNING")


def test_android_missing_adb():
    with patch("app.device_security_service.find_adb_tool", return_value=None):
        res = device_security_service.assess_android_device()
        assert res["is_available"] is False
        assert res["adb_state"] == "MISSING"
        assert res["status"] == "NOT SUPPORTED"
        assert "ADB is not installed. Android assessment is unavailable on this computer." in res["message"]
        assert any("ADB is not installed" in f["evidence"] for f in res["findings"])


def test_android_no_device_connected():
    with patch("app.device_security_service.find_adb_tool", return_value="C:\\dummy\\adb.exe"):
        mock_proc = MagicMock()
        mock_proc.stdout = "List of devices attached\n\n"
        with patch("subprocess.run", return_value=mock_proc):
            res = device_security_service.assess_android_device()
            assert res["adb_state"] == "NO_DEVICE"
            assert res["status"] == "NOT SUPPORTED"
            assert "No Android device detected. Connect an authorized Android device to continue." in res["message"]


def test_android_unauthorized_device():
    with patch("app.device_security_service.find_adb_tool", return_value="C:\\dummy\\adb.exe"):
        mock_proc = MagicMock()
        mock_proc.stdout = "List of devices attached\nRZ8M10ABCDE\tunauthorized\n\n"
        with patch("subprocess.run", return_value=mock_proc):
            res = device_security_service.assess_android_device()
            assert res["adb_state"] == "UNAUTHORIZED"
            assert res["status"] == "WARNING"
            assert "Android device detected, but USB debugging authorization is pending." in res["message"]
            auth_finding = next((f for f in res["findings"] if f["id"] == "AND-AUTH"), None)
            assert auth_finding is not None
            assert auth_finding["status"] == "WARNING"


def test_android_authorized_device_full_scan():
    with patch("app.device_security_service.find_adb_tool", return_value="C:\\dummy\\adb.exe"):
        def mock_subp_run(cmd, *args, **kwargs):
            mock = MagicMock()
            if cmd == ["C:\\dummy\\adb.exe", "devices"]:
                mock.stdout = "List of devices attached\n123456789\tdevice\n\n"
            elif "getprop" in cmd:
                prop_name = cmd[-1]
                props = {
                    "ro.product.model": "Galaxy S23",
                    "ro.product.manufacturer": "Samsung",
                    "ro.build.display.id": "UP1A.231005.007",
                    "ro.build.version.release": "14",
                    "ro.build.version.security_patch": "2026-10-01",
                    "ro.boot.flash.locked": "1",
                    "ro.boot.verifiedbootstate": "green",
                    "ro.boot.veritymode": "enforcing",
                }
                mock.stdout = props.get(prop_name, "")
            elif "lockscreen.disabled" in cmd:
                mock.stdout = "0\n"
            elif "install_non_market_apps" in cmd:
                mock.stdout = "0\n"
            elif "packages" in cmd:
                mock.stdout = "package:com.example.app1\npackage:com.example.app2\n"
            else:
                mock.stdout = ""
            return mock

        with patch("subprocess.run", side_effect=mock_subp_run):
            res = device_security_service.assess_android_device()
            assert res["adb_state"] == "AUTHORIZED"
            assert res["is_available"] is True
            findings = res["findings"]
            ids = [f["id"] for f in findings]
            assert "AND-VER" in ids
            assert "AND-PATCH" in ids
            assert "AND-BUILD" in ids
            assert "AND-BOOT" in ids
            assert "AND-VERITY" in ids
            assert "AND-AUTH" in ids
            assert "AND-LOCK" in ids
            assert "AND-UNKNOWN-SRC" in ids
            assert "AND-APPS" in ids
            assert "AND-PLAY-PROTECT" in ids
            assert len(findings) == 10

            # Verified bootlock status
            boot_f = next(f for f in findings if f["id"] == "AND-BOOT")
            assert boot_f["status"] == "PASS"

            # Unknown sources
            unknown_f = next(f for f in findings if f["id"] == "AND-UNKNOWN-SRC")
            assert unknown_f["status"] == "PASS"


def test_consent_enforcement():
    # Without consent: must reject
    res = device_security_service.run_device_assessment(target="windows", consent_granted=False)
    assert res["success"] is False
    assert res["error"] == "CONSENT_REQUIRED"

    # With consent: succeeds
    res_ok = device_security_service.run_device_assessment(target="windows", consent_granted=True)
    assert res_ok["success"] is True
    assert "device_summary" in res_ok
    assert "metrics" in res_ok
    assert res_ok["overall_status"] in ALLOWED_STATUSES


def test_metrics_and_scoring_rules():
    res = device_security_service.run_device_assessment(target="windows", consent_granted=True)
    metrics = res["metrics"]
    total = metrics["total_checks"]
    sum_checks = (
        metrics["pass_count"]
        + metrics["warning_count"]
        + metrics["fail_count"]
        + metrics["not_supported_count"]
        + metrics["not_checked_count"]
    )
    assert total == sum_checks

    # Rule: If any check failed, overall status cannot be PASS
    if metrics["fail_count"] > 0:
        assert res["overall_status"] != "PASS"


def test_execute_defender_scan_safety_boundaries():
    # Calling custom scan on non-existent file
    res = device_security_service.execute_defender_scan(scan_type="custom", custom_path="C:\\non_existent_dummy_file.tmp")
    assert res["success"] is False
    assert "Target path does not exist" in res["error"]


def test_routes_device_security():
    # Test GET /status
    from app.routes_device_security import device_security_status, scan_device, scan_file, DeviceScanRequest, FileScanRequest
    status_resp = device_security_status()
    assert status_resp["status"] == "ready"
    assert "capabilities" in status_resp
    assert "android_status" in status_resp
    assert "target_environment" in status_resp

    # Test POST /scan without consent -> 400
    req_no_consent = DeviceScanRequest(target="windows", consent=False)
    resp_bad = scan_device(req_no_consent)
    assert resp_bad.status_code == 400

    # Test POST /scan with consent -> success dict
    req_ok = DeviceScanRequest(target="windows", consent=True)
    resp_ok = scan_device(req_ok)
    assert resp_ok["success"] is True
    assert resp_ok["target"] == "windows"

    # Test POST /scan-file without consent -> 400
    f_no_consent = FileScanRequest(file_path="dummy.txt", consent=False)
    assert scan_file(f_no_consent).status_code == 400

    # Test POST /scan-file UNC path rejection -> 400
    f_unc = FileScanRequest(file_path=r"\\evil-server\share\payload.exe", consent=True)
    resp_unc = scan_file(f_unc)
    assert resp_unc.status_code == 400
    assert "UNC" in str(resp_unc.body)

    # Test POST /scan-file DOS device path rejection -> 400
    f_dos = FileScanRequest(file_path="NUL", consent=True)
    resp_dos = scan_file(f_dos)
    assert resp_dos.status_code == 400
    assert "DEVICE_PATH" in str(resp_dos.body)

    # Test POST /scan-file non-existent file rejection -> 400
    f_missing = FileScanRequest(file_path="C:\\non_existent_dummy_file.exe", consent=True)
    resp_missing = scan_file(f_missing)
    assert resp_missing.status_code == 400
    assert "TARGET_NOT_A_FILE" in str(resp_missing.body)


def test_real_time_protection_not_fabricated():
    # Verify that DEF-RTP is not fabricated as PASS without live service proof
    res = device_security_service.run_device_assessment(target="windows", consent_granted=True)
    rtp_finding = next((f for f in res["findings"] if f["id"] == "DEF-RTP"), None)
    assert rtp_finding is not None
    # Because CIM access is restricted in standard user sessions, it must be NOT CHECKED (or FAIL if disabled)
    assert rtp_finding["status"] in ("NOT CHECKED", "FAIL")
    # And overall status must NOT be PASS if critical check is NOT CHECKED
    if rtp_finding["status"] == "NOT CHECKED":
        assert res["overall_status"] != "PASS"


def test_generate_device_security_pdf():
    assessment = device_security_service.run_device_assessment(target="windows", consent_granted=True)

    for lang in ("en", "om", "am"):
        pdf_bytes = device_security_service.generate_device_security_pdf(assessment, language=lang)
        assert isinstance(pdf_bytes, (bytes, bytearray))
        assert pdf_bytes.startswith(b"%PDF-1.4")
        assert b"%%EOF" in pdf_bytes
        assert len(pdf_bytes) > 200


def test_routes_export_pdf_report():
    from app.routes_device_security import export_pdf_report, PdfReportRequest

    # Consent required
    req_no_consent = PdfReportRequest(consent=False, language="en")
    resp_no_consent = export_pdf_report(req_no_consent)
    assert resp_no_consent.status_code == 400

    # Successful export
    req_ok = PdfReportRequest(consent=True, language="om")
    resp_ok = export_pdf_report(req_ok)
    assert resp_ok.status_code == 200
    assert resp_ok.media_type == "application/pdf"
    assert resp_ok.body.startswith(b"%PDF-1.4")
    assert b"%%EOF" in resp_ok.body


def test_new_device_security_checks():
    from app import device_security_service

    # 1. Disk encryption
    enc_findings = device_security_service.assess_disk_encryption()
    assert isinstance(enc_findings, list)
    if enc_findings:
        assert enc_findings[0]["category"] == "Disk Encryption"
        assert enc_findings[0]["status"] in ("PASS", "WARNING", "FAIL", "NOT CHECKED", "NOT SUPPORTED")
        assert "why_it_matters" in enc_findings[0]

    # 2. Screen lock
    lock_findings = device_security_service.assess_screen_lock_windows()
    assert isinstance(lock_findings, list)
    if lock_findings:
        assert lock_findings[0]["category"] == "Physical Security"
        assert lock_findings[0]["status"] in ("PASS", "WARNING", "FAIL", "NOT CHECKED", "NOT SUPPORTED")
        assert "why_it_matters" in lock_findings[0]

    # 3. Startup persistence (read-only audit)
    startup_findings = device_security_service.assess_startup_persistence()
    assert isinstance(startup_findings, list)
    if startup_findings:
        assert startup_findings[0]["category"] == "Startup Persistence"
        assert startup_findings[0]["status"] in ("PASS", "WARNING", "FAIL", "NOT CHECKED", "NOT SUPPORTED")
        assert "why_it_matters" in startup_findings[0]

    # 4. Process monitoring safety rules
    proc_findings = device_security_service.assess_running_processes_limited()
    assert isinstance(proc_findings, list)
    assert len(proc_findings) > 0
    assert proc_findings[0]["category"] == "Process Monitoring"
    # Must never claim malware without evidence
    assert proc_findings[0]["status"] in ("PASS", "NOT SUPPORTED", "WARNING")

    # 5. Full assessment includes all new checks
    full_assessment = device_security_service.run_device_assessment(target="windows", consent_granted=True)
    assert full_assessment["success"] is True
    categories = {f["category"] for f in full_assessment["findings"]}
    assert "Disk Encryption" in categories
    assert "Physical Security" in categories
    assert "Startup Persistence" in categories
    assert "Process Monitoring" in categories

    # 6. Overall rating must NEVER claim "VERIFIED_SECURE" or "100% SECURE"
    assert full_assessment["overall_rating"] != "VERIFIED_SECURE"
    assert "100%" not in full_assessment["overall_rating"]
