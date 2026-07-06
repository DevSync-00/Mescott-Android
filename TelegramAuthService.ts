import { supabase } from '../lib/supabase';

// Strip trailing slash so URL concatenation never produces double slashes
const API_URL = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/+$/, '');
const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!API_URL) {
  console.warn('[TelegramAuthService] EXPO_PUBLIC_API_URL is not set');
}

export interface TelegramAuthResponse {
  success: boolean;
  session_token: string;
  telegram_link: string;
  fallback_link: string;
}

/** Shape of the Telegram Login Widget auth payload (from the WebView OAuth flow) */
export interface TelegramWidgetAuthData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

/** Shape returned by the telegram-auth Edge Function */
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
   * Call the backend to create a pending auth session.
   * Returns the session token and Telegram deep links.
   */
  static async initiateTelegramAuth(
    deviceInfo: Record<string, any> = {}
  ): Promise<TelegramAuthResponse | null> {
    const url = `${API_URL}/api/auth/telegram/initiate`;
    console.log('[TelegramAuthService] POST', url);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceInfo }),
      });

      const text = await response.text();

      if (!response.ok) {
        console.error(`[TelegramAuthService] HTTP ${response.status}:`, text);
        throw new Error(`Failed to initiate Telegram auth: HTTP ${response.status} — ${text}`);
      }

      const data: TelegramAuthResponse = JSON.parse(text);

      if (!data.success || !data.session_token) {
        console.error('[TelegramAuthService] Unexpected response:', data);
        throw new Error('Invalid response from auth server');
      }

      console.log(
        '[TelegramAuthService] Session created:',
        data.session_token.substring(0, 8) + '...'
      );
      return data;
    } catch (error) {
      console.error('[TelegramAuthService] initiateTelegramAuth failed:', error);
      return null;
    }
  }

  /**
   * Subscribe to AUTH_SUCCESS for a given session token.
   * Uses two channels for redundancy:
   *   1. Supabase Realtime broadcast  (fast path — pushed by bot webhook)
   *   2. Postgres DB change listener  (fallback — reacts to row update)
   *
   * Returns an unsubscribe function.
   */
  static subscribeToAuthStatus(
    sessionToken: string,
    onAuthSuccess: (payload: any) => void
  ): () => void {
    console.log(
      '[TelegramAuthService] Subscribing to session:',
      sessionToken.substring(0, 8) + '...'
    );

    let settled = false;

    const handleSuccess = (payload: any) => {
      if (settled) return;
      settled = true;
      console.log('[TelegramAuthService] AUTH_SUCCESS received');
      onAuthSuccess(payload);
    };

    // ── Channel 1: Realtime broadcast ──────────────────────────────────────
    const broadcastChannel = supabase.channel(`auth:${sessionToken}`, {
      config: { broadcast: { self: false } },
    });

    broadcastChannel
      .on('broadcast', { event: 'AUTH_SUCCESS' }, (msg) => {
        console.log('[TelegramAuthService] Broadcast received');
        handleSuccess(msg.payload);
      })
      .subscribe((status) => {
        console.log('[TelegramAuthService] Broadcast channel status:', status);
      });

    // ── Channel 2: DB row change (fallback) ────────────────────────────────
    const dbChannel = supabase
      .channel(`auth_db:${sessionToken}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'auth_pending_sessions',
          filter: `session_token=eq.${sessionToken}`,
        },
        (event) => {
          console.log('[TelegramAuthService] DB change received:', event.new?.status);
          const row = event.new as any;
          if (row?.status === 'APPROVED' && row?.jwt_payload) {
            handleSuccess(row.jwt_payload);
          }
        }
      )
      .subscribe((status) => {
        console.log('[TelegramAuthService] DB channel status:', status);
      });

    return () => {
      console.log(
        '[TelegramAuthService] Unsubscribing from session:',
        sessionToken.substring(0, 8) + '...'
      );
      supabase.removeChannel(broadcastChannel);
      supabase.removeChannel(dbChannel);
    };
  }

  /**
   * Send the Telegram Login Widget payload to the Supabase Edge Function for
   * HMAC verification and user creation/sign-in.
   *
   * Returns the Supabase session on success, or throws on failure.
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
          // Both headers required: apikey for the Supabase API gateway,
          // Authorization for the edge function itself.
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

    // Parse JSON — guard against non-JSON gateway errors (e.g. Supabase 504)
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
      // Edge function errors come back as { error: string }
      // Supabase gateway errors come back as { message: string, code: string }
      const message =
        json?.error ||
        json?.message ||
        `Edge Function error HTTP ${response.status}`;
      throw new Error(`[TelegramAuthService] ${message}`);
    }

    if (!json?.session?.access_token) {
      throw new Error('[TelegramAuthService] Edge Function returned no session');
    }

    return json as TelegramHMACAuthResult;
  }
}