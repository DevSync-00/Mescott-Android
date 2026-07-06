import {
  MESCOTT_API_PATHS,
  TELEGRAM_BOT_USERNAME,
  mescottApiUrl,
} from '../config/mescott'
import { supabase } from '../lib/supabase'

export type TelegramSessionResponse = {
  ok: boolean
  sessionToken?: string
  /** Present when using Supabase RPC — enter in app if bot does not DM the code yet */
  code?: string
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

async function requestTelegramSessionViaSupabase(
  phone: string,
  purpose: 'sign_in' | 'sign_up',
): Promise<TelegramSessionResponse> {
  const { data, error } = await supabase.rpc('create_telegram_session', {
    p_phone: phone,
    p_purpose: purpose,
  })

  if (error) {
    const code = (error as { code?: string }).code
    const missingRpc =
      code === 'PGRST202' ||
      (error.message?.includes('Could not find the function') &&
        !error.message?.includes('gen_random_bytes'))

    if (missingRpc) {
      return {
        ok: false,
        error:
          'create_telegram_session is not on your Supabase project yet. Run webhook-server/sql/telegram_setup_complete.sql in SQL Editor.',
      }
    }

    if (error.message?.includes('gen_random_bytes')) {
      return {
        ok: false,
        error:
          'Telegram function needs an update. Run webhook-server/sql/telegram_setup_complete.sql again in Supabase SQL Editor.',
      }
    }

    if (error.message?.includes('telegram_verification_codes')) {
      return {
        ok: false,
        error: 'Run telegram_tables.sql first, then telegram_session_rpc.sql (or telegram_setup_complete.sql).',
      }
    }

    return { ok: false, error: error.message || 'Supabase error' }
  }

  const row = data as { ok?: boolean; sessionToken?: string; code?: string } | null
  if (!row?.sessionToken) {
    return { ok: false, error: 'Could not create Telegram session' }
  }

  return {
    ok: true,
    sessionToken: row.sessionToken,
    code: row.code,
    deepLink: buildDeepLink(row.sessionToken, purpose),
    botUsername: TELEGRAM_BOT_USERNAME.replace(/^@/, ''),
  }
}

async function postJson<T extends { ok?: boolean; error?: string }>(
  url: string,
  body: Record<string, unknown>,
): Promise<{ result: T & { ok: boolean; error?: string }; status: number }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const status = response.status
  const { data, rawText } = await parseApiJson<T>(response)

  if (!data) {
    return {
      result: {
        ok: false,
        error:
          status === 404
            ? 'API route missing'
            : `Server error (${status})`,
      } as T & { ok: boolean; error?: string },
      status,
    }
  }

  if (!response.ok || data.ok === false) {
    const successShape = data as T & { success?: boolean }
    if (successShape.success === true && status === 200) {
      return { result: { ...data, ok: true } as T & { ok: boolean }, status }
    }
    return {
      result: {
        ...data,
        ok: false,
        error: data.error || `Request failed (${status})`,
      } as T & { ok: boolean; error?: string },
      status,
    }
  }

  return { result: { ...data, ok: true } as T & { ok: boolean }, status }
}

async function postWithFallbacks<T extends { ok?: boolean; error?: string }>(
  paths: string[],
  body: Record<string, unknown>,
): Promise<{ result: T & { ok: boolean; error?: string }; status: number }> {
  let last = {
    result: { ok: false, error: 'Request failed' } as T & { ok: boolean; error?: string },
    status: 0,
  }

  for (const path of paths) {
    last = await postJson<T>(mescottApiUrl(path), body)
    if (last.result.ok) return last
    if (last.status !== 404) return last
  }

  return last
}

export async function requestTelegramSession(
  phone: string,
  purpose: 'sign_in' | 'sign_up' = 'sign_in',
): Promise<TelegramSessionResponse> {
  // 1) Supabase — works without new Vercel routes
  const viaDb = await requestTelegramSessionViaSupabase(phone, purpose)
  if (viaDb.ok) return viaDb

  // 2) Dedicated API routes (after full redeploy)
  const viaApi = await postWithFallbacks<TelegramSessionResponse>(
    [
      MESCOTT_API_PATHS.telegramRequestSession,
      MESCOTT_API_PATHS.telegramRequestSessionNested,
    ],
    { phone, purpose },
  )
  if (viaApi.result.ok) return viaApi.result

  // 3) Existing /api/webhook multiplexer (after webhook/index.js redeploy)
  const viaWebhook = await postJson<TelegramSessionResponse>(
    mescottApiUrl(MESCOTT_API_PATHS.chapaWebhook),
    { mescott_action: 'telegram-request-session', phone, purpose },
  )
  if (viaWebhook.result.ok) return viaWebhook.result

  return {
    ok: false,
    error: viaDb.error || viaWebhook.result.error || viaApi.result.error || 'Could not start Telegram verification',
  }
}

export async function verifyTelegramCode(
  phone: string,
  code: string,
  sessionToken: string,
): Promise<TelegramVerifyResponse> {
  const body = { phone, code, sessionToken }

  const viaApi = await postWithFallbacks<TelegramVerifyResponse>(
    [MESCOTT_API_PATHS.telegramVerify, MESCOTT_API_PATHS.telegramVerifyNested],
    body,
  )
  if (viaApi.result.ok) return viaApi.result

  const viaWebhook = await postJson<TelegramVerifyResponse>(
    mescottApiUrl(MESCOTT_API_PATHS.chapaWebhook),
    { mescott_action: 'telegram-verify', ...body },
  )
  if (viaWebhook.result.ok) return viaWebhook.result

  return {
    ok: false,
    error:
      viaWebhook.result.error ||
      viaApi.result.error ||
      'Verification API not live. Redeploy webhook-server and set SUPABASE_SERVICE_ROLE_KEY on Vercel.',
  }
}
