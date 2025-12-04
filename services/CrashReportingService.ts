import { Alert } from 'react-native'
import { AnalyticsService } from './AnalyticsService'

export interface CrashReport {
  id: string
  user_id?: string
  error_message: string
  stack_trace: string
  app_version: string
  platform: string
  device_info: {
    model: string
    os_version: string
    memory: number
    storage: number
  }
  user_actions: string[]
  timestamp: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'new' | 'investigating' | 'resolved' | 'dismissed'
}

export interface ErrorContext {
  screen?: string
  action?: string
  user_id?: string
  session_id?: string
  additional_data?: Record<string, any>
  isFatal?: boolean
}

export class CrashReportingService {
  private static userActions: string[] = []
  private static maxUserActions = 50
  private static isInitialized = false

  // Initialize crash reporting
  static initialize(): void {
    if (this.isInitialized) return

    // Set up global error handlers
    this.setupGlobalErrorHandlers()
    
    // Set up unhandled promise rejection handler
    this.setupUnhandledRejectionHandler()
    
    this.isInitialized = true
  }

  // Set up global error handlers
  private static setupGlobalErrorHandlers(): void {
    // React Native error handler
    const originalHandler = ErrorUtils.getGlobalHandler()
    
    ErrorUtils.setGlobalHandler((error, isFatal) => {
      this.reportError(error, { isFatal })
      
      // Call original handler
      if (originalHandler) {
        originalHandler(error, isFatal)
      }
    })
  }

  // Set up unhandled promise rejection handler
  private static setupUnhandledRejectionHandler(): void {
    // This would be implemented based on your React Native version
    // For now, we'll handle it in try-catch blocks
  }

  // Report an error
  static async reportError(
    error: Error,
    context: ErrorContext = {}
  ): Promise<void> {
    try {
      const crashReport: Omit<CrashReport, 'id'> = {
        user_id: context.user_id,
        error_message: error.message,
        stack_trace: error.stack || 'No stack trace available',
        app_version: '1.0.0', // This should come from app config
        platform: 'react-native',
        device_info: await this.getDeviceInfo(),
        user_actions: [...this.userActions],
        timestamp: new Date().toISOString(),
        severity: this.determineSeverity(error, context),
        status: 'new'
      }

      // Send to analytics
      await AnalyticsService.trackCrash(error, crashReport.stack_trace, context.user_id)

      // Log to console in development
      if (__DEV__) {
        console.error('Crash Report:', crashReport)
      }

      // Show user-friendly error message
      this.showUserError(error, context)

    } catch (reportingError) {
      console.error('Failed to report crash:', reportingError)
    }
  }

  // Report a handled error
  static async reportHandledError(
    error: Error,
    context: ErrorContext = {}
  ): Promise<void> {
    try {
      await AnalyticsService.trackError(error, context, context.user_id)
      
      if (__DEV__) {
        console.warn('Handled Error:', error.message, context)
      }
    } catch (reportingError) {
      console.error('Failed to report handled error:', reportingError)
    }
  }

  // Track user actions for crash context
  static trackUserAction(action: string): void {
    this.userActions.push(`${new Date().toISOString()}: ${action}`)
    
    // Keep only the last N actions
    if (this.userActions.length > this.maxUserActions) {
      this.userActions = this.userActions.slice(-this.maxUserActions)
    }
  }

  // Get device information
  private static async getDeviceInfo(): Promise<CrashReport['device_info']> {
    try {
      // This would use device-specific APIs
      // For now, return placeholder data
      return {
        model: 'Unknown',
        os_version: 'Unknown',
        memory: 0,
        storage: 0
      }
    } catch (error) {
      return {
        model: 'Unknown',
        os_version: 'Unknown',
        memory: 0,
        storage: 0
      }
    }
  }

  // Determine error severity
  private static determineSeverity(
    error: Error,
    context: ErrorContext
  ): CrashReport['severity'] {
    // Critical errors that crash the app
    if (error.name === 'TypeError' && error.message.includes('Cannot read property')) {
      return 'critical'
    }

    // High severity errors
    if (error.name === 'NetworkError' || error.message.includes('network')) {
      return 'high'
    }

    // Medium severity errors
    if (error.name === 'ValidationError' || error.message.includes('validation')) {
      return 'medium'
    }

    // Low severity errors
    return 'low'
  }

  // Show user-friendly error message
  private static showUserError(error: Error, context: ErrorContext): void {
    let message = 'Something went wrong. Please try again.'
    let title = 'Error'

    // Customize message based on error type
    if (error.message.includes('network') || error.message.includes('fetch')) {
      title = 'Connection Error'
      message = 'Please check your internet connection and try again.'
    } else if (error.message.includes('payment')) {
      title = 'Payment Error'
      message = 'There was an issue processing your payment. Please try again.'
    } else if (error.message.includes('authentication')) {
      title = 'Authentication Error'
      message = 'Please log in again to continue.'
    }

    // Show alert
    Alert.alert(
      title,
      message,
      [
        {
          text: 'OK',
          onPress: () => {
            // Additional error handling if needed
          }
        }
      ]
    )
  }

  // Report performance issues
  static async reportPerformanceIssue(
    metric: string,
    value: number,
    threshold: number,
    context: ErrorContext = {}
  ): Promise<void> {
    try {
      await AnalyticsService.trackAppPerformance(metric, value, context.user_id)
      
      if (value > threshold) {
        await this.reportHandledError(
          new Error(`Performance issue: ${metric} = ${value} (threshold: ${threshold})`),
          context
        )
      }
    } catch (error) {
      console.error('Failed to report performance issue:', error)
    }
  }

  // Report memory issues
  static async reportMemoryIssue(
    memoryUsage: number,
    threshold: number,
    context: ErrorContext = {}
  ): Promise<void> {
    try {
      await this.reportPerformanceIssue(
        'memory_usage',
        memoryUsage,
        threshold,
        context
      )
    } catch (error) {
      console.error('Failed to report memory issue:', error)
    }
  }

  // Report network issues
  static async reportNetworkIssue(
    url: string,
    status: number,
    context: ErrorContext = {}
  ): Promise<void> {
    try {
      await this.reportHandledError(
        new Error(`Network error: ${url} returned ${status}`),
        {
          ...context,
          additional_data: { url, status }
        }
      )
    } catch (error) {
      console.error('Failed to report network issue:', error)
    }
  }

  // Report payment issues
  static async reportPaymentIssue(
    paymentId: string,
    error: Error,
    context: ErrorContext = {}
  ): Promise<void> {
    try {
      await this.reportHandledError(error, {
        ...context,
        additional_data: { payment_id: paymentId }
      })
    } catch (reportingError) {
      console.error('Failed to report payment issue:', reportingError)
    }
  }

  // Report user experience issues
  static async reportUXIssue(
    issue: string,
    screen: string,
    context: ErrorContext = {}
  ): Promise<void> {
    try {
      await this.reportHandledError(
        new Error(`UX Issue: ${issue}`),
        {
          ...context,
          screen,
          additional_data: { issue_type: 'ux' }
        }
      )
    } catch (error) {
      console.error('Failed to report UX issue:', error)
    }
  }

  // Clear user actions (call on app start)
  static clearUserActions(): void {
    this.userActions = []
  }

  // Get crash statistics
  static async getCrashStatistics(): Promise<{
    total_crashes: number
    crashes_by_severity: Record<string, number>
    crashes_by_platform: Record<string, number>
    recent_crashes: CrashReport[]
  }> {
    try {
      // This would query your crash reporting database
      // For now, return placeholder data
      return {
        total_crashes: 0,
        crashes_by_severity: {},
        crashes_by_platform: {},
        recent_crashes: []
      }
    } catch (error) {
      console.error('Failed to get crash statistics:', error)
      return {
        total_crashes: 0,
        crashes_by_severity: {},
        crashes_by_platform: {},
        recent_crashes: []
      }
    }
  }

  // Test crash reporting (for development)
  static async testCrashReporting(): Promise<void> {
    if (__DEV__) {
      try {
        throw new Error('Test crash for crash reporting system')
      } catch (error) {
        await this.reportError(error as Error, {
          screen: 'test',
          action: 'test_crash',
          additional_data: { test: true }
        })
      }
    }
  }
}
