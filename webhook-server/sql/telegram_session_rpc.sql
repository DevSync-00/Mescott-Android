-- Run in Supabase SQL Editor (lets the app start Telegram sign-in when API routes are not deployed yet)

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
  v_expires timestamptz;
BEGIN
  IF p_phone IS NULL OR length(trim(p_phone)) < 7 THEN
    RAISE EXCEPTION 'Invalid phone number';
  END IF;

  IF p_purpose IS NOT NULL AND p_purpose NOT IN ('sign_in', 'sign_up') THEN
    RAISE EXCEPTION 'Invalid purpose';
  END IF;

  v_token := encode(gen_random_bytes(16), 'hex');
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
    '000000',
    COALESCE(NULLIF(p_purpose, ''), 'sign_in'),
    v_token,
    v_expires
  );

  RETURN json_build_object(
    'ok', true,
    'sessionToken', v_token,
    'expiresAt', v_expires
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_telegram_session(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_telegram_session(text, text) TO anon, authenticated;
