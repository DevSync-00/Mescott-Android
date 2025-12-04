import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../lib/supabase'

export interface SimpleNotification {
  id: string
  title: string
  message: string
  type: 'task' | 'message' | 'application' | 'booking' | 'payment' | 'system'
  is_read: boolean
  created_at: string
  data?: any
}

export class SimpleNotificationService {
  private static STORAGE_KEY = 'simple_notifications'
  private static READ_MESSAGES_KEY = 'read_messages'

  // Get all notifications
  static async getAllNotifications(): Promise<SimpleNotification[]> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY)
      if (!stored) return []

      const notifications: SimpleNotification[] = JSON.parse(stored)
      return notifications.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    } catch (error) {
      console.error('Error getting notifications:', error)
      return []
    }
  }

  // Get unread count
  static async getUnreadCount(): Promise<number> {
    try {
      const notifications = await this.getAllNotifications()
      return notifications.filter(n => !n.is_read).length
    } catch (error) {
      console.error('Error getting unread count:', error)
      return 0
    }
  }

  // Add a new notification
  static async addNotification(
    title: string,
    message: string,
    type: SimpleNotification['type'] = 'system',
    data?: any
  ): Promise<boolean> {
    try {
      const notifications = await this.getAllNotifications()
      
      const newNotification: SimpleNotification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title,
        message,
        type,
        is_read: false,
        created_at: new Date().toISOString(),
        data: data || {}
      }

      notifications.unshift(newNotification) // Add to beginning
      
      // Keep only last 50 notifications
      const trimmedNotifications = notifications.slice(0, 50)
      
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(trimmedNotifications))
      return true
    } catch (error) {
      console.error('Error adding notification:', error)
      return false
    }
  }

  // Mark notification as read
  static async markAsRead(notificationId: string): Promise<boolean> {
    try {
      const notifications = await this.getAllNotifications()
      const updatedNotifications = notifications.map(n => 
        n.id === notificationId 
          ? { ...n, is_read: true }
          : n
      )

      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedNotifications))
      return true
    } catch (error) {
      console.error('Error marking notification as read:', error)
      return false
    }
  }

  // Mark all notifications as read
  static async markAllAsRead(): Promise<boolean> {
    try {
      const notifications = await this.getAllNotifications()
      const updatedNotifications = notifications.map(n => ({ ...n, is_read: true }))

      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedNotifications))
      return true
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
      return false
    }
  }

  // Delete a notification
  static async deleteNotification(notificationId: string): Promise<boolean> {
    try {
      const notifications = await this.getAllNotifications()
      const updatedNotifications = notifications.filter(n => n.id !== notificationId)

      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedNotifications))
      return true
    } catch (error) {
      console.error('Error deleting notification:', error)
      return false
    }
  }

  // Clear all notifications
  static async clearAllNotifications(): Promise<boolean> {
    try {
      await AsyncStorage.removeItem(this.STORAGE_KEY)
      return true
    } catch (error) {
      console.error('Error clearing notifications:', error)
      return false
    }
  }

  // Create specific notification types
  static async createTaskNotification(taskTitle: string, type: 'created' | 'updated' | 'completed' | 'cancelled'): Promise<boolean> {
    const messages = {
      created: `Your task "${taskTitle}" has been posted and is now visible to taskers.`,
      updated: `Your task "${taskTitle}" has been updated.`,
      completed: `Your task "${taskTitle}" has been completed successfully!`,
      cancelled: `Your task "${taskTitle}" has been cancelled.`
    }

    return await this.addNotification(
      'Task Update',
      messages[type],
      'task',
      { taskTitle, type }
    )
  }

  static async createMessageNotification(senderName: string, message: string, taskTitle: string): Promise<boolean> {
    return await this.addNotification(
      'New Message',
      `${senderName} sent you a message about "${taskTitle}": ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`,
      'message',
      { senderName, message, taskTitle }
    )
  }

  static async createApplicationNotification(taskTitle: string, type: 'received' | 'accepted' | 'rejected', taskerName?: string): Promise<boolean> {
    const messages = {
      received: `${taskerName} has applied for your task "${taskTitle}".`,
      accepted: `Your application for "${taskTitle}" has been accepted!`,
      rejected: `Your application for "${taskTitle}" has been rejected.`
    }

    return await this.addNotification(
      'Application Update',
      messages[type],
      'application',
      { taskTitle, type, taskerName }
    )
  }

  static async createBookingNotification(taskTitle: string, type: 'scheduled' | 'confirmed' | 'cancelled'): Promise<boolean> {
    const messages = {
      scheduled: `Your task "${taskTitle}" has been scheduled.`,
      confirmed: `Your booking for "${taskTitle}" has been confirmed.`,
      cancelled: `Your booking for "${taskTitle}" has been cancelled.`
    }

    return await this.addNotification(
      'Booking Update',
      messages[type],
      'booking',
      { taskTitle, type }
    )
  }

  static async createPaymentNotification(amount: number, type: 'received' | 'sent' | 'refunded', taskTitle?: string): Promise<boolean> {
    const messages = {
      received: `You received $${amount}${taskTitle ? ` for "${taskTitle}"` : ''}.`,
      sent: `You sent $${amount}${taskTitle ? ` for "${taskTitle}"` : ''}.`,
      refunded: `You received a refund of $${amount}${taskTitle ? ` for "${taskTitle}"` : ''}.`
    }

    return await this.addNotification(
      'Payment Update',
      messages[type],
      'payment',
      { amount, type, taskTitle }
    )
  }

  // Task application specific notifications
  static async notifyTaskApplication(taskId: string, taskerId: string, taskerName: string): Promise<boolean> {
    return await this.addNotification(
      'New Application',
      `${taskerName} has applied for your task.`,
      'application',
      { taskId, taskerId, taskerName }
    )
  }

  static async notifyTaskAccepted(taskerId: string, customerName: string, taskTitle: string): Promise<boolean> {
    return await this.addNotification(
      'Application Accepted',
      `Your application for "${taskTitle}" has been accepted by ${customerName}!`,
      'application',
      { taskerId, customerName, taskTitle }
    )
  }

  static async notifyTaskRejected(taskerId: string, customerName: string, taskTitle: string): Promise<boolean> {
    return await this.addNotification(
      'Application Rejected',
      `Your application for "${taskTitle}" was not selected by ${customerName}.`,
      'application',
      { taskerId, customerName, taskTitle }
    )
  }

  // Tasker application specific notifications
  static async notifyTaskerApproved(userId: string, userName: string): Promise<boolean> {
    return await this.addNotification(
      'Application Approved',
      `Congratulations ${userName}! Your tasker application has been approved. You can now start applying for tasks.`,
      'application',
      { userId, userName }
    )
  }

  static async notifyTaskerRejected(userId: string, userName: string): Promise<boolean> {
    return await this.addNotification(
      'Application Rejected',
      `Your tasker application was not approved at this time. You can reapply later.`,
      'application',
      { userId, userName }
    )
  }

  // Message read tracking
  static async markMessageAsRead(taskId: string, messageId: string): Promise<boolean> {
    try {
      const stored = await AsyncStorage.getItem(this.READ_MESSAGES_KEY)
      const readMessages = stored ? JSON.parse(stored) : {}
      
      if (!readMessages[taskId]) {
        readMessages[taskId] = []
      }
      
      if (!readMessages[taskId].includes(messageId)) {
        readMessages[taskId].push(messageId)
        await AsyncStorage.setItem(this.READ_MESSAGES_KEY, JSON.stringify(readMessages))
      }
      
      return true
    } catch (error) {
      console.error('Error marking message as read:', error)
      return false
    }
  }

  static async markAllMessagesAsRead(taskId: string): Promise<boolean> {
    try {
      const stored = await AsyncStorage.getItem(this.READ_MESSAGES_KEY)
      const readMessages = stored ? JSON.parse(stored) : {}
      
      // Get all message IDs for this task
      const { data: messages } = await supabase
        .from('messages')
        .select('id')
        .eq('task_id', taskId)
      
      if (messages) {
        readMessages[taskId] = messages.map(m => m.id)
        await AsyncStorage.setItem(this.READ_MESSAGES_KEY, JSON.stringify(readMessages))
      }
      
      return true
    } catch (error) {
      console.error('Error marking all messages as read:', error)
      return false
    }
  }

  static async getUnreadMessageCount(taskId: string, userId: string): Promise<number> {
    try {
      // Get all messages for this task that aren't from the current user
      const { data: messages } = await supabase
        .from('messages')
        .select('id')
        .eq('task_id', taskId)
        .neq('sender_id', userId)
      
      if (!messages) return 0
      
      // Get read messages for this task
      const stored = await AsyncStorage.getItem(this.READ_MESSAGES_KEY)
      const readMessages = stored ? JSON.parse(stored) : {}
      const readMessageIds = readMessages[taskId] || []
      
      // Count unread messages
      return messages.filter(msg => !readMessageIds.includes(msg.id)).length
    } catch (error) {
      console.error('Error getting unread message count:', error)
      return 0
    }
  }
}