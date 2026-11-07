$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$runner = Join-Path $PSScriptRoot 'Start-DeviceSecurityService.ps1'
$python = Join-Path $projectRoot 'backend\.venv\Scripts\python.exe'

if (-not (Test-Path -LiteralPath $python -PathType Leaf)) {
  throw 'The existing backend virtual environment is missing. Run the project setup once before installing automatic startup.'
}

$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$arguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $runner + '"'
$action = New-ScheduledTaskAction -Execute $powershell -Argument $arguments -WorkingDirectory $projectRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $identity
$principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero) -DontStopIfGoingOnBatteries
$taskName = 'ABBAY CYBERGUARD Device Security Local Service'

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Starts the loopback-only ABBAY CYBERGUARD Windows Device Security helper for the signed-in user.' -Force | Out-Null
Write-Output "Installed current-user logon task '$taskName' with limited privileges."
