param([switch]$RunInConsole)
$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$backendRoot = Join-Path $projectRoot 'backend'
$python = Join-Path $backendRoot '.venv\Scripts\python.exe'
$taskMutex = New-Object -TypeName System.Threading.Mutex -ArgumentList @($false, 'Local\ABBAYCyberGuardDeviceSecurity')
$mutexHeld = $false

function Test-DeviceSecurityService {
  try {
    $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/v1/health' -TimeoutSec 3
    $status = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/v1/device-security/status' -TimeoutSec 3
    return $health.status -eq 'ok' -and $status.host_platform -eq 'Windows'
  } catch {
    return $false
  }
}

function Test-LocalPortInUse {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $client.Connect('127.0.0.1', 8000)
    return $true
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

if (-not (Test-Path -LiteralPath $python -PathType Leaf)) {
  Write-Error 'The existing backend virtual environment is missing. Run the project setup once, then retry.'
  exit 1
}

$env:CYBERSHIELD_BIND = '127.0.0.1'
$env:CYBERSHIELD_PORT = '8000'
$env:CYBERSHIELD_ALLOW_NON_LOOPBACK = 'false'

try {
  $mutexHeld = $taskMutex.WaitOne(0)
} catch [System.Threading.AbandonedMutexException] {
  $mutexHeld = $true
}

if (-not $mutexHeld) {
  if (Test-DeviceSecurityService) {
    Write-Output 'The Windows Device Security helper is already running.'
  } else {
    Write-Output 'The automatic startup helper is already starting.'
  }
  exit 0
}

try {
  if ($RunInConsole) {
    if (Test-DeviceSecurityService) {
      Write-Output 'The Windows Device Security helper is already running.'
      exit 0
    }
    if (Test-LocalPortInUse) {
      Write-Error 'Port 8000 is occupied by a service that did not identify itself as the Windows Device Security helper. No process was started.'
      exit 2
    }
    Write-Output 'Starting the local-only service at http://127.0.0.1:8000'
    & $python 'run.py'
    exit $LASTEXITCODE
  }

  $restartCount = 0
  $service = $null
  $failedHealthChecks = 0
  while ($true) {
    if ($service -and $service.HasExited) {
      $service = $null
      $restartCount++
      $failedHealthChecks = 0
      if ($restartCount -gt 3) {
        Write-Error 'The local helper stopped repeatedly. Automatic recovery paused after three restarts.'
        exit 3
      }
    }

    if (Test-DeviceSecurityService) {
      $failedHealthChecks = 0
    } elseif ($service) {
      $failedHealthChecks++
      if ($failedHealthChecks -ge 3) {
        Stop-Process -Id $service.Id -Force
        $service = $null
        $failedHealthChecks = 0
        $restartCount++
        if ($restartCount -gt 3) {
          Write-Error 'The local helper repeatedly failed its health checks. Automatic recovery paused after three restarts.'
          exit 3
        }
      }
    } elseif (Test-LocalPortInUse) {
      Write-Error 'Port 8000 is occupied by a service that did not identify itself as the Windows Device Security helper. No process was started or stopped.'
      exit 2
    } elseif ($restartCount -le 3) {
      if ($restartCount -gt 0) {
        Start-Sleep -Seconds 15
      }
      $service = Start-Process -FilePath $python -ArgumentList 'run.py' -WorkingDirectory $backendRoot -WindowStyle Hidden -PassThru
    } else {
      Write-Error 'The local helper stopped repeatedly. Automatic recovery paused after three restarts.'
      exit 3
    }

    Start-Sleep -Seconds 30
  }
} finally {
  if ($mutexHeld) {
    $taskMutex.ReleaseMutex()
  }
  $taskMutex.Dispose()
}
