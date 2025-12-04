import { supabase } from '../lib/supabase'
import { SimpleNotificationService } from './SimpleNotificationService'
import { UnifiedNotificationService } from './UnifiedNotificationService'
import { ProfileVerificationService } from './ProfileVerificationService'

export interface TaskerApplication {
  id: string
  user_id: string
  full_name: string
  email?: string
  phone: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
  date_of_birth?: string
  bio: string
  skills: string[]
  availability?: string[]
  certifications?: string[]
  experience_years: number
  emergency_contact_name?: string
  emergency_contact_phone?: string
  emergency_contact_relationship?: string
  id_front_url?: string
  id_back_url?: string
  skill_verifications?: { skill: string; level: string; documents: string[] }[]
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  updated_at: string
  // Additional fields for display
  user_name?: string
}

export class TaskerApplicationService {
  // Create a new tasker application or reapply if rejected
  static async createApplication(applicationData: Omit<TaskerApplication, 'id' | 'created_at' | 'updated_at' | 'user_name'>): Promise<TaskerApplication | null> {
    try {
      // First, get the profile_id for this user
      console.log('🔍 Fetching profile for user_id:', applicationData.user_id)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', applicationData.user_id)
        .single()

      if (profileError || !profile) {
        console.error('❌ Profile not found for user:', applicationData.user_id, profileError)
        throw new Error('User profile not found. Please complete your profile first.')
      }

      const profileId = profile.id
      console.log('✅ Found profile_id:', profileId)

      // Check if user already has an application
      const existingApplication = await this.getApplicationByUserId(applicationData.user_id)
      
      if (existingApplication) {
        if (existingApplication.status === 'rejected') {
          // Update existing rejected application
          const { data, error } = await supabase
            .from('tasker_applications')
            .update({
              ...applicationData,
              status: 'pending',
              updated_at: new Date().toISOString()
            })
            .eq('id', existingApplication.id)
            .select('*')
            .single()

          if (error) throw error

          // Update user profile with application status
          await supabase
            .from('profiles')
            .update({
              tasker_application_status: 'pending',
              updated_at: new Date().toISOString()
            })
            .eq('id', profileId)

          // Send notification to admins about reapplication
          try {
            const { data: adminIds } = await supabase
              .from('profiles')
              .select('id')
              .eq('role', 'admin')
              .eq('is_active', true)

            if (adminIds && adminIds.length > 0) {
              const adminIdList = adminIds.map(admin => admin.id)
              await UnifiedNotificationService.notifyTaskerApplicationSubmitted(
                data.id,
                applicationData.full_name,
                adminIdList
              )
              console.log('🚀 TASKER APPLICATION SERVICE - Reapplication notification sent for:', data.id)
            }
          } catch (notificationError) {
            console.error('Error sending reapplication notification:', notificationError)
          }

          return {
            ...data,
            user_name: applicationData.full_name
          }
        } else {
          throw new Error('User already has a pending or approved tasker application')
        }
      }

      // Create new application with profile_id
      console.log('📝 Creating new application with profile_id:', profileId)
      const { data, error } = await supabase
        .from('tasker_applications')
        .insert([{
          ...applicationData,
          profile_id: profileId
        }])
        .select('*')
        .single()

      if (error) throw error

      // Update user profile with application status
      console.log('🔄 Updating profile with application status')
      await supabase
        .from('profiles')
        .update({
          tasker_application_status: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', profileId)

      // Send notification to admins about new application
      try {
        const { data: adminIds } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'admin')
          .eq('is_active', true)

        if (adminIds && adminIds.length > 0) {
          const adminIdList = adminIds.map(admin => admin.id)
          await UnifiedNotificationService.notifyTaskerApplicationSubmitted(
            data.id,
            applicationData.full_name,
            adminIdList
          )
          console.log('🚀 TASKER APPLICATION SERVICE - New application notification sent for:', data.id)
        }
      } catch (notificationError) {
        console.error('Error sending new application notification:', notificationError)
      }

      return {
        ...data,
        user_name: applicationData.full_name
      }
    } catch (error) {
      console.error('Error creating tasker application:', error)
      throw error
    }
  }

  static async getApplicationRequirements(userId: string): Promise<{
    missingRequirements: string[]
    completedRequirements: string[]
  }> {
    try {
      const { missing } = await ProfileVerificationService.checkVerificationRequirements(userId, 'tasker')

      return {
        missingRequirements: missing,
        completedRequirements: missing.length === 0 ? ['All requirements met'] : [],
      }
    } catch (error) {
      console.error('Error fetching application requirements:', error)
      return {
        missingRequirements: ['Unable to determine requirements. Please retry.'],
        completedRequirements: [],
      }
    }
  }

  // Get all tasker applications (admin function)
  static async getAllApplications(): Promise<TaskerApplication[]> {
    try {
      const { data, error } = await supabase
        .from('tasker_applications')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error getting all applications:', error)
      return []
    }
  }

  // Get application by user ID
  static async getApplicationByUserId(userId: string): Promise<TaskerApplication | null> {
    try {
      const { data, error } = await supabase
        .from('tasker_applications')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error getting application by user ID:', error)
      return null
    }
  }

  // Update application status with verification integration
  static async updateApplicationStatus(applicationId: string, status: TaskerApplication['status']): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('tasker_applications')
        .update({
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', applicationId)

      if (error) throw error

      // Get application details for notification
      const { data: application } = await supabase
        .from('tasker_applications')
        .select('user_id, full_name, skills')
        .eq('id', applicationId)
        .single()

      if (application) {
        // Update user profile
        await supabase
          .from('profiles')
          .update({ 
            tasker_application_status: status,
            role: status === 'approved' ? 'both' : 'customer',
            updated_at: new Date().toISOString()
          })
          .eq('id', application.user_id)

        // Send notifications based on application status
        if (status === 'approved') {
          await SimpleNotificationService.notifyTaskerApproved(application.user_id, application.full_name)
          await UnifiedNotificationService.notifyTaskerApplicationApproved(application.user_id, application.full_name)
        } else if (status === 'rejected') {
          await SimpleNotificationService.notifyTaskerRejected(application.user_id, application.full_name)
          await UnifiedNotificationService.notifyTaskerApplicationRejected(application.user_id, application.full_name)
        }
      }

      return true
    } catch (error) {
      console.error('Error updating application status:', error)
      return false
    }
  }

  // Approve application
  static async approveApplication(applicationId: string): Promise<boolean> {
    return await this.updateApplicationStatus(applicationId, 'approved')
  }

  // Reject application
  static async rejectApplication(applicationId: string): Promise<boolean> {
    return await this.updateApplicationStatus(applicationId, 'rejected')
  }

  // Listen for tasker application status changes
  static subscribeToApplicationStatus(userId: string, onStatusChange: (status: string) => void) {
    const subscription = supabase
      .channel('tasker_application_status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasker_applications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const newStatus = payload.new.status
          onStatusChange(newStatus)
        }
      )
      .subscribe()

    return subscription
  }

  // Listen for profile changes (role updates)
  static subscribeToProfileChanges(userId: string, onProfileChange: (profile: any) => void) {
    console.log('Setting up profile subscription for user:', userId);
    
    const subscription = supabase
      .channel('profile_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`
        },
        (payload) => {
          console.log('Profile change detected:', payload);
          onProfileChange(payload.new)
        }
      )
      .subscribe((status) => {
        console.log('Profile subscription status:', status);
      })

    return subscription
  }

  // Get application statistics
  static async getApplicationStats(): Promise<{
    total: number
    pending: number
    approved: number
    rejected: number
  }> {
    try {
      const { data, error } = await supabase
        .from('tasker_applications')
        .select('status')

      if (error) throw error

      const stats = {
        total: data.length,
        pending: data.filter(app => app.status === 'pending').length,
        approved: data.filter(app => app.status === 'approved').length,
        rejected: data.filter(app => app.status === 'rejected').length,
      }

      return stats
    } catch (error) {
      console.error('Error getting application stats:', error)
      return {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
      }
    }
  }

  // Delete application
  static async deleteApplication(applicationId: string): Promise<boolean> {
    try {
      // First get the user_id before deleting
      const { data: application } = await supabase
        .from('tasker_applications')
        .select('user_id')
        .eq('id', applicationId)
        .single()

      if (!application) {
        console.error('Application not found')
        return false
      }

      // Delete the application
      const { error } = await supabase
        .from('tasker_applications')
        .delete()
        .eq('id', applicationId)

      if (error) throw error

      // Clear the profile status since application is deleted
      await supabase
        .from('profiles')
        .update({
          tasker_application_status: null,
          role: 'customer',
          current_mode: 'customer',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', application.user_id)

      return true
    } catch (error) {
      console.error('Error deleting application:', error)
      return false
    }
  }

  // Check if user can apply to become tasker
  static async canUserApplyToBeTasker(userId: string): Promise<{
    canApply: boolean
    reasons: string[]
  }> {
    try {
      // Check if user already has an application
      const existingApplication = await this.getApplicationByUserId(userId)
      if (existingApplication && existingApplication.status !== 'rejected') {
        return {
          canApply: false,
          reasons: ['User already has a pending or approved tasker application']
        }
      }

      return {
        canApply: true,
        reasons: []
      }
    } catch (error) {
      console.error('Error checking if user can apply:', error)
      return {
        canApply: false,
        reasons: ['Error checking application eligibility']
      }
    }
  }
}