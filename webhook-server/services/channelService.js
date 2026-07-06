/**
 * Channel-agnostic facade — add WhatsApp, SMS bridges here later.
 */
const messageRepository = require('../lib/channels/messageRepository')
const { normalizeInboundMessage, normalizeOutboundMessage } = require('../lib/channels/normalizeMessage')

async function persistInbound({ senderId, platform, messageBody, createdAt, media, metadata }) {
  const normalized = normalizeInboundMessage({
    senderId,
    platform,
    messageBody,
    createdAt,
    media,
    metadata,
  })
  return messageRepository.saveChannelMessage(normalized)
}

async function persistOutbound({ senderId, platform, messageBody, metadata }) {
  const normalized = normalizeOutboundMessage({
    senderId,
    platform,
    messageBody,
    metadata,
  })
  return messageRepository.saveChannelMessage(normalized)
}

async function getConversation(senderId, platform) {
  return messageRepository.listMessagesForSender(senderId, platform)
}

module.exports = {
  persistInbound,
  persistOutbound,
  getConversation,
}
