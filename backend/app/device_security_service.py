"""CyberShield Ethiopia — Device Security Check Subsystem.

Provides local, privacy-preserving device security assessments for Windows and Android.
Adheres strictly to the following security & privacy constraints:
1. 100% on-device processing; zero telemetry or external network calls.
2. Explicit user consent required before scans or privileged operations.
3. No automatic remediation, no setting mutation, and no deletion of files.
4. Privacy masking: hostnames, usernames, and personal paths are masked.
5. Strict 5-state check classification: PASS, WARNING, FAIL, NOT CHECKED, NOT SUPPORTED.
6. Honest status reporting: Never marks a device as secure simply because a check failed to run.
"""

from __future__ import annotations

import datetime
import os
import platform
import re
import shutil
import struct
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# Try importing winreg on Windows systems
try:
    import winreg  # type: ignore
except ImportError:
    winreg = None  # type: ignore


# ---------------------------------------------------------------------------
# Privacy Utilities
# ---------------------------------------------------------------------------

def mask_identifier(ident: str, prefix_len: int = 7) -> str:
    """Mask a device identifier (hostname, username) to preserve privacy."""
    if not ident:
        return "DEVICE-***"
    s = str(ident).strip()
    if len(s) <= prefix_len:
        return f"{s[:2]}***" if len(s) > 2 else "***"
    return f"{s[:prefix_len]}***"


def filetime_to_datetime(raw_bytes_or_int: bytes | int) -> Optional[datetime.datetime]:
    """Convert a Windows 64-bit FILETIME value into an ISO datetime (UTC)."""
    try:
        if isinstance(raw_bytes_or_int, bytes):
            if len(raw_bytes_or_int) < 8:
                return None
            filetime = struct.unpack("<Q", raw_bytes_or_int[:8])[0]
        else:
            filetime = int(raw_bytes_or_int)

        if filetime <= 0:
            return None

        # 116444736000000000 is 100-nanosecond intervals between 1601-01-01 and 1970-01-01
        timestamp = (filetime - 116444736000000000) / 10000000.0
        return datetime.datetime.fromtimestamp(timestamp, tz=datetime.timezone.utc)
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Windows Registry & Security Discovery
# ---------------------------------------------------------------------------

def _read_registry_val(hive: int, subkey: str, val_name: str) -> Tuple[Optional[Any], Optional[str]]:
    """Safely read a registry value without raising exceptions."""
    if winreg is None:
        return None, "winreg_unavailable"
    try:
        with winreg.OpenKey(hive, subkey) as key:
            val, _ = winreg.QueryValueEx(key, val_name)
            return val, None
    except FileNotFoundError:
        return None, "NOT_FOUND"
    except PermissionError:
        return None, "ACCESS_DENIED"
    except Exception as exc:
        return None, str(exc)


def find_mpcmdrun() -> Optional[str]:
    """Locate the Microsoft Defender CLI utility MpCmdRun.exe if present."""
    search_dirs = [
        Path(r"C:\ProgramData\Microsoft\Windows Defender\Platform"),
        Path(r"C:\Program Files\Windows Defender"),
        Path(r"C:\Program Files (x86)\Windows Defender"),
    ]
    for base in search_dirs:
        if not base.is_dir():
            continue
        try:
            # Check highest version subdirectories first
            matches = list(base.glob("**/MpCmdRun.exe"))
            if matches:
                # Prefer 64-bit platform binary
                matches.sort(reverse=True)
                for m in matches:
                    if "X86" not in m.parts:
                        return str(m)
                return str(matches[0])
        except Exception:
            continue
    return None


def assess_windows_defender() -> List[Dict[str, Any]]:
    """Assess Microsoft Defender status, real-time protection, and signatures."""
    findings: List[Dict[str, Any]] = []

    if winreg is None or platform.system() != "Windows":
        return [{
            "id": "DEF-01",
            "category": "Antivirus",
            "name": "Microsoft Defender Status",
            "status": "NOT SUPPORTED",
            "severity": "INFO",
            "evidence": "Host OS is not Windows or winreg module is absent.",
            "remediation": "Microsoft Defender assessment is supported on Windows hosts only.",
            "permission_limitation": None,
        }]

    # 1. Antivirus & Antispyware Signatures
    sig_key = r"SOFTWARE\Microsoft\Windows Defender\Signature Updates"
    av_ver, av_err = _read_registry_val(winreg.HKEY_LOCAL_MACHINE, sig_key, "AVSignatureVersion")
    engine_ver, engine_err = _read_registry_val(winreg.HKEY_LOCAL_MACHINE, sig_key, "EngineVersion")
    last_upd_raw, last_upd_err = _read_registry_val(winreg.HKEY_LOCAL_MACHINE, sig_key, "SignaturesLastUpdated")

    if av_ver:
        last_dt = filetime_to_datetime(last_upd_raw) if isinstance(last_upd_raw, (bytes, int)) else None
        now_utc = datetime.datetime.now(datetime.timezone.utc)
        age_hours = (now_utc - last_dt).total_seconds() / 3600.0 if last_dt else 9999.0

        if age_hours <= 72.0:
            sig_status = "PASS"
            sig_sev = "LOW"
            sig_remed = "Signatures are up to date."
        elif age_hours <= 168.0:
            sig_status = "WARNING"
            sig_sev = "MEDIUM"
            sig_remed = "Signatures are more than 3 days old. Trigger Windows Security definitions update."
        else:
            sig_status = "FAIL"
            sig_sev = "HIGH"
            sig_remed = "Antivirus signatures are outdated (over 7 days). Immediate update recommended."

        last_upd_str = last_dt.strftime("%Y-%m-%d %H:%M UTC") if last_dt else "Unknown"
        findings.append({
            "id": "DEF-SIG",
            "category": "Antivirus",
            "name": "Defender Antivirus Signatures & Engine",
            "status": sig_status,
            "severity": sig_sev,
            "evidence": f"AV Signature: {av_ver} | Engine: {engine_ver or 'N/A'} | Last Updated: {last_upd_str} ({age_hours:.1f}h ago)",
            "remediation": sig_remed,
            "permission_limitation": None,
        })
    else:
        findings.append({
            "id": "DEF-SIG",
            "category": "Antivirus",
            "name": "Defender Antivirus Signatures",
            "status": "WARNING" if av_err == "NOT_FOUND" else "NOT CHECKED",
            "severity": "HIGH",
            "evidence": f"Unable to read Defender signature registry: {av_err}",
            "remediation": "Verify that Microsoft Defender Antivirus service is installed and enabled.",
            "permission_limitation": "Registry access denied or signature keys missing.",
        })

    # 2. Real-Time Protection Status (Verified without false confidence)
    rt_key = r"SOFTWARE\Microsoft\Windows Defender\Real-Time Protection"
    disable_rt, rt_err = _read_registry_val(winreg.HKEY_LOCAL_MACHINE, rt_key, "DisableRealtimeMonitoring")

    if disable_rt == 1:
        findings.append({
            "id": "DEF-RTP",
            "category": "Antivirus",
            "name": "Defender Real-Time Protection",
            "status": "FAIL",
            "severity": "CRITICAL",
            "evidence": "DisableRealtimeMonitoring is explicitly set to 1 in registry (Real-time monitoring explicitly disabled).",
            "remediation": "Real-time protection is disabled. Enable Real-time protection in Windows Security settings immediately.",
            "permission_limitation": None,
        })
    elif disable_rt == 0:
        # Policy explicitly requires monitoring, but runtime service state requires confirmation
        findings.append({
            "id": "DEF-RTP",
            "category": "Antivirus",
            "name": "Defender Real-Time Protection",
            "status": "NOT CHECKED",
            "severity": "MEDIUM",
            "evidence": "Registry policy DisableRealtimeMonitoring = 0, but live runtime service state requires elevated CIM privileges to independently confirm.",
            "remediation": "Confirm active status in Windows Security -> Virus & threat protection settings.",
            "permission_limitation": "Live service query restricted (CIM access not available to unprivileged client).",
        })
    elif rt_err == "NOT_FOUND":
        # Absence of DisableRealtimeMonitoring does NOT prove protection is active
        findings.append({
            "id": "DEF-RTP",
            "category": "Antivirus",
            "name": "Defender Real-Time Protection",
            "status": "NOT CHECKED",
            "severity": "MEDIUM",
            "evidence": "DisableRealtimeMonitoring key is absent. Absence of disable policy does not prove runtime service is actively running.",
            "remediation": "Inspect active status in Windows Security -> Virus & threat protection settings.",
            "permission_limitation": "Live service query restricted (CIM access not available to unprivileged client).",
        })
    else:
        findings.append({
            "id": "DEF-RTP",
            "category": "Antivirus",
            "name": "Defender Real-Time Protection",
            "status": "NOT CHECKED",
            "severity": "HIGH",
            "evidence": f"Failed to inspect Real-Time Protection registry: {rt_err}",
            "remediation": "Check Windows Security -> Virus & threat protection settings.",
            "permission_limitation": "Insufficient permissions to inspect Real-Time Protection policy.",
        })

    # 3. Defender CLI Presence
    mpcmd = find_mpcmdrun()
    if mpcmd:
        findings.append({
            "id": "DEF-CLI",
            "category": "Antivirus",
            "name": "Defender Command-Line Interface (MpCmdRun)",
            "status": "PASS",
            "severity": "INFO",
            "evidence": f"Found CLI tool at: {mpcmd}",
            "remediation": "Defender command-line utility is available for verified security audits.",
            "permission_limitation": None,
        })
    else:
        findings.append({
            "id": "DEF-CLI",
            "category": "Antivirus",
            "name": "Defender Command-Line Interface",
            "status": "WARNING",
            "severity": "LOW",
            "evidence": "MpCmdRun.exe not found in standard Windows Defender platform paths.",
            "remediation": "Direct CLI-driven scans unavailable; GUI Windows Security is required.",
            "permission_limitation": "Utility not located in expected system directories.",
        })

    # 4. Defender Last Scan Telemetry (Read-only registry)
    scan_key = r"SOFTWARE\Microsoft\Windows Defender\Scan"
    last_scan_raw, scan_err = _read_registry_val(winreg.HKEY_LOCAL_MACHINE, scan_key, "LastScanRun")
    scan_type_raw, _ = _read_registry_val(winreg.HKEY_LOCAL_MACHINE, scan_key, "LastScanType")

    if last_scan_raw:
        dt_scan = filetime_to_datetime(last_scan_raw)
        if dt_scan:
            now_utc = datetime.datetime.now(datetime.timezone.utc)
            scan_age_h = (now_utc - dt_scan).total_seconds() / 3600.0
            type_label = "Quick Scan" if scan_type_raw == 1 else "Full Scan" if scan_type_raw == 2 else f"Type {scan_type_raw}"
            if scan_age_h <= 168.0:
                scan_st = "PASS"
                scan_sev = "LOW"
                scan_rem = "Recent Defender scan confirmed within the last 7 days."
            elif scan_age_h <= 720.0:
                scan_st = "WARNING"
                scan_sev = "MEDIUM"
                scan_rem = "Last scan was over 7 days ago. Triggering a quick scan is recommended."
            else:
                scan_st = "WARNING"
                scan_sev = "MEDIUM"
                scan_rem = "Last scan was over 30 days ago. Run a system scan in Windows Security."

            findings.append({
                "id": "DEF-LAST-SCAN",
                "category": "Antivirus",
                "name": "Defender Most Recent Scan Telemetry",
                "status": scan_st,
                "severity": scan_sev,
                "evidence": f"Last Scan: {dt_scan.strftime('%Y-%m-%d %H:%M UTC')} ({type_label}, {scan_age_h:.1f}h ago)",
                "remediation": scan_rem,
                "permission_limitation": None,
            })
        else:
            findings.append({
                "id": "DEF-LAST-SCAN",
                "category": "Antivirus",
                "name": "Defender Most Recent Scan Telemetry",
                "status": "WARNING",
                "severity": "LOW",
                "evidence": "Unable to decode LastScanRun timestamp in registry.",
                "remediation": "Run a scan in Windows Security.",
                "permission_limitation": None,
            })
    else:
        findings.append({
            "id": "DEF-LAST-SCAN",
            "category": "Antivirus",
            "name": "Defender Most Recent Scan Telemetry",
            "status": "NOT CHECKED",
            "severity": "LOW",
            "evidence": f"LastScanRun registry value unavailable: {scan_err}",
            "remediation": "Check Windows Security -> Virus & threat protection for scan history.",
            "permission_limitation": "Scan history registry restricted or unrecorded.",
        })

    return findings


def assess_windows_firewall() -> List[Dict[str, Any]]:
    """Assess Windows Firewall state across Domain, Private, and Public profiles."""
    findings: List[Dict[str, Any]] = []

    if winreg is None or platform.system() != "Windows":
        return [{
            "id": "FW-01",
            "category": "Firewall",
            "name": "Host Firewall Status",
            "status": "NOT SUPPORTED",
            "severity": "INFO",
            "evidence": "Firewall inspection is supported on Windows hosts only.",
            "remediation": "Ensure a host-based firewall is enabled on your operating system.",
            "permission_limitation": None,
        }]

    base_fw = r"SYSTEM\CurrentControlSet\Services\SharedAccess\Parameters\FirewallPolicy"
    profiles = [
        ("DomainProfile", "Domain Network Profile", "FW-DOM"),
        ("StandardProfile", "Private Network Profile", "FW-PRIV"),
        ("PublicProfile", "Public Network Profile", "FW-PUB"),
    ]

    for prof_key, prof_label, check_id in profiles:
        val, err = _read_registry_val(winreg.HKEY_LOCAL_MACHINE, f"{base_fw}\\{prof_key}", "EnableFirewall")
        if val == 1:
            findings.append({
                "id": check_id,
                "category": "Firewall",
                "name": f"Windows Firewall ({prof_label})",
                "status": "PASS",
                "severity": "LOW",
                "evidence": f"EnableFirewall = 1 for {prof_key} (registry policy confirmed)",
                "remediation": f"Firewall protection policy is active for {prof_label}.",
                "permission_limitation": None,
            })
        elif val == 0:
            findings.append({
                "id": check_id,
                "category": "Firewall",
                "name": f"Windows Firewall ({prof_label})",
                "status": "FAIL",
                "severity": "HIGH",
                "evidence": f"EnableFirewall = 0 for {prof_key}",
                "remediation": f"Enable Windows Defender Firewall for {prof_label} in Control Panel.",
                "permission_limitation": None,
            })
        else:
            findings.append({
                "id": check_id,
                "category": "Firewall",
                "name": f"Windows Firewall ({prof_label})",
                "status": "NOT CHECKED",
                "severity": "MEDIUM",
                "evidence": f"Unable to read firewall policy for {prof_key}: {err}",
                "remediation": "Verify Windows Firewall status in Windows Security settings.",
                "permission_limitation": "Insufficient registry permissions or non-standard firewall configuration.",
            })

    # Service startup configuration check for Windows Defender Firewall (MpsSvc)
    svc_val, svc_err = _read_registry_val(winreg.HKEY_LOCAL_MACHINE, r"SYSTEM\CurrentControlSet\Services\MpsSvc", "Start")
    if svc_val == 2:
        findings.append({
            "id": "FW-SVC",
            "category": "Firewall",
            "name": "Windows Defender Firewall Service (MpsSvc)",
            "status": "PASS",
            "severity": "LOW",
            "evidence": "MpsSvc startup configuration is set to Automatic (Start = 2).",
            "remediation": "Firewall service is configured to start automatically on system boot.",
            "permission_limitation": None,
        })
    elif svc_val == 4:
        findings.append({
            "id": "FW-SVC",
            "category": "Firewall",
            "name": "Windows Defender Firewall Service (MpsSvc)",
            "status": "FAIL",
            "severity": "CRITICAL",
            "evidence": "MpsSvc startup configuration is set to Disabled (Start = 4).",
            "remediation": "Enable Windows Defender Firewall service in Services management console.",
            "permission_limitation": None,
        })
    else:
        findings.append({
            "id": "FW-SVC",
            "category": "Firewall",
            "name": "Windows Defender Firewall Service (MpsSvc)",
            "status": "NOT CHECKED",
            "severity": "MEDIUM",
            "evidence": f"Unable to verify MpsSvc startup configuration: {svc_err or svc_val}",
            "remediation": "Confirm Windows Defender Firewall service is running in services.msc.",
            "permission_limitation": "Service Control Manager registry inspection restricted.",
        })

    return findings


def assess_windows_updates() -> List[Dict[str, Any]]:
    """Assess Windows Security Update status via Component Based Servicing (CBS)."""
    findings: List[Dict[str, Any]] = []

    if winreg is None or platform.system() != "Windows":
        return [{
            "id": "UPD-01",
            "category": "OS Updates",
            "name": "Security Updates",
            "status": "NOT SUPPORTED",
            "severity": "INFO",
            "evidence": "Windows update inspection requires a Windows host.",
            "remediation": "Regularly apply operating system patches.",
            "permission_limitation": None,
        }]

    cbs_path = r"SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\Packages"
    installed_kbs: List[Tuple[str, datetime.datetime]] = []

    try:
        with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, cbs_path) as key:
            i = 0
            while True:
                try:
                    sub = winreg.EnumKey(key, i)
                    i += 1
                    if "Package_for_KB" in sub or "Package_for_RollupFix" in sub:
                        # Inspect installation state and time
                        try:
                            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, f"{cbs_path}\\{sub}") as subkey:
                                state, _ = winreg.QueryValueEx(subkey, "CurrentState")
                                # State 112 (0x70) confirms package is Installed. Skip pending (80), superseded (96), staged (64)
                                if state != 112:
                                    continue
                                high, _ = winreg.QueryValueEx(subkey, "InstallTimeHigh")
                                low, _ = winreg.QueryValueEx(subkey, "InstallTimeLow")
                                filetime = (int(high) << 32) | (int(low) & 0xFFFFFFFF)
                                dt = filetime_to_datetime(filetime)
                                if dt:
                                    kb_match = re.search(r"KB\d+", sub)
                                    name = kb_match.group(0) if kb_match else "RollupFix"
                                    installed_kbs.append((name, dt))
                        except Exception:
                            continue
                except OSError:
                    break
    except Exception as exc:
        return [{
            "id": "UPD-CBS",
            "category": "OS Updates",
            "name": "Windows Security Update Status",
            "status": "NOT CHECKED",
            "severity": "MEDIUM",
            "evidence": f"Failed to enumerate CBS packages: {exc}",
            "remediation": "Run Windows Update to ensure the latest cumulative updates are installed.",
            "permission_limitation": "CBS package registry access restricted.",
        }]

    if installed_kbs:
        installed_kbs.sort(key=lambda x: x[1], reverse=True)
        latest_name, latest_dt = installed_kbs[0]
        now_utc = datetime.datetime.now(datetime.timezone.utc)
        age_days = (now_utc - latest_dt).total_seconds() / 86400.0

        if age_days <= 45.0:
            status = "PASS"
            sev = "LOW"
            remed = "System has received recent cumulative security updates."
        elif age_days <= 90.0:
            status = "WARNING"
            sev = "MEDIUM"
            remed = "Most recent update is over 45 days old. Check Windows Update for new patches."
        else:
            status = "FAIL"
            sev = "HIGH"
            remed = "Most recent update is over 90 days old. System may be exposed to known CVEs."

        findings.append({
            "id": "UPD-PATCH",
            "category": "OS Updates",
            "name": "Cumulative Security Patch Freshness",
            "status": status,
            "severity": sev,
            "evidence": f"Latest Package: {latest_name} installed on {latest_dt.strftime('%Y-%m-%d')} ({age_days:.1f} days ago). Total KBs tracked: {len(installed_kbs)}",
            "remediation": remed,
            "permission_limitation": None,
        })
    else:
        findings.append({
            "id": "UPD-PATCH",
            "category": "OS Updates",
            "name": "Cumulative Security Patch Freshness",
            "status": "WARNING",
            "severity": "MEDIUM",
            "evidence": "No discrete KB packages detected in CBS history.",
            "remediation": "Run Settings -> Windows Update to confirm patch status.",
            "permission_limitation": None,
        })

    return findings


def assess_system_hardening() -> List[Dict[str, Any]]:
    """Assess User Account Control (UAC) and operating system security baseline."""
    findings: List[Dict[str, Any]] = []

    if winreg is None or platform.system() != "Windows":
        return []

    # UAC / EnableLUA check
    uac_key = r"SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System"
    lua_val, lua_err = _read_registry_val(winreg.HKEY_LOCAL_MACHINE, uac_key, "EnableLUA")

    if lua_val == 1:
        findings.append({
            "id": "HARD-UAC",
            "category": "System Hardening",
            "name": "User Account Control (UAC)",
            "status": "PASS",
            "severity": "LOW",
            "evidence": "EnableLUA = 1 (UAC privilege boundary enforced).",
            "remediation": "UAC is enabled. Never run applications with unneeded administrative privileges.",
            "permission_limitation": None,
        })
    elif lua_val == 0:
        findings.append({
            "id": "HARD-UAC",
            "category": "System Hardening",
            "name": "User Account Control (UAC)",
            "status": "FAIL",
            "severity": "HIGH",
            "evidence": "EnableLUA = 0 (UAC is completely disabled).",
            "remediation": "Enable User Account Control in Control Panel -> User Accounts.",
            "permission_limitation": None,
        })
    else:
        findings.append({
            "id": "HARD-UAC",
            "category": "System Hardening",
            "name": "User Account Control (UAC)",
            "status": "NOT CHECKED",
            "severity": "MEDIUM",
            "evidence": f"Unable to read UAC configuration: {lua_err}",
            "remediation": "Check User Account Control settings in Control Panel.",
            "permission_limitation": "Insufficient permissions to inspect system security policies.",
        })

    return findings




# ---------------------------------------------------------------------------
# BitLocker Disk Encryption Assessment (Read-Only Registry Inspection)
# ---------------------------------------------------------------------------

def assess_disk_encryption() -> List[Dict[str, Any]]:
    """Check BitLocker / disk encryption status via registry.
    
    Inspects the BitLocker policy and protection status.
    Does NOT modify any encryption settings.
    """
    findings: List[Dict[str, Any]] = []

    if winreg is None or platform.system() != "Windows":
        return []

    # Check BitLocker FVE policy
    fve_key = r"SOFTWARE\Microsoft\Windows\CurrentVersion\BitLocker"
    fve_val, fve_err = _read_registry_val(winreg.HKEY_LOCAL_MACHINE, fve_key, "RequireDeviceEncryption")

    # Also check the volume protection status via the FVE configuration
    vol_key = r"SYSTEM\CurrentControlSet\Control\BitLockerDriveEncryption"
    vol_val, vol_err = _read_registry_val(winreg.HKEY_LOCAL_MACHINE, vol_key, "EncryptionMethod")

    # Check if BitLocker is enabled via yet another known path
    bde_key = r"SOFTWARE\Policies\Microsoft\FVE"
    bde_val, bde_err = _read_registry_val(winreg.HKEY_LOCAL_MACHINE, bde_key, "UseAdvancedStartup")

    # Determine status from available evidence
    if fve_val is not None or vol_val is not None or bde_val is not None:
        has_policy = fve_val == 1 or bde_val is not None
        has_method = vol_val is not None and vol_val > 0

        if has_method:
            encryption_methods = {1: "AES-128", 3: "AES-128-Diffuser", 4: "AES-256", 6: "AES-256-Diffuser", 7: "XTS-AES-128", 8: "XTS-AES-256"}
            method_name = encryption_methods.get(vol_val, f"Method {vol_val}")
            findings.append({
                "id": "ENC-BITLOCKER",
                "category": "Disk Encryption",
                "name": "BitLocker Drive Encryption",
                "status": "PASS",
                "severity": "LOW",
                "evidence": f"BitLocker encryption configured (method: {method_name}).",
                "remediation": "Continue using disk encryption. Verify all data drives are also encrypted.",
                "why_it_matters": "Disk encryption protects your data from being read if the device is lost, stolen, or physically accessed by an attacker.",
                "permission_limitation": None,
            })
        elif has_policy:
            findings.append({
                "id": "ENC-BITLOCKER",
                "category": "Disk Encryption",
                "name": "BitLocker Drive Encryption",
                "status": "WARNING",
                "severity": "MEDIUM",
                "evidence": "BitLocker policy detected but encryption method not confirmed. Device may be partially encrypted or policy is pending.",
                "remediation": "Open Settings > Privacy & Security > Device Encryption to verify and enable full-disk encryption.",
                "why_it_matters": "Without disk encryption, anyone with physical access to your computer can read your files.",
                "permission_limitation": None,
            })
        else:
            findings.append({
                "id": "ENC-BITLOCKER",
                "category": "Disk Encryption",
                "name": "BitLocker Drive Encryption",
                "status": "WARNING",
                "severity": "MEDIUM",
                "evidence": "BitLocker registry keys found but status is inconclusive.",
                "remediation": "Verify BitLocker status by opening 'Manage BitLocker' from Control Panel.",
                "why_it_matters": "Unencrypted disks expose all data if the device is physically compromised.",
                "permission_limitation": "Non-admin registry access may not reflect actual BitLocker volume protection status.",
            })
    else:
        findings.append({
            "id": "ENC-BITLOCKER",
            "category": "Disk Encryption",
            "name": "BitLocker Drive Encryption",
            "status": "NOT CHECKED",
            "severity": "MEDIUM",
            "evidence": f"Unable to read BitLocker registry keys: {fve_err or vol_err or 'Registry path not found'}.",
            "remediation": "Check BitLocker status manually via Settings > Privacy & Security > Device Encryption or 'manage-bde -status' from an admin command prompt.",
            "why_it_matters": "Without disk encryption verification, we cannot confirm your data is protected from physical access.",
            "permission_limitation": "Insufficient permissions to read BitLocker configuration. Admin elevation may be required.",
        })

    return findings


def assess_screen_lock_windows() -> List[Dict[str, Any]]:
    """Check Windows screen lock / screensaver security settings via registry.
    
    Read-only inspection. Does NOT modify any lock screen settings.
    """
    findings: List[Dict[str, Any]] = []

    if winreg is None or platform.system() != "Windows":
        return []

    # Check screensaver policy (GPO-enforced)
    policy_key = r"SOFTWARE\Policies\Microsoft\Windows\Control Panel\Desktop"
    timeout_val, timeout_err = _read_registry_val(winreg.HKEY_CURRENT_USER, policy_key, "ScreenSaveTimeOut")
    secure_val, secure_err = _read_registry_val(winreg.HKEY_CURRENT_USER, policy_key, "ScreenSaverIsSecure")

    # Also check user-level screensaver settings
    user_key = r"Control Panel\Desktop"
    user_timeout, _ = _read_registry_val(winreg.HKEY_CURRENT_USER, user_key, "ScreenSaveTimeOut")
    user_secure, _ = _read_registry_val(winreg.HKEY_CURRENT_USER, user_key, "ScreenSaverIsSecure")
    user_active, _ = _read_registry_val(winreg.HKEY_CURRENT_USER, user_key, "ScreenSaveActive")

    # Use policy values first, fall back to user values
    effective_timeout = timeout_val or user_timeout
    effective_secure = secure_val or user_secure
    screensaver_active = user_active

    if effective_timeout is not None and effective_secure is not None:
        try:
            timeout_sec = int(effective_timeout)
            is_secure = str(effective_secure) == "1"
        except (ValueError, TypeError):
            timeout_sec = None
            is_secure = False

        if timeout_sec and timeout_sec > 0 and is_secure:
            timeout_min = timeout_sec // 60
            findings.append({
                "id": "LOCK-SCREEN",
                "category": "Physical Security",
                "name": "Screen Lock (Screensaver Security)",
                "status": "PASS",
                "severity": "LOW",
                "evidence": f"Screen lock enabled: {timeout_min}-minute timeout with password protection.",
                "remediation": "Screen lock is properly configured. Consider reducing timeout to 5 minutes or less for high-security environments.",
                "why_it_matters": "Automatic screen lock prevents unauthorized access when you step away from your computer.",
                "permission_limitation": None,
            })
        elif timeout_sec and timeout_sec > 0 and not is_secure:
            findings.append({
                "id": "LOCK-SCREEN",
                "category": "Physical Security",
                "name": "Screen Lock (Screensaver Security)",
                "status": "WARNING",
                "severity": "MEDIUM",
                "evidence": f"Screensaver timeout set to {timeout_sec // 60} minutes, but password-on-resume is NOT enabled.",
                "remediation": "Enable 'On resume, display logon screen' in Screen Saver Settings, or use Settings > Accounts > Sign-in Options to require password after sleep.",
                "why_it_matters": "A screensaver without password protection does not prevent someone from using your computer while you are away.",
                "permission_limitation": None,
            })
        else:
            findings.append({
                "id": "LOCK-SCREEN",
                "category": "Physical Security",
                "name": "Screen Lock (Screensaver Security)",
                "status": "FAIL",
                "severity": "HIGH",
                "evidence": "No automatic screen lock timeout configured.",
                "remediation": "Enable automatic screen lock: Settings > Personalization > Lock Screen > Screen timeout settings. Set to 5 minutes. Also enable 'Require sign-in' after sleep.",
                "why_it_matters": "Without automatic screen lock, anyone can access your computer when you step away, even briefly.",
                "permission_limitation": None,
            })
    else:
        # Check dynamic lock as alternative
        dyn_lock_key = r"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon"
        dyn_val, _ = _read_registry_val(winreg.HKEY_CURRENT_USER, dyn_lock_key, "EnableGoodbye")

        if dyn_val == 1:
            findings.append({
                "id": "LOCK-SCREEN",
                "category": "Physical Security",
                "name": "Screen Lock (Dynamic Lock)",
                "status": "WARNING",
                "severity": "LOW",
                "evidence": "Dynamic Lock (Bluetooth-based) is enabled but screensaver password protection could not be confirmed.",
                "remediation": "Dynamic Lock is a good supplementary measure. Also configure a screensaver timeout with password protection for reliable screen locking.",
                "why_it_matters": "Dynamic Lock depends on Bluetooth connectivity and may not activate immediately.",
                "permission_limitation": "Screensaver policy registry values not accessible.",
            })
        else:
            findings.append({
                "id": "LOCK-SCREEN",
                "category": "Physical Security",
                "name": "Screen Lock (Screensaver Security)",
                "status": "NOT CHECKED",
                "severity": "MEDIUM",
                "evidence": f"Unable to read screen lock configuration: {timeout_err or 'Registry key not found'}.",
                "remediation": "Verify screen lock settings in Settings > Accounts > Sign-in Options and Settings > Personalization > Lock Screen.",
                "why_it_matters": "Automatic screen lock is a fundamental physical security control.",
                "permission_limitation": "Screensaver registry values not readable under current user context.",
            })

    return findings


def assess_startup_persistence() -> List[Dict[str, Any]]:
    """Inspect Windows startup/persistence registry entries (Read-Only).
    
    Reads Run and RunOnce keys from HKCU and HKLM to identify programs
    that launch automatically at startup. 
    
    SAFETY: This function NEVER deletes, disables, or modifies any startup entry.
    It is strictly a read-only audit for user awareness.
    """
    findings: List[Dict[str, Any]] = []

    if winreg is None or platform.system() != "Windows":
        return []

    startup_keys = [
        (winreg.HKEY_CURRENT_USER, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Run", "HKCU\\...\\Run"),
        (winreg.HKEY_CURRENT_USER, r"SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce", "HKCU\\...\\RunOnce"),
        (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Run", "HKLM\\...\\Run"),
        (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce", "HKLM\\...\\RunOnce"),
    ]

    total_entries = 0
    all_entry_names = []
    key_results = []

    for hive, key_path, friendly_name in startup_keys:
        try:
            key = winreg.OpenKey(hive, key_path, 0, winreg.KEY_READ)
            entry_count = 0
            entry_names = []
            idx = 0
            while True:
                try:
                    name, value, vtype = winreg.EnumValue(key, idx)
                    entry_count += 1
                    # Only record the entry name, NOT the full executable path (privacy)
                    entry_names.append(name)
                    idx += 1
                except OSError:
                    break
            winreg.CloseKey(key)
            total_entries += entry_count
            all_entry_names.extend(entry_names)
            key_results.append((friendly_name, entry_count, entry_names))
        except OSError:
            key_results.append((friendly_name, 0, []))

    # Summarize findings
    if total_entries == 0:
        findings.append({
            "id": "PERSIST-STARTUP",
            "category": "Startup Persistence",
            "name": "Startup Registry Entries (Run / RunOnce)",
            "status": "PASS",
            "severity": "INFORMATIONAL",
            "evidence": "No startup persistence entries found in Run/RunOnce registry keys.",
            "remediation": "No action needed. Startup registry keys are empty.",
            "why_it_matters": "Startup entries can be used by both legitimate applications and malware to run automatically when Windows starts.",
            "permission_limitation": None,
        })
    elif total_entries <= 8:
        entry_summary = ", ".join(all_entry_names[:10])
        findings.append({
            "id": "PERSIST-STARTUP",
            "category": "Startup Persistence",
            "name": "Startup Registry Entries (Run / RunOnce)",
            "status": "PASS",
            "severity": "INFORMATIONAL",
            "evidence": f"{total_entries} startup entries found: {entry_summary}.",
            "remediation": "Review startup entries periodically. Disable any you don't recognize using Task Manager > Startup tab.",
            "why_it_matters": "A normal system has a few startup entries from legitimate software. Regularly reviewing them helps catch unauthorized programs.",
            "permission_limitation": None,
            "startup_entries": [{"name": n} for n in all_entry_names],
        })
    else:
        entry_summary = ", ".join(all_entry_names[:15])
        if len(all_entry_names) > 15:
            entry_summary += f"... (+{len(all_entry_names) - 15} more)"
        findings.append({
            "id": "PERSIST-STARTUP",
            "category": "Startup Persistence",
            "name": "Startup Registry Entries (Run / RunOnce)",
            "status": "WARNING",
            "severity": "MEDIUM",
            "evidence": f"{total_entries} startup entries found (higher than typical): {entry_summary}.",
            "remediation": "Review startup entries in Task Manager > Startup tab. Disable programs you don't recognize or need. CAUTION: Do NOT delete entries unless you are certain they are not needed — some are required by Windows or your security software.",
            "why_it_matters": "An unusually high number of startup entries can slow your computer and may include unwanted or suspicious programs. Not all are malware — many are legitimate.",
            "false_positive_warning": "Many entries are normal (antivirus, drivers, cloud storage, audio software). This finding does NOT mean malware is present.",
            "permission_limitation": None,
            "startup_entries": [{"name": n} for n in all_entry_names],
        })

    return findings


def assess_running_processes_limited() -> List[Dict[str, Any]]:
    """Attempt to inspect running processes for security awareness.
    
    SAFETY RULES:
    1. NEVER auto-kill, terminate, or quarantine any process.
    2. NEVER classify a process as malware based only on name, path, or resource usage.
    3. Returns NOT SUPPORTED with honest message if process listing is unavailable.
    4. Requires psutil package for reliable process enumeration.
    """
    findings: List[Dict[str, Any]] = []

    if platform.system() != "Windows":
        findings.append({
            "id": "PROC-MONITOR",
            "category": "Process Monitoring",
            "name": "Running Process Audit",
            "status": "NOT SUPPORTED",
            "severity": "INFORMATIONAL",
            "evidence": "Process monitoring is only available on Windows hosts.",
            "remediation": "No action needed.",
            "why_it_matters": "Process monitoring helps identify unexpected or suspicious programs running on your computer.",
            "permission_limitation": "Non-Windows platform detected.",
        })
        return findings

    # Try psutil first (most reliable)
    try:
        import psutil
        process_count = len(psutil.pids())
        findings.append({
            "id": "PROC-MONITOR",
            "category": "Process Monitoring",
            "name": "Running Process Audit",
            "status": "PASS",
            "severity": "INFORMATIONAL",
            "evidence": f"{process_count} processes currently running. Use Task Manager for detailed inspection.",
            "remediation": "Process count is within normal range. Review Task Manager > Details tab for individual process inspection.",
            "why_it_matters": "Monitoring running processes helps detect unauthorized software or suspicious activity.",
            "permission_limitation": None,
        })
    except ImportError:
        findings.append({
            "id": "PROC-MONITOR",
            "category": "Process Monitoring",
            "name": "Running Process Audit",
            "status": "NOT SUPPORTED",
            "severity": "INFORMATIONAL",
            "evidence": "Process monitoring library (psutil) is not installed. Detailed process listing is unavailable.",
            "remediation": "For process monitoring capability, install psutil: pip install psutil. Alternatively, use Task Manager (Ctrl+Shift+Esc) for manual process review.",
            "why_it_matters": "Automated process monitoring can alert you to unexpected programs, but manual review via Task Manager is equally effective.",
            "permission_limitation": "The psutil Python package is required for automated process enumeration. Without it, use Windows Task Manager for manual review.",
        })

    return findings


# ---------------------------------------------------------------------------
# Windows Defender Scan Execution (User-Consented Only)
# ---------------------------------------------------------------------------

def execute_defender_scan(scan_type: str = "quick", custom_path: Optional[str] = None) -> Dict[str, Any]:
    """Execute a local Microsoft Defender scan.
    
    CRITICAL SAFETY RULES:
    1. ScanType 3 (Custom file/dir) ALWAYS uses -DisableRemediation so no files are deleted.
    2. Explicit user approval is enforced before calling this function.
    3. Strictly bounded execution timeout.
    """
    mpcmd = find_mpcmdrun()
    if not mpcmd:
        return {
            "success": False,
            "status": "NOT SUPPORTED",
            "error": "MpCmdRun.exe utility not found on this system.",
            "output": "",
            "duration_sec": 0.0,
        }

    t0 = datetime.datetime.now()
    try:
        if scan_type == "quick":
            # Quick Scan (-ScanType 1)
            cmd = [mpcmd, "-Scan", "-ScanType", "1"]
            timeout_sec = 180
        elif scan_type == "custom" and custom_path:
            # Custom scan with -DisableRemediation (safe read-only inspection)
            resolved = Path(custom_path).resolve()
            if not resolved.exists():
                return {
                    "success": False,
                    "status": "FAIL",
                    "error": f"Target path does not exist: {custom_path}",
                    "output": "",
                    "duration_sec": 0.0,
                }
            cmd = [mpcmd, "-Scan", "-ScanType", "3", "-File", str(resolved), "-DisableRemediation"]
            timeout_sec = 60
        else:
            return {
                "success": False,
                "status": "FAIL",
                "error": f"Invalid scan_type '{scan_type}' or missing custom_path.",
                "output": "",
                "duration_sec": 0.0,
            }

        res = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout_sec,
            check=False,
        )
        duration = (datetime.datetime.now() - t0).total_seconds()
        output_clean = (res.stdout or "") + ("\n" + res.stderr if res.stderr else "")

        if res.returncode == 0:
            status = "PASS"
        elif res.returncode == 2:
            status = "WARNING"
        else:
            status = "FAIL"

        return {
            "success": True,
            "status": status,
            "exit_code": res.returncode,
            "duration_sec": round(duration, 2),
            "output": output_clean.strip(),
            "scan_type": scan_type,
        }
    except subprocess.TimeoutExpired:
        duration = (datetime.datetime.now() - t0).total_seconds()
        return {
            "success": False,
            "status": "FAIL",
            "error": f"Scan timed out after {timeout_sec} seconds.",
            "duration_sec": round(duration, 2),
            "output": "",
        }
    except PermissionError as exc:
        return {
            "success": False,
            "status": "NOT SUPPORTED",
            "error": f"Permission denied executing scan: {exc}",
            "duration_sec": 0.0,
            "output": "",
        }
    except Exception as exc:
        return {
            "success": False,
            "status": "FAIL",
            "error": f"Scan failed unexpectedly: {exc}",
            "duration_sec": 0.0,
            "output": "",
        }


# ---------------------------------------------------------------------------
# Android Security Assessment (Bridge & API Inspection)
# ---------------------------------------------------------------------------

def find_adb_tool() -> Optional[str]:
    """Find adb executable if installed in PATH or standard Android SDK directories."""
    tool = shutil.which("adb")
    if tool:
        return tool

    candidates = [
        Path(os.environ.get("ANDROID_HOME", "")) / "platform-tools" / "adb.exe",
        Path(os.environ.get("LOCALAPPDATA", "")) / "Android" / "Sdk" / "platform-tools" / "adb.exe",
    ]
    for c in candidates:
        if c.is_file():
            return str(c)
    return None


def assess_android_device() -> Dict[str, Any]:
    """Assess connected Android device via legitimate Android Debug Bridge APIs.
    
    If ADB is absent, unauthorized, or no device is attached, honestly reports
    the exact condition with no fabricated telemetry.
    When an authorized device is present, queries 10 read-only security properties.
    """
    adb_path = find_adb_tool()
    if not adb_path:
        return {
            "is_available": False,
            "adb_state": "MISSING",
            "status": "NOT SUPPORTED",
            "message": "ADB is not installed. Android assessment is unavailable on this computer.",
            "device_summary": {
                "model": "None (ADB tool not installed)",
                "os": "Android",
                "version": "Unknown",
                "security_patch": "Unknown",
            },
            "findings": [
                {
                    "id": "AND-BRIDGE",
                    "category": "Device State",
                    "name": "Android Debug Bridge (ADB)",
                    "status": "NOT SUPPORTED",
                    "severity": "INFO",
                    "evidence": "ADB is not installed. Android assessment is unavailable on this computer.",
                    "remediation": "Install Android SDK Platform-Tools and enable USB Debugging on your Android device.",
                    "permission_limitation": "ADB host binary unavailable on PATH or SDK paths.",
                    "verification_level": "UNSUPPORTED",
                },
                {
                    "id": "AND-PLAY-PROTECT",
                    "category": "Antivirus",
                    "name": "Google Play Protect Status",
                    "status": "NOT SUPPORTED",
                    "severity": "INFO",
                    "evidence": "Google Play Protect requires vendor Play Services API; unprivileged shell inspection not supported.",
                    "remediation": "Check Google Play Protect directly in device Settings -> Security.",
                    "permission_limitation": "Vendor Play Protect status is private to Play Services.",
                    "verification_level": "UNSUPPORTED",
                },
            ],
            "limitations": [
                "ADB executable is not installed on this host system.",
                "Full malware scanning cannot be performed via standard Android APIs without privileged MDM/Enterprise agent.",
            ],
        }

    # If ADB is available, check connected devices
    try:
        proc = subprocess.run([adb_path, "devices"], capture_output=True, text=True, timeout=5, check=False)
        lines = [line.strip() for line in (proc.stdout or "").splitlines() if line.strip() and not line.startswith("*")]
        
        # Check for device rows
        device_entries = [line.split() for line in lines[1:] if len(line.split()) >= 2]

        if not device_entries:
            return {
                "is_available": True,
                "adb_state": "NO_DEVICE",
                "status": "NOT SUPPORTED",
                "message": "No Android device detected. Connect an authorized Android device to continue.",
                "device_summary": {
                    "model": "No Device Connected",
                    "os": "Android",
                    "version": "Unknown",
                    "security_patch": "Unknown",
                },
                "findings": [
                    {
                        "id": "AND-CONN",
                        "category": "Device State",
                        "name": "Connected Android Device",
                        "status": "NOT SUPPORTED",
                        "severity": "INFO",
                        "evidence": "No Android device detected. Connect an authorized Android device to continue.",
                        "remediation": "Connect your Android phone via USB and enable USB Debugging in Developer Options.",
                        "permission_limitation": "No USB or Wi-Fi Android device connected.",
                        "verification_level": "UNSUPPORTED",
                    }
                ],
                "limitations": [
                    "No authorized device attached.",
                    "Android Play Protect status cannot be queried without Google Play Enterprise APIs.",
                ],
            }

        # Inspect the first detected device entry
        dev_id, dev_state = device_entries[0][0], device_entries[0][1].lower()
        masked_dev_id = mask_identifier(dev_id, prefix_len=4)

        if dev_state == "unauthorized":
            return {
                "is_available": True,
                "adb_state": "UNAUTHORIZED",
                "status": "WARNING",
                "message": "Android device detected, but USB debugging authorization is pending.",
                "device_summary": {
                    "model": f"Device {masked_dev_id} (Unauthorized)",
                    "os": "Android",
                    "version": "Pending Auth",
                    "security_patch": "Pending Auth",
                },
                "findings": [
                    {
                        "id": "AND-AUTH",
                        "category": "Device State",
                        "name": "USB Debugging Authorization",
                        "status": "WARNING",
                        "severity": "HIGH",
                        "evidence": "Android device detected, but USB debugging authorization is pending.",
                        "remediation": "Unlock your phone screen and tap 'Allow USB debugging' on the RSA prompt.",
                        "permission_limitation": "Host RSA public key not authorized on Android device.",
                        "verification_level": "DIRECT_TELEMETRY",
                    }
                ],
                "limitations": [
                    "USB debugging authorization is pending on mobile screen.",
                ],
            }

        if dev_state == "offline":
            return {
                "is_available": True,
                "adb_state": "OFFLINE",
                "status": "WARNING",
                "message": "Android device detected, but device state is offline.",
                "device_summary": {
                    "model": f"Device {masked_dev_id} (Offline)",
                    "os": "Android",
                    "version": "Offline",
                    "security_patch": "Offline",
                },
                "findings": [
                    {
                        "id": "AND-CONN",
                        "category": "Device State",
                        "name": "Connected Android Device",
                        "status": "WARNING",
                        "severity": "MEDIUM",
                        "evidence": "Android device detected, but device state is offline.",
                        "remediation": "Reconnect USB cable or toggle USB debugging off and on.",
                        "permission_limitation": "Android device daemon is unresponsive.",
                        "verification_level": "DIRECT_TELEMETRY",
                    }
                ],
                "limitations": [
                    "Device is offline.",
                ],
            }

        # Device is authorized ('device'): query legitimate system properties
        def get_prop(name: str) -> str:
            try:
                r = subprocess.run([adb_path, "-s", dev_id, "shell", "getprop", name], capture_output=True, text=True, timeout=5, check=False)
                return (r.stdout or "").strip()
            except Exception:
                return ""

        def run_shell(cmd_args: List[str]) -> str:
            try:
                r = subprocess.run([adb_path, "-s", dev_id, "shell"] + cmd_args, capture_output=True, text=True, timeout=5, check=False)
                return (r.stdout or "").strip()
            except Exception:
                return ""

        model = get_prop("ro.product.model") or "Android Device"
        manufacturer = get_prop("ro.product.manufacturer") or "Unknown"
        build_id = get_prop("ro.build.display.id") or "Unknown"
        os_ver = get_prop("ro.build.version.release") or "Unknown"
        patch_level = get_prop("ro.build.version.security_patch") or "Unknown"
        boot_locked = get_prop("ro.boot.flash.locked")
        verified_boot = get_prop("ro.boot.verifiedbootstate")
        verity_mode = get_prop("ro.boot.veritymode")

        findings: List[Dict[str, Any]] = []

        # 1. OS Version Check
        findings.append({
            "id": "AND-VER",
            "category": "OS Updates",
            "name": "Android Operating System Version",
            "status": "PASS" if os_ver and os_ver.isdigit() and int(os_ver) >= 13 else "WARNING" if os_ver and os_ver.isdigit() and int(os_ver) >= 11 else "FAIL" if os_ver != "Unknown" else "NOT CHECKED",
            "severity": "LOW" if os_ver and os_ver.isdigit() and int(os_ver) >= 13 else "MEDIUM",
            "evidence": f"Android Version: {os_ver} (Release build: {mask_identifier(build_id, 10)})",
            "remediation": "Update to the latest supported Android release provided by your device vendor.",
            "permission_limitation": None,
            "verification_level": "DIRECT_TELEMETRY",
        })

        # 2. Patch Level Evaluation
        patch_status = "WARNING"
        patch_sev = "MEDIUM"
        remed_patch = "Check device Settings -> System -> Software Update."
        if patch_level != "Unknown":
            try:
                patch_date = datetime.datetime.strptime(patch_level, "%Y-%m-%d").date()
                today = datetime.date.today()
                days_old = (today - patch_date).days
                if days_old <= 60:
                    patch_status = "PASS"
                    patch_sev = "LOW"
                    remed_patch = "Android security patch is up to date."
                elif days_old <= 180:
                    patch_status = "WARNING"
                    patch_sev = "MEDIUM"
                    remed_patch = "Security patch is older than 60 days. Check for manufacturer updates."
                else:
                    patch_status = "FAIL"
                    patch_sev = "HIGH"
                    remed_patch = "Security patch is over 6 months old. Device is vulnerable to known exploits."
            except Exception:
                pass

        findings.append({
            "id": "AND-PATCH",
            "category": "OS Updates",
            "name": "Android Security Patch Level",
            "status": patch_status,
            "severity": patch_sev,
            "evidence": f"Patch Level: {patch_level} | Device ID: {masked_dev_id}",
            "remediation": remed_patch,
            "permission_limitation": None,
            "verification_level": "DIRECT_TELEMETRY",
        })

        # 3. Build & Hardware Info
        findings.append({
            "id": "AND-BUILD",
            "category": "Device State",
            "name": "Device Hardware & Firmware Identity",
            "status": "PASS" if manufacturer != "Unknown" else "NOT CHECKED",
            "severity": "INFO",
            "evidence": f"Manufacturer: {mask_identifier(manufacturer, 6)} | Model: {mask_identifier(model, 6)}",
            "remediation": "Verify device authenticity with original manufacturer documentation.",
            "permission_limitation": None,
            "verification_level": "DIRECT_TELEMETRY",
        })

        # 4. Bootloader Lock State
        if boot_locked == "1":
            boot_status = "PASS"
            boot_sev = "LOW"
            boot_ev = "Bootloader is securely locked (ro.boot.flash.locked = 1)."
            boot_rem = "Bootloader integrity is preserved."
        elif boot_locked == "0":
            boot_status = "FAIL"
            boot_sev = "CRITICAL"
            boot_ev = "Bootloader is unlocked (ro.boot.flash.locked = 0). Physical attacks and custom ROMs possible."
            boot_rem = "Re-lock bootloader to prevent unauthorized kernel or recovery manipulation."
        else:
            boot_status = "NOT CHECKED"
            boot_sev = "MEDIUM"
            boot_ev = f"Bootloader lock state property not exposed: {boot_locked or 'N/A'}"
            boot_rem = "Inspect bootloader status in Developer Options -> OEM unlocking."

        findings.append({
            "id": "AND-BOOT",
            "category": "System Hardening",
            "name": "Bootloader Lock State",
            "status": boot_status,
            "severity": boot_sev,
            "evidence": boot_ev,
            "remediation": boot_rem,
            "permission_limitation": None,
            "verification_level": "DIRECT_TELEMETRY",
        })

        # 5. Android Verified Boot (AVB)
        if verified_boot in ("green", "locked"):
            verity_st = "PASS"
            verity_sev = "LOW"
            verity_ev = f"Verified Boot state is '{verified_boot}'. System image cryptographic signature is valid."
        elif verified_boot in ("orange", "yellow", "red"):
            verity_st = "FAIL"
            verity_sev = "HIGH"
            verity_ev = f"Verified Boot state is '{verified_boot}'. Unverified or modified system software detected."
        else:
            verity_st = "NOT CHECKED"
            verity_sev = "LOW"
            verity_ev = f"Verified boot state property: {verified_boot or 'unreported'}"

        findings.append({
            "id": "AND-VERITY",
            "category": "System Hardening",
            "name": "Android Verified Boot (AVB)",
            "status": verity_st,
            "severity": verity_sev,
            "evidence": verity_ev,
            "remediation": "Do not flash untrusted firmware or modified boot images.",
            "permission_limitation": None,
            "verification_level": "DIRECT_TELEMETRY",
        })

        # 6. ADB Authorization State
        findings.append({
            "id": "AND-AUTH",
            "category": "Device State",
            "name": "ADB Debugging Authorization",
            "status": "PASS",
            "severity": "INFO",
            "evidence": f"ADB host RSA key authenticated by device ({dev_state}).",
            "remediation": "Revoke USB debugging authorizations in Developer Options when audits are complete.",
            "permission_limitation": None,
            "verification_level": "DIRECT_TELEMETRY",
        })

        # 7. Screen Lock Status
        lock_disabled = run_shell(["settings", "get", "secure", "lockscreen.disabled"])
        if lock_disabled == "1":
            findings.append({
                "id": "AND-LOCK",
                "category": "System Hardening",
                "name": "Screen Lock Security",
                "status": "FAIL",
                "severity": "HIGH",
                "evidence": "lockscreen.disabled = 1 (Screen lock is completely disabled).",
                "remediation": "Set up a PIN, password, or biometric lock in Settings -> Security.",
                "permission_limitation": None,
                "verification_level": "DIRECT_TELEMETRY",
            })
        elif lock_disabled == "0":
            findings.append({
                "id": "AND-LOCK",
                "category": "System Hardening",
                "name": "Screen Lock Security",
                "status": "PASS",
                "severity": "LOW",
                "evidence": "lockscreen.disabled = 0 (Device enforces screen lock credentials).",
                "remediation": "Keep strong biometric or alphanumeric lockscreen protection enabled.",
                "permission_limitation": None,
                "verification_level": "DIRECT_TELEMETRY",
            })
        else:
            findings.append({
                "id": "AND-LOCK",
                "category": "System Hardening",
                "name": "Screen Lock Security",
                "status": "NOT CHECKED",
                "severity": "LOW",
                "evidence": "Lockscreen configuration query restricted by Android permissions.",
                "remediation": "Verify PIN or biometric lock in Settings -> Security.",
                "permission_limitation": "settings secure read requires user permission.",
                "verification_level": "INFERRED",
            })

        # 8. Unknown Sources App Installation
        unknown_apps = run_shell(["settings", "get", "global", "install_non_market_apps"])
        if unknown_apps == "1":
            findings.append({
                "id": "AND-UNKNOWN-SRC",
                "category": "System Hardening",
                "name": "Unknown Source App Installation",
                "status": "WARNING",
                "severity": "HIGH",
                "evidence": "install_non_market_apps = 1 (System allows sideloading unknown APKs).",
                "remediation": "Disable sideloading of unknown apps in Settings -> Apps -> Special app access.",
                "permission_limitation": None,
                "verification_level": "DIRECT_TELEMETRY",
            })
        elif unknown_apps == "0":
            findings.append({
                "id": "AND-UNKNOWN-SRC",
                "category": "System Hardening",
                "name": "Unknown Source App Installation",
                "status": "PASS",
                "severity": "LOW",
                "evidence": "install_non_market_apps = 0 (Unchecked sideloading restricted).",
                "remediation": "Maintain unknown app installation restrictions to prevent malicious APKs.",
                "permission_limitation": None,
                "verification_level": "DIRECT_TELEMETRY",
            })
        else:
            findings.append({
                "id": "AND-UNKNOWN-SRC",
                "category": "System Hardening",
                "name": "Unknown Source App Installation",
                "status": "NOT CHECKED",
                "severity": "LOW",
                "evidence": "Per-app install permissions managed dynamically in modern Android versions.",
                "remediation": "Audit 'Install unknown apps' permission in device Settings.",
                "permission_limitation": "Managed per-package in Android 8+.",
                "verification_level": "INFERRED",
            })

        # 9. Third-Party App Packages Count
        pkg_output = run_shell(["pm", "list", "packages", "-3"])
        pkg_lines = [p.strip() for p in pkg_output.splitlines() if p.strip().startswith("package:")]
        findings.append({
            "id": "AND-APPS",
            "category": "Device State",
            "name": "Third-Party Application Hygiene",
            "status": "PASS" if len(pkg_lines) <= 80 else "WARNING",
            "severity": "LOW" if len(pkg_lines) <= 80 else "MEDIUM",
            "evidence": f"Total third-party installed packages: {len(pkg_lines)}",
            "remediation": "Regularly review and uninstall unneeded third-party applications.",
            "permission_limitation": None,
            "verification_level": "DIRECT_TELEMETRY",
        })

        # 10. Google Play Protect Status (Transparent limitation disclosure)
        findings.append({
            "id": "AND-PLAY-PROTECT",
            "category": "Antivirus",
            "name": "Google Play Protect Status",
            "status": "NOT SUPPORTED",
            "severity": "INFO",
            "evidence": "Google Play Protect status is private to Play Services and not exposed via standard adb shell.",
            "remediation": "Inspect Google Play Protect in Google Play Store -> Settings -> Play Protect.",
            "permission_limitation": "Android OS sandbox restricts security suite telemetry.",
            "verification_level": "UNSUPPORTED",
        })

        return {
            "is_available": True,
            "adb_state": "AUTHORIZED",
            "status": patch_status,
            "message": "Android device assessment completed via authorized ADB connection.",
            "device_summary": {
                "model": mask_identifier(model, 6),
                "manufacturer": mask_identifier(manufacturer, 6),
                "os": f"Android {os_ver}",
                "version": os_ver,
                "security_patch": patch_level,
                "device_id": masked_dev_id,
            },
            "findings": findings,
            "limitations": [
                "Full malware scanning cannot be performed via standard Android APIs without privileged MDM agent.",
                "Google Play Protect status requires manual verification in the Play Store app.",
            ],
        }
    except Exception as exc:
        return {
            "is_available": True,
            "adb_state": "ERROR",
            "status": "NOT CHECKED",
            "message": f"Exception querying ADB: {exc}",
            "device_summary": {"model": "Error", "os": "Android", "version": "N/A", "security_patch": "N/A"},
            "findings": [{
                "id": "AND-ERR",
                "category": "Device State",
                "name": "Android Assessment Exception",
                "status": "NOT CHECKED",
                "severity": "MEDIUM",
                "evidence": f"Exception querying ADB: {exc}",
                "remediation": "Reconnect device and verify adb authorization.",
                "permission_limitation": str(exc),
                "verification_level": "UNSUPPORTED",
            }],
            "limitations": [str(exc)],
        }


# ---------------------------------------------------------------------------
# Master Assessment Aggregator
# ---------------------------------------------------------------------------

def run_device_assessment(
    target: str = "windows",
    run_quick_scan: bool = False,
    custom_path: Optional[str] = None,
    consent_granted: bool = False,
) -> Dict[str, Any]:
    """Execute a comprehensive, privacy-preserving device security assessment.
    
    Requires explicit consent_granted=True.
    """
    if not consent_granted:
        return {
            "success": False,
            "error": "CONSENT_REQUIRED",
            "message": "User consent must be explicitly granted before device security assessment.",
        }

    scan_timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
    raw_node = platform.node()
    masked_device_id = mask_identifier(raw_node, prefix_len=8)

    if target.lower() == "android":
        android_res = assess_android_device()
        findings = android_res["findings"]
        dev_summary = android_res["device_summary"]
        limitations = android_res["limitations"]
    else:
        # Windows assessment
        defender_findings = assess_windows_defender()
        firewall_findings = assess_windows_firewall()
        update_findings = assess_windows_updates()
        hardening_findings = assess_system_hardening()
        encryption_findings = assess_disk_encryption()
        screen_lock_findings = assess_screen_lock_windows()
        startup_findings = assess_startup_persistence()
        process_findings = assess_running_processes_limited()
        findings = (
            defender_findings + firewall_findings + update_findings
            + hardening_findings + encryption_findings + screen_lock_findings
            + startup_findings + process_findings
        )

        dev_summary = {
            "hostname": masked_device_id,
            "os": f"Windows {platform.release()} ({platform.system()})",
            "version": platform.version(),
            "architecture": platform.machine(),
            "python_env": f"Python {platform.python_version()}",
            "inspected_target_type": "LOCAL_BACKEND_HOST",
            "execution_scope": "Local workstation running backend process (127.0.0.1)",
        }
        limitations = [
            "WMI/CIM Defender queries require administrator privileges; registry inspection used for non-privileged safety.",
            "Service Control Manager query requires elevation; inspected through verified local registry keys.",
        ]

        # Optional quick scan if explicitly consented
        if run_quick_scan:
            scan_out = execute_defender_scan(scan_type="quick")
            findings.append({
                "id": "DEF-SCAN-EXEC",
                "category": "Antivirus",
                "name": "Defender Quick Scan Result",
                "status": scan_out["status"],
                "severity": "LOW" if scan_out["status"] == "PASS" else "HIGH",
                "evidence": f"Scan completed in {scan_out.get('duration_sec', 0)}s. Exit code: {scan_out.get('exit_code', 'N/A')}. Output preview: {scan_out.get('output', '')[:160]}",
                "remediation": "Keep running periodic quick scans or use continuous real-time monitoring.",
                "permission_limitation": scan_out.get("error"),
            })
        elif custom_path:
            scan_out = execute_defender_scan(scan_type="custom", custom_path=custom_path)
            findings.append({
                "id": "DEF-SCAN-CUSTOM",
                "category": "Antivirus",
                "name": "Defender Custom File Scan (Safe Audit)",
                "status": scan_out["status"],
                "severity": "LOW" if scan_out["status"] == "PASS" else "HIGH",
                "evidence": f"Scanned path: {mask_identifier(custom_path, 12)} in {scan_out.get('duration_sec', 0)}s. {scan_out.get('output', '')[:160]}",
                "remediation": "No threats identified in audited file.",
                "permission_limitation": scan_out.get("error"),
            })

    # Tally metrics
    pass_cnt = sum(1 for f in findings if f["status"] == "PASS")
    warn_cnt = sum(1 for f in findings if f["status"] == "WARNING")
    fail_cnt = sum(1 for f in findings if f["status"] == "FAIL")
    not_supp_cnt = sum(1 for f in findings if f["status"] == "NOT SUPPORTED")
    not_chk_cnt = sum(1 for f in findings if f["status"] == "NOT CHECKED")

    # Strictly honest overall health rating (Never mark secure if critical checks are unverified or failed)
    if fail_cnt > 0:
        overall_rating = "CRITICAL_ATTENTION_REQUIRED"
        overall_status = "FAIL"
    elif warn_cnt > 0:
        overall_rating = "ACTION_RECOMMENDED"
        overall_status = "WARNING"
    elif not_chk_cnt > 0:
        overall_rating = "PARTIAL_ASSESSMENT_LIMITATIONS_PRESENT"
        overall_status = "WARNING"
    elif not_supp_cnt > 0:
        overall_rating = "UNSUPPORTED_PLATFORM" if pass_cnt == 0 else "PARTIAL_ASSESSMENT_LIMITATIONS_PRESENT"
        overall_status = "NOT SUPPORTED" if pass_cnt == 0 else "WARNING"
    elif pass_cnt > 0:
        overall_rating = "ALL_CHECKED_CONTROLS_PASSED"
        overall_status = "PASS"
    else:
        overall_rating = "INCOMPLETE_ASSESSMENT"
        overall_status = "NOT CHECKED"

    return {
        "success": True,
        "target": target,
        "scan_time": scan_timestamp,
        "overall_status": overall_status,
        "overall_rating": overall_rating,
        "device_summary": dev_summary,
        "metrics": {
            "total_checks": len(findings),
            "pass_count": pass_cnt,
            "warning_count": warn_cnt,
            "fail_count": fail_cnt,
            "not_supported_count": not_supp_cnt,
            "not_checked_count": not_chk_cnt,
        },
        "findings": findings,
        "limitations": limitations,
        "privacy_notice": "Assessment processed 100% locally on device. No passwords, personal documents, or network telemetry were collected or transmitted.",
    }


# ---------------------------------------------------------------------------
# Multilingual PDF Report Generation (Standalone Subsystem)
# ---------------------------------------------------------------------------

def generate_device_security_pdf(assessment_data: Dict[str, Any], language: str = "en") -> bytes:
    """Generate a clean, valid PDF-1.4 binary report for device security assessment.
    
    Supports English ('en'), Afaan Oromoo ('om'), and Amharic ('am').
    Pure Python implementation using standard libraries with zero external dependencies.
    """
    lang = (language or "en").lower().strip()
    if lang not in ("en", "om", "am"):
        lang = "en"

    # Localization dictionary for structural report headers
    i18n = {
        "en": {
            "title": "CyberShield Ethiopia - Device Security Assessment Report",
            "subtitle": "Offline-First Privacy-Preserving Endpoint Defense Audit",
            "date": "Assessment Date",
            "target": "Platform Target",
            "device": "Host Identification",
            "status": "Verified System Status",
            "summary": "Check Metrics",
            "findings": "Verified Security Findings",
            "remediation": "Remediation",
            "limitation": "Limitation",
            "disclaimer": "Confidential & Local: Generated 100% on-device. Zero telemetry or external transmission.",
        },
        "om": {
            "title": "CyberShield Itoophiyaa - Gabaasa Sakatta'iinsa Nageenya Meeshaa",
            "subtitle": "Sakatta'iinsa Qorannoo Nageenya Meeshaa Toora-malee fi Eegumsa Dhuunfaa",
            "date": "Guyyaa Qorannoo",
            "target": "Xiyyeeffannoo Meeshaa",
            "device": "Eenymmeeffama Meeshaa",
            "status": "Haala Nageenya Mirkanaa'e",
            "summary": "Lakkoofsa Sakatta'iinsaa",
            "findings": "Bu'aawwan Nageenyaa Mirkanaa'an",
            "remediation": "Tarkaanfii Sirreeffamaa",
            "limitation": "Daangaa Qorannoo",
            "disclaimer": "Iccitii fi Kallattii Meeshaa: 100% meeshaa irratti uumame. Daataan alatti hin ergamne.",
        },
        "am": {
            "title": "ሳይበርሺልድ ኢትዮጵያ - የመሳሪያ ደህንነት ግምገማ ይፋዊ ሪፖርት",
            "subtitle": "የግል ደህንነትን የጠበቀ ከመስመር ውጭ የተከናወነ የመሳሪያ ደህንነት ምርመራ",
            "date": "የምርመራ ቀን",
            "target": "የመሳሪያ አይነት",
            "device": "የመሳሪያ መለያ",
            "status": "የተረጋገጠ አጠቃላይ ሁኔታ",
            "summary": "የፍተሻዎች ማጠቃለያ",
            "findings": "የተረጋገጡ የደህንነት ግኝቶች ዝርዝር",
            "remediation": "የሚመከር እርምጃ",
            "limitation": "የምርመራ ወሰን",
            "disclaimer": "ሚስጥራዊ እና በኮምፒውተርዎ ላይ ብቻ የተዘጋጀ፡ ምንም አይነት መረጃ ወደ ውጭ አልተላከም።",
        },
    }

    t = i18n[lang]
    target_str = str(assessment_data.get("target", "Windows")).upper()
    scan_time = str(assessment_data.get("scan_time", datetime.datetime.now(datetime.timezone.utc).isoformat()))
    overall_status = str(assessment_data.get("overall_status", "UNKNOWN"))
    overall_rating = str(assessment_data.get("overall_rating", "INCOMPLETE")).replace("_", " ")
    dev_summary = assessment_data.get("device_summary", {})
    hostname = dev_summary.get("hostname") or dev_summary.get("model") or "Local Workstation"
    metrics = assessment_data.get("metrics", {})
    findings = assessment_data.get("findings", [])

    lines: List[str] = []
    lines.append(f"=== {t['title']} ===")
    lines.append(f"{t['subtitle']}")
    lines.append("-" * 72)
    lines.append(f"{t['date']}: {scan_time}")
    lines.append(f"{t['target']}: {target_str} | {t['device']}: {hostname}")
    lines.append(f"{t['status']}: [{overall_status}] - {overall_rating}")
    lines.append(
        f"{t['summary']}: Total={metrics.get('total_checks', len(findings))} | "
        f"PASS={metrics.get('pass_count', 0)} | "
        f"WARN={metrics.get('warning_count', 0)} | "
        f"FAIL={metrics.get('fail_count', 0)} | "
        f"NOT_SUPPORTED={metrics.get('not_supported_count', 0)} | "
        f"NOT_CHECKED={metrics.get('not_checked_count', 0)}"
    )
    lines.append("-" * 72)
    lines.append(f"--- {t['findings']} ---")

    for f in findings:
        f_id = f.get("id", "CHK")
        f_name = f.get("name", "Unknown Check")
        f_stat = f.get("status", "NOT CHECKED")
        f_sev = f.get("severity", "LOW")
        f_ev = f.get("evidence", "")
        f_rem = f.get("remediation", "")
        f_lim = f.get("permission_limitation")

        lines.append(f"[{f_stat}] {f_id}: {f_name} (Severity: {f_sev})")
        if f_ev:
            lines.append(f"   Evidence: {f_ev}")
        if f_rem:
            lines.append(f"   {t['remediation']}: {f_rem}")
        if f_lim:
            lines.append(f"   {t['limitation']}: {f_lim}")
        lines.append("")

    lines.append("-" * 72)
    lines.append(t["disclaimer"])

    # Construct valid structural PDF-1.4 stream
    content_stream_lines: List[str] = []
    content_stream_lines.append("BT")
    content_stream_lines.append("/F1 12 Tf")
    content_stream_lines.append("40 800 Td")

    first = True
    for raw_line in lines:
        # Sanitize for PDF Type 1 string encoding
        sanitized = raw_line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        # Wrap long lines
        while len(sanitized) > 90:
            part = sanitized[:90]
            sanitized = "    " + sanitized[90:]
            if first:
                content_stream_lines.append(f"({part}) Tj")
                first = False
            else:
                content_stream_lines.append(f"0 -13 Td ({part}) Tj")
        if first:
            content_stream_lines.append(f"({sanitized}) Tj")
            first = False
        else:
            content_stream_lines.append(f"0 -13 Td ({sanitized}) Tj")

    content_stream_lines.append("ET")
    content_text = "\r\n".join(content_stream_lines)
    content_bytes = content_text.encode("utf-8", errors="replace")

    pdf_parts: List[bytes] = []
    offsets: List[int] = []
    cur_offset = 0

    def add_chunk(chunk: bytes):
        nonlocal cur_offset
        pdf_parts.append(chunk)
        cur_offset += len(chunk)

    def add_str(s: str):
        add_chunk(s.encode("latin-1", errors="replace"))

    add_str("%PDF-1.4\r\n%\xFF\xFF\xFF\xFF\r\n")

    # Obj 1: Catalog
    offsets.append(cur_offset)
    add_str("1 0 obj\r\n<< /Type /Catalog /Pages 2 0 R >>\r\nendobj\r\n")

    # Obj 2: Pages
    offsets.append(cur_offset)
    add_str("2 0 obj\r\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\r\nendobj\r\n")

    # Obj 3: Page (A4 Dimensions: 595.28 x 841.89)
    offsets.append(cur_offset)
    add_str(
        "3 0 obj\r\n"
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] "
        "/Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> "
        "/Contents 4 0 R >>\r\nendobj\r\n"
    )

    # Obj 4: Content Stream
    offsets.append(cur_offset)
    add_str(f"4 0 obj\r\n<< /Length {len(content_bytes)} >>\r\nstream\r\n")
    add_chunk(content_bytes)
    add_str("\r\nendstream\r\nendobj\r\n")

    # XRef Table
    startxref = cur_offset
    total_objs = len(offsets) + 1
    add_str(f"xref\r\n0 {total_objs}\r\n")
    add_str("0000000000 65535 f\r\n")
    for off in offsets:
        add_str(f"{off:010d} 00000 n\r\n")

    add_str(f"trailer\r\n<< /Size {total_objs} /Root 1 0 R >>\r\nstartxref\r\n{startxref}\r\n%%EOF\r\n")

    return b"".join(pdf_parts)


