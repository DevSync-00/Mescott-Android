const crypto = require('crypto')
const logger = require('../logger')

const HEADER_SECRET = 'x-telegram-bot-api-secret-token'

/**
 * Validates that a webhook request is from Telegram.
 * @see https://core.telegram.org/bots/api#setwebhook secret_token
 */
function validateTelegramWebhook(req) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!expected) {
    logger.warn('TELEGRAM_WEBHOOK_SECRET not set — skipping webhook validation (dev only)')
    return process.env.NODE_ENV !== 'production'
  }

  const received =
    req.headers[HEADER_SECRET] ||
    req.headers[HEADER_SECRET.toLowerCase()] ||
    req.query.secret

  if (!received || typeof received !== 'string') {
    return false
  }

  try {
    return crypto.timingSafeEqual(
      Buffer.from(received, 'utf8'),
      Buffer.from(expected, 'utf8'),
    )
  } catch {
    return false
  }
}

module.exports = { validateTelegramWebhook, HEADER_SECRET }
