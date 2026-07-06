@echo off
REM Mescott Webhook Server Deployment Script for Windows

echo Deploying Mescott Webhook Server...

where vercel >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Vercel CLI not found. Installing...
    npm install -g vercel
)

vercel whoami >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Please login to Vercel first:
    vercel login
)

echo Installing dependencies...
npm install

echo Deploying to Vercel...
vercel --prod

echo.
echo Deployment complete!
echo Configure DNS: mescott.co -^> your Vercel deployment
echo.
echo Production URLs:
echo   Chapa webhook:     https://api.mescott.co/api/webhook
echo   Payment return:    https://api.mescott.co/api/payment-return
echo   Telegram webhook:  https://api.mescott.co/api/webhooks/telegram
echo.
echo Set EXPO_PUBLIC_API_URL=https://api.mescott.co in the mobile app .env

pause
