const { createClient } = require('@supabase/supabase-js')
const logger = require('../logger')

const TABLE = process.env.TELEGRAM_VERIFICATION_TABLE || 'telegram_verification_codes'
const CODE_TTL_MINUTES = Number(process.env.TELEGRAM_OTP_TTL_MINUTES || 10)

let supabase = null
const mockStore = []

function getSupabase() {
  if (supabase) return supabase
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !key) return null
  supabase = createClient(url, key)
  return supabase
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function expiresAt() {
  return new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString()
}

/** App calls this before opening Telegram */
async function createPendingSession({ sessionToken, phone, purpose = 'sign_in' }) {
  const row = {
    telegram_user_id: `pending_${sessionToken}`,
    phone: phone.trim(),
    code: '000000',
    purpose,
    session_token: sessionToken,
    expires_at: expiresAt(),
    used_at: null,
  }

  const client = getSupabase()
  if (!client) {
    mockStore.push(row)
    return row
  }

  const { error } = await client.from(TABLE).insert([row])
  if (error) throw error
  return row
}

/** Bot /start with signin_<sessionToken> or signup_<sessionToken> */
async function activateSessionFromBot(sessionToken, telegramUserId) {
  const code = generateOtp()
  const client = getSupabase()

  if (!client) {
    const row = mockStore.find(
      (r) => r.session_token === sessionToken && !r.used_at && r.telegram_user_id.startsWith('pending_'),
    )
    if (!row) return null
    row.telegram_user_id = String(telegramUserId)
    row.code = code
    row.expires_at = expiresAt()
    return { code, phone: row.phone, purpose: row.purpose, expiresAt: row.expires_at }
  }

  const { data: existing, error: findError } = await client
    .from(TABLE)
    .select('*')
    .eq('session_token', sessionToken)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (findError) throw findError

  if (existing) {
    const { error: updateError } = await client
      .from(TABLE)
      .update({
        telegram_user_id: String(telegramUserId),
        code,
        expires_at: expiresAt(),
      })
      .eq('id', existing.id)

    if (updateError) throw updateError
    return {
      code,
      phone: existing.phone,
      purpose: existing.purpose,
      expiresAt: expiresAt(),
    }
  }

  return null
}

async function createVerificationCode({
  telegramUserId,
  phone = null,
  purpose = 'sign_in',
  sessionToken = null,
}) {
  const code = generateOtp()
  const exp = expiresAt()

  const row = {
    telegram_user_id: String(telegramUserId),
    phone,
    code,
    purpose,
    session_token: sessionToken,
    expires_at: exp,
    used_at: null,
  }

  const client = getSupabase()
  if (!client) {
    mockStore.push(row)
    return { code, expiresAt: exp, mock: true }
  }

  const { error } = await client.from(TABLE).insert([row])
  if (error) throw error
  return { code, expiresAt: exp, mock: false }
}

async function verifyCode(telegramUserId, submittedCode) {
  const client = getSupabase()
  const key = String(telegramUserId)

  if (!client) {
    const row = mockStore.find(
      (r) => r.telegram_user_id === key && !r.used_at && r.code === String(submittedCode).trim(),
    )
    if (!row) return { valid: false, reason: 'no_code' }
    if (new Date(row.expires_at) < new Date()) return { valid: false, reason: 'expired' }
    row.used_at = new Date().toISOString()
    return {
      valid: true,
      purpose: row.purpose,
      phone: row.phone,
      sessionToken: row.session_token,
      telegramUserId: key,
    }
  }

  const { data, error } = await client
    .from(TABLE)
    .select('*')
    .eq('telegram_user_id', key)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) return { valid: false, reason: 'no_code' }
  if (data.code !== String(submittedCode).trim()) return { valid: false, reason: 'invalid' }

  await client.from(TABLE).update({ used_at: new Date().toISOString() }).eq('id', data.id)

  return {
    valid: true,
    purpose: data.purpose,
    phone: data.phone,
    sessionToken: data.session_token,
    telegramUserId: key,
  }
}

/** Mobile app verifies session + code + phone */
async function verifyBySession(sessionToken, submittedCode, phone) {
  const client = getSupabase()
  const code = String(submittedCode).trim()
  const normalizedPhone = phone.trim()

  if (!client) {
    const row = mockStore.find(
      (r) =>
        r.session_token === sessionToken &&
        r.phone === normalizedPhone &&
        r.code === code &&
        !r.used_at,
    )
    if (!row) return { valid: false, reason: 'no_code' }
    if (new Date(row.expires_at) < new Date()) return { valid: false, reason: 'expired' }
    row.used_at = new Date().toISOString()
    return {
      valid: true,
      purpose: row.purpose,
      phone: row.phone,
      sessionToken,
      telegramUserId: row.telegram_user_id,
    }
  }

  const { data, error } = await client
    .from(TABLE)
    .select('*')
    .eq('session_token', sessionToken)
    .eq('phone', normalizedPhone)
    .eq('code', code)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (error) throw error
  if (!data) return { valid: false, reason: 'invalid' }

  await client.from(TABLE).update({ used_at: new Date().toISOString() }).eq('id', data.id)

  return {
    valid: true,
    purpose: data.purpose,
    phone: data.phone,
    sessionToken,
    telegramUserId: data.telegram_user_id,
  }
}

module.exports = {
  createPendingSession,
  activateSessionFromBot,
  createVerificationCode,
  verifyCode,
  verifyBySession,
  CODE_TTL_MINUTES,
}
