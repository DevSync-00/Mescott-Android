/**
 * Normalizes channel-specific payloads into the mobile-app message shape.
 */
function normalizeInboundMessage({
  senderId,
  platform,
  messageBody,
  createdAt,
  media = null,
  metadata = {},
}) {
  return {
    sender_id: String(senderId),
    platform,
    message_body: messageBody || '',
    media,
    created_at: createdAt || new Date().toISOString(),
    direction: 'inbound',
    metadata,
  }
}

function normalizeOutboundMessage({ senderId, platform, messageBody, createdAt, metadata = {} }) {
  return {
    sender_id: String(senderId),
    platform,
    message_body: messageBody || '',
    media: null,
    created_at: createdAt || new Date().toISOString(),
    direction: 'outbound',
    metadata,
  }
}

module.exports = {
  normalizeInboundMessage,
  normalizeOutboundMessage,
}
