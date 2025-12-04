import { supabase } from '../lib/supabase'

export interface Report {
  id: string
  reporter_id: string
  reported_user_id?: string
  reported_task_id?: string
  report_type: 'inappropriate_content' | 'spam' | 'harassment' | 'fake_profile' | 'payment_issue' | 'safety_concern' | 'other'
  description: string
  status: 'pending' | 'under_review' | 'resolved' | 'dismissed'
  admin_notes?: string
  created_at: string
  updated_at: string
  // Additional context
  reported_content?: string
  evidence_urls?: string[]
  priority: 'low' | 'medium' | 'high' | 'urgent'
}

export interface ModerationAction {
  id: string
  report_id: string
  action_type: 'warning' | 'content_removal' | 'account_suspension' | 'account_ban' | 'payment_hold' | 'no_action'
  description: string
  admin_id: string
  created_at: string
  // Additional details
  duration_days?: number // For suspensions
  reason: string
}

export class ContentModerationService {
  // Submit a report
  static async submitReport(report: Omit<Report, 'id' | 'status' | 'created_at' | 'updated_at'>): Promise<Report | null> {
    try {
      const { data, error } = await supabase
        .from('reports')
        .insert({
          ...report,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error submitting report:', error)
      return null
    }
  }

  // Get reports for admin review
  static async getReports(
    status?: Report['status'],
    priority?: Report['priority'],
    limit = 50,
    offset = 0
  ): Promise<Report[]> {
    try {
      let query = supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (status) {
        query = query.eq('status', status)
      }

      if (priority) {
        query = query.eq('priority', priority)
      }

      const { data, error } = await query
      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching reports:', error)
      return []
    }
  }

  // Update report status
  static async updateReportStatus(
    reportId: string,
    status: Report['status'],
    adminNotes?: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('reports')
        .update({
          status,
          admin_notes: adminNotes,
          updated_at: new Date().toISOString()
        })
        .eq('id', reportId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error updating report status:', error)
      return false
    }
  }

  // Take moderation action
  static async takeModerationAction(action: Omit<ModerationAction, 'id' | 'created_at'>): Promise<boolean> {
    try {
      // Create the action record
      const { error: actionError } = await supabase
        .from('moderation_actions')
        .insert({
          ...action,
          created_at: new Date().toISOString()
        })

      if (actionError) throw actionError

      // Update report status
      await this.updateReportStatus(action.report_id, 'resolved')

      // Apply the action based on type
      await this.applyModerationAction(action)

      return true
    } catch (error) {
      console.error('Error taking moderation action:', error)
      return false
    }
  }

  // Apply moderation action to user/task
  private static async applyModerationAction(action: Omit<ModerationAction, 'id' | 'created_at'>): Promise<void> {
    try {
      // Get the report to understand what to moderate
      const { data: report, error: reportError } = await supabase
        .from('reports')
        .select('*')
        .eq('id', action.report_id)
        .single()

      if (reportError) throw reportError

      switch (action.action_type) {
        case 'warning':
          // Send warning notification to user
          await this.sendWarningNotification(report.reported_user_id, action.reason)
          break

        case 'content_removal':
          if (report.reported_task_id) {
            // Remove or hide the task
            await supabase
              .from('tasks')
              .update({ status: 'removed', updated_at: new Date().toISOString() })
              .eq('id', report.reported_task_id)
          }
          break

        case 'account_suspension':
          // Suspend user account
          const suspensionEnd = new Date()
          suspensionEnd.setDate(suspensionEnd.getDate() + (action.duration_days || 7))
          
          await supabase
            .from('profiles')
            .update({
              is_suspended: true,
              suspension_end: suspensionEnd.toISOString(),
              suspension_reason: action.reason,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', report.reported_user_id)
          break

        case 'account_ban':
          // Permanently ban user
          await supabase
            .from('profiles')
            .update({
              is_banned: true,
              ban_reason: action.reason,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', report.reported_user_id)
          break

        case 'payment_hold':
          // Hold payments for user
          await supabase
            .from('profiles')
            .update({
              payment_held: true,
              payment_hold_reason: action.reason,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', report.reported_user_id)
          break
      }
    } catch (error) {
      console.error('Error applying moderation action:', error)
    }
  }

  // Send warning notification
  private static async sendWarningNotification(userId: string, reason: string): Promise<void> {
    try {
      // This would integrate with your notification service
      console.log(`Sending warning to user ${userId}: ${reason}`)
      // Implementation would depend on your notification system
    } catch (error) {
      console.error('Error sending warning notification:', error)
    }
  }

  // Get user's report history
  static async getUserReportHistory(userId: string): Promise<Report[]> {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .or(`reporter_id.eq.${userId},reported_user_id.eq.${userId}`)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching user report history:', error)
      return []
    }
  }

  // Check if content violates community guidelines
  static async checkContentViolation(content: string): Promise<{
    isViolation: boolean
    violationType?: string
    confidence: number
  }> {
    // Basic keyword filtering - in production, you'd use AI/ML services
    const prohibitedWords = [
      'spam', 'scam', 'fake', 'illegal', 'harassment',
      'discrimination', 'hate speech', 'inappropriate'
    ]

    const lowerContent = content.toLowerCase()
    const foundViolations = prohibitedWords.filter(word => 
      lowerContent.includes(word)
    )

    return {
      isViolation: foundViolations.length > 0,
      violationType: foundViolations[0],
      confidence: foundViolations.length > 0 ? 0.8 : 0.1
    }
  }

  // Get moderation statistics
  static async getModerationStats(): Promise<{
    totalReports: number
    pendingReports: number
    resolvedReports: number
    reportsByType: Record<string, number>
  }> {
    try {
      const { data: reports, error } = await supabase
        .from('reports')
        .select('status, report_type')

      if (error) throw error

      const stats = {
        totalReports: reports?.length || 0,
        pendingReports: reports?.filter(r => r.status === 'pending').length || 0,
        resolvedReports: reports?.filter(r => r.status === 'resolved').length || 0,
        reportsByType: {} as Record<string, number>
      }

      // Count reports by type
      reports?.forEach(report => {
        stats.reportsByType[report.report_type] = (stats.reportsByType[report.report_type] || 0) + 1
      })

      return stats
    } catch (error) {
      console.error('Error fetching moderation stats:', error)
      return {
        totalReports: 0,
        pendingReports: 0,
        resolvedReports: 0,
        reportsByType: {}
      }
    }
  }
}
