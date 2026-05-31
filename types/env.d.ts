// Type definitions for Expo environment variables
// Expo automatically loads .env files and makes EXPO_PUBLIC_* variables available via process.env
declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
    EXPO_PUBLIC_CHAPA_PUBLIC_KEY?: string;
    EXPO_PUBLIC_CHAPA_SECRET_KEY?: string;
    EXPO_PUBLIC_CHAPA_WEBHOOK_SECRET?: string;
    EXPO_PUBLIC_API_URL?: string;
    EXPO_PUBLIC_APP_URL?: string;
    EXPO_PUBLIC_WEBHOOK_API_URL?: string;
    EXPO_PUBLIC_TELEGRAM_BOT_USERNAME?: string;
    NODE_ENV?: string;
  }
}
