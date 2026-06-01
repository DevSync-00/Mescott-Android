/** Root handler — GET https://api.mescott.co/ */
module.exports = (req, res) => {
  res.status(200).json({
    ok: true,
    service: 'Mescott webhook server',
    endpoints: {
      chapaWebhook: 'POST /api/webhook',
      paymentReturn: 'GET /api/payment-return?tx_ref=YOUR_TX_REF',
      telegramRequestSession: 'POST /api/telegram-request-session',
      telegramVerify: 'POST /api/telegram-verify',
      telegramViaWebhook: 'POST /api/webhook body.mescott_action=telegram-request-session|telegram-verify',
      telegramBotWebhook: 'POST /api/webhooks/telegram',
      test: 'GET /api/test',
    },
  })
}
