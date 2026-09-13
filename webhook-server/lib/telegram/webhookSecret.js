const crypto = require('crypto')

/** Telegram setWebhook secret_token: A–Z, a–z, 0–9, _ and - only (1–256 chars) */
const ALLOWED_SECRET = /^[A-Za-z0-9_-]{1,256}$/

function validateWebhookSecret(secret) {
  if (!secret || typeof secret !== 'string') {
    return {
      valid: false,
      error: 'TELEGRAM_WEBHOOK_SECRET is required',
    }
  }

  if (!ALLOWED_SECRET.test(secret)) {
    return {
      valid: false,
      error:
        'TELEGRAM_WEBHOOK_SECRET must be 1–256 characters and only use letters, numbers, underscore (_), or hyphen (-). ' +
        'Do not use @, spaces, or special characters like ! # $ %',
    }
  }

  return { valid: true }
}

function generateWebhookSecret(byteLength = 32) {
  return crypto.randomBytes(byteLength).toString('hex')
}

module.exports = {
  validateWebhookSecret,
  generateWebhookSecret,
}
