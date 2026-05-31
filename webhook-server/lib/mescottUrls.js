/**
 * Canonical Mescott URLs for the webhook server (Node.js).
 */
function normalizeBase(url, fallback) {
  const raw = (url || '').trim()
  if (!raw) return fallback.replace(/\/$/, '')
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  return withScheme.replace(/\/$/, '')
}

const MESCOTT_API_URL = normalizeBase(
  process.env.TELEGRAM_WEBHOOK_BASE_URL ||
    process.env.EXPO_PUBLIC_WEBHOOK_API_URL ||
    process.env.EXPO_PUBLIC_API_URL,
  'https://api.mescott.co',
)

const MESCOTT_APP_URL = (process.env.EXPO_PUBLIC_APP_URL || 'https://mescott.co').replace(
  /\/$/,
  '',
)

function apiUrl(path) {
  return `${MESCOTT_API_URL}${path.startsWith('/') ? path : `/${path}`}`
}

module.exports = {
  MESCOTT_API_URL,
  MESCOTT_APP_URL,
  MESCOTT_LOGO_URL: `${MESCOTT_APP_URL}/logo.png`,
  apiUrl,
}
