/**
 * Single Vercel serverless entry — static requires so all handlers are bundled.
 * build: telegram-oidc-v1
 */
const HANDLERS = {
  '/api/auth/telegram': './auth/telegram',
  '/api/auth/telegram-oidc': './auth/telegram-oidc',
  '/api/auth/telegram-callback': './auth/telegram-callback',
  '/api/auth/telegram-login': './auth/telegram-login',
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

function unwrap(mod) {
  return mod.default || mod
}

function requestPath(req) {
  const raw = req.url || '/'
  return raw.split('?')[0].replace(/\/$/, '') || '/'
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const urlPath = requestPath(req)

  if (urlPath === '/' || urlPath === '') {
    return res.status(200).json({
      ok: true,
      service: 'Mescott webhook server',
      build: 'telegram-oidc-v1',
      endpoints: {
        telegramLogin: 'POST /api/auth/telegram',
        chapaWebhook: 'POST /api/webhook',
        paymentReturn: 'GET /api/payment-return?tx_ref=YOUR_TX_REF',
        test: 'GET /api/test',
      },
    })
  }

  const handlerPath = HANDLERS[urlPath]
  if (!handlerPath) {
    return res.status(404).json({
      ok: false,
      error: 'Not found',
      path: urlPath,
      build: 'telegram-oidc-v1',
    })
  }

  try {
    const handlerFn = require(handlerPath)
    return await unwrap(handlerFn)(req, res)
  } catch (error) {
    console.error('Router error:', urlPath, error)
    return res.status(500).json({ ok: false, error: error.message, path: urlPath })
  }
}
