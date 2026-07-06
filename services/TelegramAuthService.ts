import { supabase } from '../lib/supabase';
import {
  MESCOTT_API_PATHS,
  TELEGRAM_BOT_USERNAME,
  mescottApiUrl,
} from '../config/mescott';

// Helper types for the Telegram Login Widget
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

export interface TelegramAuthResponse {
  success: boolean;
  session_token: string;
  telegram_link: string;
  fallback_link: string;
}

export type TelegramSessionResponse = {
  ok: boolean;
  sessionToken?: string;
  code?: string;
  deepLink?: string;
  botUsername?: string;
  error?: string;
};

export type TelegramVerifyResponse = {
  ok: boolean;
  verified?: boolean;
  error?: string;
  session?: {
    access_token: string;
    refresh_token: string;
    user_id: string;
    expires_at?: number;
  };
};

const API_URL = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/+$/, '');
const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

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
   * Uses three channels for redundancy:
   *   1. Supabase Realtime broadcast  (fast path — pushed by bot webhook)
   *   2. Postgres DB change listener  (fallback — reacts to row update)
   *   3. Direct HTTP fetch polling  (robust mobile cellular fallback)
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

    // ── Channel 3: Direct HTTP Fetch Polling Fallback (100% Reliable) ───────
    const pollInterval = setInterval(async () => {
      if (settled) {
        clearInterval(pollInterval);
        return;
      }
      try {
        const url = `${SUPABASE_URL}/rest/v1/auth_pending_sessions?session_token=eq.${sessionToken}&select=status,jwt_payload`;

        const res = await fetch(url, {
          method: 'GET',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
        });

        if (res.ok) {
          const rows = await res.json();
          const data = rows[0];
          if (data) {
            if (data.status === 'APPROVED' && data.jwt_payload) {
              clearInterval(pollInterval);
              console.log('[TelegramAuthService] Polling detected APPROVED session');
              handleSuccess(data.jwt_payload);
            } else if (data.status === 'EXPIRED') {
              clearInterval(pollInterval);
              console.log('[TelegramAuthService] Polling detected EXPIRED session');
            }
          }
        }
      } catch (err: any) {
        console.warn('[TelegramAuthService] Polling check exception:', err.message);
      }
    }, 2000);

    return () => {
      console.log(
        '[TelegramAuthService] Unsubscribing from session:',
        sessionToken.substring(0, 8) + '...'
      );
      clearInterval(pollInterval);
      supabase.removeChannel(broadcastChannel);
      supabase.removeChannel(dbChannel);
    };
  }

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

// ─── Manual OTP / Direct Verification Helper Functions ──────────────────────

async function parseApiJson<T>(response: Response): Promise<{ data: T | null; rawText: string }> {
  const rawText = await response.text();
  if (!rawText.trim()) {
    return { data: null, rawText };
  }
  try {
    return { data: JSON.parse(rawText) as T, rawText };
  } catch {
    return { data: null, rawText };
  }
}

function buildDeepLink(sessionToken: string, purpose: 'sign_in' | 'sign_up') {
  const prefix = purpose === 'sign_up' ? 'signup' : 'signin';
  const bot = TELEGRAM_BOT_USERNAME.replace(/^@/, '');
  return `https://t.me/${bot}?start=${prefix}_${sessionToken}`;
}

async function requestTelegramSessionViaSupabase(
  phone: string,
  purpose: 'sign_in' | 'sign_up',
): Promise<TelegramSessionResponse> {
  const { data, error } = await supabase.rpc('create_telegram_session', {
    p_phone: phone,
    p_purpose: purpose,
  });

  if (error) {
    const code = (error as { code?: string }).code;
    const missingRpc =
      code === 'PGRST202' ||
      (error.message?.includes('Could not find the function') &&
        !error.message?.includes('gen_random_bytes'));

    if (missingRpc) {
      return {
        ok: false,
        error:
          'create_telegram_session is not on your Supabase project yet. Run webhook-server/sql/telegram_setup_complete.sql in SQL Editor.',
      };
    }

    if (error.message?.includes('gen_random_bytes')) {
      return {
        ok: false,
        error:
          'Telegram function needs an update. Run webhook-server/sql/telegram_setup_complete.sql again in Supabase SQL Editor.',
      };
    }

    if (error.message?.includes('telegram_verification_codes')) {
      return {
        ok: false,
        error: 'Run telegram_tables.sql first, then telegram_session_rpc.sql (or telegram_setup_complete.sql).',
      };
    }

    return { ok: false, error: error.message || 'Supabase error' };
  }

  const row = data as { ok?: boolean; sessionToken?: string; code?: string } | null;
  if (!row?.sessionToken) {
    return { ok: false, error: 'Could not create Telegram session' };
  }

  return {
    ok: true,
    sessionToken: row.sessionToken,
    code: row.code,
    deepLink: buildDeepLink(row.sessionToken, purpose),
    botUsername: TELEGRAM_BOT_USERNAME.replace(/^@/, ''),
  };
}

async function postJson<T extends { ok?: boolean; error?: string }>(
  url: string,
  body: Record<string, unknown>,
): Promise<{ result: T & { ok: boolean; error?: string }; status: number }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const status = response.status;
  const { data, rawText } = await parseApiJson<T>(response);

  if (!data) {
    return {
      result: {
        ok: false,
        error: status === 404 ? 'API route missing' : `Server error (${status})`,
      } as T & { ok: boolean; error?: string },
      status,
    };
  }

  if (!response.ok || data.ok === false) {
    const successShape = data as T & { success?: boolean };
    if (successShape.success === true && status === 200) {
      return { result: { ...data, ok: true } as T & { ok: boolean }, status };
    }
    return {
      result: {
        ...data,
        ok: false,
        error: data.error || `Request failed (${status})`,
      } as T & { ok: boolean; error?: string },
      status,
    };
  }

  return { result: { ...data, ok: true } as T & { ok: boolean }, status };
}

async function postWithFallbacks<T extends { ok?: boolean; error?: string }>(
  paths: string[],
  body: Record<string, unknown>,
): Promise<{ result: T & { ok: boolean; error?: string }; status: number }> {
  let last = {
    result: { ok: false, error: 'Request failed' } as T & { ok: boolean; error?: string },
    status: 0,
  };

  for (const path of paths) {
    last = await postJson<T>(mescottApiUrl(path), body);
    if (last.result.ok) return last;
    if (last.status !== 404) return last;
  }

  return last;
}

export async function requestTelegramSession(
  phone: string,
  purpose: 'sign_in' | 'sign_up' = 'sign_in',
): Promise<TelegramSessionResponse> {
  const viaDb = await requestTelegramSessionViaSupabase(phone, purpose);
  if (viaDb.ok) return viaDb;

  const viaApi = await postWithFallbacks<TelegramSessionResponse>(
    [
      MESCOTT_API_PATHS.telegramRequestSession,
      MESCOTT_API_PATHS.telegramRequestSessionNested,
    ],
    { phone, purpose },
  );
  if (viaApi.result.ok) return viaApi.result;

  const viaWebhook = await postJson<TelegramSessionResponse>(
    mescottApiUrl(MESCOTT_API_PATHS.chapaWebhook),
    { mescott_action: 'telegram-request-session', phone, purpose },
  );
  if (viaWebhook.result.ok) return viaWebhook.result;

  return {
    ok: false,
    error: viaDb.error || viaWebhook.result.error || viaApi.result.error || 'Could not start Telegram verification',
  };
}

export async function verifyTelegramCode(
  phone: string,
  code: string,
  sessionToken: string,
): Promise<TelegramVerifyResponse> {
  const body = { phone, code, sessionToken };

  const viaApi = await postWithFallbacks<TelegramVerifyResponse>(
    [MESCOTT_API_PATHS.telegramVerify, MESCOTT_API_PATHS.telegramVerifyNested],
    body,
  );
  if (viaApi.result.ok) return viaApi.result;

  const viaWebhook = await postJson<TelegramVerifyResponse>(
    mescottApiUrl(MESCOTT_API_PATHS.chapaWebhook),
    { mescott_action: 'telegram-verify', ...body },
  );
  if (viaWebhook.result.ok) return viaWebhook.result;

  return {
    ok: false,
    error:
      viaWebhook.result.error ||
      viaApi.result.error ||
      'Verification API not live. Redeploy webhook-server and set SUPABASE_SERVICE_ROLE_KEY on Vercel.',
  };
}
