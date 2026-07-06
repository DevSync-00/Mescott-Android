module.exports = function handler(req, res) {
  res.status(200).json({
    success: true,
    message: 'Webhook server is running!',
    build: 'telegram-v4-static',
    timestamp: new Date().toISOString(),
    environment: {
      supabase_url: process.env.SUPABASE_URL ? 'Set' : 'Not set',
      supabase_anon_key: process.env.SUPABASE_ANON_KEY ? 'Set' : 'Not set',
      chapa_webhook_secret: process.env.CHAPA_WEBHOOK_SECRET ? 'Set' : 'Not set',
      telegram_bot_token: process.env.TELEGRAM_BOT_TOKEN ? 'Set' : 'Not set',
      supabase_service_role: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Not set',
    },
  })
}
