-- Create a secure function that handles the profile insertion automatically
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, username, phone, telegram_chat_id, role, current_mode)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Telegram User'),
    COALESCE(NEW.raw_user_meta_data->>'username', 'tg_' || (NEW.raw_user_meta_data->>'telegram_id')),
    COALESCE(NEW.phone, ''),
    COALESCE(NEW.raw_user_meta_data->>'telegram_id', ''),
    'customer',
    'customer'
  )
  ON CONFLICT (telegram_chat_id) DO UPDATE
  SET user_id = EXCLUDED.user_id,
      updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; -- SECURITY DEFINER allows it to run with bypass rights

-- Bind the function to fire automatically whenever an account is added to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();
