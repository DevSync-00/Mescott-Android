import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { SimpleNotificationService } from './SimpleNotificationService'
import type { NotificationPermissionsStatus } from 'expo-notifications'

type IOSPermissionShape = NonNullable<NotificationPermissionsStatus['ios']>

// Lazy-load expo-notifications to avoid side effects in Expo Go (SDK 53)
let Notifications: typeof import('expo-notifications') | null = null
const shouldDisablePushInExpoGo = () => Constants.appOwnership === 'expo'
const getNotifications = async (): Promise<typeof import('expo-notifications') | null> => {
  if (shouldDisablePushInExpoGo()) {
    return null
  }
  if (!Notifications) {
    Notifications = await import('expo-notifications')
  }
  return Notifications
}

// Configure notification behavior (only when notifications are available)
;(async () => {
  const N = await getNotifications()
  if (N) {
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    })
  }
})()

export interface PushNotificationData {
  type: 'task' | 'message' | 'application' | 'booking' | 'payment' | 'system'
  taskId?: string
  chatId?: string
  userId?: string
  title: string
  body: string
  data?: any
}

export class PushNotificationService {
  private static expoPushToken: string | null = null

  // Register for push notifications
  static async registerForPushNotifications(): Promise<string | null> {
    if (shouldDisablePushInExpoGo()) {
      console.warn('Push registration disabled in Expo Go. Use a development build for push notifications.')
      return null
    }

    const N = await getNotifications()
    if (!N) return null

    if (!Device.isDevice) {
      console.log('Must use physical device for Push Notifications')
      return null
    }

    const { status: existingStatus } = await N.getPermissionsAsync()
    let finalStatus = existingStatus

    if (existingStatus !== 'granted') {
      const { status } = await N.requestPermissionsAsync()
      finalStatus = status
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!')
      return null
    }

    try {
      // Check if we have a valid projectId
      const projectId = Constants.expoConfig?.extra?.eas?.projectId
      if (!projectId || projectId === 'your-project-id-here' || projectId === 'default') {
        console.warn('Invalid or missing projectId. Push notifications may not work properly.')
        console.warn('Please configure a valid EAS projectId in app.json')
        return null
      }

      const token = await N.getExpoPushTokenAsync({
        projectId: projectId,
      })
      
      this.expoPushToken = token.data
      console.log('Push token:', this.expoPushToken)
      return this.expoPushToken
    } catch (error) {
      console.error('Error getting push token:', error)
      return null
    }
  }

  // Get the current push token
  static getPushToken(): string | null {
    return this.expoPushToken
  }

  // Send a local notification
  static async sendLocalNotification(
    title: string,
    body: string,
    data?: any
  ): Promise<void> {
    try {
      const N = await getNotifications()
      if (!N) return
      await N.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: 'default',
        },
        trigger: null, // Show immediately
      })
    } catch (error) {
      console.error('Error sending local notification:', error)
    }
  }

  // Send a scheduled notification
  static async sendScheduledNotification(
    title: string,
    body: string,
    triggerDate: Date,
    data?: any
  ): Promise<void> {
    try {
      const N = await getNotifications()
      if (!N) return
      await N.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: 'default',
        },
        trigger: null, // Show immediately for now
      })
    } catch (error) {
      console.error('Error sending scheduled notification:', error)
    }
  }

  // Send push notification to specific user
  static async sendPushNotification(
    expoPushToken: string,
    title: string,
    body: string,
    data?: any
  ): Promise<boolean> {
    try {
      const message = {
        to: expoPushToken,
        sound: 'default',
        title,
        body,
        data,
      }

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      })

      const result = await response.json()
      console.log('Push notification sent:', result)
      return result.data?.status === 'ok'
    } catch (error) {
      console.error('Error sending push notification:', error)
      return false
    }
  }

  // Create notification for new task
  static async createTaskNotification(
    taskTitle: string,
    taskId: string,
    customerName: string,
    message?: string
  ): Promise<void> {
    const defaultTitle = 'New Task Available'
    const defaultBody = `${customerName} posted: "${taskTitle}"`
    const title = message ? 'Task Update' : defaultTitle
    const body = message ?? defaultBody

    if (message) {
      await SimpleNotificationService.addNotification(
        'Task Update',
        message,
        'task',
        { taskTitle, taskId }
      )
    } else {
      await SimpleNotificationService.createTaskNotification(taskTitle, 'created')
    }

    await this.sendLocalNotification(title, body, {
      type: 'task',
      taskId,
      taskTitle,
      customerName,
    })
  }

  // Create notification for new message
  static async createMessageNotification(
    senderName: string,
    message: string,
    taskTitle: string,
    taskId: string
  ): Promise<void> {
    const title = `New message from ${senderName}`
    const body = message.length > 50 ? `${message.substring(0, 50)}...` : message
    
    // Add to local notifications
    await SimpleNotificationService.createMessageNotification(senderName, message, taskTitle)
    
    // Send local push notification
    await this.sendLocalNotification(title, body, {
      type: 'message',
      taskId,
      taskTitle,
      senderName,
    })
  }

  // Create notification for task application
  static async createApplicationNotification(
    taskerName: string,
    taskTitle: string,
    taskId: string
  ): Promise<void> {
    const title = 'New Application'
    const body = `${taskerName} applied for "${taskTitle}"`
    
    // Add to local notifications
    await SimpleNotificationService.createApplicationNotification(taskTitle, 'received', taskerName)
    
    // Send local push notification
    await this.sendLocalNotification(title, body, {
      type: 'application',
      taskId,
      taskTitle,
      taskerName,
    })
  }

  // Create notification for booking update
  static async createBookingNotification(
    taskTitle: string,
    status: 'scheduled' | 'confirmed' | 'cancelled',
    taskId: string
  ): Promise<void> {
    const statusMessages = {
      scheduled: 'Your task has been scheduled',
      confirmed: 'Your booking has been confirmed',
      cancelled: 'Your booking has been cancelled'
    }
    
    const title = 'Booking Update'
    const body = `${statusMessages[status]}: "${taskTitle}"`
    
    // Add to local notifications
    await SimpleNotificationService.createBookingNotification(taskTitle, status)
    
    // Send local push notification
    await this.sendLocalNotification(title, body, {
      type: 'booking',
      taskId,
      taskTitle,
      status,
    })
  }

  // Create notification for payment
  static async createPaymentNotification(
    amount: number,
    type: 'received' | 'sent' | 'refunded',
    taskTitle?: string,
    taskId?: string
  ): Promise<void> {
    const typeMessages = {
      received: `You received ${amount} ETB`,
      sent: `You sent ${amount} ETB`,
      refunded: `You received a refund of ${amount} ETB`
    }
    
    const title = 'Payment Update'
    const body = taskTitle ? `${typeMessages[type]} for "${taskTitle}"` : typeMessages[type]
    
    // Add to local notifications
    await SimpleNotificationService.createPaymentNotification(amount, type, taskTitle)
    
    // Send local push notification
    await this.sendLocalNotification(title, body, {
      type: 'payment',
      taskId,
      taskTitle,
      amount,
      paymentType: type,
    })
  }

  // Cancel all notifications
  static async cancelAllNotifications(): Promise<void> {
    try {
      const N = await getNotifications()
      if (!N) return
      await N.cancelAllScheduledNotificationsAsync()
    } catch (error) {
      console.error('Error canceling notifications:', error)
    }
  }

  // Get notification permissions status
  static async getPermissionsStatus(): Promise<NotificationPermissionsStatus> {
    const N = await getNotifications()
    if (!N) {
      const fallbackIos: IOSPermissionShape = {
        status: 'undetermined' as unknown as IOSPermissionShape['status'],
        allowsAlert: false,
        allowsBadge: false,
        allowsSound: false,
        allowsCriticalAlerts: false,
        allowsDisplayInCarPlay: false,
        allowsDisplayInNotificationCenter: false,
        allowsDisplayOnLockScreen: false,
        alertStyle: 'banner' as unknown as IOSPermissionShape['alertStyle'],
        allowsAnnouncements: false,
      }

      return {
        status: 'undetermined' as NotificationPermissionsStatus['status'],
        canAskAgain: false,
        granted: false,
        expires: 'never',
        ios: fallbackIos,
      }
    }
    return await N.getPermissionsAsync()
  }

  // Request notification permissions
  static async requestPermissions(): Promise<boolean> {
    const N = await getNotifications()
    if (!N) return false
    const { status } = await N.requestPermissionsAsync()
    return status === 'granted'
  }

  // Set up notification listeners
  static setupNotificationListeners() {
    if (shouldDisablePushInExpoGo()) {
      return { notificationListener: null, responseListener: null }
    }

    // Set up listeners lazily
    let notificationListener: any = null
    let responseListener: any = null

    getNotifications().then(N => {
      if (!N) return
      // Handle notifications received while app is foregrounded
      notificationListener = N.addNotificationReceivedListener(notification => {
        console.log('Notification received:', notification)
      })

      // Handle notification responses (when user taps notification)
      responseListener = N.addNotificationResponseReceivedListener(response => {
        console.log('Notification response:', response)
        const data = response.notification.request.content.data
        
        // Handle navigation based on notification type
        if (data?.type === 'message' && data?.taskId) {
          // Navigate to chat
          // This would need to be implemented with navigation context
        } else if (data?.type === 'task' && data?.taskId) {
          // Navigate to task detail
          // This would need to be implemented with navigation context
        }
      })
    })

    return { notificationListener, responseListener }
  }
}
