const jose = require('jose')

const ISSUER = 'https://oauth.telegram.org'
const TOKEN_URL = `${ISSUER}/token`
const JWKS_URL = new URL(`${ISSUER}/.well-known/jwks.json`)

let jwks = null

function getJwks() {
  if (!jwks) jwks = jose.createRemoteJWKSet(JWKS_URL)
  return jwks
}

function getOidcConfig() {
  const clientId = process.env.TELEGRAM_OIDC_CLIENT_ID || process.env.TELEGRAM_BOT_CLIENT_ID
  const clientSecret =
    process.env.TELEGRAM_OIDC_CLIENT_SECRET || process.env.TELEGRAM_BOT_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error(
      'TELEGRAM_OIDC_CLIENT_ID and TELEGRAM_OIDC_CLIENT_SECRET must be set (from @BotFather → Web Login)',
    )
  }

  return { clientId: String(clientId), clientSecret }
}

/**
 * @param {string} phone E.164
 */
function normalizePhone(phone) {
  const digits = String(phone).replace(/\D/g, '')
  if (!digits || digits.length < 7) {
    throw new Error('Invalid phone number from Telegram')
  }
  return `+${digits}`
}

/**
 * Exchange authorization code (PKCE) for tokens — server-side only.
 * @see https://core.telegram.org/bots/telegram-login#exchange-code-for-tokens
 */
async function exchangeAuthorizationCode({ code, redirectUri, codeVerifier }) {
  const { clientId, clientSecret } = getOidcConfig()
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier,
  })

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
    body: body.toString(),
  })

  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`Telegram token endpoint returned invalid JSON (${res.status})`)
  }

  if (!res.ok) {
    const msg = data.error_description || data.error || text || `HTTP ${res.status}`
    throw new Error(`Telegram token exchange failed: ${msg}`)
  }

  if (!data.id_token) {
    throw new Error('Telegram did not return an id_token')
  }

  return data
}

/**
 * Validate OIDC id_token (signature + iss/aud/exp).
 * @see https://core.telegram.org/bots/telegram-login#validating-id-tokens
 */
async function verifyIdToken(idToken) {
  const { clientId } = getOidcConfig()
  const audiences = [clientId, Number(clientId)].filter((a) => a !== '' && !Number.isNaN(a))

  const { payload } = await jose.jwtVerify(idToken, getJwks(), {
    issuer: ISSUER,
    audience: audiences,
  })

  const telegramUserId = payload.sub || (payload.id != null ? String(payload.id) : null)
  const phoneRaw = payload.phone_number

  if (!telegramUserId) {
    throw new Error('Telegram id_token missing user identifier (sub)')
  }

  if (!phoneRaw) {
    throw new Error(
      'Telegram did not share a phone number. Enable the phone scope in @BotFather → Web Login and try again.',
    )
  }

  return {
    telegramUserId: String(telegramUserId),
    phone: normalizePhone(phoneRaw),
    name: typeof payload.name === 'string' ? payload.name : undefined,
    username:
      typeof payload.preferred_username === 'string' ? payload.preferred_username : undefined,
    picture: typeof payload.picture === 'string' ? payload.picture : undefined,
  }
}

/**
 * Full login: code → tokens → verified claims
 */
async function loginWithAuthorizationCode({ code, redirectUri, codeVerifier }) {
  const tokens = await exchangeAuthorizationCode({ code, redirectUri, codeVerifier })
  const user = await verifyIdToken(tokens.id_token)
  return { user, tokens }
}

module.exports = {
  exchangeAuthorizationCode,
  verifyIdToken,
  loginWithAuthorizationCode,
  normalizePhone,
}
