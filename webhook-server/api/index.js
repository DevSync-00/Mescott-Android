/**
 * Single Vercel serverless entry — static requires so all handlers are bundled.
 * build: telegram-oidc-v1
 */
const HANDLERS = {
  '/api/auth/telegram-oidc': require('./auth/telegram-oidc'),
  '/api/payment-return': require('./payment-return'),
  '/api/webhook': require('./webhook/index'),
  '/api/telegram-request-session': require('./telegram/request-session'),
  '/api/telegram-verify': require('./telegram/verify'),
  '/api/webhooks/telegram': require('./webhooks/telegram'),
  '/api/webhooks-telegram': require('./webhooks/telegram'),
  '/api/telegram/request-session': require('./telegram/request-session'),
  '/api/telegram/verify': require('./telegram/verify'),
  '/api/telegram/send': require('./telegram/send'),
  '/api/telegram/messages': require('./telegram/messages'),
  '/api/telegram': require('./telegram'),
  '/api/test': require('./test/index'),
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
        telegramLogin: 'POST /api/auth/telegram-oidc',
        chapaWebhook: 'POST /api/webhook',
        paymentReturn: 'GET /api/payment-return?tx_ref=YOUR_TX_REF',
        test: 'GET /api/test',
      },
    })
  }

  const handlerFn = HANDLERS[urlPath]
  if (!handlerFn) {
    return res.status(404).json({
      ok: false,
      error: 'Not found',
      path: urlPath,
      build: 'telegram-oidc-v1',
    })
  }

  try {
    return await unwrap(handlerFn)(req, res)
  } catch (error) {
    console.error('Router error:', urlPath, error)
    return res.status(500).json({ ok: false, error: error.message, path: urlPath })
  }
}
