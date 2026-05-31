# Mescott Webhook Server

Handles **Chapa payments**, **payment return redirects**, and **Telegram** sign-up/sign-in for the Mescott mobile app.

Hosted on **`https://api.mescott.co`** (website stays on `https://mescott.co`).

## Endpoints

| Method | URL | Purpose |
|--------|-----|---------|
| POST | `https://api.mescott.co/api/webhook` | Chapa payment webhook |
| GET | `https://api.mescott.co/api/payment-return` | Chapa return → opens app |
| POST | `https://api.mescott.co/api/webhooks/telegram` | Telegram Bot webhook |
| POST | `https://api.mescott.co/api/telegram-request-session` | App: get `deepLink` + `sessionToken` |
| POST | `https://api.mescott.co/api/telegram-verify` | App: verify OTP → Supabase session |
| POST | `https://api.mescott.co/api/telegram/send` | Send Telegram message |
| GET | `https://api.mescott.co/api/telegram/messages` | Fetch messages |

## Environment variables (Vercel — webhook project)

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
CHAPA_WEBHOOK_SECRET=your_secret

TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=...
TELEGRAM_BOT_USERNAME=YourBotName
TELEGRAM_WEBHOOK_BASE_URL=https://api.mescott.co
EXPO_PUBLIC_APP_URL=https://mescott.co
```

## Deploy

1. Deploy this `webhook-server` folder to Vercel (root directory = `webhook-server`).
2. Point **`api.mescott.co`** DNS → that deployment.
3. **Redeploy** after pulling Telegram API changes (older deploys only have Chapa routes).
4. Chapa dashboard webhook: `https://api.mescott.co/api/webhook`
5. Copy `webhook-server/.env.example` → `.env` and set `TELEGRAM_BOT_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_USERNAME`.

6. Register Telegram webhook (loads `.env` automatically):

```powershell
cd webhook-server
npm run telegram:register-webhook
```

Paste your bot token when prompted. Add the same variables to **Vercel → Production**, then `npx vercel --prod`.

## Mobile app `.env`

```env
EXPO_PUBLIC_APP_URL=https://mescott.co
EXPO_PUBLIC_API_URL=https://api.mescott.co
EXPO_PUBLIC_TELEGRAM_BOT_USERNAME=YourBotName
```

Then: `npx expo start --clear`

## Telegram sign-in flow

1. User enters phone → **Verify with Telegram**.
2. App `POST /api/telegram-request-session` → opens `https://t.me/Bot?start=signin_<token>`.
3. User taps **Start** in Telegram → 6-digit code.
4. App `POST /api/telegram-verify` → Supabase session.

Run `sql/telegram_tables.sql` in Supabase if not already applied.

## Test

```bash
curl https://api.mescott.co/
curl -X POST https://api.mescott.co/api/telegram-request-session \
  -H "Content-Type: application/json" \
  -d '{"phone":"+251911000000"}'
```

Expected: JSON with `"ok": true` and `deepLink`. If **404**, redeploy the latest `webhook-server` code.
