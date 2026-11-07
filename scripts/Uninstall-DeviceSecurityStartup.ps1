$ErrorActionPreference = 'Stop'
$taskName = 'ABBAY CYBERGUARD Device Security Local Service'
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if (-not $task) {
  Write-Output 'The ABBAY CYBERGUARD Device Security startup task is not installed.'
  exit 0
}

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
Write-Output 'Removed automatic startup. The currently running helper, if any, is not stopped.'
