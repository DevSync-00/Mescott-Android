/**
 * Single Vercel serverless entry — all API routes go through here.
 * build: telegram-v3-single
 */
function requestPath(req) {
  const raw = req.url || '/'
  const path = raw.split('?')[0].replace(/\/$/, '') || '/'
  return path
}

const path = require('path')

function load(relativePath) {
  const mod = require(path.join(__dirname, relativePath))
  return mod.default || mod
}

const ROUTES = {
  '/api/payment-return': './payment-return',
  '/api/webhook': './webhook/index',
  '/api/telegram-request-session': './telegram/request-session',
  '/api/telegram-verify': './telegram/verify',
  '/api/webhooks/telegram': './webhooks/telegram',
  '/api/webhooks-telegram': './webhooks/telegram',
  '/api/telegram/request-session': './telegram/request-session',
  '/api/telegram/verify': './telegram/verify',
  '/api/telegram/send': './telegram/send',
  '/api/telegram/messages': './telegram/messages',
  '/api/telegram': './telegram',
  '/api/test': './test/index',
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const path = requestPath(req)

  if (path === '/' || path === '') {
    return res.status(200).json({
      ok: true,
      service: 'Mescott webhook server',
      build: 'telegram-v3-single',
      endpoints: {
        chapaWebhook: 'POST /api/webhook',
        paymentReturn: 'GET /api/payment-return?tx_ref=YOUR_TX_REF',
        telegramRequestSession: 'POST /api/telegram-request-session',
        telegramVerify: 'POST /api/telegram-verify',
        telegramViaWebhook:
          'POST /api/webhook {"mescott_action":"telegram-request-session"|"telegram-verify"}',
        telegramBotWebhook: 'POST /api/webhooks/telegram',
        test: 'GET /api/test',
      },
    })
  }

  const modulePath = ROUTES[path]
  if (!modulePath) {
    return res.status(404).json({
      ok: false,
      error: 'Not found',
      path,
      build: 'telegram-v3-single',
    })
  }

  try {
    return await load(modulePath)(req, res)
  } catch (error) {
    console.error('Router error:', path, error)
    return res.status(500).json({ ok: false, error: error.message, path })
  }
}
