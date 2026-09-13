const verificationRepository = require('../../lib/channels/verificationRepository')
const { createSessionForPhone } = require('../../lib/auth/telegramAuth')

/**
 * POST /api/telegram/verify
 * Body: { sessionToken, code, phone }
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const { sessionToken, code, phone } = req.body || {}

  if (!sessionToken || !code || !phone) {
    return res.status(400).json({
      ok: false,
      error: 'sessionToken, code, and phone are required',
    })
  }

  try {
    const result = await verificationRepository.verifyBySession(
      sessionToken,
      code,
      phone,
    )

    if (!result.valid) {
      const messages = {
        expired: 'Code expired. Open Telegram and tap Start again from the app.',
        invalid: 'Invalid code. Check the 6-digit code from Telegram.',
        no_code: 'No active code. Open Telegram from the app first.',
      }
      return res.status(400).json({
        ok: false,
        error: messages[result.reason] || 'Verification failed',
        reason: result.reason,
      })
    }

    const session = await createSessionForPhone(phone, result.telegramUserId)

    return res.status(200).json({
      ok: true,
      verified: true,
      purpose: result.purpose,
      session,
    })
  } catch (error) {
    console.error('telegram verify error:', error)
    return res.status(500).json({ ok: false, error: error.message })
  }
}
