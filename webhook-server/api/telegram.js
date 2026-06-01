/**
 * POST /api/telegram?action=request-session | verify
 * Single-file Telegram API (reliable on Vercel).
 */
const requestSession = require('./telegram/request-session')
const verify = require('./telegram/verify')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const action =
    req.query?.action ||
    req.body?.action ||
    (req.url?.includes('verify') ? 'verify' : 'request-session')

  if (action === 'verify') {
    return verify(req, res)
  }

  return requestSession(req, res)
}
