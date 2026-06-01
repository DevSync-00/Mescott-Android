/**
 * Mescott URLs:
 * - mescott.co — marketing / app links
 * - api.mescott.co — webhook server (Chapa, Telegram, payment return)
 */
export const MESCOTT_SITE_URL = 'https://mescott.co'
export const MESCOTT_API_BASE = 'https://api.mescott.co'

/** Ensures https:// and no trailing slash (accepts "api.mescott.co" in .env) */
export function normalizeBaseUrl(url: string | undefined, fallback: string): string {
  const raw = (url || '').trim()
  if (!raw) return fallback.replace(/\/$/, '')
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  return withScheme.replace(/\/$/, '')
}

export const MESCOTT_APP_URL = normalizeBaseUrl(
  process.env.EXPO_PUBLIC_APP_URL,
  MESCOTT_SITE_URL,
)

/** Webhook server — defaults to api.mescott.co */
export const MESCOTT_API_URL = normalizeBaseUrl(
  process.env.EXPO_PUBLIC_WEBHOOK_API_URL ||
    process.env.EXPO_PUBLIC_API_URL,
  MESCOTT_API_BASE,
)

/** @deprecated alias — same as MESCOTT_API_URL */
export const MESCOTT_WEBHOOK_API_URL = MESCOTT_API_URL

export function mescottWebhookApiUrl(path: string): string {
  return `${MESCOTT_API_URL}${path.startsWith('/') ? path : `/${path}`}`
}

export const MESCOTT_LOGO_URL = `${MESCOTT_APP_URL}/logo.png`

export const MESCOTT_EMAILS = {
  support: 'support@mescott.co',
  privacy: 'privacy@mescott.co',
  customer: 'customer@mescott.co',
} as const

export const MESCOTT_API_PATHS = {
  chapaWebhook: '/api/webhook',
  paymentReturn: '/api/payment-return',
  telegramWebhook: '/api/webhooks/telegram',
  telegramRequestSession: '/api/telegram-request-session',
  telegramVerify: '/api/telegram-verify',
  /** Telegram via existing Chapa webhook route (until dedicated routes deploy) */
  telegramViaWebhook: '/api/webhook',
  telegramRequestSessionNested: '/api/telegram/request-session',
  telegramVerifyNested: '/api/telegram/verify',
  telegramSend: '/api/telegram/send',
  telegramMessages: '/api/telegram/messages',
  /** Official Telegram Login (OIDC) — exchange code for Supabase session */
  telegramOidc: '/api/auth/telegram-oidc',
} as const

/** Numeric Client ID from @BotFather → Bot Settings → Web Login */
export const TELEGRAM_OIDC_CLIENT_ID =
  process.env.EXPO_PUBLIC_TELEGRAM_OIDC_CLIENT_ID || ''

export const TELEGRAM_BOT_USERNAME =
  process.env.EXPO_PUBLIC_TELEGRAM_BOT_USERNAME || 'MescottBot'

export function mescottApiUrl(path: string): string {
  return mescottWebhookApiUrl(path)
}
