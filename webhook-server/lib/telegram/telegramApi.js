const logger = require('../logger')

function getBotToken() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is not configured')
  }
  return token
}

function apiUrl(method) {
  return `https://api.telegram.org/bot${getBotToken()}/${method}`
}

/**
 * Send a text message to a Telegram user or chat.
 * @param {string|number} telegramUserId - chat_id (user id for private chats)
 * @param {string} text
 * @param {object} [options]
 */
async function sendTelegramMessage(telegramUserId, text, options = {}) {
  const body = {
    chat_id: telegramUserId,
    text,
    parse_mode: options.parseMode,
    disable_web_page_preview: options.disablePreview ?? true,
    reply_markup: options.replyMarkup,
  }

  const response = await fetch(apiUrl('sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok || !data.ok) {
    logger.error('Telegram sendMessage failed', {
      status: response.status,
      description: data.description,
      chatId: telegramUserId,
    })
    throw new Error(data.description || `Telegram API error (${response.status})`)
  }

  return data.result
}

/**
 * Register webhook URL with Telegram (run once during setup).
 */
async function setTelegramWebhook(webhookUrl, secretToken) {
  const payload = {
    url: webhookUrl,
    allowed_updates: ['message', 'edited_message'],
    drop_pending_updates: false,
  }
  if (secretToken) {
    payload.secret_token = secretToken
  }

  const response = await fetch(apiUrl('setWebhook'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const data = await response.json()
  if (!data.ok) {
    throw new Error(data.description || 'setWebhook failed')
  }
  return data
}

module.exports = {
  sendTelegramMessage,
  setTelegramWebhook,
  apiUrl,
}
