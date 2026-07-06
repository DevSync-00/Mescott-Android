/**
 * Parses a Telegram Bot API Update into a normalized inbound payload.
 * @see https://core.telegram.org/bots/api#update
 */
function parseTelegramUpdate(update) {
  if (!update || typeof update !== 'object') {
    return null
  }

  const message =
    update.message ||
    update.edited_message ||
    update.channel_post ||
    null

  if (!message) {
    return {
      updateId: update.update_id,
      kind: 'unsupported',
      raw: update,
    }
  }

  const from = message.from || {}
  const chat = message.chat || {}
  const timestamp = message.date
    ? new Date(message.date * 1000).toISOString()
    : new Date().toISOString()

  let media = null
  if (message.photo?.length) {
    const largest = message.photo[message.photo.length - 1]
    media = { type: 'photo', file_id: largest.file_id, file_unique_id: largest.file_unique_id }
  } else if (message.document) {
    media = {
      type: 'document',
      file_id: message.document.file_id,
      file_name: message.document.file_name,
      mime_type: message.document.mime_type,
    }
  } else if (message.voice) {
    media = { type: 'voice', file_id: message.voice.file_id, duration: message.voice.duration }
  } else if (message.video) {
    media = { type: 'video', file_id: message.video.file_id }
  }

  const text =
    message.text ||
    message.caption ||
    (message.contact ? `contact:${message.contact.phone_number}` : '') ||
    ''

  // Deep link: https://t.me/Bot?start=signin_<token> → message text "/start signin_<token>"
  let startParam = null
  if (text.startsWith('/start')) {
    const parts = text.trim().split(/\s+/)
    startParam = parts[1] || null
  }

  return {
    updateId: update.update_id,
    kind: 'message',
    telegramUserId: String(from.id || chat.id),
    username: from.username || null,
    firstName: from.first_name || null,
    lastName: from.last_name || null,
    chatId: String(chat.id),
    messageId: message.message_id,
    messageBody: text.trim(),
    media,
    startParam,
    timestamp,
    raw: update,
  }
}

module.exports = { parseTelegramUpdate }
