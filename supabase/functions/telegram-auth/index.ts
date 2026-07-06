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

  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

