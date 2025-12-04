import { AnalyticsService } from './AnalyticsService'
import { CrashReportingService } from './CrashReportingService'

export interface PerformanceMetric {
  id: string
  user_id?: string
  metric_name: string
  value: number
  unit: string
  timestamp: string
  context: Record<string, any>
}

export interface AppPerformance {
  app_start_time: number
  screen_load_times: Record<string, number>
  api_response_times: Record<string, number>
  memory_usage: number
  battery_usage: number
  network_requests: number
  errors_count: number
}

export class PerformanceMonitoringService {
  private static metrics: PerformanceMetric[] = []
  private static screenStartTimes: Record<string, number> = {}
  private static apiStartTimes: Record<string, number> = {}
  private static isInitialized = false

  // Initialize performance monitoring
  static initialize(): void {
    if (this.isInitialized) return

    // Set up performance monitoring
    this.setupPerformanceMonitoring()
    
    this.isInitialized = true
  }

  // Set up performance monitoring
  private static setupPerformanceMonitoring(): void {
    // Monitor app performance
    this.monitorAppPerformance()
    
    // Monitor memory usage
    this.monitorMemoryUsage()
    
    // Monitor network performance
    this.monitorNetworkPerformance()
  }

  // Track screen load time
  static startScreenLoad(screenName: string): void {
    this.screenStartTimes[screenName] = Date.now()
  }

  static endScreenLoad(screenName: string, userId?: string): void {
    const startTime = this.screenStartTimes[screenName]
    if (startTime) {
      const loadTime = Date.now() - startTime
      this.recordMetric('screen_load_time', loadTime, 'ms', {
        screen: screenName
      }, userId)
      
      // Report slow screen loads
      if (loadTime > 2000) { // 2 seconds threshold
        CrashReportingService.reportPerformanceIssue(
          'screen_load_time',
          loadTime,
          2000,
          { screen: screenName, user_id: userId }
        )
      }
    }
  }

  // Track API response time
  static startApiCall(endpoint: string): void {
    this.apiStartTimes[endpoint] = Date.now()
  }

  static endApiCall(endpoint: string, userId?: string): void {
    const startTime = this.apiStartTimes[endpoint]
    if (startTime) {
      const responseTime = Date.now() - startTime
      this.recordMetric('api_response_time', responseTime, 'ms', {
        endpoint
      }, userId)
      
      // Report slow API calls
      if (responseTime > 5000) { // 5 seconds threshold
        CrashReportingService.reportPerformanceIssue(
          'api_response_time',
          responseTime,
          5000,
          { screen: endpoint, user_id: userId }
        )
      }
    }
  }

  // Track user interaction response time
  static trackUserInteraction(
    action: string,
    startTime: number,
    endTime: number,
    userId?: string
  ): void {
    const responseTime = endTime - startTime
    this.recordMetric('user_interaction_time', responseTime, 'ms', {
      action
    }, userId)
    
    // Report slow interactions
    if (responseTime > 1000) { // 1 second threshold
      CrashReportingService.reportPerformanceIssue(
        'user_interaction_time',
        responseTime,
        1000,
        { screen: action, user_id: userId }
      )
    }
  }

  // Track memory usage
  static trackMemoryUsage(usage: number, userId?: string): void {
    this.recordMetric('memory_usage', usage, 'MB', {}, userId)
    
    // Report high memory usage
    if (usage > 100) { // 100MB threshold
      CrashReportingService.reportMemoryIssue(usage, 100, { user_id: userId })
    }
  }

  // Track battery usage
  static trackBatteryUsage(usage: number, userId?: string): void {
    this.recordMetric('battery_usage', usage, '%', {}, userId)
  }

  // Track network requests
  static trackNetworkRequest(
    url: string,
    method: string,
    status: number,
    responseTime: number,
    userId?: string
  ): void {
    this.recordMetric('network_request', responseTime, 'ms', {
      url,
      method,
      status
    }, userId)
  }

  // Track app startup time
  static trackAppStartup(startTime: number, endTime: number, userId?: string): void {
    const startupTime = endTime - startTime
    this.recordMetric('app_startup_time', startupTime, 'ms', {}, userId)
    
    // Report slow app startup
    if (startupTime > 3000) { // 3 seconds threshold
      CrashReportingService.reportPerformanceIssue(
        'app_startup_time',
        startupTime,
        3000,
        { user_id: userId }
      )
    }
  }

  // Track image load time
  static trackImageLoad(
    imageUrl: string,
    loadTime: number,
    userId?: string
  ): void {
    this.recordMetric('image_load_time', loadTime, 'ms', {
      image_url: imageUrl
    }, userId)
  }

  // Track payment processing time
  static trackPaymentProcessing(
    paymentId: string,
    processingTime: number,
    userId?: string
  ): void {
    this.recordMetric('payment_processing_time', processingTime, 'ms', {
      payment_id: paymentId
    }, userId)
  }

  // Track search performance
  static trackSearchPerformance(
    query: string,
    resultCount: number,
    searchTime: number,
    userId?: string
  ): void {
    this.recordMetric('search_time', searchTime, 'ms', {
      query,
      result_count: resultCount
    }, userId)
  }

  // Record a performance metric
  private static recordMetric(
    metricName: string,
    value: number,
    unit: string,
    context: Record<string, any> = {},
    userId?: string
  ): void {
    const metric: PerformanceMetric = {
      id: `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      user_id: userId,
      metric_name: metricName,
      value,
      unit,
      timestamp: new Date().toISOString(),
      context
    }

    this.metrics.push(metric)

    // Send to analytics
    AnalyticsService.trackAppPerformance(metricName, value, userId)

    // Keep only last 1000 metrics in memory
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000)
    }
  }

  // Monitor app performance
  private static monitorAppPerformance(): void {
    // Monitor app performance every 30 seconds
    setInterval(() => {
      this.collectAppPerformance()
    }, 30000)
  }

  // Monitor memory usage
  private static monitorMemoryUsage(): void {
    // Monitor memory usage every 60 seconds
    setInterval(() => {
      this.collectMemoryUsage()
    }, 60000)
  }

  // Monitor network performance
  private static monitorNetworkPerformance(): void {
    // This would monitor network performance
    // Implementation depends on your network setup
  }

  // Collect app performance data
  private static collectAppPerformance(): void {
    try {
      // This would collect actual performance data
      // For now, we'll use placeholder data
      const performance: AppPerformance = {
        app_start_time: 0,
        screen_load_times: {},
        api_response_times: {},
        memory_usage: 0,
        battery_usage: 0,
        network_requests: 0,
        errors_count: 0
      }

      // Send to analytics
      AnalyticsService.trackEvent('app_performance_collected', performance)
    } catch (error) {
      console.error('Error collecting app performance:', error)
    }
  }

  // Collect memory usage
  private static collectMemoryUsage(): void {
    try {
      // This would collect actual memory usage
      // For now, we'll use placeholder data
      const memoryUsage = 0 // This would be actual memory usage
      
      this.trackMemoryUsage(memoryUsage)
    } catch (error) {
      console.error('Error collecting memory usage:', error)
    }
  }

  // Get performance metrics
  static getPerformanceMetrics(): PerformanceMetric[] {
    return [...this.metrics]
  }

  // Get performance summary
  static getPerformanceSummary(): {
    total_metrics: number
    average_screen_load_time: number
    average_api_response_time: number
    average_memory_usage: number
    slowest_screen: string
    slowest_api: string
  } {
    const screenLoadTimes = this.metrics
      .filter(m => m.metric_name === 'screen_load_time')
      .map(m => m.value)

    const apiResponseTimes = this.metrics
      .filter(m => m.metric_name === 'api_response_time')
      .map(m => m.value)

    const memoryUsages = this.metrics
      .filter(m => m.metric_name === 'memory_usage')
      .map(m => m.value)

    const slowestScreen = this.metrics
      .filter(m => m.metric_name === 'screen_load_time')
      .reduce<PerformanceMetric | null>((max, current) => {
        if (!max || current.value > max.value) {
          return current
        }
        return max
      }, null)

    const slowestApi = this.metrics
      .filter(m => m.metric_name === 'api_response_time')
      .reduce<PerformanceMetric | null>((max, current) => {
        if (!max || current.value > max.value) {
          return current
        }
        return max
      }, null)

    return {
      total_metrics: this.metrics.length,
      average_screen_load_time: screenLoadTimes.length > 0 ? 
        screenLoadTimes.reduce((a, b) => a + b, 0) / screenLoadTimes.length : 0,
      average_api_response_time: apiResponseTimes.length > 0 ? 
        apiResponseTimes.reduce((a, b) => a + b, 0) / apiResponseTimes.length : 0,
      average_memory_usage: memoryUsages.length > 0 ? 
        memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length : 0,
      slowest_screen: slowestScreen?.context?.screen || 'Unknown',
      slowest_api: slowestApi?.context?.endpoint || 'Unknown'
    }
  }

  // Clear performance metrics
  static clearMetrics(): void {
    this.metrics = []
  }

  // Test performance monitoring
  static testPerformanceMonitoring(): void {
    if (__DEV__) {
      // Test screen load time
      this.startScreenLoad('test_screen')
      setTimeout(() => {
        this.endScreenLoad('test_screen')
      }, 100)

      // Test API call
      this.startApiCall('test_endpoint')
      setTimeout(() => {
        this.endApiCall('test_endpoint')
      }, 200)

      // Test user interaction
      const startTime = Date.now()
      setTimeout(() => {
        this.trackUserInteraction('test_action', startTime, Date.now())
      }, 50)
    }
  }
}
