export function createDeviceSecurityAlert(kind, severity, timestamp = new Date()) {
  return {
    id: `${kind}-${timestamp.getTime()}`,
    kind,
    severity,
    timestamp: timestamp.toISOString(),
    dismissed: false,
  }
}

export async function requestDeviceSecurityNotificationPermission(notificationApi) {
  if (!notificationApi || typeof notificationApi.requestPermission !== 'function') {
    return { permission: 'unsupported', enabled: false, error: 'unsupported' }
  }

  try {
    const permission = await notificationApi.requestPermission()
    return {
      permission,
      enabled: permission === 'granted',
      error: permission === 'granted' ? null : permission === 'denied' ? 'denied' : 'not-granted',
    }
  } catch {
    return {
      permission: notificationApi.permission || 'default',
      enabled: false,
      error: 'unavailable',
    }
  }
}

export function evaluateLocalServiceHealth(previousState, failureCount, healthy) {
  if (healthy) {
    return {
      state: 'available',
      consecutiveFailures: 0,
      alerts: previousState === 'unavailable' ? ['service_recovered'] : [],
    }
  }

  const consecutiveFailures = failureCount + 1
  const alerts = previousState !== 'unavailable'
    ? ['service_unavailable']
    : consecutiveFailures === 3
      ? ['service_repeated_failures']
      : []

  return {
    state: 'unavailable',
    consecutiveFailures,
    alerts,
  }
}
