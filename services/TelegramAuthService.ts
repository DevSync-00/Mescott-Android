import {
  MESCOTT_API_PATHS,
  TELEGRAM_BOT_USERNAME,
  mescottApiUrl,
} from '../config/mescott'
import { supabase } from '../lib/supabase'

export type TelegramSessionResponse = {
  ok: boolean
  sessionToken?: string
  deepLink?: string
  botUsername?: string
  error?: string
}

export type TelegramVerifyResponse = {
  ok: boolean
  verified?: boolean
  error?: string
  session?: {
    access_token: string
    refresh_token: string
    user_id: string
    expires_at?: number
  }
}

async function parseApiJson<T>(response: Response): Promise<{ data: T | null; rawText: string }> {
  const rawText = await response.text()
  if (!rawText.trim()) {
    return { data: null, rawText }
  }
  try {
    return { data: JSON.parse(rawText) as T, rawText }
  } catch {
    return { data: null, rawText }
  }
}

function buildDeepLink(sessionToken: string, purpose: 'sign_in' | 'sign_up') {
  const prefix = purpose === 'sign_up' ? 'signup' : 'signin'
  const bot = TELEGRAM_BOT_USERNAME.replace(/^@/, '')
  return `https://t.me/${bot}?start=${prefix}_${sessionToken}`
}

/** Fallback when api.mescott.co has not been redeployed with Telegram routes */
async function requestTelegramSessionViaSupabase(
  phone: string,
  purpose: 'sign_in' | 'sign_up',
): Promise<TelegramSessionResponse> {
  const { data, error } = await supabase.rpc('create_telegram_session', {
    p_phone: phone,
    p_purpose: purpose,
  })

  if (error) {
    if (error.message?.includes('does not exist')) {
      return {
        ok: false,
        error:
          'Telegram is not set up in the database. Run webhook-server/sql/telegram_tables.sql and telegram_session_rpc.sql in Supabase.',
      }
    }
    return { ok: false, error: error.message }
  }

  const row = data as { ok?: boolean; sessionToken?: string } | null
  if (!row?.sessionToken) {
    return { ok: false, error: 'Could not create Telegram session' }
  }

  return {
    ok: true,
    sessionToken: row.sessionToken,
    deepLink: buildDeepLink(row.sessionToken, purpose),
    botUsername: TELEGRAM_BOT_USERNAME.replace(/^@/, ''),
  }
}

async function postWebhookApi<T extends { ok?: boolean; error?: string }>(
  path: string,
  body: Record<string, unknown>,
): Promise<{ result: T & { ok: boolean; error?: string }; status: number }> {
  const urls = [
    mescottApiUrl(path),
    ...(path.includes('telegram-request')
      ? [mescottApiUrl(MESCOTT_API_PATHS.telegramRequestSessionNested)]
      : path.includes('telegram-verify')
        ? [mescottApiUrl(MESCOTT_API_PATHS.telegramVerifyNested)]
        : []),
  ]

  let lastStatus = 0
  let lastError = 'Request failed'

  for (const url of urls) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    lastStatus = response.status
    const { data, rawText } = await parseApiJson<T>(response)

    if (!data) {
      lastError =
        response.status === 404
          ? 'API route missing on server'
          : `Server error (${response.status})`
      if (response.status === 404) continue
      return {
        result: { ok: false, error: lastError } as T & { ok: boolean; error?: string },
        status: response.status,
      }
    }

    if (!response.ok || data.ok === false) {
      return {
        result: {
          ...data,
          ok: false,
          error: data.error || `Request failed (${response.status})`,
        } as T & { ok: boolean; error?: string },
        status: response.status,
      }
    }

    return { result: { ...data, ok: true } as T & { ok: boolean }, status: response.status }
  }

  return {
    result: { ok: false, error: lastError } as T & { ok: boolean; error?: string },
    status: lastStatus,
  }
}

export async function requestTelegramSession(
  phone: string,
  purpose: 'sign_in' | 'sign_up' = 'sign_in',
): Promise<TelegramSessionResponse> {
  const { result, status } = await postWebhookApi<TelegramSessionResponse>(
    MESCOTT_API_PATHS.telegramRequestSession,
    { phone, purpose },
  )

  if (result.ok) return result

  if (status === 404) {
    const fallback = await requestTelegramSessionViaSupabase(phone, purpose)
    if (fallback.ok) return fallback
  }

  return {
    ok: false,
    error:
      result.error ||
      'Telegram API not found. Redeploy webhook-server: cd webhook-server && npx vercel login && npx vercel --prod',
  }
}

export async function verifyTelegramCode(
  phone: string,
  code: string,
  sessionToken: string,
): Promise<TelegramVerifyResponse> {
  const { result, status } = await postWebhookApi<TelegramVerifyResponse>(
    MESCOTT_API_PATHS.telegramVerify,
    { phone, code, sessionToken },
  )

  if (result.ok) return result

  if (status === 404) {
    return {
      ok: false,
      error:
        'Verify API not deployed yet. Run in terminal: cd webhook-server, then npx vercel login, then npx vercel --prod',
    }
  }

  return {
    ok: false,
    error: result.error || 'Verification failed',
  }
}
