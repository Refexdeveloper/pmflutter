/**
 * Production equivalent of the Vite dev proxies.
 * Kissflow access keys and the User Master token are added here and never sent to the browser.
 */
function envValue(...names) {
  for (const name of names) {
    const value = String(process.env[name] || '').trim()
    if (value) return value
  }
  return ''
}

function kissflowSettings() {
  const apiOrigin = (
    envValue('KF_API_ORIGIN', 'VITE_KF_API_ORIGIN', 'VITE_KF_BASE_URL', 'VITE_KF_LIVE_API_ORIGIN') ||
    'https://refexgroup.kissflow.com'
  ).replace(/\/$/, '')
  const liveOrigin = (
    envValue('KF_LIVE_API_ORIGIN', 'VITE_KF_LIVE_API_ORIGIN') || 'https://refexgroup.kissflow.com'
  ).replace(/\/$/, '')
  const devOrigin = (
    envValue('KF_DEV_API_ORIGIN', 'VITE_KF_DEV_API_ORIGIN') || 'https://development-refexgroup.kissflow.com'
  ).replace(/\/$/, '')
  const devAccountId = envValue('KF_DEV_ACCOUNT_ID', 'VITE_KF_DEV_ACCOUNT_ID', 'VITE_KF_ACCOUNT_ID') || 'AcCMptp3yqcn'
  const liveAccountId = envValue('KF_LIVE_ACCOUNT_ID', 'VITE_KF_LIVE_ACCOUNT_ID') || 'AcCMptlq60zH'
  const activeIsLive = apiOrigin.includes('refexgroup.kissflow.com') && !apiOrigin.includes('development-refexgroup')
  return { apiOrigin, liveOrigin, devOrigin, devAccountId, liveAccountId, activeIsLive }
}

function devKeys() {
  return {
    id: envValue('KF_ACCESS_KEY_ID', 'VITE_KF_DEV_ACCESS_KEY_ID', 'VITE_KF_ACCESS_KEY_ID'),
    secret: envValue('KF_ACCESS_KEY_SECRET', 'VITE_KF_DEV_ACCESS_KEY_SECRET', 'VITE_KF_ACCESS_KEY_SECRET'),
  }
}

function liveKeys() {
  return {
    id: envValue('KF_LIVE_ACCESS_KEY_ID', 'VITE_KF_LIVE_ACCESS_KEY_ID'),
    secret: envValue('KF_LIVE_ACCESS_KEY_SECRET', 'VITE_KF_LIVE_ACCESS_KEY_SECRET'),
  }
}

function userMasterToken() {
  return envValue('USER_MASTER_TOKEN', 'VITE_USER_MASTER_TOKEN')
}

export function createWebhookUrl() {
  return envValue('PM_CREATE_WEBHOOK_URL', 'VITE_PM_CREATE_WEBHOOK_URL')
}

function sendJson(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
  return true
}

function readRaw(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function shouldRewriteGetToLive(method, pathOnly) {
  if (method !== 'GET' && method !== 'HEAD') return false
  if (
    pathOnly.startsWith('/kf-live') ||
    pathOnly.startsWith('/kf-dev') ||
    pathOnly.startsWith('/__pm-last-webhook')
  ) {
    return false
  }
  if (pathOnly.includes('/pm_external_report_A00') || pathOnly.includes('/pm_subtask_A00')) return false
  return ['/process/', '/process-report/', '/case/', '/case-report/', '/user/'].some((prefix) =>
    pathOnly.startsWith(prefix),
  )
}

function isDirectKissflowPath(pathOnly) {
  return ['/process', '/process-report', '/case', '/case-report', '/user', '/form', '/flow', '/dataset', '/integration'].some(
    (prefix) => pathOnly === prefix || pathOnly.startsWith(`${prefix}/`),
  )
}

async function forward(req, res, target, method, extraHeaders) {
  const headers = { Accept: req.headers.accept || 'application/json' }
  if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type']
  Object.assign(headers, extraHeaders)
  const hasBody = method !== 'GET' && method !== 'HEAD'
  let upstream
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body: hasBody ? await readRaw(req) : undefined,
      redirect: 'manual',
      signal: AbortSignal.timeout(25000),
    })
  } catch (error) {
    sendJson(res, 502, { error: error?.message || 'Upstream request failed.' })
    return
  }
  const body = Buffer.from(await upstream.arrayBuffer())
  res.statusCode = upstream.status
  const contentType = upstream.headers.get('content-type')
  if (contentType) res.setHeader('Content-Type', contentType)
  res.end(body)
}

export async function handleExternalProxy(req, res) {
  const url = new URL(req.url || '/', 'http://localhost')
  const pathOnly = url.pathname
  const method = String(req.method || 'GET').toUpperCase()
  const settings = kissflowSettings()

  if (pathOnly === '/api/v1' || pathOnly.startsWith('/api/v1/')) {
    const token = userMasterToken()
    if (!token) return sendJson(res, 503, { error: 'User Master token is not configured on the server.' })
    const upstreamPath = `${pathOnly}${url.search}`
    await forward(req, res, `https://refexone.com${upstreamPath}`, method, {
      Authorization: `Bearer ${token}`,
    })
    return true
  }

  const live = liveKeys()
  const dev = devKeys()
  let target = ''
  let keys = null

  if (shouldRewriteGetToLive(method, pathOnly) && live.id && live.secret) {
    const rewritten = pathOnly.replaceAll(settings.devAccountId, settings.liveAccountId)
    target = `${settings.liveOrigin}${rewritten}${url.search}`
    keys = live
  } else if (pathOnly === '/kf-live' || pathOnly.startsWith('/kf-live/')) {
    const stripped = pathOnly.replace(/^\/kf-live/, '') || '/'
    target = `${settings.liveOrigin}${stripped}${url.search}`
    keys = live
  } else if (pathOnly === '/kf-dev' || pathOnly.startsWith('/kf-dev/')) {
    let stripped = pathOnly.replace(/^\/kf-dev/, '') || '/'
    if (settings.activeIsLive) stripped = stripped.replaceAll(settings.devAccountId, settings.liveAccountId)
    target = `${settings.activeIsLive ? settings.liveOrigin : settings.devOrigin}${stripped}${url.search}`
    keys = settings.activeIsLive ? live : dev
  } else if (isDirectKissflowPath(pathOnly)) {
    target = `${settings.apiOrigin}${pathOnly}${url.search}`
    keys = settings.activeIsLive ? live : dev
  } else {
    return false
  }

  if (!keys?.id || !keys?.secret) {
    return sendJson(res, 503, { error: 'Kissflow credentials are not configured on the server.' })
  }

  await forward(req, res, target, method, {
    'X-Access-Key-Id': keys.id,
    'X-Access-Key-Secret': keys.secret,
  })
  return true
}
