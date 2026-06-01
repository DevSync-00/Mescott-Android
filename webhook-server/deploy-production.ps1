# Deploy webhook-server to Vercel project: mescott-android (api.mescott.co)
Set-Location $PSScriptRoot

Write-Host "Linking and deploying to project: mescott-android" -ForegroundColor Cyan
Write-Host "Domain should be: api.mescott.co" -ForegroundColor Cyan
Write-Host ""

npx vercel login
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "When prompted, select project: mescott-android" -ForegroundColor Yellow
npx vercel link
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

npx vercel --prod
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Check: https://api.mescott.co/ should show build telegram-v2" -ForegroundColor Green
