const telegramService = require('../../services/telegramService')
const channelService = require('../../services/channelService')
const logger = require('../../lib/logger')

/**
 * POST /api/telegram/send
 * Body: { telegramUserId, text }
 * Optional header: x-api-key = TELEGRAM_INTERNAL_API_KEY
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const apiKey = process.env.TELEGRAM_INTERNAL_API_KEY
  if (apiKey) {
    const provided = req.headers['x-api-key'] || req.headers.authorization?.replace('Bearer ', '')
    if (provided !== apiKey) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' })
    }
  }

  const { telegramUserId, text } = req.body || {}

  if (!telegramUserId || !text) {
    return res.status(400).json({
      ok: false,
      error: 'telegramUserId and text are required',
    })
  }

  try {
    const result = await telegramService.sendTelegramMessage(telegramUserId, text)

    await channelService.persistOutbound({
      senderId: telegramUserId,
      platform: 'telegram',
      messageBody: text,
      metadata: { telegram_message_id: result?.message_id },
    })

    return res.status(200).json({ ok: true, result })
  } catch (error) {
    logger.error('sendTelegramMessage API failed', { message: error.message })
    return res.status(500).json({ ok: false, error: error.message })
  }
}
