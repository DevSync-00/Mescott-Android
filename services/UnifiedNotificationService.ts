import { supabase } from '../lib/supabase'
import { PushNotificationService } from './PushNotificationService'
import { SimpleNotificationService } from './SimpleNotificationService'

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: 'task' | 'message' | 'application' | 'booking' | 'payment' | 'system'
  data?: any
  is_read: boolean
  created_at: string
  updated_at: string
}

export interface NotificationSubscription {
  onNotification: (notification: Notification) => void
  onUnreadCountChange: (count: number) => void
}

export class UnifiedNotificationService {
  private static subscriptions: Set<NotificationSubscription> = new Set()
  private static isSubscribed = false
  private static currentUserId: string | null = null

  // Helper method to get auth user ID from profile ID
  private static async getAuthUserIdFromProfileId(profileId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('id', profileId)
        .single()

      if (error) {
        console.error('Error getting auth user ID from profile ID:', error)
        return null
      }

      const authUserId = data?.user_id
      if (!authUserId) {
        console.error('No auth user ID found for profile:', profileId)
        return null
      }

      // Verify that the auth user ID actually exists in auth.users
      // Note: We can't directly query auth.users from the client, so we'll skip this validation
      // and rely on the database foreign key constraint to handle invalid user IDs
      return authUserId
    } catch (error) {
      console.error('Error getting auth user ID from profile ID:', error)
      return null
    }
  }

  // Initialize notification service
  static async initialize(userId: string): Promise<void> {
    try {
      this.currentUserId = userId
      
      // Register for push notifications
      await PushNotificationService.registerForPushNotifications()
      
      // Subscribe to real-time notifications
      await this.subscribeToNotifications()
      
    } catch (error) {
      console.error('Error initializing notification service:', error)
    }
  }

  // Subscribe to real-time notifications
  static async subscribeToNotifications(): Promise<void> {
    if (!this.currentUserId || this.isSubscribed) return

    try {
      const channel = supabase
        .channel('notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${this.currentUserId}`
          },
          (payload) => {
            const notification = payload.new as Notification
            
            // Send push notification
            this.sendPushNotification(notification)
            
            // Notify subscribers
            this.notifySubscribers(notification)
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${this.currentUserId}`
          },
          (payload) => {
            const notification = payload.new as Notification
            
            // Notify subscribers
            this.notifySubscribers(notification)
          }
        )
        .subscribe()

      this.isSubscribed = true
    } catch (error) {
      console.error('Error subscribing to notifications:', error)
    }
  }

  // Unsubscribe from notifications
  static async unsubscribe(): Promise<void> {
    try {
      await supabase.removeChannel(supabase.channel('notifications'))
      this.isSubscribed = false
      this.subscriptions.clear()
      this.currentUserId = null
    } catch (error) {
      console.error('Error unsubscribing from notifications:', error)
    }
  }

  // Add a subscription
  static addSubscription(subscription: NotificationSubscription): void {
    this.subscriptions.add(subscription)
  }

  // Remove a subscription
  static removeSubscription(subscription: NotificationSubscription): void {
    this.subscriptions.delete(subscription)
  }

  // Notify all subscribers
  private static notifySubscribers(notification: Notification): void {
    this.subscriptions.forEach(sub => {
      try {
        sub.onNotification(notification)
      } catch (error) {
        console.error('Error notifying subscriber:', error)
      }
    })
  }

  // Send push notification
  private static async sendPushNotification(notification: Notification): Promise<void> {
    try {
      await PushNotificationService.sendLocalNotification(
        notification.title,
        notification.message,
        {
          type: notification.type,
          data: notification.data,
          notificationId: notification.id
        }
      )
    } catch (error) {
      console.error('Error sending push notification:', error)
    }
  }

  // Get all notifications for user
  static async getNotifications(userId: string, limit: number = 50): Promise<Notification[]> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error getting notifications:', error)
      return []
    }
  }

  // Get unread count
  static async getUnreadCount(userId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false)

      if (error) throw error
      return count || 0
    } catch (error) {
      console.error('Error getting unread count:', error)
      return 0
    }
  }

  // Mark notification as read
  static async markAsRead(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ 
          is_read: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', notificationId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error marking notification as read:', error)
      return false
    }
  }

  // Mark all notifications as read
  static async markAllAsRead(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ 
          is_read: true,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('is_read', false)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
      return false
    }
  }

  // Create a notification
  static async createNotification(
    userId: string,
    title: string,
    message: string,
    type: Notification['type'] = 'system',
    data?: any
  ): Promise<boolean> {
    try {
      
      // Note: We can't directly query auth.users from the client
      // The database foreign key constraint will handle invalid user IDs
      
      const { data: result, error } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          title,
          message,
          type,
          data: data || {},
          is_read: false
        })
        .select('id')

      if (error) {
        console.error('❌ UNIFIED NOTIFICATION SERVICE - Database error:', error)
        throw error
      }
      
      return true
    } catch (error) {
      console.error('❌ UNIFIED NOTIFICATION SERVICE - Error creating notification:', error)
      return false
    }
  }

  // ===== TASK-RELATED NOTIFICATIONS =====

  // Notify when a new task is posted (for taskers)
  static async notifyNewTaskPosted(taskId: string, taskTitle: string, customerName: string, taskerIds: string[]): Promise<void> {
    const promises = []
    
    for (const taskerId of taskerIds) {
      // Convert profile ID to auth user ID
      const authUserId = await this.getAuthUserIdFromProfileId(taskerId)
      if (authUserId) {
        promises.push(
          this.createNotification(
            authUserId,
            'New Task Available!',
            `${customerName} posted a new task: "${taskTitle}"`,
            'task',
            { task_id: taskId, action: 'new_task' }
          )
        )
      } else {
        console.error('❌ UNIFIED NOTIFICATION SERVICE - Could not get auth user ID for tasker profile:', taskerId)
      }
    }
    
    await Promise.all(promises)
  }

  // Notify when task is updated
  static async notifyTaskUpdated(taskId: string, taskTitle: string, customerId: string, taskerId?: string): Promise<void> {
    const promises = []
    
    // Convert customer profile ID to auth user ID
    const customerAuthId = await this.getAuthUserIdFromProfileId(customerId)
    if (customerAuthId) {
      promises.push(
        this.createNotification(
          customerAuthId,
          'Task Updated',
          `Your task "${taskTitle}" has been updated`,
          'task',
          { task_id: taskId, action: 'task_updated' }
        )
      )
    } else {
      console.error('❌ UNIFIED NOTIFICATION SERVICE - Could not get auth user ID for customer profile:', customerId)
    }

    // Notify tasker if assigned
    if (taskerId) {
      const taskerAuthId = await this.getAuthUserIdFromProfileId(taskerId)
      if (taskerAuthId) {
        promises.push(
          this.createNotification(
            taskerAuthId,
            'Task Updated',
            `Task "${taskTitle}" has been updated`,
            'task',
            { task_id: taskId, action: 'task_updated' }
          )
        )
      } else {
        console.error('❌ UNIFIED NOTIFICATION SERVICE - Could not get auth user ID for tasker profile:', taskerId)
      }
    }

    await Promise.all(promises)
  }

  // Notify when task is cancelled
  static async notifyTaskCancelled(taskId: string, taskTitle: string, customerId: string, taskerId?: string): Promise<void> {
    const promises = []
    
    // Convert customer profile ID to auth user ID
    const customerAuthId = await this.getAuthUserIdFromProfileId(customerId)
    if (customerAuthId) {
      promises.push(
        this.createNotification(
          customerAuthId,
          'Task Cancelled',
          `Your task "${taskTitle}" has been cancelled`,
          'task',
          { task_id: taskId, action: 'task_cancelled' }
        )
      )
    } else {
      console.error('❌ UNIFIED NOTIFICATION SERVICE - Could not get auth user ID for customer profile:', customerId)
    }

    // Notify tasker if assigned
    if (taskerId) {
      const taskerAuthId = await this.getAuthUserIdFromProfileId(taskerId)
      if (taskerAuthId) {
        promises.push(
          this.createNotification(
            taskerAuthId,
            'Task Cancelled',
            `Task "${taskTitle}" has been cancelled`,
            'task',
            { task_id: taskId, action: 'task_cancelled' }
          )
        )
      } else {
        console.error('❌ UNIFIED NOTIFICATION SERVICE - Could not get auth user ID for tasker profile:', taskerId)
      }
    }

    await Promise.all(promises)
  }

  // ===== APPLICATION-RELATED NOTIFICATIONS =====

  // Notify when someone applies for a task
  static async notifyTaskApplication(taskId: string, taskTitle: string, customerId: string, taskerName: string, applicationId: string): Promise<void> {
    
    // Convert profile ID to auth user ID
    const authUserId = await this.getAuthUserIdFromProfileId(customerId)
    if (!authUserId) {
      console.error('❌ UNIFIED NOTIFICATION SERVICE - Could not get auth user ID for profile:', customerId)
      return
    }
    
    
    const success = await this.createNotification(
      authUserId,
      'New Task Application',
      `${taskerName} applied for your task: "${taskTitle}"`,
      'application',
      { task_id: taskId, application_id: applicationId, action: 'task_application' }
    )
    
  }

  // Notify when task application is accepted
  static async notifyApplicationAccepted(taskId: string, taskTitle: string, taskerId: string, customerName: string): Promise<void> {
    // Convert profile ID to auth user ID
    const authUserId = await this.getAuthUserIdFromProfileId(taskerId)
    if (!authUserId) {
      console.error('❌ UNIFIED NOTIFICATION SERVICE - Could not get auth user ID for tasker profile:', taskerId)
      return
    }
    
    await this.createNotification(
      authUserId,
      'Application Accepted!',
      `${customerName} accepted your application for "${taskTitle}"`,
      'application',
      { task_id: taskId, action: 'application_accepted' }
    )
  }

  // Notify when task application is rejected
  static async notifyApplicationRejected(taskId: string, taskTitle: string, taskerId: string, customerName: string): Promise<void> {
    // Convert profile ID to auth user ID
    const authUserId = await this.getAuthUserIdFromProfileId(taskerId)
    if (!authUserId) {
      console.error('❌ UNIFIED NOTIFICATION SERVICE - Could not get auth user ID for tasker profile:', taskerId)
      return
    }
    
    await this.createNotification(
      authUserId,
      'Application Not Selected',
      `${customerName} didn't select your application for "${taskTitle}"`,
      'application',
      { task_id: taskId, action: 'application_rejected' }
    )
  }

  // ===== TASKER APPLICATION NOTIFICATIONS =====

  // Notify when tasker application is submitted
  static async notifyTaskerApplicationSubmitted(applicationId: string, taskerName: string, adminIds: string[]): Promise<void> {
    const promises = adminIds.map(adminId =>
      this.createNotification(
        adminId,
        'New Tasker Application',
        `${taskerName} submitted a tasker application`,
        'application',
        { application_id: applicationId, action: 'tasker_application_submitted' }
      )
    )
    await Promise.all(promises)
  }

  // Notify when tasker application is approved
  static async notifyTaskerApplicationApproved(taskerId: string, taskerName: string): Promise<void> {
    await this.createNotification(
      taskerId,
      'Application Approved!',
      `Congratulations ${taskerName}! Your tasker application has been approved`,
      'application',
      { action: 'tasker_application_approved' }
    )
  }

  // Notify when tasker application is rejected
  static async notifyTaskerApplicationRejected(taskerId: string, taskerName: string, reason?: string): Promise<void> {
    await this.createNotification(
      taskerId,
      'Application Not Approved',
      `Your tasker application was not approved${reason ? `: ${reason}` : ''}`,
      'application',
      { action: 'tasker_application_rejected', reason }
    )
  }

  // ===== MESSAGE NOTIFICATIONS =====

  // Notify when a new message is received
  static async notifyNewMessage(chatId: string, senderId: string, receiverId: string, messageText: string, senderName: string): Promise<void> {
    // Convert profile ID to auth user ID
    const authUserId = await this.getAuthUserIdFromProfileId(receiverId)
    if (!authUserId) {
      console.error('❌ UNIFIED NOTIFICATION SERVICE - Could not get auth user ID for receiver profile:', receiverId)
      return
    }
    
    await this.createNotification(
      authUserId,
      'New Message',
      `${senderName}: ${messageText.length > 50 ? messageText.substring(0, 50) + '...' : messageText}`,
      'message',
      { chat_id: chatId, sender_id: senderId, action: 'new_message' }
    )
  }

  // ===== BOOKING NOTIFICATIONS =====

  // Notify when booking is created
  static async notifyBookingCreated(bookingId: string, taskTitle: string, customerId: string, taskerId: string, customerName: string, taskerName: string): Promise<void> {
    // Convert profile IDs to auth user IDs
    const [customerAuthId, taskerAuthId] = await Promise.all([
      this.getAuthUserIdFromProfileId(customerId),
      this.getAuthUserIdFromProfileId(taskerId)
    ])

    const promises = []
    
    // Notify customer
    if (customerAuthId) {
      promises.push(
        this.createNotification(
          customerAuthId,
          'Booking Confirmed',
          `Your booking with ${taskerName} for "${taskTitle}" is confirmed`,
          'booking',
          { booking_id: bookingId, action: 'booking_created' }
        )
      )
    } else {
      console.error('❌ UNIFIED NOTIFICATION SERVICE - Could not get auth user ID for customer profile:', customerId)
    }
    
    // Notify tasker
    if (taskerAuthId) {
      promises.push(
        this.createNotification(
          taskerAuthId,
          'New Booking',
          `You have a new booking with ${customerName} for "${taskTitle}"`,
          'booking',
          { booking_id: bookingId, action: 'booking_created' }
        )
      )
    } else {
      console.error('❌ UNIFIED NOTIFICATION SERVICE - Could not get auth user ID for tasker profile:', taskerId)
    }
    
    await Promise.all(promises)
  }

  // Notify when booking status changes
  static async notifyBookingStatusChange(bookingId: string, taskTitle: string, customerId: string, taskerId: string, status: string, customerName: string, taskerName: string): Promise<void> {
    const statusMessages = {
      'in_progress': 'has started',
      'completed': 'has been completed',
      'cancelled': 'has been cancelled'
    }

    const message = statusMessages[status as keyof typeof statusMessages] || `status changed to ${status}`
    const title = status === 'completed' ? 'Task Completed!' : 'Booking Update'

    // Convert profile IDs to auth user IDs
    const [customerAuthId, taskerAuthId] = await Promise.all([
      this.getAuthUserIdFromProfileId(customerId),
      this.getAuthUserIdFromProfileId(taskerId)
    ])

    const promises = []
    
    // Notify customer
    if (customerAuthId) {
      promises.push(
        this.createNotification(
          customerAuthId,
          title,
          `Your booking with ${taskerName} for "${taskTitle}" ${message}`,
          'booking',
          { booking_id: bookingId, status, action: 'booking_status_change' }
        )
      )
    } else {
      console.error('❌ UNIFIED NOTIFICATION SERVICE - Could not get auth user ID for customer profile:', customerId)
    }
    
    // Notify tasker
    if (taskerAuthId) {
      promises.push(
        this.createNotification(
          taskerAuthId,
          title,
          `Your booking with ${customerName} for "${taskTitle}" ${message}`,
          'booking',
          { booking_id: bookingId, status, action: 'booking_status_change' }
        )
      )
    } else {
      console.error('❌ UNIFIED NOTIFICATION SERVICE - Could not get auth user ID for tasker profile:', taskerId)
    }
    
    await Promise.all(promises)
  }

  // ===== RATING NOTIFICATIONS =====

  // Notify when task is rated
  static async notifyTaskRated(taskId: string, taskTitle: string, raterId: string, rateeId: string, rating: number, raterName: string, rateeName: string): Promise<void> {
    // Convert profile ID to auth user ID
    const authUserId = await this.getAuthUserIdFromProfileId(rateeId)
    if (!authUserId) {
      console.error('❌ UNIFIED NOTIFICATION SERVICE - Could not get auth user ID for ratee profile:', rateeId)
      return
    }
    
    await this.createNotification(
      authUserId,
      'New Rating Received',
      `${raterName} rated you ${rating} stars for "${taskTitle}"`,
      'system',
      { task_id: taskId, rating, action: 'task_rated' }
    )
  }

  // ===== PAYMENT NOTIFICATIONS =====

  // Notify when payment is required
  static async notifyPaymentRequired(taskId: string, taskTitle: string, customerUserId: string, amount: number): Promise<void> {
    const title = 'Payment Required'
    const message = `Please pay ${amount} ETB for the completed task: "${taskTitle}"`

    await this.createNotification(
      customerUserId, // This should be auth.users.id
      title,
      message,
      'payment',
      { task_id: taskId, amount, task_title: taskTitle, action: 'payment_required' }
    )
  }

  // Notify when payment is processed
  static async notifyPaymentProcessed(userId: string, amount: number, taskTitle: string, status: 'success' | 'failed'): Promise<void> {
    const title = status === 'success' ? 'Payment Successful' : 'Payment Failed'
    const message = status === 'success' 
      ? `Payment of ${amount} ETB for "${taskTitle}" was successful`
      : `Payment of ${amount} ETB for "${taskTitle}" failed`

    await this.createNotification(
      userId,
      title,
      message,
      'payment',
      { amount, task_title: taskTitle, status, action: 'payment_processed' }
    )
  }

  // Notify when payment is completed and tasker should be paid
  static async notifyTaskerPaymentReady(taskId: string, taskTitle: string, taskerProfileId: string, amount: number): Promise<void> {
    const title = 'Payment Ready'
    const message = `Payment of ${amount} ETB is ready for your completed task: "${taskTitle}"`

    // Get the user_id from the tasker's profile ID
    const { data: taskerProfile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('id', taskerProfileId)
      .single()

    if (profileError || !taskerProfile) {
      console.error('UnifiedNotificationService: Tasker profile not found for ID:', taskerProfileId, profileError)
      return
    }

    await this.createNotification(
      taskerProfile.user_id, // Use auth.users.id
      title,
      message,
      'payment',
      { task_id: taskId, amount, task_title: taskTitle, action: 'tasker_payment_ready' }
    )
  }

  // ===== SYSTEM NOTIFICATIONS =====

  // Notify for system updates
  static async notifySystemUpdate(userId: string, title: string, message: string): Promise<void> {
    await this.createNotification(
      userId,
      title,
      message,
      'system',
      { action: 'system_update' }
    )
  }

  // Notify for maintenance
  static async notifyMaintenance(userIds: string[], title: string, message: string): Promise<void> {
    const promises = userIds.map(userId =>
      this.createNotification(
        userId,
        title,
        message,
        'system',
        { action: 'maintenance' }
      )
    )
    await Promise.all(promises)
  }

  // Delete a notification
  static async deleteNotification(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error deleting notification:', error)
      return false
    }
  }

  // Clear all notifications
  static async clearAllNotifications(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', userId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error clearing all notifications:', error)
      return false
    }
  }

  // Send notification to multiple users
  static async sendToMultipleUsers(
    userIds: string[],
    title: string,
    message: string,
    type: Notification['type'] = 'system',
    data?: any
  ): Promise<boolean> {
    try {
      const notifications = userIds.map(userId => ({
        user_id: userId,
        title,
        message,
        type,
        data: data || {},
        is_read: false
      }))

      const { error } = await supabase
        .from('notifications')
        .insert(notifications)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error sending notifications to multiple users:', error)
      return false
    }
  }

  // Get notification statistics
  static async getNotificationStats(userId: string): Promise<{
    total: number
    unread: number
    byType: Record<string, number>
  }> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('type, is_read')
        .eq('user_id', userId)

      if (error) throw error

      const stats = {
        total: data.length,
        unread: data.filter(n => !n.is_read).length,
        byType: {} as Record<string, number>
      }

      data.forEach(notification => {
        stats.byType[notification.type] = (stats.byType[notification.type] || 0) + 1
      })

      return stats
    } catch (error) {
      console.error('Error getting notification stats:', error)
      return { total: 0, unread: 0, byType: {} }
    }
  }

  // Cleanup
  static async cleanup(): Promise<void> {
    await this.unsubscribe()
  }
}
