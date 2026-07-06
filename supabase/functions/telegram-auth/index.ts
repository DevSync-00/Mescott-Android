import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Send a message via Telegram Bot API
async function sendMessage(chatId: number, text: string, replyMarkup: any = null) {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!token) {
    console.warn('[telegram] TELEGRAM_BOT_TOKEN not set — skipping message');
    return;
  }
  const body: any = { chat_id: chatId, text, parse_mode: 'HTML' };
  if (replyMarkup) body.reply_markup = replyMarkup;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!json.ok) console.error('[telegram] sendMessage failed:', json);
  } catch (err: any) {
    console.error('[telegram] sendMessage error:', err.message);
  }
}

// Deterministic password derived from chatId - same as used on the server
async function derivePassword(chatId: number) {
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'mescott-fallback-secret';
  const keyData = new TextEncoder().encode(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(String(chatId))
  );
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Verify the HMAC signature of the Telegram Login Widget auth payload
async function verifyTelegramWidgetHMAC(authData: any, botToken: string): Promise<boolean> {
  const { hash, ...fields } = authData;
  if (!hash) return false;

  // 1. Sort fields and construct check string
  const checkString = Object.keys(fields)
    .sort()
    .map(key => `${key}=${fields[key]}`)
    .join('\n');

  // 2. Compute SHA256(botToken) to get secret key
  const tokenBytes = new TextEncoder().encode(botToken);
  const secretKeyBuffer = await crypto.subtle.digest('SHA-256', tokenBytes);

  // 3. Import secret key for HMAC
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    secretKeyBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // 4. Sign checkString
  const dataBytes = new TextEncoder().encode(checkString);
  const signatureBuffer = await crypto.subtle.sign('HMAC', hmacKey, dataBytes);

  // 5. Convert signature to hex
  const calculatedHash = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return calculatedHash === hash;
}

// Broadcast AUTH_SUCCESS via Supabase Realtime and persist jwt_payload to DB
async function approveSession(supabaseAdmin: any, sessionToken: string, userId: string, jwtPayload: any) {
  // 1. Update DB row to APPROVED
  const { error: updateError } = await supabaseAdmin
    .from('auth_pending_sessions')
    .update({ status: 'APPROVED', user_id: userId, jwt_payload: jwtPayload })
    .eq('session_token', sessionToken);

  if (updateError) {
    console.error('[telegram] Failed to update session to APPROVED:', updateError.message);
    return false;
  }

  // 2. Broadcast via Supabase Realtime so the mobile app gets the event immediately
  try {
    const channel = supabaseAdmin.channel(`auth:${sessionToken}`);
    await new Promise<void>((resolve) => {
      channel.subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await channel.send({
            type: 'broadcast',
            event: 'AUTH_SUCCESS',
            payload: jwtPayload,
          });
          console.log(`[telegram] Broadcasted AUTH_SUCCESS for session ${sessionToken.substring(0, 8)}...`);
          await supabaseAdmin.removeChannel(channel);
          resolve();
        }
      });
    });
  } catch (broadcastErr: any) {
    console.warn('[telegram] Realtime broadcast failed (DB fallback will handle it):', broadcastErr.message);
  }

  return true;
}

// Find or create Supabase Auth user + profile, then sign them in
async function authenticateUser(supabaseAdmin: any, phone: string, chatId: number, username: string, contact: any) {
  const password = await derivePassword(chatId);

  // Try sign-in first (user may already exist)
  const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
    phone,
    password,
  });

  if (!signInError && signInData?.session) {
    // Existing user — update telegram fields on their profile
    await supabaseAdmin
      .from('profiles')
      .update({ telegram_chat_id: String(chatId), telegram_username: username, updated_at: new Date().toISOString() })
      .eq('user_id', signInData.user.id);

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('user_id', signInData.user.id)
      .maybeSingle();

    return { session: signInData.session, user: signInData.user, profile };
  }

  // User doesn't exist — create them
  console.log('[telegram] User not found, creating new account for phone:', phone);

  const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
    phone,
    password,
    phone_confirm: true,
  });

  if (createError && !createError.message.includes('already registered')) {
    console.error('[telegram] Failed to create user:', createError.message);
    return null;
  }

  // Sign in with the newly created user
  const { data: freshSignIn, error: freshSignInError } = await supabaseAdmin.auth.signInWithPassword({
    phone,
    password,
  });

  if (freshSignInError || !freshSignIn?.session) {
    console.error('[telegram] Sign-in after creation failed:', freshSignInError?.message);
    return null;
  }

  const userId = freshSignIn.user.id;
  const fullName = [contact?.first_name, contact?.last_name].filter(Boolean).join(' ') || 'Telegram User';

  // Create profile row
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .insert([{
      user_id: userId,
      full_name: fullName,
      username: username || `tg_${chatId}`,
      phone,
      telegram_chat_id: String(chatId),
      telegram_username: username,
      role: 'customer',
      current_mode: 'customer',
    }])
    .select()
    .single();

  if (profileError) {
    console.error('[telegram] Profile creation error:', profileError.message);
    return { session: freshSignIn.session, user: freshSignIn.user, profile: null };
  }

  return { session: freshSignIn.session, user: freshSignIn.user, profile };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url);
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  if (!supabaseUrl || !supabaseServiceRole) {
    return new Response(
      JSON.stringify({ success: false, error: 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  });

  // Root POST Route: Verify Telegram Widget HMAC and Sign In/Sign Up
  if (url.pathname === '/telegram-auth' || url.pathname === '/' || url.pathname.endsWith('/telegram-auth')) {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      const authData = await req.json().catch(() => ({}));
      const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';

      if (!botToken) {
        return new Response(JSON.stringify({ success: false, error: 'TELEGRAM_BOT_TOKEN is not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 1. Verify signature
      const isValid = await verifyTelegramWidgetHMAC(authData, botToken);
      if (!isValid) {
        return new Response(JSON.stringify({ success: false, error: 'Signature verification failed' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check auth_date age (e.g. max 24 hours)
      const ageSeconds = Date.now() / 1000 - Number(authData.auth_date);
      if (ageSeconds > 86400) {
        return new Response(JSON.stringify({ success: false, error: 'Session expired' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const telegramUserId = String(authData.id);
      const email = `tg_${telegramUserId}@telegram.mescott.co`;
      const password = await derivePassword(Number(telegramUserId));
      const fullName = [authData.first_name, authData.last_name].filter(Boolean).join(' ') || 'Telegram User';
      const username = authData.username || `tg_${telegramUserId}`;

      // 2. Find or create Supabase user
      let session: any = null;
      let user: any = null;

      const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password,
      });

      if (!signInError && signInData?.session) {
        session = signInData.session;
        user = signInData.user;

        // Existing user — update profile fields
        await supabaseAdmin
          .from('profiles')
          .update({
            telegram_chat_id: telegramUserId,
            telegram_username: username,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);
      } else {
        // Create new user in Supabase Auth
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { telegram_id: telegramUserId },
        });

        if (createError && !createError.message.includes('already registered')) {
          console.error('[telegram-auth] Failed to create user:', createError.message);
          return new Response(JSON.stringify({ success: false, error: 'Failed to create user account' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Sign in with the newly created user
        const { data: freshSignIn, error: freshSignInError } = await supabaseAdmin.auth.signInWithPassword({
          email,
          password,
        });

        if (freshSignInError || !freshSignIn?.session) {
          console.error('[telegram-auth] Sign-in after creation failed:', freshSignInError?.message);
          return new Response(JSON.stringify({ success: false, error: 'Failed to sign in new user account' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        session = freshSignIn.session;
        user = freshSignIn.user;

        // Create profile
        await supabaseAdmin.from('profiles').insert([{
          user_id: user.id,
          full_name: fullName,
          username,
          phone: null,
          telegram_chat_id: telegramUserId,
          telegram_username: username,
          role: 'customer',
          current_mode: 'customer',
        }]);
      }

      console.log(`[telegram-auth] Successful widget login for Telegram ID: ${telegramUserId}`);

      return new Response(JSON.stringify({
        success: true,
        session: {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_in: session.expires_in,
          token_type: session.token_type,
          user: {
            id: user.id,
            user_metadata: { telegram_id: telegramUserId },
          },
        },
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (err: any) {
      console.error('[telegram-auth] Root handler error:', err);
      return new Response(JSON.stringify({ success: false, error: err.message || 'Internal server error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  // Route 1: Initiate Telegram Login Session
  if (url.pathname.endsWith('/initiate')) {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      const sessionToken = crypto.randomUUID().replace(/-/g, '');
      const body = await req.json().catch(() => ({}));
      const deviceInfo = body.deviceInfo || {};

      const { error } = await supabaseAdmin
        .from('auth_pending_sessions')
        .insert([{
          session_token: sessionToken,
          status: 'PENDING',
          device_info: deviceInfo,
        }]);

      if (error) {
        console.error('[initiate] Supabase insert error:', error);
        return new Response(JSON.stringify({ success: false, error: 'Failed to create session', details: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const botName = Deno.env.get('TELEGRAM_BOT_NAME') || 'MescottVerifyBot';
      const telegramLink = `tg://resolve?domain=${botName}&start=${sessionToken}`;
      const fallbackLink = `https://t.me/${botName}?start=${sessionToken}`;

      console.log(`[initiate] Session created: ${sessionToken.substring(0, 8)}... bot: ${botName}`);

      return new Response(JSON.stringify({
        success: true,
        session_token: sessionToken,
        telegram_link: telegramLink,
        fallback_link: fallbackLink,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (err: any) {
      console.error('[initiate] Unexpected error:', err);
      return new Response(JSON.stringify({ success: false, error: 'Internal server error', details: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  // Route 2: Telegram Bot Webhook Callback
  if (url.pathname.endsWith('/webhook')) {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      const payload = await req.json().catch(() => null);
      if (!payload?.message) {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { message } = payload;
      const chatId = message.chat.id;
      const from = message.from || {};
      const username = from.username || '';
      const text = message.text || '';
      const contact = message.contact;

      console.log(`[telegram] Received message from chatId=${chatId} username=${username}`);

      // ── /start <token> ──────────────────────────────────────────────────────
      if (text.startsWith('/start')) {
        const token = text.split(' ')[1];

        if (!token) {
          await sendMessage(chatId, 'Welcome to Mescott!\n\nPlease use the <b>Continue with Telegram</b> button in the Mescott app to sign in.');
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }

        // Look up the pending session
        const { data: session, error: sessionError } = await supabaseAdmin
          .from('auth_pending_sessions')
          .select('*')
          .eq('session_token', token)
          .maybeSingle();

        if (sessionError || !session) {
          await sendMessage(chatId, '❌ Invalid or expired login link. Please try again from the Mescott app.');
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }

        if (session.status !== 'PENDING') {
          await sendMessage(chatId, '⚠️ This login session has already been used. Please start a new one from the app.');
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }

        const ageSeconds = (Date.now() - new Date(session.created_at).getTime()) / 1000;
        if (ageSeconds > 300) {
          await supabaseAdmin.from('auth_pending_sessions').update({ status: 'EXPIRED' }).eq('session_token', token);
          await sendMessage(chatId, '⌛ This login session has expired (5 min limit). Please try again from the app.');
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }

        // Save chatId + username into device_info so the contact handler can match sessions
        await supabaseAdmin
          .from('auth_pending_sessions')
          .update({ device_info: { ...session.device_info, telegram_chat_id: String(chatId), telegram_username: username } })
          .eq('session_token', token);

        // If we already know this Telegram user (returning user), authenticate immediately
        const { data: existingProfile } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .eq('telegram_chat_id', String(chatId))
          .maybeSingle();

        if (existingProfile) {
          console.log(`[telegram] Returning user found: ${existingProfile.full_name}`);
          const password = await derivePassword(chatId);
          const { data: authData, error: signInErr } = await supabaseAdmin.auth.signInWithPassword({
            phone: existingProfile.phone,
            password,
          });

          if (signInErr || !authData?.session) {
            console.error('[telegram] Sign-in for returning user failed:', signInErr?.message);
            await sendMessage(chatId, '⚠️ Authentication failed. Please contact support.');
            return new Response(JSON.stringify({ ok: true }), { status: 200 });
          }

          const jwtPayload = {
            access_token: authData.session.access_token,
            refresh_token: authData.session.refresh_token,
            user: {
              id: existingProfile.id,
              user_id: authData.user.id,
              full_name: existingProfile.full_name,
              username: existingProfile.username,
              phone: existingProfile.phone,
              role: existingProfile.role,
              current_mode: existingProfile.current_mode,
            },
          };

          await approveSession(supabaseAdmin, token, authData.user.id, jwtPayload);
          await sendMessage(chatId, '🎉 Signed in successfully! Return to the Mescott app.');
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }

        // New user — ask them to share their phone number
        await sendMessage(
          chatId,
          '👋 Welcome to Mescott!\n\nTo complete sign-in, please share your phone number using the button below.',
          {
            keyboard: [[{ text: '📱 Share Phone Number', request_contact: true }]],
            resize_keyboard: true,
            one_time_keyboard: true,
          }
        );
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      // ── Contact shared (phone number) ───────────────────────────────────────
      if (contact) {
        if (String(contact.user_id) !== String(from.id)) {
          await sendMessage(chatId, '⚠️ Please share <b>your own</b> phone number, not someone else\'s.');
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }

        const rawPhone = contact.phone_number;
        const phone = rawPhone.startsWith('+') ? rawPhone : `+${rawPhone}`;

        // Find the pending session for this chatId
        const { data: session, error: sessionError } = await supabaseAdmin
          .from('auth_pending_sessions')
          .select('*')
          .eq('status', 'PENDING')
          .eq('device_info->>telegram_chat_id', String(chatId))
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (sessionError || !session) {
          await sendMessage(chatId, '❌ No active login session found. Please tap <b>Continue with Telegram</b> in the Mescott app first.');
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }

        const authResult = await authenticateUser(supabaseAdmin, phone, chatId, username, contact);
        if (!authResult) {
          await sendMessage(chatId, '⚠️ Authentication failed. Please try again or contact support.');
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }

        const { session: authSession, user: authUser, profile } = authResult;

        const jwtPayload = {
          access_token: authSession.access_token,
          refresh_token: authSession.refresh_token,
          user: {
            id: profile?.id || authUser.id,
            user_id: authUser.id,
            full_name: profile?.full_name || [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'Telegram User',
            username: profile?.username || username || `tg_${chatId}`,
            phone,
            role: profile?.role || 'customer',
            current_mode: profile?.current_mode || 'customer',
          },
        };

        const approved = await approveSession(supabaseAdmin, session.session_token, authUser.id, jwtPayload);
        if (approved) {
          await sendMessage(chatId, '🎉 Authentication successful! Return to the Mescott app to continue.', {
            remove_keyboard: true,
          });
        } else {
          await sendMessage(chatId, '⚠️ Something went wrong finalizing your session. Please try again.');
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    } catch (err: any) {
      console.error('[telegram] Unhandled error in webhook handler:', err);
      return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500 });
    }
  }

  // ── Route 3: OIDC /login — redirect to oauth.telegram.org ────────────────
  // GET /login?state=<state>&code_challenge=<challenge>&app_redirect=<uri>
  if (url.pathname.endsWith('/login')) {
    const clientId = Deno.env.get('TELEGRAM_OIDC_CLIENT_ID') || '';
    if (!clientId) {
      return new Response('TELEGRAM_OIDC_CLIENT_ID is not configured', { status: 500 });
    }

    const state = url.searchParams.get('state') || '';
    const codeChallenge = url.searchParams.get('code_challenge') || '';

    if (!state || !codeChallenge) {
      return new Response('Missing state or code_challenge', { status: 400 });
    }

    const callbackUrl = `${supabaseUrl}/functions/v1/telegram-auth/callback`;
    const q = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: 'openid profile phone',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    const telegramAuthUrl = `https://oauth.telegram.org/auth?${q.toString()}`;

    // Return an HTML page that immediately redirects the browser to Telegram OIDC.
    // This ensures the correct Origin/Referer headers are set from our domain.
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Connecting to Telegram...</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
           display: flex; align-items: center; justify-content: center;
           height: 100vh; margin: 0; background: #f5f5f7; color: #1d1d1f; }
    .wrap { text-align: center; padding: 24px; }
    .spin { border: 4px solid rgba(0,0,0,.1); width: 36px; height: 36px;
            border-radius: 50%; border-left-color: #0088CC;
            animation: spin 1s linear infinite; margin: 0 auto 16px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    h1 { font-size: 20px; margin-bottom: 8px; font-weight: 600; }
    p  { font-size: 14px; color: #86868b; margin: 0; }
    a  { display: inline-block; margin-top: 16px; color: #0088CC; text-decoration: none; font-size: 14px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="spin"></div>
    <h1>Connecting to Telegram</h1>
    <p>Please wait while we establish a secure connection...</p>
    <a href="${telegramAuthUrl}">Tap here if not redirected automatically</a>
  </div>
  <script>setTimeout(function(){ window.location.replace("${telegramAuthUrl}"); }, 100);</script>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  // ── Route 4: OIDC /callback — Telegram redirects here after user confirms ─
  // GET /callback?code=<code>&state=<state>
  if (url.pathname.endsWith('/callback')) {
    const code = url.searchParams.get('code') || '';
    const state = url.searchParams.get('state') || '';
    const error = url.searchParams.get('error') || '';
    const errorDesc = url.searchParams.get('error_description') || '';

    if (!state) {
      return new Response('Missing state parameter', { status: 400 });
    }

    // State format: "<randomHex>|<mobileAppDeepLink>"
    const pipeIdx = state.indexOf('|');
    const mobileDeepLink = pipeIdx !== -1 ? state.substring(pipeIdx + 1) : '';

    if (!mobileDeepLink) {
      return new Response('Invalid state format — no mobile deep link found', { status: 400 });
    }

    try {
      const target = new URL(mobileDeepLink);
      if (code) target.searchParams.set('code', code);
      if (state) target.searchParams.set('state', state);
      if (error) target.searchParams.set('error', error);
      if (errorDesc) target.searchParams.set('error_description', errorDesc);

      const targetStr = target.toString();
      const html = `<!DOCTYPE html>
<html>
<head>
  <title>Redirecting to Mescott...</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
           display: flex; align-items: center; justify-content: center;
           height: 100vh; margin: 0; background: #f5f5f7; color: #1d1d1f; }
    .wrap { text-align: center; padding: 24px; }
    .spin { border: 4px solid rgba(0,0,0,.1); width: 36px; height: 36px;
            border-radius: 50%; border-left-color: #7B4FFF;
            animation: spin 1s linear infinite; margin: 0 auto 16px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    h1 { font-size: 20px; margin-bottom: 8px; font-weight: 600; }
    p  { font-size: 14px; color: #86868b; margin: 0; }
    a  { display: inline-block; margin-top: 16px; color: #7B4FFF; text-decoration: none; font-size: 14px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="spin"></div>
    <h1>Redirecting to Mescott</h1>
    <p>Please wait while we take you back to the app.</p>
    <a href="${targetStr}">Tap here if not redirected automatically</a>
  </div>
  <script>setTimeout(function(){ window.location.replace("${targetStr}"); }, 100);</script>
</body>
</html>`;

      return new Response(html, {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });
    } catch (err: any) {
      return new Response(`Redirect error: ${err.message}`, { status: 500 });
    }
  }

  // ── Route 5: OIDC /oidc-exchange — server-side code → Supabase session ────
  // POST /oidc-exchange  body: { code, code_verifier, redirect_uri }
  if (url.pathname.endsWith('/oidc-exchange')) {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const clientId = Deno.env.get('TELEGRAM_OIDC_CLIENT_ID') || '';
    const clientSecret = Deno.env.get('TELEGRAM_OIDC_CLIENT_SECRET') || '';

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ ok: false, error: 'TELEGRAM_OIDC_CLIENT_ID and TELEGRAM_OIDC_CLIENT_SECRET must be configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    try {
      const body = await req.json();
      const { code, code_verifier: codeVerifier, redirect_uri: redirectUri } = body || {};

      if (!code || !codeVerifier || !redirectUri) {
        return new Response(
          JSON.stringify({ ok: false, error: 'code, code_verifier, and redirect_uri are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ── Step 1: Exchange auth code for Telegram tokens ────────────────────
      const basic = btoa(`${clientId}:${clientSecret}`);
      const tokenBody = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: codeVerifier,
      });

      const tokenRes = await fetch('https://oauth.telegram.org/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basic}`,
        },
        body: tokenBody.toString(),
      });

      const tokenText = await tokenRes.text();
      let tokenData: any;
      try { tokenData = JSON.parse(tokenText); }
      catch { throw new Error(`Telegram token endpoint returned invalid JSON (${tokenRes.status}): ${tokenText}`); }

      if (!tokenRes.ok) {
        const msg = tokenData?.error_description || tokenData?.error || `HTTP ${tokenRes.status}`;
        throw new Error(`Telegram token exchange failed: ${msg}`);
      }

      if (!tokenData.id_token) throw new Error('Telegram did not return an id_token');

      // ── Step 2: Decode id_token to get user info (skip full JWT verify in Deno) ──
      // Telegram signs with RS256; we trust the exchange endpoint since we hold the secret.
      const [, payloadB64] = tokenData.id_token.split('.');
      const payloadJson = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
      const claims: any = JSON.parse(payloadJson);

      const telegramUserId = String(claims.sub || claims.id || '');
      const rawPhone = claims.phone_number || '';
      const phone = rawPhone ? (rawPhone.startsWith('+') ? rawPhone : `+${rawPhone}`) : '';
      const firstName = claims.given_name || claims.first_name || '';
      const lastName = claims.family_name || claims.last_name || '';
      const username = claims.preferred_username || '';
      const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Telegram User';

      if (!telegramUserId) throw new Error('No Telegram user ID in id_token');
      if (!phone) throw new Error('No phone number in id_token — ensure phone scope was granted');

      console.log(`[oidc] Authenticated Telegram user ${telegramUserId}, phone: ${phone.substring(0, 5)}...`);

      // ── Step 3: Find or create Supabase user by phone ─────────────────────
      const password = await derivePassword(Number(telegramUserId));

      let authData: any = null;
      const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({ phone, password });

      if (!signInError && signInData?.session) {
        authData = signInData;
        // Update profile with Telegram info
        await supabaseAdmin
          .from('profiles')
          .update({ telegram_chat_id: telegramUserId, telegram_username: username, updated_at: new Date().toISOString() })
          .eq('user_id', authData.user.id);
      } else {
        // Create new user
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          phone, password, phone_confirm: true,
        });

        if (createError && !createError.message.includes('already registered')) {
          throw new Error(`Failed to create user: ${createError.message}`);
        }

        const { data: freshData, error: freshErr } = await supabaseAdmin.auth.signInWithPassword({ phone, password });
        if (freshErr || !freshData?.session) throw new Error(`Sign-in after creation failed: ${freshErr?.message}`);
        authData = freshData;

        // Create profile
        await supabaseAdmin.from('profiles').insert([{
          user_id: authData.user.id,
          full_name: fullName,
          username: username || `tg_${telegramUserId}`,
          phone,
          telegram_chat_id: telegramUserId,
          telegram_username: username,
          role: 'customer',
          current_mode: 'customer',
        }]).select().single();
      }

      console.log(`[oidc] Supabase session issued for user ${authData.user.id}`);

      return new Response(JSON.stringify({
        ok: true,
        verified: true,
        phone,
        telegram_user_id: telegramUserId,
        profile: { name: fullName, username },
        session: {
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
          user_id: authData.user.id,
          expires_at: authData.session.expires_at,
        },
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (err: any) {
      console.error('[oidc-exchange] Error:', err.message);
      return new Response(JSON.stringify({ ok: false, error: err.message || 'OIDC exchange failed' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
});
