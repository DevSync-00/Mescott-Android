/**
 * Register Telegram webhook URL with Telegram.
 * Loads webhook-server/.env automatically — no need to set $env: vars in PowerShell.
 */
const readline = require('readline')
const { loadEnv, isPlaceholder } = require('../lib/loadEnv')
const { setTelegramWebhook } = require('../lib/telegram/telegramApi')
const {
  validateWebhookSecret,
  generateWebhookSecret,
} = require('../lib/telegram/webhookSecret')

loadEnv()

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

async function main() {
  const base =
    process.env.TELEGRAM_WEBHOOK_BASE_URL ||
    process.env.EXPO_PUBLIC_API_URL ||
    'https://api.mescott.co'

  let token = process.env.TELEGRAM_BOT_TOKEN
  if (isPlaceholder(token)) {
    console.log('')
    console.log('TELEGRAM_BOT_TOKEN is missing in webhook-server/.env')
    console.log('Get it from Telegram @BotFather → /mybots → your bot → API Token')
    console.log('')
    token = await ask('Paste TELEGRAM_BOT_TOKEN here: ')
  }

  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN is required. Add it to webhook-server/.env and run again.')
    process.exit(1)
  }

  process.env.TELEGRAM_BOT_TOKEN = token

  let secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (isPlaceholder(secret)) {
    secret = generateWebhookSecret()
    console.log('')
    console.log('Generated TELEGRAM_WEBHOOK_SECRET (add to webhook-server/.env AND Vercel):')
    console.log(secret)
    console.log('')
  }

  const check = validateWebhookSecret(secret)
  if (!check.valid) {
    console.error('Invalid TELEGRAM_WEBHOOK_SECRET:', check.error)
    console.error('Use only letters, numbers, _ and - (no @ symbol).')
    process.exit(1)
  }

  const flatUrl = `${base.replace(/\/$/, '')}/api/webhooks-telegram`
  const nestedUrl = `${base.replace(/\/$/, '')}/api/webhooks/telegram`

  console.log('Registering webhook:', flatUrl)

  let result
  try {
    result = await setTelegramWebhook(flatUrl, secret)
  } catch (flatError) {
    console.warn('Flat path failed, trying nested URL:', nestedUrl)
    result = await setTelegramWebhook(nestedUrl, secret)
  }

  console.log('Success:', JSON.stringify(result, null, 2))
  console.log('')
  console.log('Add these to Vercel → Project mchapaw → Environment Variables → Production:')
  console.log('  TELEGRAM_BOT_TOKEN')
  console.log('  TELEGRAM_WEBHOOK_SECRET=' + secret)
  console.log('  TELEGRAM_WEBHOOK_BASE_URL=https://api.mescott.co')
  console.log('  TELEGRAM_BOT_USERNAME=your_bot_username_without_at')
  console.log('  SUPABASE_SERVICE_ROLE_KEY=from Supabase Dashboard → Settings → API')
  console.log('')
  console.log('Then redeploy: npx vercel --prod')
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
