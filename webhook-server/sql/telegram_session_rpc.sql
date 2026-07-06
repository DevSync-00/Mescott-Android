-- Run AFTER telegram_tables.sql (or use telegram_setup_complete.sql for everything at once)

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

  IF p_purpose IS NOT NULL AND p_purpose NOT IN ('sign_in', 'sign_up') THEN
    RAISE EXCEPTION 'Invalid purpose';
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

NOTIFY pgrst, 'reload schema';
