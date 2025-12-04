import { supabase } from '../lib/supabase'

export interface TaskerApplicationStatus {
  application_id: string
  status: string
  profile_id: string
  profile_role: string
  profile_current_mode: string
  created_at: string
  updated_at: string
}

export class ProfileSyncService {
  // Get tasker application status for a user
  static async getUserTaskerApplicationStatus(userId: string): Promise<TaskerApplicationStatus | null> {
    try {
      const { data, error } = await supabase
        .from('tasker_applications')
        .select(`
          id,
          status,
          profile_id,
          created_at,
          updated_at,
          profiles!tasker_applications_profile_id_fkey (
            role,
            current_mode
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows found
          return null
        }
        console.error('Error fetching tasker application status:', error)
        return null
      }

      const profileData = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles

      return {
        application_id: data.id,
        status: data.status,
        profile_id: data.profile_id,
        profile_role: profileData?.role || 'customer',
        profile_current_mode: profileData?.current_mode || 'customer',
        created_at: data.created_at,
        updated_at: data.updated_at,
      }
    } catch (error) {
      console.error('Error fetching tasker application status:', error)
      return null
    }
  }

  // Get tasker applications with profile data
  static async getTaskerApplicationsWithProfiles() {
    try {
      const { data, error } = await supabase
        .from('tasker_applications_with_profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching tasker applications with profiles:', error)
        return []
      }

      return data
    } catch (error) {
      console.error('Error fetching tasker applications with profiles:', error)
      return []
    }
  }

  // Update tasker application status (for admin use)
  static async updateTaskerApplicationStatus(applicationId: string, status: string, adminId?: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('tasker_applications')
        .update({ 
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', applicationId)

      if (error) {
        console.error('Error updating tasker application status:', error)
        return false
      }

      // Log admin activity if adminId is provided
      if (adminId && status === 'approved') {
        await supabase
          .from('admin_activity_log')
          .insert({
            admin_id: adminId,
            action: 'tasker_application_approved',
            resource_type: 'tasker_application',
            resource_id: applicationId,
            details: {
              approved_at: new Date().toISOString(),
              status: status
            }
          })
      }

      return true
    } catch (error) {
      console.error('Error updating tasker application status:', error)
      return false
    }
  }

  // Get pending tasker applications for admin review
  static async getPendingTaskerApplications() {
    try {
      const { data, error } = await supabase
        .from('tasker_applications_with_profiles')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching pending tasker applications:', error)
        return []
      }

      return data
    } catch (error) {
      console.error('Error fetching pending tasker applications:', error)
      return []
    }
  }

  // Get approved taskers
  static async getApprovedTaskers() {
    try {
      const { data, error } = await supabase
        .from('tasker_applications_with_profiles')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching approved taskers:', error)
        return []
      }

      return data
    } catch (error) {
      console.error('Error fetching approved taskers:', error)
      return []
    }
  }

  // Check if user has approved tasker application
  static async isUserApprovedTasker(userId: string): Promise<boolean> {
    try {
      const status = await this.getUserTaskerApplicationStatus(userId)
      return status?.status === 'approved'
    } catch (error) {
      console.error('Error checking if user is approved tasker:', error)
      return false
    }
  }

  // Get user's current role and mode
  static async getUserRoleAndMode(userId: string): Promise<{ role: string; current_mode: string } | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role, current_mode')
        .eq('user_id', userId)
        .single()

      if (error) {
        console.error('Error fetching user role and mode:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error fetching user role and mode:', error)
      return null
    }
  }

  // Sync profile with tasker application status
  static async syncProfileWithTaskerApplication(userId: string): Promise<boolean> {
    try {
      const status = await this.getUserTaskerApplicationStatus(userId)
      
      if (!status) {
        // No tasker application found, reset profile status
        const { error } = await supabase
          .from('profiles')
          .update({
            tasker_application_status: null,
            role: 'customer',
            current_mode: 'customer',
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)

        if (error) {
          console.error('Error resetting profile status:', error)
          return false
        }
        return true
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          tasker_application_status: status.status,
          role: status.profile_role,
          current_mode: status.profile_current_mode,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)

      if (error) {
        console.error('Error syncing profile with tasker application:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error syncing profile with tasker application:', error)
      return false
    }
  }

  // Clear tasker application status when application is deleted
  static async clearTaskerApplicationStatus(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          tasker_application_status: null,
          role: 'customer',
          current_mode: 'customer',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)

      if (error) {
        console.error('Error clearing tasker application status:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error clearing tasker application status:', error)
      return false
    }
  }
}
