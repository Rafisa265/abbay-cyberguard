# Windows Device Security local service

The hosted ABBAY CYBERGUARD website runs in your browser. To inspect the Windows PC that is using the site, the browser must connect to a local helper running on that same PC. The site does not send Windows inspection requests to Render.

## Start the local service

1. On the Windows PC you want to inspect, install the project prerequisites once by running `setup.bat` from the repository root if setup has not already been completed.
2. Run `start.bat` from the repository root.
3. Keep the command window open while using Windows Device Security. The script starts the service on `127.0.0.1:8000` only; do not change the bind address to `0.0.0.0` or create an inbound firewall rule.
4. Open the hosted ABBAY CYBERGUARD site in a browser on the same PC. Select Windows, grant the inspection authorization, and retry. If the browser asks to allow local-network access, allow it for the site.

The first setup step may install the dependencies listed by the project's setup script. Do not rerun setup just to start the service; use `start.bat` after setup is complete.

## Start automatically at sign-in

Automatic startup is optional and applies only to the current Windows user. From the repository root, run this once in a normal, non-elevated PowerShell window:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Install-DeviceSecurityStartup.ps1
```

This registers a Task Scheduler logon task with limited privileges. It reuses `backend\.venv\Scripts\python.exe`, binds only to `127.0.0.1:8000`, and does not change Firewall, Defender, UAC, or other Windows security settings. The task checks for a healthy helper before starting a process; if another program occupies port 8000, it stops without terminating that program. It checks service health while running and allows at most three recovery restarts per task run.

To turn off future automatic starts but keep the task definition:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Disable-DeviceSecurityStartup.ps1
```

To remove the task entirely:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Uninstall-DeviceSecurityStartup.ps1
```

Disabling or removing the task does not stop a helper that is already running. The manual `start.bat` workflow remains available; it detects an existing helper and refuses to start over a conflicting port.

## Verify the service

With the `start.bat` window still open, run these commands in a second PowerShell window:

```powershell
Get-NetTCPConnection -LocalPort 8000 -State Listen
Invoke-RestMethod http://127.0.0.1:8000/api/v1/health
Invoke-RestMethod http://127.0.0.1:8000/api/v1/device-security/status
```

The listener should be on `127.0.0.1:8000`. The health response should report `status: ok`; the device status response should report `host_platform: Windows`. If the service does not start, read the error in the original command window. If these commands work but the hosted site still cannot connect, check the browser's local-network permission and reload the site. The service allows the exact production Pages origin; wildcard CORS is not used.

The browser can poll the helper while the Device Security page is active and Windows inspection has been authorized. Browser notifications require a separate explicit opt-in and site permission. They contain generic alert text only and are not a background push service; do not expect delivery after the browser is closed. Recent alert history stores only generic alert types and timestamps locally, not assessment findings or device evidence.

## Scope and privacy

Windows assessment is read-only unless the user separately enables the optional Defender Quick Scan and confirms it. Authorization is required before assessment. Android remains a browser-only check and does not use this Windows helper; it reports only web-visible transport, secure-context, browser API, and non-prompting permission states. It cannot inspect installed apps, Play Protect/antivirus state, Android system settings, security patch level, verified boot, or hardware integrity. ADB checks remain a separate capability and are not invoked by this browser-only mode. The local service is intentionally bound to loopback and should not be exposed to a LAN or the public internet.
