const { loginWithAuthorizationCode } = require('../../lib/auth/telegramOidc')
const { createSessionForPhone } = require('../../lib/auth/telegramAuth')

/**
 * POST /api/auth/telegram-oidc
 * Body: { code, code_verifier, redirect_uri }
 *
 * Official Telegram Login (OIDC + PKCE). App opens oauth.telegram.org; this route
 * exchanges the code and returns a Supabase session.
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const { code, code_verifier: codeVerifier, redirect_uri: redirectUri } = req.body || {}

  if (!code || !codeVerifier || !redirectUri) {
    return res.status(400).json({
      ok: false,
      error: 'code, code_verifier, and redirect_uri are required',
    })
  }

  try {
    const { user } = await loginWithAuthorizationCode({
      code,
      redirectUri,
      codeVerifier,
    })

    const session = await createSessionForPhone(user.phone, user.telegramUserId)

    return res.status(200).json({
      ok: true,
      verified: true,
      phone: user.phone,
      telegram_user_id: user.telegramUserId,
      profile: {
        name: user.name,
        username: user.username,
        picture: user.picture,
      },
      session,
    })
  } catch (error) {
    console.error('telegram-oidc error:', error.message)
    return res.status(400).json({
      ok: false,
      error: error.message || 'Telegram login failed',
    })
  }
}
