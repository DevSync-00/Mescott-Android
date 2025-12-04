import { supabase } from '../lib/supabase'
import { SimpleUserProfile } from '../types/SimpleUserProfile'
import { handleError, formatPhoneNumber, isValidPhoneNumber } from '../utils/errorHandler'

// Alias for backward compatibility
export type Profile = SimpleUserProfile;

export class ProfileService {
  // Get user profile by ID
  static async getProfile(userId: string): Promise<Profile | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error getting profile:', error)
      return null
    }
  }

  // Create or update user profile
  static async upsertProfile(profileData: Partial<Profile>): Promise<Profile | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .upsert([profileData])
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error upserting profile:', error)
      throw error
    }
  }

  // Update profile
  static async updateProfile(userId: string, updates: Partial<Profile>): Promise<Profile | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error updating profile:', error)
      throw error
    }
  }

  // Verify phone number using Supabase OTP
  static async verifyPhoneNumber(phone: string, code: string): Promise<{ success: boolean, user?: any, error?: string }> {
    try {
      // Format phone number to E.164 format
      const formattedPhone = formatPhoneNumber(phone)
      
      // Verify OTP with Supabase
      const { data, error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: code,
        type: 'sms'
      })
      
      if (error) {
        return { success: false, error: error.message }
      }
      
      return { success: true, user: data.user }
    } catch (error) {
      console.error('Error verifying phone number:', error)
      return { success: false, error: 'Failed to verify phone number' }
    }
  }

  // Send phone verification code using Supabase OTP
  static async sendPhoneVerificationCode(phone: string): Promise<{ success: boolean, error?: string }> {
    try {
      // Format phone number to E.164 format
      const formattedPhone = formatPhoneNumber(phone)
      
      // Validate phone number
      if (!isValidPhoneNumber(formattedPhone)) {
        return { success: false, error: 'Invalid phone number format' }
      }

      // Simple approach - just send OTP without metadata to avoid trigger issues
      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone
      })
      
      if (error) {
        return { success: false, error: error.message }
      }
      
      return { success: true }
    } catch (error) {
      console.error('Error sending verification code:', error)
      return { success: false, error: 'Failed to send verification code' }
    }
  }

  // Get user by phone number
  static async getUserByPhone(phone: string): Promise<Profile | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('phone', phone)
        .single()

      if (error) {
        // If no rows found, return null instead of throwing
        if (error.code === 'PGRST116') {
          return null
        }
        throw error
      }
      return data
    } catch (error) {
      console.error('Error getting user by phone:', error)
      return null
    }
  }

  // Create user profile after phone verification
  // DEPRECATED: Profile creation is now handled only in SimpleAuthContext after OTP verification
  static async createUserProfile_DEPRECATED(userId: string, phone: string, fullName: string, username?: string): Promise<Profile | null> {
    try {
      const generatedUsername = username || `user_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
      
      const profileData = {
        id: userId,
        user_id: userId,  // ADD THIS LINE
        phone,
        full_name: fullName,
        username: generatedUsername,
        role: 'customer' as const,
        available: true,
        verification_status: 'verified' as const,
        phone_verified: true,
        total_tasks_completed: 0,
        rating_average: 0,
        rating_count: 0,
        completed_tasks: 0,
        experience_years: 0,
        average_rating: 0,
        total_reviews: 0,
        is_admin: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('profiles')
        .insert([profileData])
        .select()
        .single()

      if (error) {
        console.error('Error creating user profile:', error)
        // Return a temporary profile for now
        return {
          id: userId,
          user_id: userId,
          phone,
          full_name: fullName,
          username: generatedUsername,
          role: 'customer',
          current_mode: 'customer',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          name: fullName, // alias for compatibility
          profile: {
            full_name: fullName,
            username: generatedUsername,
            phone: phone,
          }
        } as Profile
      }
      return data
    } catch (error) {
      console.error('Error creating user profile:', error)
      // Return a temporary profile as fallback
      return {
        id: userId,
        user_id: userId,
        phone,
        full_name: fullName,
        username: username || `user_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        role: 'customer',
        current_mode: 'customer',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        name: fullName, // alias for compatibility
        profile: {
          full_name: fullName,
          username: username || `user_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          phone: phone,
        }
      } as Profile
    }
  }

  // Update user role
  static async updateUserRole(userId: string, role: 'customer' | 'tasker' | 'both'): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          role,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error updating user role:', error)
      return false
    }
  }

  // Get tasker profiles
  static async getTaskerProfiles(limit: number = 20): Promise<Profile[]> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['tasker', 'both'])
        .eq('available', true)
        .order('rating_average', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error getting tasker profiles:', error)
      return []
    }
  }

  // Search profiles
  static async searchProfiles(query: string, role?: 'customer' | 'tasker' | 'both'): Promise<Profile[]> {
    try {
      let queryBuilder = supabase
        .from('profiles')
        .select('*')
        .or(`full_name.ilike.%${query}%,username.ilike.%${query}%,bio.ilike.%${query}%`)

      if (role) {
        queryBuilder = queryBuilder.eq('role', role)
      }

      const { data, error } = await queryBuilder
        .order('rating_average', { ascending: false })
        .limit(20)

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error searching profiles:', error)
      return []
    }
  }

}
