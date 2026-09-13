const crypto = require('crypto')
const { Buffer } = require('buffer')
const { createClient } = require('@supabase/supabase-js')

const TELEGRAM_ISSUER = 'https://oauth.telegram.org'
const TELEGRAM_JWKS = new URL('https://oauth.telegram.org/.well-known/jwks.json')

function send(res, status, body) {
  res.status(status).json(body)
}

function validateMiniAppData(initData, botToken) {
  const params = new URLSearchParams(initData)
  const receivedHash = params.get('hash')
  if (!receivedHash) throw new Error('Telegram launch data has no signature')

  params.delete('hash')
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
  const calculatedHash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex')
  const received = Buffer.from(receivedHash, 'hex')
  const calculated = Buffer.from(calculatedHash, 'hex')
  if (received.length !== calculated.length || !crypto.timingSafeEqual(received, calculated)) {
    throw new Error('Telegram launch signature is invalid')
  }

  const authDate = Number(params.get('auth_date'))
  if (!authDate || Math.abs(Date.now() / 1000 - authDate) > 300) {
    throw new Error('Telegram launch data has expired')
  }

  const user = JSON.parse(params.get('user') || 'null')
  if (!user?.id) throw new Error('Telegram launch data has no user')
  return user
}

async function validateOidcCode(body, clientId, clientSecret) {
  const tokenResponse = await fetch('https://oauth.telegram.org/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: body.code,
      redirect_uri: body.redirectUri,
      client_id: String(clientId),
      code_verifier: body.codeVerifier,
    }),
  })
  const tokens = await tokenResponse.json()
  if (!tokenResponse.ok || !tokens.id_token) {
    throw new Error(tokens.error_description || tokens.error || 'Telegram token exchange failed')
  }

  const { createRemoteJWKSet, jwtVerify } = await import('jose')
  const { payload } = await jwtVerify(tokens.id_token, createRemoteJWKSet(TELEGRAM_JWKS), {
    issuer: TELEGRAM_ISSUER,
    audience: String(clientId),
  })
  if (!body.nonce || payload.nonce !== body.nonce) throw new Error('Telegram nonce is invalid')
  return payload
}

async function createSupabaseLogin(claims) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) throw new Error('Supabase server credentials are not configured')

  const telegramId = String(claims.sub || claims.id)
  const email = `telegram-${telegramId}@auth.mescott.app`
  const metadata = {
    provider: 'telegram',
    telegram_id: telegramId,
    full_name: claims.name || [claims.first_name, claims.last_name].filter(Boolean).join(' '),
    username: claims.preferred_username || claims.username || null,
    avatar_url: claims.picture || claims.photo_url || null,
    phone: claims.phone_number || null,
  }
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const { error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: metadata,
  })
  if (createError && !/already|registered|exists/i.test(createError.message)) throw createError

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { data: metadata },
  })
  if (error || !data?.properties?.hashed_token) throw error || new Error('Could not create app session')
  return data.properties.hashed_token
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' })
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}
    let claims
    if (body.mode === 'mini_app') {
      if (!process.env.TELEGRAM_BOT_TOKEN) throw new Error('Telegram bot token is not configured')
      claims = validateMiniAppData(body.initData, process.env.TELEGRAM_BOT_TOKEN)
    } else if (body.mode === 'oidc') {
      if (!process.env.TELEGRAM_CLIENT_ID || !process.env.TELEGRAM_CLIENT_SECRET) {
        throw new Error('Telegram OIDC credentials are not configured')
      }
      claims = await validateOidcCode(
        body,
        process.env.TELEGRAM_CLIENT_ID,
        process.env.TELEGRAM_CLIENT_SECRET,
      )
    } else {
      return send(res, 400, { error: 'Unsupported Telegram authentication mode' })
    }

    const tokenHash = await createSupabaseLogin(claims)
    return send(res, 200, { tokenHash })
  } catch (error) {
    console.error('Telegram authentication failed:', error)
    return send(res, 401, { error: error.message || 'Telegram authentication failed' })
  }
}
