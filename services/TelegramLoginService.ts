import * as Crypto from 'expo-crypto'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'

WebBrowser.maybeCompleteAuthSession()

const TELEGRAM_AUTH_URL = 'https://oauth.telegram.org/auth'
const SCOPES = 'openid profile phone'

export type TelegramLoginResult = {
  ok: boolean
  error?: string
  session?: {
    access_token: string
    refresh_token: string
    user_id: string
    expires_at?: number
  }
  phone?: string
}

async function randomHexString(byteCount: number): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(byteCount)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function createPkcePair() {
  const verifier = await randomHexString(32)
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: Crypto.CryptoEncoding.BASE64 },
  )
  const challenge = digest.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return { verifier, challenge }
}

export function getTelegramRedirectUri(): string {
  return Linking.createURL('auth/telegram')
}

function buildAuthorizeUrl(params: {
  clientId: string
  redirectUri: string
  state: string
  codeChallenge: string
}) {
  const q = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: 'code',
    scope: SCOPES,
    state: params.state,
    code_challenge: params.codeChallenge,
    code_challenge_method: 'S256',
  })
  return `${TELEGRAM_AUTH_URL}?${q.toString()}`
}

async function exchangeCodeOnServer(
  code: string,
  codeVerifier: string,
  redirectUri: string,
  edgeFunctionBase: string,
): Promise<TelegramLoginResult> {
  const exchangeUrl = `${edgeFunctionBase}/oidc-exchange`;
  const response = await fetch(exchangeUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
    }),
  })

  const raw = await response.text()
  let data: TelegramLoginResult & { error?: string }
  try {
    data = JSON.parse(raw) as TelegramLoginResult & { error?: string }
  } catch {
    return {
      ok: false,
      error: raw || `Server error (${response.status})`,
    }
  }

  if (!response.ok || !data.ok || !data.session) {
    return {
      ok: false,
      error: data.error || `Login failed (${response.status})`,
    }
  }

  return {
    ok: true,
    session: data.session,
    phone: data.phone,
  }
}

/**
 * Official Telegram Login (OIDC + PKCE).
 * @see https://core.telegram.org/bots/telegram-login
 */
export async function signInWithTelegramOidc(): Promise<TelegramLoginResult> {
  const edgeFunctionBase = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '') +
    '/functions/v1/telegram-auth';

  const appRedirectUri = getTelegramRedirectUri()
  // The Edge Function /callback will redirect back to appRedirectUri
  const backendCallback = `${edgeFunctionBase}/callback`;

  const { verifier, challenge } = await createPkcePair()
  const stateVal = await randomHexString(16)
  const combinedState = `${stateVal}|${appRedirectUri}`

  // Edge Function /login handles the redirect to oauth.telegram.org
  const startUrl = `${edgeFunctionBase}/login?state=${encodeURIComponent(combinedState)}&code_challenge=${encodeURIComponent(challenge)}`;

  const result = await WebBrowser.openAuthSessionAsync(startUrl, appRedirectUri)

  if (result.type !== 'success' || !result.url) {
    if (result.type === 'cancel' || result.type === 'dismiss') {
      return { ok: false, error: 'Telegram sign-in was cancelled' }
    }
    return { ok: false, error: 'Telegram sign-in did not complete' }
  }

  const parsed = Linking.parse(result.url)
  const query = parsed.queryParams || {}

  if (query.error) {
    return {
      ok: false,
      error: typeof query.error_description === 'string'
        ? query.error_description
        : String(query.error),
    }
  }

  const code = typeof query.code === 'string' ? query.code : null
  const returnedState = typeof query.state === 'string' ? query.state : null

  if (!code) {
    return { ok: false, error: 'No authorization code returned from Telegram' }
  }

  if (returnedState && returnedState !== combinedState) {
    return { ok: false, error: 'Invalid state — please try again' }
  }

  // Exchange code using our Edge Function /oidc-exchange endpoint
  return exchangeCodeOnServer(code, verifier, backendCallback, edgeFunctionBase)
}
