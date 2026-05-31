const crypto = require('crypto')
const verificationRepository = require('../../lib/channels/verificationRepository')

/**
 * POST /api/telegram/request-session
 * Body: { phone, purpose?: 'sign_in' | 'sign_up' }
 * Returns deep link for the user to open the bot.
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const { phone, purpose = 'sign_in' } = req.body || {}

  if (!phone || typeof phone !== 'string') {
    return res.status(400).json({ ok: false, error: 'phone is required' })
  }

  const sessionToken = crypto.randomBytes(16).toString('hex')
  const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'MescottBot'
  const prefix = purpose === 'sign_up' ? 'signup' : 'signin'
  const deepLink = `https://t.me/${botUsername}?start=${prefix}_${sessionToken}`

  try {
    await verificationRepository.createPendingSession({
      sessionToken,
      phone: phone.trim(),
      purpose,
    })

    return res.status(200).json({
      ok: true,
      sessionToken,
      deepLink,
      botUsername,
    })
  } catch (error) {
    console.error('request-session error:', error)
    return res.status(500).json({ ok: false, error: error.message })
  }
}
