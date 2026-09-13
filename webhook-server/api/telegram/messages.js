const channelService = require('../../services/channelService')

/**
 * GET /api/telegram/messages?senderId=123456789
 * Mobile app polls or fetches conversation history.
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const apiKey = process.env.TELEGRAM_INTERNAL_API_KEY
  if (apiKey) {
    const provided = req.headers['x-api-key'] || req.headers.authorization?.replace('Bearer ', '')
    if (provided !== apiKey) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' })
    }
  }

  const senderId = req.query.senderId
  if (!senderId) {
    return res.status(400).json({ ok: false, error: 'senderId query param required' })
  }

  try {
    const messages = await channelService.getConversation(senderId, 'telegram')
    return res.status(200).json({ ok: true, messages })
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message })
  }
}
