// Chapa Payment Gateway Configuration
// Expo automatically loads .env files and makes EXPO_PUBLIC_* variables available via process.env
const EXPO_PUBLIC_CHAPA_PUBLIC_KEY = process.env.EXPO_PUBLIC_CHAPA_PUBLIC_KEY
const EXPO_PUBLIC_CHAPA_SECRET_KEY = process.env.EXPO_PUBLIC_CHAPA_SECRET_KEY
const EXPO_PUBLIC_CHAPA_WEBHOOK_SECRET = process.env.EXPO_PUBLIC_CHAPA_WEBHOOK_SECRET
const EXPO_PUBLIC_API_URL = process.env.EXPO_PUBLIC_API_URL
const EXPO_PUBLIC_APP_URL = process.env.EXPO_PUBLIC_APP_URL

const isProduction = typeof __DEV__ !== 'undefined' ? !__DEV__ : process.env.NODE_ENV === 'production'

if (isProduction) {
  const missing: string[] = []
  if (!EXPO_PUBLIC_CHAPA_PUBLIC_KEY) missing.push('EXPO_PUBLIC_CHAPA_PUBLIC_KEY')
  if (!EXPO_PUBLIC_CHAPA_SECRET_KEY) missing.push('EXPO_PUBLIC_CHAPA_SECRET_KEY')
  if (!EXPO_PUBLIC_CHAPA_WEBHOOK_SECRET) missing.push('EXPO_PUBLIC_CHAPA_WEBHOOK_SECRET')
  if (!EXPO_PUBLIC_API_URL) missing.push('EXPO_PUBLIC_API_URL')
  if (!EXPO_PUBLIC_APP_URL) missing.push('EXPO_PUBLIC_APP_URL')

  if (missing.length > 0) {
    throw new Error(
      `Missing required Chapa environment variables: ${missing.join(', ')}. See .env.example for reference.`
    )
  }
}

export const CHAPA_CONFIG = {
  publicKey: EXPO_PUBLIC_CHAPA_PUBLIC_KEY || '',
  secretKey: EXPO_PUBLIC_CHAPA_SECRET_KEY || '',
  webhookSecret: EXPO_PUBLIC_CHAPA_WEBHOOK_SECRET || '',

  companyName: 'Mescott',
  companyLogo: 'https://mescott.com/logo.png',

  currency: 'ETB',
  vatRate: 0.15,
  platformFeeRate: 0.05,

  baseUrl: 'https://api.chapa.co/v1',
  webhookUrl: EXPO_PUBLIC_API_URL ? `${EXPO_PUBLIC_API_URL}/api/webhook` : (() => {
    if (isProduction) {
      throw new Error('EXPO_PUBLIC_API_URL must be set in production')
    }
    return 'https://mchapaw-n0utcbuab-bereket-birhanu-kinfus-projects.vercel.app/api/webhook'
  })(),
  // Chapa requires HTTPS return_url; our server instantly redirects into the app
  appScheme: 'mescott',
  getReturnUrl: (txRef: string) => {
    const base = EXPO_PUBLIC_API_URL || EXPO_PUBLIC_APP_URL
    if (!base) {
      if (isProduction) {
        throw new Error('EXPO_PUBLIC_API_URL must be set in production')
      }
      return `https://mchapaw-n0utcbuab-bereket-birhanu-kinfus-projects.vercel.app/api/payment-return?tx_ref=${encodeURIComponent(txRef)}`
    }
    return `${base.replace(/\/$/, '')}/api/payment-return?tx_ref=${encodeURIComponent(txRef)}`
  },
  getAppDeepLink: (txRef: string) =>
    `mescott://payment-success?tx_ref=${encodeURIComponent(txRef)}`,
}

export default CHAPA_CONFIG
