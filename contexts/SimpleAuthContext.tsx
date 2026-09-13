// simpleauthcontext.tsx
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SimpleUserProfile } from '../types/SimpleUserProfile';
import { ProfileSyncService } from '../services/ProfileSyncService';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { User } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';
import { waitForTelegramMiniAppInitData } from '../lib/telegram';

WebBrowser.maybeCompleteAuthSession();

interface AuthContextType {
  user: SimpleUserProfile | null;
  isAuthenticated: boolean;
  loading: boolean;
  isLoading: boolean; // Add this for backward compatibility
  sendVerificationCode: (phone: string) => Promise<{ success: boolean; message: string }>;
  verifyPhoneCode: (phone: string, code: string) => Promise<{ success: boolean; message: string; isNewUser?: boolean }>;
  signInWithGoogle: () => Promise<{ success: boolean; message: string }>;
  signInWithTelegram: () => Promise<{ success: boolean; message: string }>;
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
          ensureUserProfile(session.user!)
            .then(() => loadUserProfile(session.user!.id))
            .catch((error) => handleProfileLoadError(error, event));
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
          await ensureUserProfile(session.user);
          await loadUserProfile(session.user.id);
        } catch (profileError) {
          console.error('Profile loading error:', profileError);
          // If profile doesn't exist, sign out the user
          await supabase.auth.signOut();
          setUser(null);
        }
      } else {
        const initData = await waitForTelegramMiniAppInitData();
        if (initData) {
          const result = await signInWithTelegramMiniApp(initData);
          if (!result.success) console.error('Telegram Mini App sign-in failed:', result.message);
        } else {
          setUser(null);
        }
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

  const ensureUserProfile = async (authUser: User) => {
    const { data: existingProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', authUser.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (existingProfile) return;

    const metadata = authUser.user_metadata || {};
    const fullName = metadata.full_name || metadata.name || '';
    const preferredName = metadata.username || authUser.email?.split('@')[0] || 'user';
    const safeName = preferredName.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 20) || 'user';

    const { error: createError } = await supabase.from('profiles').insert({
      user_id: authUser.id,
      full_name: fullName,
      username: `${safeName}-${authUser.id.slice(0, 6)}`,
      phone: authUser.phone || metadata.phone || null,
      avatar_url: metadata.avatar_url || metadata.picture || null,
      role: 'customer',
      current_mode: 'customer',
    });

    // A database trigger may create the same profile during OAuth signup.
    if (createError && createError.code !== '23505') throw createError;
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

  const signInWithGoogle = async () => {
    try {
      const redirectTo = Linking.createURL('auth');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });

      if (error) return { success: false, message: error.message };
      if (!data.url) return { success: false, message: 'Unable to start Google sign-in.' };

      if (Platform.OS === 'web') {
        window.location.assign(data.url);
        return { success: true, message: 'Opening Google sign-in…' };
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success') {
        return {
          success: false,
          message: result.type === 'cancel' ? 'Google sign-in was cancelled.' : 'Google sign-in did not complete.',
        };
      }

      const callbackUrl = new URL(result.url);
      const code = callbackUrl.searchParams.get('code');
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) return { success: false, message: exchangeError.message };
      } else {
        const hash = new URLSearchParams(callbackUrl.hash.replace(/^#/, ''));
        const accessToken = hash.get('access_token');
        const refreshToken = hash.get('refresh_token');
        if (!accessToken || !refreshToken) {
          return { success: false, message: 'Google did not return a valid session.' };
        }
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionError) return { success: false, message: sessionError.message };
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user) {
        return { success: false, message: 'Google sign-in completed without a user session.' };
      }
      await ensureUserProfile(sessionData.session.user);
      await loadUserProfile(sessionData.session.user.id);
      return { success: true, message: 'Signed in with Google.' };
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      return { success: false, message: error?.message || 'Unable to sign in with Google.' };
    }
  };

  const getTelegramAuthEndpoint = () => {
    const apiBase = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');
    if (!apiBase) throw new Error('EXPO_PUBLIC_API_URL is not configured.');
    return apiBase.endsWith('/api') ? `${apiBase}/auth/telegram` : `${apiBase}/api/auth/telegram`;
  };

  const finishTelegramSignIn = async (payload: Record<string, string>) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    let response: Response;
    try {
      response = await fetch(getTelegramAuthEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        throw new Error('Telegram sign-in timed out. Please try again.');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
    const result = await response.json();
    if (!response.ok || !result.tokenHash) {
      throw new Error(result.error || 'Telegram authentication failed.');
    }

    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: result.tokenHash,
      type: 'email',
    });
    if (error || !data.user) throw error || new Error('Telegram session could not be created.');
    await ensureUserProfile(data.user);
    await loadUserProfile(data.user.id);
  };

  const signInWithTelegramMiniApp = async (initData: string) => {
    try {
      await finishTelegramSignIn({ mode: 'mini_app', initData });
      return { success: true, message: 'Signed in with Telegram.' };
    } catch (error: any) {
      return { success: false, message: error?.message || 'Unable to sign in with Telegram.' };
    }
  };

  const signInWithTelegram = async () => {
    try {
      const clientId = process.env.EXPO_PUBLIC_TELEGRAM_CLIENT_ID;
      if (!clientId) throw new Error('Telegram Login is not configured.');

      const redirectUri = Linking.createURL('auth');
      const state = `${Crypto.randomUUID()}${Crypto.randomUUID()}`.replace(/-/g, '');
      const nonce = Crypto.randomUUID();
      const codeVerifier = `${Crypto.randomUUID()}${Crypto.randomUUID()}`.replace(/-/g, '');
      const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, codeVerifier, {
        encoding: Crypto.CryptoEncoding.BASE64,
      });
      const codeChallenge = digest.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const authorizeUrl = new URL('https://oauth.telegram.org/auth');
      authorizeUrl.search = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid profile phone',
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      }).toString();

      const browserResult = await WebBrowser.openAuthSessionAsync(authorizeUrl.toString(), redirectUri);
      if (browserResult.type !== 'success') {
        return { success: false, message: 'Telegram sign-in was cancelled.' };
      }
      const callback = new URL(browserResult.url);
      if (callback.searchParams.get('state') !== state) throw new Error('Telegram login state is invalid.');
      const code = callback.searchParams.get('code');
      if (!code) throw new Error(callback.searchParams.get('error_description') || 'Telegram returned no login code.');

      await finishTelegramSignIn({ mode: 'oidc', code, redirectUri, codeVerifier, nonce });
      return { success: true, message: 'Signed in with Telegram.' };
    } catch (error: any) {
      console.error('Telegram sign-in error:', error);
      return { success: false, message: error?.message || 'Unable to sign in with Telegram.' };
    }
  };

  const sendVerificationCode = async (phone: string) => {
    const normalized = normalizePhone(phone);

    // Send OTP (login-only flow)
    const { error } = await supabase.auth.signInWithOtp({ phone: normalized });
    if (error) return { success: false, message: error.message };
    return { success: true, message: 'Verification code sent' };
  };

  const verifyPhoneCode = async (phone: string, code: string) => {
    try {
      const normalized = normalizePhone(phone);
      const { data, error } = await supabase.auth.verifyOtp({ phone: normalized, token: code, type: 'sms' });

      if (error) {
        console.error('OTP verification error:', error);
        return { success: false, message: error.message };
      }

      if (!data?.user) {
        console.error('No user data returned from OTP verification');
        return { success: false, message: 'Verification failed' };
      }
      
      const authUser = data.user;
      console.log('OTP verified successfully for user:', authUser.id);

      // Login-only flow: if profile missing, auto-create minimal profile
      let isNewUser = false;
      try {
        const { data: existingProfile, error: checkError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', authUser.id)
          .maybeSingle();

        if (checkError) {
          console.error('Error checking user existence during sign-in:', checkError);
          await supabase.auth.signOut();
          setUser(null);
          return { success: false, message: 'Error verifying user. Please try again.' };
        }

        if (!existingProfile) {
          console.log('No profile found, creating a minimal profile for OTP login');
          const usernameSeed = normalized.replace(/\D/g, '').slice(-4) || '0000';
          const { data: profile, error: createError } = await supabase
            .from('profiles')
            .insert({
              user_id: authUser.id,
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
            return { success: false, message: createError.message };
          }

          console.log('Minimal profile created:', profile?.id);
          isNewUser = true;
        }

        await loadUserProfile(authUser.id);
        return {
          success: true,
          message: isNewUser ? 'Signed in. Please complete your profile.' : 'Signed in successfully',
          isNewUser,
        };
      } catch (profileError) {
        console.error('Profile handling error during sign-in:', profileError);
        await supabase.auth.signOut();
        setUser(null);
        return { success: false, message: 'Unable to load profile. Please try again.' };
      }
    } catch (error) {
      console.error('Unexpected error in verifyPhoneCode:', error);
      return { success: false, message: 'An unexpected error occurred. Please try again.' };
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

  const value: AuthContextType = {
    user,
    isAuthenticated,
    loading,
    isLoading: loading, // Add this for backward compatibility
    sendVerificationCode,
    verifyPhoneCode,
    signInWithGoogle,
    signInWithTelegram,
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
