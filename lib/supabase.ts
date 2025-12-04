import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Expo automatically loads .env files and makes EXPO_PUBLIC_* variables available via process.env
const EXPO_PUBLIC_SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL
const EXPO_PUBLIC_SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

// Validate that required environment variables are set
// In production, these MUST be set - no fallback values allowed
// Note: In React Native/Expo, __DEV__ is false in production builds
const isProduction = typeof __DEV__ !== 'undefined' ? !__DEV__ : process.env.NODE_ENV === 'production'

// Check if variables are missing
const hasSupabaseUrl = !!EXPO_PUBLIC_SUPABASE_URL
const hasSupabaseKey = !!EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!hasSupabaseUrl || !hasSupabaseKey) {
  const errorMessage = '❌ CRITICAL: Supabase environment variables are missing!\n' +
    'Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file.\n' +
    'See .env.example for reference.'
  
  if (isProduction) {
    throw new Error(errorMessage)
  } else {
    console.error(errorMessage)
    console.warn('⚠️ App will use placeholder values in development. Set environment variables for full functionality.')
  }
}

// Validate URL format (only if variable exists)
if (hasSupabaseUrl && !EXPO_PUBLIC_SUPABASE_URL!.startsWith('https://')) {
  const error = 'EXPO_PUBLIC_SUPABASE_URL must be a valid HTTPS URL'
  if (isProduction) {
    throw new Error(error)
  } else {
    console.error('⚠️', error)
  }
}

// Validate key format (only if variable exists)
if (hasSupabaseKey && !EXPO_PUBLIC_SUPABASE_ANON_KEY!.startsWith('eyJ')) {
  const error = 'EXPO_PUBLIC_SUPABASE_ANON_KEY appears to be invalid (should start with eyJ)'
  if (isProduction) {
    throw new Error(error)
  } else {
    console.error('⚠️', error)
  }
}

// Use variables or fallback to placeholder values in development
const supabaseUrl = EXPO_PUBLIC_SUPABASE_URL || (isProduction ? '' : 'https://placeholder.supabase.co')
const supabaseAnonKey = EXPO_PUBLIC_SUPABASE_ANON_KEY || (isProduction ? '' : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTIwMDAsImV4cCI6MTk2MDc2ODAwMH0.placeholder')

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Android only, no URL detection needed
    storageKey: 'supabase.auth.token', // Explicit storage key
  },
  global: {
    headers: {
      'X-Client-Info': 'mescott-app',
    },
  },
  db: {
    schema: 'public',
  },
})

// Database types
export type { SimpleUserProfile } from '../types/SimpleUserProfile';

export interface ServiceCategory {
  id: string
  name: string
  icon: string
  description: string
}

export interface Booking {
  id: string
  customer_id: string
  technician_id?: string
  service_type: string
  description?: string
  scheduled_at?: string
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
  created_at: string
  updated_at: string
  location?: {
    address: string
    lat: number
    lng: number
  }
}

export interface Message {
  id: string
  task_id: string
  sender_id: string
  receiver_id: string
  content: string
  message_type: 'text' | 'image' | 'system'
  attachments?: string[]
  read_at?: string
  created_at: string
  sender_profile?: {
    username: string
    avatar_url?: string
  }
}