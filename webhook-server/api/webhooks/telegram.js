const { validateTelegramWebhook } = require('../../lib/telegram/validateWebhook')
const telegramService = require('../../services/telegramService')
const logger = require('../../lib/logger')

/**
 * Vercel / Express handler: POST /api/webhooks/telegram
 * Telegram Bot API webhook endpoint.
 */
module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      service: 'telegram-webhook',
      hint: 'POST Telegram updates to this URL',
    })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  if (!validateTelegramWebhook(req)) {
    logger.warn('Rejected Telegram webhook — invalid secret')
    return res.status(401).json({ ok: false, error: 'Unauthorized' })
  }

  const update = req.body
  if (!update || typeof update !== 'object') {
    return res.status(400).json({ ok: false, error: 'Invalid body' })
  }

  // Respond immediately so Telegram does not retry (process in same invocation)
  try {
    const result = await telegramService.processInboundUpdate(update)
    return res.status(200).json({ ok: true, result })
  } catch (error) {
    logger.error('Telegram webhook processing failed', {
      message: error.message,
      updateId: update.update_id,
    })
    // Still return 200 to avoid retry storms; log for investigation
    return res.status(200).json({ ok: false, error: 'processed_with_errors' })
  }
}
