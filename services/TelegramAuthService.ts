import { MESCOTT_API_PATHS, mescottApiUrl } from '../config/mescott'

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

function apiUnavailableMessage(status: number, rawText: string): string {
  if (status === 405 || (status === 200 && rawText.includes('<!doctype'))) {
    return (
      'Mescott API is not reachable. Set EXPO_PUBLIC_API_URL=https://api.mescott.co in .env and restart Expo.'
    )
  }
  if (status === 404) {
    return 'Telegram API not found (404). Redeploy webhook-server from the latest code.'
  }
  return `Server error (${status}). Check webhook deployment and env vars.`
}

async function postWebhookApi<T extends { ok?: boolean; error?: string }>(
  path: string,
  body: Record<string, unknown>,
): Promise<T & { ok: boolean; error?: string }> {
  const urls = [
    mescottApiUrl(path),
    ...(path.includes('telegram-request')
      ? [mescottApiUrl(MESCOTT_API_PATHS.telegramRequestSessionNested)]
      : path.includes('telegram-verify')
        ? [mescottApiUrl(MESCOTT_API_PATHS.telegramVerifyNested)]
        : []),
  ]

  let lastError = 'Request failed'

  for (const url of urls) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const { data, rawText } = await parseApiJson<T>(response)

    if (!data) {
      lastError = apiUnavailableMessage(response.status, rawText)
      if (response.status === 404) continue
      return { ok: false, error: lastError } as T & { ok: boolean; error?: string }
    }

    if (!response.ok || data.ok === false) {
      return {
        ...data,
        ok: false,
        error: data.error || apiUnavailableMessage(response.status, rawText),
      } as T & { ok: boolean; error?: string }
    }

    return { ...data, ok: true } as T & { ok: boolean }
  }

  return { ok: false, error: lastError } as T & { ok: boolean; error?: string }
}

export async function requestTelegramSession(
  phone: string,
  purpose: 'sign_in' | 'sign_up' = 'sign_in',
): Promise<TelegramSessionResponse> {
  return postWebhookApi<TelegramSessionResponse>(MESCOTT_API_PATHS.telegramRequestSession, {
    phone,
    purpose,
  })
}

export async function verifyTelegramCode(
  phone: string,
  code: string,
  sessionToken: string,
): Promise<TelegramVerifyResponse> {
  return postWebhookApi<TelegramVerifyResponse>(MESCOTT_API_PATHS.telegramVerify, {
    phone,
    code,
    sessionToken,
  })
}

