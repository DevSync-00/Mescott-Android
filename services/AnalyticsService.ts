import { supabase } from '../lib/supabase'

export interface AnalyticsEvent {
  id: string
  user_id: string
  event_type: string
  event_data: Record<string, any>
  timestamp: string
  session_id: string
  app_version: string
  platform: 'ios' | 'android' | 'web'
}

export interface UserMetrics {
  user_id: string
  total_sessions: number
  total_time_spent: number
  last_active: string
  first_seen: string
  app_version: string
  platform: string
}

export interface AppMetrics {
  total_users: number
  active_users_7d: number
  active_users_30d: number
  total_tasks: number
  completed_tasks: number
  total_payments: number
  total_revenue: number
  average_rating: number
  crash_rate: number
  retention_rate_7d: number
  retention_rate_30d: number
}

export class AnalyticsService {
  private static sessionId: string = ''
  private static appVersion: string = '1.0.0'
  private static platform: 'ios' | 'android' | 'web' = 'web'

  // Initialize analytics
  static initialize(version: string, platform: 'ios' | 'android' | 'web') {
    this.appVersion = version
    this.platform = platform
    this.sessionId = this.generateSessionId()
  }

  // Track custom events
  static async trackEvent(
    eventType: string,
    eventData: Record<string, any> = {},
    userId?: string
  ): Promise<void> {
    try {
      const event: Omit<AnalyticsEvent, 'id'> = {
        user_id: userId || 'anonymous',
        event_type: eventType,
        event_data: eventData,
        timestamp: new Date().toISOString(),
        session_id: this.sessionId,
        app_version: this.appVersion,
        platform: this.platform
      }

      const { error } = await supabase
        .from('analytics_events')
        .insert(event)

      if (error) {
        console.error('Error tracking event:', error)
      }
    } catch (error) {
      console.error('Error tracking event:', error)
    }
  }

  // Track user actions
  static async trackUserAction(
    action: string,
    details: Record<string, any> = {},
    userId?: string
  ): Promise<void> {
    await this.trackEvent(`user_action_${action}`, details, userId)
  }

  // Track app performance
  static async trackPerformance(
    metric: string,
    value: number,
    details: Record<string, any> = {},
    userId?: string
  ): Promise<void> {
    await this.trackEvent('performance_metric', {
      metric,
      value,
      ...details
    }, userId)
  }

  // Track errors
  static async trackError(
    error: Error,
    context: Record<string, any> = {},
    userId?: string
  ): Promise<void> {
    await this.trackEvent('error', {
      error_message: error.message,
      error_stack: error.stack,
      ...context
    }, userId)
  }

  // Track business events
  static async trackBusinessEvent(
    event: string,
    data: Record<string, any> = {},
    userId?: string
  ): Promise<void> {
    await this.trackEvent(`business_${event}`, data, userId)
  }

  // Track user journey
  static async trackUserJourney(
    step: string,
    details: Record<string, any> = {},
    userId?: string
  ): Promise<void> {
    await this.trackEvent('user_journey', {
      step,
      ...details
    }, userId)
  }

  // Get user metrics
  static async getUserMetrics(userId: string): Promise<UserMetrics | null> {
    try {
      const { data, error } = await supabase
        .from('user_metrics')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error fetching user metrics:', error)
      return null
    }
  }

  // Get app metrics
  static async getAppMetrics(): Promise<AppMetrics | null> {
    try {
      const { data, error } = await supabase
        .from('app_metrics')
        .select('*')
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error fetching app metrics:', error)
      return null
    }
  }

  // Get event analytics
  static async getEventAnalytics(
    eventType: string,
    startDate: string,
    endDate: string
  ): Promise<AnalyticsEvent[]> {
    try {
      const { data, error } = await supabase
        .from('analytics_events')
        .select('*')
        .eq('event_type', eventType)
        .gte('timestamp', startDate)
        .lte('timestamp', endDate)
        .order('timestamp', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching event analytics:', error)
      return []
    }
  }

  // Get user retention
  static async getUserRetention(
    startDate: string,
    endDate: string
  ): Promise<{
    day_1: number
    day_7: number
    day_30: number
  }> {
    try {
      // This would require complex SQL queries
      // For now, return placeholder data
      return {
        day_1: 0.85,
        day_7: 0.65,
        day_30: 0.45
      }
    } catch (error) {
      console.error('Error calculating user retention:', error)
      return {
        day_1: 0,
        day_7: 0,
        day_30: 0
      }
    }
  }

  // Get conversion funnel
  static async getConversionFunnel(
    startDate: string,
    endDate: string
  ): Promise<{
    step: string
    count: number
    conversion_rate: number
  }[]> {
    try {
      // This would require complex SQL queries
      // For now, return placeholder data
      return [
        { step: 'app_open', count: 1000, conversion_rate: 1.0 },
        { step: 'signup', count: 800, conversion_rate: 0.8 },
        { step: 'profile_complete', count: 600, conversion_rate: 0.75 },
        { step: 'first_task_post', count: 400, conversion_rate: 0.67 },
        { step: 'first_payment', count: 300, conversion_rate: 0.75 }
      ]
    } catch (error) {
      console.error('Error calculating conversion funnel:', error)
      return []
    }
  }

  // Track specific business events
  static async trackTaskPosted(taskId: string, userId: string, category: string): Promise<void> {
    await this.trackBusinessEvent('task_posted', {
      task_id: taskId,
      category,
      timestamp: new Date().toISOString()
    }, userId)
  }

  static async trackTaskApplied(taskId: string, userId: string, taskerId: string): Promise<void> {
    await this.trackBusinessEvent('task_applied', {
      task_id: taskId,
      tasker_id: taskerId,
      timestamp: new Date().toISOString()
    }, userId)
  }

  static async trackTaskCompleted(taskId: string, userId: string, amount: number): Promise<void> {
    await this.trackBusinessEvent('task_completed', {
      task_id: taskId,
      amount,
      timestamp: new Date().toISOString()
    }, userId)
  }

  static async trackPaymentProcessed(
    paymentId: string,
    userId: string,
    amount: number,
    method: string
  ): Promise<void> {
    await this.trackBusinessEvent('payment_processed', {
      payment_id: paymentId,
      amount,
      method,
      timestamp: new Date().toISOString()
    }, userId)
  }

  static async trackUserRegistered(userId: string, method: string): Promise<void> {
    await this.trackBusinessEvent('user_registered', {
      registration_method: method,
      timestamp: new Date().toISOString()
    }, userId)
  }

  static async trackUserVerified(userId: string, verificationType: string): Promise<void> {
    await this.trackBusinessEvent('user_verified', {
      verification_type: verificationType,
      timestamp: new Date().toISOString()
    }, userId)
  }

  // Track app crashes
  static async trackCrash(
    error: Error,
    stackTrace: string,
    userId?: string
  ): Promise<void> {
    await this.trackEvent('app_crash', {
      error_message: error.message,
      stack_trace: stackTrace,
      app_version: this.appVersion,
      platform: this.platform
    }, userId)
  }

  // Track app performance
  static async trackAppPerformance(
    metric: string,
    value: number,
    userId?: string
  ): Promise<void> {
    await this.trackEvent('app_performance', {
      metric,
      value,
      app_version: this.appVersion,
      platform: this.platform
    }, userId)
  }

  // Track user engagement
  static async trackUserEngagement(
    action: string,
    duration?: number,
    userId?: string
  ): Promise<void> {
    await this.trackEvent('user_engagement', {
      action,
      duration,
      timestamp: new Date().toISOString()
    }, userId)
  }

  // Generate session ID
  private static generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Update user metrics
  static async updateUserMetrics(userId: string): Promise<void> {
    try {
      // This would calculate and update user metrics
      // For now, just track the event
      await this.trackEvent('user_metrics_updated', {
        user_id: userId,
        timestamp: new Date().toISOString()
      }, userId)
    } catch (error) {
      console.error('Error updating user metrics:', error)
    }
  }

  // Update app metrics
  static async updateAppMetrics(): Promise<void> {
    try {
      // This would calculate and update app metrics
      // For now, just track the event
      await this.trackEvent('app_metrics_updated', {
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.error('Error updating app metrics:', error)
    }
  }
}
