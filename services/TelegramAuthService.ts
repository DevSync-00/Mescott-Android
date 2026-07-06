const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export interface TelegramWidgetAuthData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export interface TelegramHMACAuthResult {
  session: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
    user: {
      id: string;
      user_metadata?: Record<string, any>;
      [key: string]: any;
    };
  };
}

export class TelegramAuthService {
  /**
   * Send the Telegram Login Widget payload to the Supabase Edge Function for
   * HMAC verification and user creation/sign-in.
   */
  static async loginWithTelegramHMAC(
    authData: TelegramWidgetAuthData
  ): Promise<TelegramHMACAuthResult> {
    if (!SUPABASE_URL) {
      throw new Error('[TelegramAuthService] EXPO_PUBLIC_SUPABASE_URL is not set');
    }
    if (!SUPABASE_ANON_KEY) {
      throw new Error('[TelegramAuthService] EXPO_PUBLIC_SUPABASE_ANON_KEY is not set');
    }

    const url = `${SUPABASE_URL}/functions/v1/telegram-auth`;
    console.log('[TelegramAuthService] Calling Edge Function:', url);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(authData),
      });
    } catch (networkError: any) {
      throw new Error(
        `[TelegramAuthService] Network error reaching Edge Function: ${networkError?.message}`
      );
    }

    const text = await response.text();

    let json: any;
    try {
      json = JSON.parse(text);
    } catch (_) {
      throw new Error(
        `[TelegramAuthService] Edge Function returned non-JSON (HTTP ${response.status}): ${text}`
      );
    }

    if (!response.ok) {
      console.error(
        `[TelegramAuthService] Edge Function HTTP ${response.status} body:`,
        text
      );
      const message = json?.error || json?.message || `Edge Function error HTTP ${response.status}`;
      throw new Error(`[TelegramAuthService] ${message}`);
    }

    if (!json?.session) {
      throw new Error('[TelegramAuthService] Edge Function returned no session');
    }

    return json as TelegramHMACAuthResult;
  }
}
