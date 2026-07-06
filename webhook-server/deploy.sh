#!/bin/bash

# Mescott Webhook Server Deployment Script

echo "🚀 Deploying Mescott Webhook Server..."

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi

# Check if user is logged in to Vercel
if ! vercel whoami &> /dev/null; then
    echo "🔐 Please login to Vercel first:"
    vercel login
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Deploy to Vercel
echo "🚀 Deploying to Vercel..."
vercel --prod

echo "✅ Deployment complete!"
echo ""
echo "🌐 Configure DNS: mescott.co → your Vercel deployment"
echo ""
echo "📝 Production URLs (use in Chapa, Telegram, and app .env):"
echo "   Chapa webhook:     https://api.mescott.co/api/webhook"
echo "   Payment return:    https://api.mescott.co/api/payment-return"
echo "   Telegram webhook:  https://api.mescott.co/api/webhooks/telegram"
echo ""
echo "📝 Environment variables:"
echo "   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CHAPA_WEBHOOK_SECRET"
echo "   TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET"
echo "   TELEGRAM_WEBHOOK_BASE_URL=https://api.mescott.co"
echo "   EXPO_PUBLIC_API_URL=https://api.mescott.co"
echo "   EXPO_PUBLIC_APP_URL=https://mescott.co"
