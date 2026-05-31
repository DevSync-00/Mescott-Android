/** Root handler so visiting the deployment URL does not show Vercel 404 */
module.exports = (req, res) => {
  res.status(200).json({
    ok: true,
    service: 'Mescott webhook server',
    endpoints: {
      chapaWebhook: 'POST /api/webhook',
      paymentReturn: 'GET /api/payment-return?tx_ref=YOUR_TX_REF',
      telegramWebhook: 'POST /api/webhooks/telegram',
      telegramRequestSession: 'POST /api/telegram-request-session',
      telegramVerify: 'POST /api/telegram-verify',
      telegramSend: 'POST /api/telegram/send',
      telegramMessages: 'GET /api/telegram/messages?senderId=TELEGRAM_USER_ID',
      test: 'GET /api/test',
    },
  })
}
