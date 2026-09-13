import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';
import { registerForPushNotifications, savePushToken } from '../services/notifications';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const DEFAULT_COUNTRY_CODE = '+251';

  useEffect(() => {
    checkUser();
    
    // Listen for auth changes (handles automatic session refresh, logout, etc.)
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.id);
      
      if (session?.user) {
        // User is authenticated, load their profile
        await loadUserProfile(session.user.id);
      } else {
        // User is not authenticated, clear state
        setUser(null);
        setIsAdmin(false);
        await AsyncStorage.removeItem('user');
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const checkUser = async () => {
    try {
      // First, try to get cached user from AsyncStorage for faster initial load
      const cachedUser = await AsyncStorage.getItem('user');
      if (cachedUser) {
        try {
          const userData = JSON.parse(cachedUser);
          // Ensure location field exists (for backward compatibility)
          const userWithLocation = {
            ...userData,
            location: userData.location || '',
            saved_destinations: userData.saved_destinations || userData.saved_churches || [],
            saved_stations: userData.saved_stations || [],
          };
          setUser(userWithLocation);
          setIsAdmin(userData.is_admin || false);
        } catch (e) {
          console.log('Error parsing cached user:', e);
        }
      }

      // Then verify session with Supabase (this handles automatic session restoration)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.log('Session error:', sessionError);
        // If session check fails, clear cached user
        if (cachedUser) {
          await AsyncStorage.removeItem('user');
          setUser(null);
          setIsAdmin(false);
        }
      } else if (session?.user) {
        // Session is valid, load fresh user profile
        await loadUserProfile(session.user.id);
        // Register for push notifications
        const pushToken = await registerForPushNotifications();
        if (pushToken && session.user.id) {
          await savePushToken(session.user.id, pushToken);
        }
      } else {
        // No valid session, clear user state
        if (cachedUser) {
          await AsyncStorage.removeItem('user');
          setUser(null);
          setIsAdmin(false);
        }
      }
    } catch (error) {
      console.log('Error checking user:', error);
      // On error, clear any cached data
      await AsyncStorage.removeItem('user');
      setUser(null);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const applyUserState = async (data) => {
    const userData = {
      ...data,
      name: data.name || '',
      phone_number: data.phone_number || '',
      emergency_contact: data.emergency_contact || '',
      location: data.location || '',
      saved_destinations: data.saved_destinations || data.saved_churches || [],
      saved_stations: data.saved_stations || [],
    };

    setUser(userData);
    setIsAdmin(data.is_admin || false);
    await AsyncStorage.setItem('user', JSON.stringify(userData));
    return userData;
  };

  const createUserProfile = async (userId, phoneNumber = '') => {
    const newUser = {
      id: userId,
      phone_number: phoneNumber,
      name: '',
      email: '',
      emergency_contact: '',
      location: '',
      saved_destinations: [],
      saved_stations: [],
      is_admin: false,
    };

    const { data, error } = await supabase
      .from('users')
      .upsert([newUser], { onConflict: 'id' })
      .select('*')
      .single();

    if (error) throw error;
    return applyUserState(data);
  };

  const loadUserProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        const { data: authData } = await supabase.auth.getUser();
        await createUserProfile(userId, authData?.user?.phone || '');
        return;
      }

      await applyUserState(data);
    } catch (error) {
      console.log('Error loading user profile:', error);
    }
  };

  const normalizePhoneNumber = (phoneNumber) => {
    const rawInput = (phoneNumber || '').trim();
    if (!rawInput) {
      throw new Error('Please enter a valid phone number');
    }

    const cleaned = rawInput.replace(/[^\d+]/g, '');
    let normalized = cleaned;

    if (cleaned.startsWith('00')) {
      normalized = `+${cleaned.slice(2)}`;
    } else if (!cleaned.startsWith('+')) {
      if (/^0\d{9}$/.test(cleaned)) {
        normalized = `${DEFAULT_COUNTRY_CODE}${cleaned.slice(1)}`;
      } else if (/^\d{9}$/.test(cleaned)) {
        normalized = `${DEFAULT_COUNTRY_CODE}${cleaned}`;
      } else {
        normalized = `+${cleaned}`;
      }
    }

    if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
      throw new Error('Use a valid phone number format like 09XXXXXXXX or +2519XXXXXXXX');
    }

    return normalized;
  };

  const getOtpErrorMessage = (error) => {
    const providerMessage = error?.message || 'Unable to send OTP right now. Please try again.';

    if (providerMessage.includes('20003') || providerMessage.toLowerCase().includes('authenticate')) {
      return 'SMS provider authentication failed. Update Twilio credentials in Supabase Auth > Phone settings.';
    }

    return providerMessage;
  };

  const sendOTP = async (phoneNumber) => {
    try {
      const formattedPhone = normalizePhoneNumber(phoneNumber);

      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
      });

      if (error) throw error;

      return { success: true, phoneNumber: formattedPhone };
    } catch (error) {
      throw new Error(getOtpErrorMessage(error));
    }
  };

  const verifyOTP = async (phoneNumber, token) => {
    try {
      const formattedPhone = normalizePhoneNumber(phoneNumber);

      const { data, error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: token,
        type: 'sms',
      });

      if (error) throw error;

      if (data.user) {
        // Check if user profile exists
        const { data: existingUser, error: existingUserError } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        if (existingUserError) throw existingUserError;

        if (!existingUser) {
          await createUserProfile(data.user.id, formattedPhone);
        } else {
          await applyUserState(existingUser);
        }
      }

      return data.user;
    } catch (error) {
      throw new Error(getOtpErrorMessage(error));
    }
  };

  const loginWithTelegram = async (telegramAuthData) => {
    try {
      const supabaseUrl =
        process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://dotjlikaurcjwabarqcy.supabase.co';
      const supabaseAnonKey =
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvdGpsaWthdXJjandhYmFycWN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwODY5MTQsImV4cCI6MjA4MDY2MjkxNH0.zZ0GeY_sV0TtP9jGVQRKPoXoDBCSpyNDlRKruAisa9A';

      // ── Security: wipe any existing session BEFORE setting a new one ─────
      // If we call setSession() while another account's session is still
      // active, Supabase's onAuthStateChange can fire with stale state and
      // loadUserProfile() would load the wrong user's data.
      await supabase.auth.signOut();
      setUser(null);
      setIsAdmin(false);
      await AsyncStorage.removeItem('user');
      // ─────────────────────────────────────────────────────────────────────

      console.log('[Telegram] Calling edge function with data:', JSON.stringify({
        ...telegramAuthData,
        hash: telegramAuthData.hash?.slice(0, 8) + '...',
      }));

      const response = await fetch(
        `${supabaseUrl}/functions/v1/telegram-auth`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify(telegramAuthData),
        },
      );

      const bodyText = await response.text();
      console.log('[Telegram] Edge function response:', response.status, bodyText);

      let result;
      try {
        result = JSON.parse(bodyText);
      } catch {
        throw new Error(`Edge function returned non-JSON (HTTP ${response.status}): ${bodyText.slice(0, 200)}`);
      }

      if (!response.ok || result.error) {
        throw new Error(result.error || `HTTP ${response.status} from edge function`);
      }

      const { session } = result;
      if (!session?.access_token) {
        throw new Error('No session returned from Telegram auth');
      }

      // ── Belt-and-suspenders: confirm the session belongs to the Telegram
      //    account that was actually authenticated, not any other account. ──
      const expectedId = String(telegramAuthData.id);
      const meta = session.user?.user_metadata;
      if (meta?.telegram_id && meta.telegram_id !== expectedId) {
        console.error('[Telegram] SECURITY VIOLATION: session telegram_id', meta.telegram_id, '!== expected', expectedId);
        throw new Error('Account mismatch detected. Please try signing in again.');
      }

      console.log('[Telegram] Got session for telegram_id:', expectedId, 'supabase uid:', session.user?.id);

      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });

      if (setSessionError) {
        console.error('[Telegram] setSession error:', setSessionError);
        throw setSessionError;
      }

      // Load profile explicitly — onAuthStateChange may fire before the
      // setSession promise resolves on some Supabase client versions.
      await loadUserProfile(session.user.id);
      console.log('[Telegram] Login complete for', expectedId);
    } catch (error) {
      // On any failure, always leave a clean logged-out state —
      // never allow a partial or mismatched session to persist.
      await supabase.auth.signOut().catch(() => {});
      setUser(null);
      setIsAdmin(false);
      await AsyncStorage.removeItem('user');
      console.error('[Telegram] loginWithTelegram failed:', error.message);
      throw new Error(error.message || 'Telegram login failed. Please try again.');
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      await AsyncStorage.removeItem('user');
      // Increment a counter persisted in AsyncStorage so TelegramLoginScreen
      // knows to remount its WebView and clear the Telegram session cookie.
      const prev = await AsyncStorage.getItem('webview_reset_key');
      await AsyncStorage.setItem('webview_reset_key', String((parseInt(prev || '0', 10) + 1)));
      setUser(null);
      setIsAdmin(false);
    } catch (error) {
      console.log('Error logging out:', error);
    }
  };

  const updateProfile = async (updates) => {
    try {
      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;

      // Reload user from database to ensure all fields are up to date
      await loadUserProfile(user.id);
    } catch (error) {
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAdmin,
        sendOTP,
        verifyOTP,
        loginWithTelegram,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
