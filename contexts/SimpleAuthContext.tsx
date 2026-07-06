// simpleauthcontext.tsx
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SimpleUserProfile } from '../types/SimpleUserProfile';
import { ProfileSyncService } from '../services/ProfileSyncService';
import { TelegramAuthService, TelegramWidgetAuthData, requestTelegramSession, verifyTelegramCode } from '../services/TelegramAuthService';
import { signInWithTelegramOidc } from '../services/TelegramLoginService';

interface AuthContextType {
  user: SimpleUserProfile | null;
  isAuthenticated: boolean;
  loading: boolean;
  isLoading: boolean; // Add this for backward compatibility
  initiateTelegramAuth: (deviceInfo?: Record<string, any>) => Promise<{ success: boolean; session_token: string; telegram_link: string; fallback_link: string; } | null>;
  handleTelegramCallback: (jwtPayload: any) => Promise<{ success: boolean; message?: string }>;
  signInWithTelegram: () => Promise<{ success: boolean; message: string; isNewUser?: boolean }>;
  loginWithTelegram: (telegramAuthData: any) => Promise<void>;
  sendTelegramVerification: (phone: string) => Promise<{
    success: boolean;
    message: string;
    sessionToken?: string;
    deepLink?: string;
    botUsername?: string;
  }>;
  verifyTelegramOtp: (phone: string, code: string, sessionToken: string) => Promise<{ success: boolean; message: string; isNewUser?: boolean }>;
  logout: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  switchMode: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<SimpleUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const initDoneRef = useRef(false);

  const isAuthenticated = !!user;
  
  const normalizePhone = (phone: string) => {
    // If phone already starts with +, return as is (already normalized)
    if (phone.startsWith('+')) {
      return phone;
    }
    
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');
    
    // If starts with 0, remove it (common in some countries)
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    
    // Default to Ethiopia (+251) if no country code detected
    // This maintains backward compatibility
    if (!cleaned.startsWith('251') && cleaned.length <= 10) {
      cleaned = '251' + cleaned;
    }
    
    return '+' + cleaned;
  };

  // Helper function to check if error is a refresh token error
  const isRefreshTokenError = (error: any): boolean => {
    if (!error) return false;
    const message = error.message || error.toString() || '';
    return (
      message.includes('Refresh Token') ||
      message.includes('refresh_token') ||
      message.includes('Invalid Refresh Token') ||
      message.includes('Refresh Token Not Found') ||
      (error.name === 'AuthApiError' && message.includes('refresh'))
    );
  };

  // Helper function to clear invalid session
  const clearInvalidSession = async () => {
    try {
      await supabase.auth.signOut();
      await AsyncStorage.multiRemove([
        'supabase.auth.token',
      ]);
      setUser(null);
    } catch (error) {
      console.error('Error clearing invalid session:', error);
      setUser(null);
    }
  };

  const handleProfileLoadError = async (error: unknown, context: string) => {
    console.error(`Error loading profile (${context}):`, error);
    if (isRefreshTokenError(error)) {
      console.log('Invalid refresh token detected, clearing session');
      await clearInvalidSession();
    } else {
      setUser(null);
    }
  };

  // Init auth state
  useEffect(() => {
    init();

    // Never await Supabase calls directly in this callback — it deadlocks getSession/init.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session?.user?.id);

      if (event === 'SIGNED_OUT') {
        setUser(null);
        return;
      }

      // INITIAL_SESSION and the first SIGNED_IN are handled by init()
      if (!initDoneRef.current) return;

      if (
        (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') &&
        session?.user
      ) {
        setTimeout(() => {
          loadUserProfile(session.user!.id).catch((error) =>
            handleProfileLoadError(error, event)
          );
        }, 0);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const init = async () => {
    setLoading(true);
    try {
      const {
        data: { session },
        error: sessionError
      } = await supabase.auth.getSession();

      // Handle refresh token errors gracefully
      if (sessionError) {
        console.error('Session error:', sessionError);
        
        // If it's a refresh token error, clear the session
        if (isRefreshTokenError(sessionError)) {
          console.log('Invalid refresh token detected, clearing session');
          await clearInvalidSession();
        }
        
        setUser(null);
        return;
      }

      if (session?.user) {
        try {
          await loadUserProfile(session.user.id);
        } catch (profileError) {
          console.error('Profile loading error:', profileError);
          // If profile doesn't exist, sign out the user
          await supabase.auth.signOut();
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch (err: any) {
      console.error('Auth init error:', err);
      
      // Handle refresh token errors in catch block too
      if (isRefreshTokenError(err)) {
        console.log('Invalid refresh token in catch block, clearing session');
        await clearInvalidSession();
      }
      
      setUser(null);
    } finally {
      initDoneRef.current = true;
      setLoading(false);
    }
  };

  const loadUserProfile = async (userId: string) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId) // user_id references auth.users.id
        .maybeSingle();

      if (error) {
        console.error('Database error loading profile:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      if (!profile) {
        console.log('No profile found for user:', userId);
        setUser(null);
        throw new Error('Profile not found');
      }

      console.log('Profile loaded successfully:', profile.full_name);
      setUser({
        id: profile.id,
        user_id: profile.user_id,
        full_name: profile.full_name,
        username: profile.username,
        phone: profile.phone,
        role: profile.role,
        current_mode: profile.current_mode,
        tasker_application_status: profile.tasker_application_status,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
        name: profile.full_name,
        currentMode: profile.current_mode,
        avatar_url: profile.avatar_url, // Add avatar_url to main user object
        profile,
      });
    } catch (error) {
      console.error('Error in loadUserProfile:', error);
      setUser(null);
      throw error;
    }
  };

  const initiateTelegramAuth = async (deviceInfo: Record<string, any> = {}) => {
    return await TelegramAuthService.fetchDeepLink(deviceInfo);
  };

  const handleTelegramCallback = async (jwtPayload: any) => {
    try {
      const { access_token, refresh_token } = jwtPayload;
      if (!access_token || !refresh_token) {
        throw new Error('Invalid JWT payload from Telegram auth');
      }

      const { error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });

      if (error) throw error;

      if (jwtPayload.user?.user_id) {
        await loadUserProfile(jwtPayload.user.user_id);
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await loadUserProfile(session.user.id);
        } else {
          throw new Error('No user session found after setting tokens');
        }
      }
      return { success: true };
    } catch (err: any) {
      console.error('Error handling Telegram callback:', err);
      return { success: false, message: err.message };
    }
  };

  const ensureProfileAfterAuth = async (authUserId: string, normalized: string) => {
    let isNewUser = false;
    const { data: existingProfile, error: checkError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', authUserId)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking user existence during sign-in:', checkError);
      await supabase.auth.signOut();
      setUser(null);
      return { success: false as const, message: 'Error verifying user. Please try again.' };
    }

    if (!existingProfile) {
      const usernameSeed = normalized.replace(/\D/g, '').slice(-4) || '0000';
      const { error: createError } = await supabase
        .from('profiles')
        .insert({
          user_id: authUserId,
          full_name: '',
          username: `user-${usernameSeed}`,
          phone: normalized,
          role: 'customer',
          current_mode: 'customer',
        })
        .select()
        .single();

      if (createError) {
        console.error('Profile creation error:', createError);
        return { success: false as const, message: createError.message };
      }
      isNewUser = true;
    }

    await loadUserProfile(authUserId);
    return {
      success: true as const,
      message: isNewUser ? 'Signed in. Please complete your profile.' : 'Signed in successfully',
      isNewUser,
    };
  };

  const signInWithTelegram = async () => {
    try {
      const result = await signInWithTelegramOidc();

      if (!result.ok || !result.session) {
        return { success: false, message: result.error || 'Telegram sign-in failed' };
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      });

      if (sessionError) {
        return { success: false, message: sessionError.message };
      }

      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        return { success: false, message: 'Telegram sign-in failed' };
      }

      const phone = result.phone || authUser.phone || '';
      return ensureProfileAfterAuth(authUser.id, phone ? normalizePhone(phone) : '+');
    } catch (error) {
      console.error('Unexpected error in signInWithTelegram:', error);
      return { success: false, message: 'An unexpected error occurred. Please try again.' };
    }
  };

  const sendTelegramVerification = async (phone: string) => {
    try {
      const normalized = normalizePhone(phone);
      const result = await requestTelegramSession(normalized, 'sign_in');
      if (!result.ok) {
        return { success: false, message: result.error || 'Failed to start Telegram verification' };
      }
      return {
        success: true,
        message: 'Telegram session created',
        sessionToken: result.sessionToken,
        deepLink: result.deepLink,
        botUsername: result.botUsername,
      };
    } catch (error: any) {
      console.error('Error in sendTelegramVerification:', error);
      return { success: false, message: error.message || 'An unexpected error occurred' };
    }
  };

  const verifyTelegramOtp = async (phone: string, code: string, sessionToken: string) => {
    try {
      const normalized = normalizePhone(phone);
      const result = await verifyTelegramCode(normalized, code, sessionToken);

      if (!result.ok || !result.session) {
        return { success: false, message: result.error || 'Verification failed' };
      }

      // Login using the returned session
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      });

      if (sessionError) {
        return { success: false, message: sessionError.message };
      }

      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        return { success: false, message: 'Telegram sign-in failed' };
      }

      return ensureProfileAfterAuth(authUser.id, normalized);
    } catch (error: any) {
      console.error('Error in verifyTelegramOtp:', error);
      return { success: false, message: error.message || 'An unexpected error occurred' };
    }
  };

  const refreshUserProfile = async () => {
    if (!user) return;
    
    // First sync the profile with tasker application status
    await ProfileSyncService.syncProfileWithTaskerApplication(user.user_id);
    
    // Then load the updated profile
    await loadUserProfile(user.user_id);
  };

  const logout = async () => {
      await supabase.auth.signOut();
      setUser(null);
      await AsyncStorage.clear();
  };

  const switchMode = async () => {
    if (!user) {
      console.log('🚀 SWITCH MODE - No user found');
      return;
    }
    
    try {
      const currentMode = user.current_mode;
      const newMode = currentMode === 'customer' ? 'tasker' : 'customer';
      
      console.log('🚀 SWITCH MODE - Current mode:', currentMode, 'Switching to:', newMode);
      console.log('🚀 SWITCH MODE - User ID:', user.id);
      
      // Update the profile in the database
      const { error } = await supabase
        .from('profiles')
        .update({ 
          current_mode: newMode,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) {
        console.error('🚀 SWITCH MODE - Database error:', error);
        throw error;
      }

      console.log('🚀 SWITCH MODE - Database updated successfully');

      // Update the local user state
      setUser(prev => {
        if (!prev) return null;
        const updated = { ...prev, current_mode: newMode as "tasker" | "customer" };
        console.log('🚀 SWITCH MODE - Local state updated:', updated.current_mode);
        console.log('🚀 SWITCH MODE - Full user object:', updated);
        return updated;
      });
      
      console.log(`🚀 SWITCH MODE - Mode switched to: ${newMode}`);
    } catch (error) {
      console.error('🚀 SWITCH MODE - Error switching mode:', error);
      throw error;
    }
  };

  const loginWithTelegram = async (telegramAuthData: TelegramWidgetAuthData): Promise<void> => {
    try {
      console.log('🔑 TELEGRAM WIDGET LOGIN - Starting for Telegram user:', telegramAuthData.id);

      // Step 1: Always sign out first to prevent account bleed
      await supabase.auth.signOut();
      setUser(null);

      // Step 2: Call Edge Function — HMAC verification happens server-side
      const result = await TelegramAuthService.loginWithTelegramHMAC(telegramAuthData);

      // Step 3: Verify the returned session belongs to the correct Telegram account
      const expectedId = String(telegramAuthData.id);
      const returnedId = result.session.user?.user_metadata?.telegram_id;
      if (returnedId && returnedId !== expectedId) {
        await supabase.auth.signOut();
        throw new Error('Account mismatch — session belongs to a different Telegram user. Please try again.');
      }

      // Step 4: Set the Supabase session
      const { data, error } = await supabase.auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      });

      if (error) {
        await supabase.auth.signOut();
        throw error;
      }

      console.log('🔑 TELEGRAM WIDGET LOGIN - Session set for user:', data.user?.id);

      // Step 5: Load the profile
      if (data.user) {
        await loadUserProfile(data.user.id);
      }
    } catch (err) {
      // Step 5 (error path): always sign out so we never leave a partial session
      console.error('❌ TELEGRAM WIDGET LOGIN - Error:', err);
      try {
        await supabase.auth.signOut();
      } catch (_) {
        // best-effort
      }
      setUser(null);
      throw err;
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    loading,
    isLoading: loading,
    initiateTelegramAuth,
    handleTelegramCallback,
    signInWithTelegram,
    loginWithTelegram,
    sendTelegramVerification,
    verifyTelegramOtp,
    logout,
    refreshUserProfile,
    switchMode,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
