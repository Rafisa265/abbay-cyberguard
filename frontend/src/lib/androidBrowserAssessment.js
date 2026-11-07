const permissionNames = ['geolocation', 'camera', 'microphone']

export function isAndroidBrowser(navigatorObject = globalThis.navigator) {
  if (!navigatorObject) return false
  const platform = navigatorObject.userAgentData?.platform || ''
  return /^android$/i.test(platform) || /\bandroid\b/i.test(navigatorObject.userAgent || '')
}

function finding(id, name, status, severity, remediation, evidence = '') {
  return {
    id,
    name,
    status,
    severity,
    category: 'Device State',
    remediation,
    evidence,
  }
}

async function getPermissionStates(permissions) {
  const states = {}
  if (!permissions || typeof permissions.query !== 'function') {
    return Object.fromEntries(permissionNames.map((name) => [name, 'not-supported']))
  }

  await Promise.all(permissionNames.map(async (name) => {
    try {
      const permission = await permissions.query({ name })
      states[name] = permission.state
    } catch {
      states[name] = 'not-checked'
    }
  }))
  return states
}

export async function inspectAndroidBrowserEnvironment({
  windowObject = globalThis.window,
  navigatorObject = globalThis.navigator,
  timestamp = new Date(),
} = {}) {
  const secureContext = windowObject?.isSecureContext === true
  const isHttps = windowObject?.location?.protocol === 'https:'
  const permissions = await getPermissionStates(navigatorObject?.permissions)
  const notificationApi = typeof windowObject?.Notification !== 'undefined'
  const notificationPermission = notificationApi
    ? windowObject.Notification.permission
    : 'not-supported'
  const findings = [
    finding(
      'ANDROID-HTTPS',
      'device.check_android_https_name',
      isHttps ? 'PASS' : 'WARNING',
      isHttps ? 'INFO' : 'HIGH',
      'device.check_android_https_rem',
      isHttps ? 'HTTPS' : 'HTTP'
    ),
    finding(
      'ANDROID-SECURE-CONTEXT',
      'device.check_android_secure_context_name',
      secureContext ? 'PASS' : 'WARNING',
      secureContext ? 'INFO' : 'MEDIUM',
      'device.check_android_secure_context_rem',
      secureContext ? 'secure' : 'not-secure'
    ),
    finding(
      'ANDROID-CRYPTO',
      'device.check_android_crypto_name',
      navigatorObject?.crypto?.subtle ? 'PASS' : 'NOT SUPPORTED',
      'INFO',
      'device.check_android_crypto_rem',
      navigatorObject?.crypto?.subtle ? 'available' : 'unavailable'
    ),
    finding(
      'ANDROID-SERVICE-WORKER',
      'device.check_android_service_worker_name',
      navigatorObject?.serviceWorker ? 'PASS' : 'NOT SUPPORTED',
      'INFO',
      'device.check_android_service_worker_rem',
      navigatorObject?.serviceWorker ? 'available' : 'unavailable'
    ),
    finding(
      'ANDROID-NOTIFICATIONS',
      'device.check_android_notifications_name',
      !notificationApi
        ? 'NOT SUPPORTED'
        : notificationPermission === 'denied'
          ? 'WARNING'
          : notificationPermission === 'granted'
            ? 'PASS'
            : 'NOT CHECKED',
      notificationPermission === 'denied' ? 'LOW' : 'INFO',
      'device.check_android_notifications_rem',
      notificationPermission
    ),
    ...permissionNames.map((name) => finding(
      `ANDROID-PERMISSION-${name.toUpperCase()}`,
      `device.check_android_permission_${name}_name`,
      permissions[name] === 'not-supported' ? 'NOT SUPPORTED' : 'NOT CHECKED',
      'INFO',
      `device.check_android_permission_${name}_rem`,
      permissions[name]
    )),
  ]

  const counts = findings.reduce((totals, item) => {
    if (item.status === 'PASS') totals.pass_count += 1
    else if (item.status === 'WARNING') totals.warning_count += 1
    else if (item.status === 'FAIL') totals.fail_count += 1
    else if (item.status === 'NOT SUPPORTED') totals.not_supported_count += 1
    else totals.not_checked_count += 1
    return totals
  }, {
    pass_count: 0,
    warning_count: 0,
    fail_count: 0,
    not_supported_count: 0,
    not_checked_count: 0,
  })

  return {
    target: 'android',
    overall_status: 'BROWSER_ONLY',
    overall_rating: 'BROWSER_ONLY',
    scan_time: timestamp.toISOString(),
    device_summary: {
      model: 'Android browser',
      os: 'Android (browser-visible only)',
    },
    metrics: {
      total_checks: findings.length,
      ...counts,
    },
    findings,
  }
}
