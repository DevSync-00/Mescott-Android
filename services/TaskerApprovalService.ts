import { supabase } from '../lib/supabase'

export interface TaskerApprovalData {
  applicationId: string
  adminId: string
  status: 'approved' | 'rejected'
  adminNotes?: string
}

export class TaskerApprovalService {
  // Get or create admin record for current user
  static async getOrCreateAdminRecord(userId: string, userEmail: string, userName: string): Promise<string | null> {
    try {
      // First try to find existing admin record by user_id
      const { data: existingAdmin, error: findError } = await supabase
        .from('admins')
        .select('id')
        .eq('user_id', userId)
        .single()

      if (existingAdmin && !findError) {
        return existingAdmin.id
      }

      // If not found, try to find by email
      const { data: emailAdmin, error: emailError } = await supabase
        .from('admins')
        .select('id')
        .eq('email', userEmail)
        .single()

      if (emailAdmin && !emailError) {
        return emailAdmin.id
      }

      // If still not found, create a new admin record
      const { data: newAdmin, error: createError } = await supabase
        .from('admins')
        .insert({
          user_id: userId,
          email: userEmail,
          full_name: userName,
          admin_level: 'admin',
          is_active: true
        })
        .select('id')
        .single()

      if (createError || !newAdmin) {
        console.error('Error creating admin record:', createError)
        return null
      }

      return newAdmin.id
    } catch (error) {
      console.error('Error in getOrCreateAdminRecord:', error)
      return null
    }
  }

  // Approve or reject a tasker application
  static async updateTaskerApplicationStatus(data: TaskerApprovalData): Promise<boolean> {
    try {
      const { applicationId, adminId, status, adminNotes } = data

      // First, verify the admin exists in the admins table
      const { data: adminData, error: adminError } = await supabase
        .from('admins')
        .select('id, full_name, email')
        .eq('id', adminId)
        .single()

      if (adminError || !adminData) {
        console.error('Admin not found:', adminError)
        return false
      }

      // Update the tasker application status
      const { error: applicationError } = await supabase
        .from('tasker_applications')
        .update({ 
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', applicationId)

      if (applicationError) {
        console.error('Error updating tasker application:', applicationError)
        return false
      }

      // Get the application details
      const { data: application, error: fetchError } = await supabase
        .from('tasker_applications')
        .select('profile_id, user_id, full_name')
        .eq('id', applicationId)
        .single()

      if (fetchError || !application) {
        console.error('Error fetching application details:', fetchError)
        return false
      }

      // Update the profile based on status
      if (status === 'approved') {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            role: 'both', // or 'tasker' depending on current role
            current_mode: 'tasker',
            tasker_application_status: 'approved',
            updated_at: new Date().toISOString()
          })
          .eq('id', application.profile_id)

        if (profileError) {
          console.error('Error updating profile:', profileError)
          return false
        }
      } else if (status === 'rejected') {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            tasker_application_status: 'rejected',
            updated_at: new Date().toISOString()
          })
          .eq('id', application.profile_id)

        if (profileError) {
          console.error('Error updating profile:', profileError)
          return false
        }
      }

      // Log admin activity with the verified admin ID
      const { error: logError } = await supabase
        .from('admin_activity_log')
        .insert({
          admin_id: adminData.id,
          action: `tasker_application_${status}`,
          resource_type: 'tasker_application',
          resource_id: applicationId,
          details: {
            user_id: application.user_id,
            profile_id: application.profile_id,
            full_name: application.full_name,
            status: status,
            admin_notes: adminNotes,
            admin_name: adminData.full_name,
            admin_email: adminData.email
          }
        })

      if (logError) {
        console.error('Error logging admin activity:', logError)
        // Don't return false here as the main operation succeeded
      }

      return true
    } catch (error) {
      console.error('Error in updateTaskerApplicationStatus:', error)
      return false
    }
  }

  // Get all pending tasker applications for admin review
  static async getPendingApplications(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('tasker_applications')
        .select(`
          *,
          profile:profiles!profile_id(
            id,
            full_name,
            username,
            phone,
            avatar_url,
            bio,
            location
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching pending applications:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error in getPendingApplications:', error)
      return []
    }
  }

  // Get tasker application by ID
  static async getTaskerApplication(applicationId: string): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .from('tasker_applications')
        .select(`
          *,
          profile:profiles!profile_id(
            id,
            full_name,
            username,
            phone,
            avatar_url,
            bio,
            location,
            role,
            current_mode,
            tasker_application_status
          )
        `)
        .eq('id', applicationId)
        .single()

      if (error) {
        console.error('Error fetching tasker application:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error in getTaskerApplication:', error)
      return null
    }
  }

  // Get all tasker applications (for admin dashboard)
  static async getAllApplications(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('tasker_applications')
        .select(`
          *,
          profile:profiles!profile_id(
            id,
            full_name,
            username,
            phone,
            avatar_url,
            bio,
            location,
            role,
            current_mode,
            tasker_application_status
          )
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching all applications:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error in getAllApplications:', error)
      return []
    }
  }
}
