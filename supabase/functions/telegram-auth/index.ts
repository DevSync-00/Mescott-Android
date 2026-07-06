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

  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
});
