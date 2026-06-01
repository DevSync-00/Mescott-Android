# Deploy webhook-server to api.mescott.co (includes Telegram routes)
Set-Location $PSScriptRoot

Write-Host "Deploying Mescott webhook-server to Vercel production..." -ForegroundColor Cyan

if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
  Write-Error "Node.js/npx is required."
  exit 1
}

npx vercel login
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

npx vercel --prod
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Done. Test Telegram API:" -ForegroundColor Green
Write-Host '  Invoke-RestMethod -Uri "https://api.mescott.co/api/telegram-request-session" -Method POST -ContentType "application/json" -Body ''{"phone":"+251911000000"}'''
Write-Host ""
Write-Host "Add Telegram env vars on Vercel if not set: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, TELEGRAM_BOT_USERNAME, SUPABASE_SERVICE_ROLE_KEY"
