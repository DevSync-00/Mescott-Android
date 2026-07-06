const crypto = require('crypto')
const { getSupabaseAdmin } = require('../supabaseAdmin')

function phoneToEmail(phone) {
  const digits = phone.replace(/\D/g, '')
  return `${digits}@phone.mescott.co`
}

async function findAuthUserByPhone(admin, phone) {
  const { data: profile } = await admin
    .from('profiles')
    .select('user_id')
    .eq('phone', phone)
    .maybeSingle()

  if (!profile?.user_id) return null

  const { data, error } = await admin.auth.admin.getUserById(profile.user_id)
  if (error || !data?.user) return null
  return data.user
}

/**
 * After Telegram OTP is verified, create or sign in Supabase user and return session tokens.
 */
async function createSessionForPhone(phone, telegramUserId) {
  const admin = getSupabaseAdmin()
  const email = phoneToEmail(phone)
  const password = crypto.randomBytes(24).toString('base64url')

  let authUser = await findAuthUserByPhone(admin, phone)

  if (!authUser) {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      phone,
      phone_confirm: true,
      email,
      password,
      email_confirm: true,
      user_metadata: { telegram_user_id: telegramUserId, auth_via: 'telegram' },
    })

    if (createError) {
      authUser = await findAuthUserByPhone(admin, phone)
      if (!authUser) throw createError
    } else {
      authUser = created.user
    }
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(authUser.id, {
    password,
    phone_confirm: true,
    user_metadata: {
      ...authUser.user_metadata,
      telegram_user_id: telegramUserId,
      auth_via: 'telegram',
    },
  })
  if (updateError) throw updateError

  const { data: signInData, error: signInError } = await admin.auth.signInWithPassword({
    email,
    password,
  })
  if (signInError) throw signInError

  if (telegramUserId && !String(telegramUserId).startsWith('pending_')) {
    await admin
      .from('profiles')
      .update({ telegram_user_id: String(telegramUserId) })
      .eq('user_id', signInData.user.id)
      .then(() => {})
      .catch(() => {})
  }

  return {
    access_token: signInData.session.access_token,
    refresh_token: signInData.session.refresh_token,
    user_id: signInData.user.id,
    expires_at: signInData.session.expires_at,
  }
}

module.exports = { createSessionForPhone, phoneToEmail }
