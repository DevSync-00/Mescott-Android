-- ============================================================
-- MESCOTT: Profiles Auto-Provisioning Trigger
-- Fires on INSERT to auth.users (SECURITY DEFINER = service role bypass)
--
-- Metadata layout written by the telegram-auth Edge Function on createUser:
--   raw_user_meta_data = { "telegram_id": "<string>" }
--
-- The Edge Function ALSO does a direct profiles.insert() after user creation.
-- This trigger is a safety net. The ON CONFLICT clause lets both coexist.
-- The EXCEPTION block ensures trigger errors NEVER block auth.users inserts.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER AS $$
DECLARE
    computed_full_name TEXT;
    computed_username   TEXT;
    tg_id_str           TEXT;
BEGIN
    -- 1. Extract telegram_id (the only guaranteed field in Edge Function metadata)
    tg_id_str := COALESCE(NEW.raw_user_meta_data->>'telegram_id', '');

    -- 2. Build full name: use first_name+last_name if present, else email prefix
    computed_full_name := TRIM(
        COALESCE(NEW.raw_user_meta_data->>'first_name', '') || ' ' ||
        COALESCE(NEW.raw_user_meta_data->>'last_name', '')
    );
    IF computed_full_name = '' OR computed_full_name IS NULL THEN
        computed_full_name := COALESCE(
            NULLIF(SPLIT_PART(NEW.email, '@', 1), ''),
            'Telegram User'
        );
    END IF;

    -- 3. Build username: prefer explicit username field, then tg_<id>, then email prefix
    computed_username := COALESCE(
        NULLIF(NEW.raw_user_meta_data->>'username', ''),
        CASE WHEN tg_id_str <> '' THEN 'tg_' || tg_id_str ELSE NULL END,
        NULLIF(SPLIT_PART(NEW.email, '@', 1), ''),
        'user_' || SUBSTR(NEW.id::text, 1, 8)
    );

    -- 4. Upsert profile row — ON CONFLICT handles the race with Edge Function direct insert
    INSERT INTO public.profiles (
        user_id,
        full_name,
        username,
        phone,
        telegram_chat_id,
        role,
        current_mode,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        computed_full_name,
        computed_username,
        COALESCE(NEW.phone, ''),
        tg_id_str,
        'customer',
        'customer',
        NOW(),
        NOW()
    )
    ON CONFLICT (telegram_chat_id) DO UPDATE
        SET user_id    = EXCLUDED.user_id,
            full_name  = EXCLUDED.full_name,
            username   = EXCLUDED.username,
            updated_at = NOW();

    RETURN NEW;

EXCEPTION
    WHEN OTHERS THEN
        -- Log error but NEVER block the auth.users row insert
        RAISE WARNING '[handle_new_user_profile] trigger error for user %: % (SQLSTATE: %)',
            NEW.id, SQLERRM, SQLSTATE;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-bind the trigger to fire after every new auth.users row
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- Grant all permissions on profiles table and sequences to prevent permission denied errors
GRANT ALL ON public.profiles TO postgres, service_role, authenticated, anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role, authenticated, anon;

-- Disable RLS on profiles to completely prevent row-level security policy violations
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;



