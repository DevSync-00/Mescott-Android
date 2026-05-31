// Chapa Payment Gateway Configuration
// Expo automatically loads .env files and makes EXPO_PUBLIC_* variables available via process.env
import { MESCOTT_LOGO_URL, mescottApiUrl } from './mescott'

const EXPO_PUBLIC_CHAPA_PUBLIC_KEY = process.env.EXPO_PUBLIC_CHAPA_PUBLIC_KEY
const EXPO_PUBLIC_CHAPA_SECRET_KEY = process.env.EXPO_PUBLIC_CHAPA_SECRET_KEY
const EXPO_PUBLIC_CHAPA_WEBHOOK_SECRET = process.env.EXPO_PUBLIC_CHAPA_WEBHOOK_SECRET
const EXPO_PUBLIC_API_URL = process.env.EXPO_PUBLIC_API_URL
const EXPO_PUBLIC_APP_URL = process.env.EXPO_PUBLIC_APP_URL

// Validate required environment variables
// Note: In React Native/Expo, __DEV__ is false in production builds
const isProduction = typeof __DEV__ !== 'undefined' ? !__DEV__ : process.env.NODE_ENV === 'production'

// Check if variables are missing
const hasChapaPublicKey = !!EXPO_PUBLIC_CHAPA_PUBLIC_KEY
const hasChapaSecretKey = !!EXPO_PUBLIC_CHAPA_SECRET_KEY
const hasChapaWebhookSecret = !!EXPO_PUBLIC_CHAPA_WEBHOOK_SECRET

if (!hasChapaPublicKey || !hasChapaSecretKey || !hasChapaWebhookSecret) {
  const errorMessage = '❌ CRITICAL: Chapa environment variables are missing!\n' +
    'Please set EXPO_PUBLIC_CHAPA_PUBLIC_KEY, EXPO_PUBLIC_CHAPA_SECRET_KEY, and EXPO_PUBLIC_CHAPA_WEBHOOK_SECRET in your .env file.\n' +
    'See .env.example for reference.'
  
  if (isProduction) {
    throw new Error(errorMessage)
  } else {
    console.error(errorMessage)
    console.warn('⚠️ Payment features will not work. Set environment variables for full functionality.')
  }
}

// Validate key formats (only if variables exist)
if (hasChapaPublicKey && !EXPO_PUBLIC_CHAPA_PUBLIC_KEY!.startsWith('CHAPUBK_')) {
  const error = 'EXPO_PUBLIC_CHAPA_PUBLIC_KEY appears to be invalid (should start with CHAPUBK_)'
  if (isProduction) {
    throw new Error(error)
  } else {
    console.error('⚠️', error)
  }
}

if (hasChapaSecretKey && !EXPO_PUBLIC_CHAPA_SECRET_KEY!.startsWith('CHASECK_')) {
  const error = 'EXPO_PUBLIC_CHAPA_SECRET_KEY appears to be invalid (should start with CHASECK_)'
  if (isProduction) {
    throw new Error(error)
  } else {
    console.error('⚠️', error)
  }
}

// Validate webhook secret is not the default (only if variable exists)
if (hasChapaWebhookSecret && (EXPO_PUBLIC_CHAPA_WEBHOOK_SECRET === 'qwertyuil@1A' || EXPO_PUBLIC_CHAPA_WEBHOOK_SECRET === 'your_webhook_secret_here')) {
  if (isProduction) {
    throw new Error('EXPO_PUBLIC_CHAPA_WEBHOOK_SECRET must be changed from default value in production')
  } else {
    console.warn('⚠️ Warning: Using default webhook secret. Change this in production!')
  }
}

// Validate API URL if provided
if (EXPO_PUBLIC_API_URL && !EXPO_PUBLIC_API_URL.startsWith('https://')) {
  const error = 'EXPO_PUBLIC_API_URL must be a valid HTTPS URL'
  if (isProduction) {
    throw new Error(error)
  } else {
    console.error('⚠️', error)
  }
}

export const CHAPA_CONFIG = {
  // Get these from your Chapa dashboard: https://dashboard.chapa.co/
  publicKey: EXPO_PUBLIC_CHAPA_PUBLIC_KEY || (isProduction ? '' : 'CHAPUBK_TEST-placeholder'),
  secretKey: EXPO_PUBLIC_CHAPA_SECRET_KEY || (isProduction ? '' : 'CHASECK_TEST-placeholder'),
  webhookSecret: EXPO_PUBLIC_CHAPA_WEBHOOK_SECRET || (isProduction ? '' : 'placeholder-secret'),
  
  // Company information
  companyName: 'Mescott',
  companyLogo: MESCOTT_LOGO_URL,
  
  // Payment configuration
  currency: 'ETB',
  vatRate: 0.15, // 15% VAT as per Ethiopian tax law
  platformFeeRate: 0.05, // 5% platform fee
  
  // API URLs - Use main endpoint (test keys work with main endpoint)
  baseUrl: 'https://api.chapa.co/v1',
  webhookUrl: mescottApiUrl('/api/webhook'),
  // Chapa requires HTTPS return_url; api.mescott.co/api/payment-return redirects into the app
  appScheme: 'mescott',
  getReturnUrl: (txRef: string) =>
    `${mescottApiUrl('/api/payment-return')}?tx_ref=${encodeURIComponent(txRef)}`,
  getAppDeepLink: (txRef: string) =>
    `mescott://payment-success?tx_ref=${encodeURIComponent(txRef)}`,
}

// Instructions for setup:
// 1. Register at https://dashboard.chapa.co/register
// 2. Get your API keys from Account > Settings > API
// 3. Set up webhook URL in Account > Settings > Webhooks
// 4. Create a .env file in the project root with your credentials:
//    EXPO_PUBLIC_CHAPA_PUBLIC_KEY=your_public_key_here
//    EXPO_PUBLIC_CHAPA_SECRET_KEY=your_secret_key_here
//    EXPO_PUBLIC_CHAPA_WEBHOOK_SECRET=your_webhook_secret_here
// 5. Update the company logo URL with your actual logo
// 6. Update the API and app URLs with your actual domains

export default CHAPA_CONFIG
