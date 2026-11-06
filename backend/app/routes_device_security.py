"""CyberShield Ethiopia — Device Security Check API Routes.

Provides endpoints for local device security assessment, Windows Defender status,
firewall verification, patch freshness, and Android bridge inspection.
Zero telemetry; strictly bounded to local loopback operations.
"""

from __future__ import annotations

import os
import platform
import re
from pathlib import Path
from typing import Optional
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from . import device_security_service

router = APIRouter(prefix="/api/v1/device-security", tags=["device_security"])


class DeviceScanRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    target: str = Field(default="windows", max_length=16)
    run_quick_scan: bool = Field(default=False)
    consent: bool = Field(default=False)


class FileScanRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    file_path: str = Field(max_length=512)
    consent: bool = Field(default=False)


@router.get("/status", summary="Query device security subsystem readiness")
def device_security_status():
    """Return local host capability and supported device targets."""
    host_os = platform.system()
    adb_tool = device_security_service.find_adb_tool()
    adb_available = adb_tool is not None
    mpcmd_available = device_security_service.find_mpcmdrun() is not None

    adb_state = "MISSING"
    adb_message = "ADB is not installed. Android assessment is unavailable on this computer."
    if adb_available:
        try:
            import subprocess
            proc = subprocess.run([adb_tool, "devices"], capture_output=True, text=True, timeout=3, check=False)
            lines = [l.strip() for l in (proc.stdout or "").splitlines() if l.strip() and not l.startswith("*")]
            devs = [l.split() for l in lines[1:] if len(l.split()) >= 2]
            if not devs:
                adb_state = "NO_DEVICE"
                adb_message = "No Android device detected. Connect an authorized Android device to continue."
            elif devs[0][1].lower() == "unauthorized":
                adb_state = "UNAUTHORIZED"
                adb_message = "Android device detected, but USB debugging authorization is pending."
            elif devs[0][1].lower() == "offline":
                adb_state = "OFFLINE"
                adb_message = "Android device detected, but device state is offline."
            else:
                adb_state = "AUTHORIZED"
                adb_message = "Authorized Android device detected and ready for assessment."
        except Exception:
            adb_state = "ERROR"
            adb_message = "Error probing ADB devices."

    return {
        "status": "ready",
        "host_platform": host_os,
        "capabilities": {
            "windows_assessment": host_os == "Windows",
            "defender_cli": mpcmd_available,
            "android_assessment": adb_available,
        },
        "android_status": {
            "adb_available": adb_available,
            "adb_state": adb_state,
            "message": adb_message,
        },
        "target_environment": {
            "execution_location": "LOCAL_BACKEND_HOST",
            "description": "Assessment inspects the machine hosting the backend service. When running locally (127.0.0.1), this audits your local computer.",
        },
        "privacy": {
            "local_only": True,
            "zero_telemetry": True,
            "requires_user_consent": True,
        },
    }


@router.post("/scan", summary="Execute consented device security assessment")
def scan_device(body: DeviceScanRequest):
    """Run an assessment for the specified target (windows or android)."""
    if not body.consent:
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "CONSENT_REQUIRED",
                    "message": "Explicit user consent is mandatory before performing security checks.",
                }
            },
        )

    target_clean = body.target.lower().strip()
    if target_clean not in ("windows", "android"):
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "INVALID_TARGET",
                    "message": "Target must be 'windows' or 'android'.",
                }
            },
        )

    result = device_security_service.run_device_assessment(
        target=target_clean,
        run_quick_scan=body.run_quick_scan,
        consent_granted=True,
    )
    return result


@router.post("/scan-file", summary="Execute custom safe file scan with Defender")
def scan_file(body: FileScanRequest):
    """Scan a user-selected file with -DisableRemediation (safe read-only audit)."""
    if not body.consent:
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "CONSENT_REQUIRED",
                    "message": "Explicit user consent is mandatory before performing security checks.",
                }
            },
        )

    raw_path = body.file_path.strip()
    # Path sanitization and injection prevention (SR-08 / Sec 3)
    if not raw_path or "\0" in raw_path:
        return JSONResponse(
            status_code=400,
            content={"error": {"code": "INVALID_FILE_PATH", "message": "File path contains invalid null characters or is empty."}},
        )

    # Disallow UNC network paths (prevent NTLM relay or external probing)
    if raw_path.startswith(("\\\\", "//")):
        return JSONResponse(
            status_code=400,
            content={"error": {"code": "UNC_PATH_NOT_ALLOWED", "message": "Network UNC paths are strictly prohibited."}},
        )

    # Disallow DOS device paths
    if re.match(r"^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)", os.path.basename(raw_path), re.IGNORECASE):
        return JSONResponse(
            status_code=400,
            content={"error": {"code": "DEVICE_PATH_NOT_ALLOWED", "message": "DOS device names cannot be scanned."}},
        )

    try:
        resolved = Path(raw_path).resolve()
        if not resolved.exists() or not resolved.is_file():
            return JSONResponse(
                status_code=400,
                content={"error": {"code": "TARGET_NOT_A_FILE", "message": "Specified path does not exist or is not a regular file."}},
            )

        # Enforce size ceiling to prevent unbounded execution
        if resolved.stat().st_size > 50 * 1024 * 1024:
            return JSONResponse(
                status_code=400,
                content={"error": {"code": "FILE_TOO_LARGE", "message": "File size exceeds 50 MB scan threshold."}},
            )

        result = device_security_service.run_device_assessment(
            target="windows",
            run_quick_scan=False,
            custom_path=str(resolved),
            consent_granted=True,
        )
        return result
    except Exception as exc:
        return JSONResponse(
            status_code=400,
            content={"error": {"code": "PATH_RESOLUTION_FAILED", "message": f"Invalid path resolution: {exc}"}},
        )


class PdfReportRequest(BaseModel):
    model_config = ConfigDict(extra="allow")
    assessment_data: Optional[dict] = None
    language: str = Field(default="en", max_length=8)
    consent: bool = Field(default=False)


@router.post("/report-pdf", summary="Generate downloadable PDF report from assessment data")
def export_pdf_report(body: PdfReportRequest):
    """Generate and return a standalone PDF report matching the specified language."""
    if not body.consent:
        return JSONResponse(
            status_code=400,
            content={"error": {"code": "CONSENT_REQUIRED", "message": "Explicit user consent is mandatory before report generation."}},
        )

    lang = body.language.lower().strip()
    if lang not in ("en", "om", "am"):
        lang = "en"

    data = body.assessment_data
    if not data or not isinstance(data, dict) or "findings" not in data:
        # Generate fresh safe assessment if no previous payload was supplied
        data = device_security_service.run_device_assessment(target="windows", consent_granted=True)

    pdf_bytes = device_security_service.generate_device_security_pdf(data, language=lang)
    import datetime
    date_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
    target_str = str(data.get("target", "windows")).upper()
    filename = f"CyberShield_Device_Security_{date_str}_{target_str}_{lang.upper()}.pdf"

    from fastapi import Response
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )



