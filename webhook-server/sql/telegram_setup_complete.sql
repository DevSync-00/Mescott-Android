-- Run this ENTIRE file once in Supabase SQL Editor
-- Project must match app .env: EXPO_PUBLIC_SUPABASE_URL

-- Tables (gen_random_uuid() is built-in on Supabase — no pgcrypto required)
CREATE TABLE IF NOT EXISTS public.channel_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id text NOT NULL,
  platform text NOT NULL DEFAULT 'telegram',
  message_body text,
  media jsonb,
  direction text NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound', 'outbound')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.telegram_verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id text NOT NULL,
  phone text,
  code text NOT NULL,
  purpose text NOT NULL DEFAULT 'sign_in' CHECK (purpose IN ('sign_in', 'sign_up')),
  session_token text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telegram_verification_session
  ON public.telegram_verification_codes (session_token)
  WHERE used_at IS NULL AND session_token IS NOT NULL;

-- RPC for mobile app
CREATE OR REPLACE FUNCTION public.create_telegram_session(
  p_phone text,
  p_purpose text DEFAULT 'sign_in'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_code text;
  v_expires timestamptz;
BEGIN
  IF p_phone IS NULL OR length(trim(p_phone)) < 7 THEN
    RAISE EXCEPTION 'Invalid phone number';
  END IF;

  v_token := replace(gen_random_uuid()::text, '-', '');
  v_code := lpad((floor(random() * 900000) + 100000)::int::text, 6, '0');
  v_expires := now() + interval '10 minutes';

  INSERT INTO public.telegram_verification_codes (
    telegram_user_id,
    phone,
    code,
    purpose,
    session_token,
    expires_at
  ) VALUES (
    'pending_' || v_token,
    trim(p_phone),
    v_code,
    COALESCE(NULLIF(p_purpose, ''), 'sign_in'),
    v_token,
    v_expires
  );

  RETURN json_build_object(
    'ok', true,
    'sessionToken', v_token,
    'code', v_code,
    'expiresAt', v_expires
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_telegram_session(text, text) TO anon, authenticated, service_role;

-- Tell PostgREST / Supabase API to see the new function (important!)
NOTIFY pgrst, 'reload schema';
