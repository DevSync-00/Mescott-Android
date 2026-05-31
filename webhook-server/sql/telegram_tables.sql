-- Run in Supabase SQL Editor for Telegram sign-up / sign-in + support messages

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

CREATE INDEX IF NOT EXISTS idx_channel_messages_sender
  ON public.channel_messages (sender_id, platform, created_at DESC);

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

CREATE INDEX IF NOT EXISTS idx_telegram_verification_active
  ON public.telegram_verification_codes (telegram_user_id, expires_at DESC)
  WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_telegram_verification_session
  ON public.telegram_verification_codes (session_token)
  WHERE used_at IS NULL AND session_token IS NOT NULL;

-- Optional: link Telegram ID to profile after verification
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_user_id text UNIQUE;

ALTER TABLE public.channel_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_verification_codes ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; tighten policies for anon/authenticated as needed
