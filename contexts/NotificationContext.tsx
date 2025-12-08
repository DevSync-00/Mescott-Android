import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './SimpleAuthContext'
import { UnifiedNotificationService, Notification } from '../services/UnifiedNotificationService'

interface NotificationContextType {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  refreshNotifications: () => Promise<void>
  markAsRead: (notificationId: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  deleteNotification: (notificationId: string) => Promise<void>
  clearAllNotifications: () => Promise<void>
  createNotification: (title: string, message: string, type?: Notification['type'], data?: any) => Promise<void>
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)

  // Initialize notification service when user is authenticated
  useEffect(() => {
    if (isAuthenticated && user?.user_id) {
      initializeNotifications()
    } else {
      cleanupNotifications()
    }
  }, [isAuthenticated, user?.user_id])

  const handleRealtimeNotification = useCallback((incoming: Notification) => {
    if (!incoming?.id) {
      return
    }

    setNotifications(prev => {
      const existingIndex = prev.findIndex(n => n.id === incoming.id)

      if (existingIndex !== -1) {
        const previousNotification = prev[existingIndex]

        if (previousNotification.is_read !== incoming.is_read) {
          setUnreadCount(count => {
            const delta = incoming.is_read ? -1 : 1
            return Math.max(0, count + delta)
          })
        }

        const updated = [...prev]
        updated[existingIndex] = { ...previousNotification, ...incoming }
        updated.sort((a, b) => {
          const aTime = a?.created_at ? new Date(a.created_at).getTime() : 0
          const bTime = b?.created_at ? new Date(b.created_at).getTime() : 0
          return bTime - aTime
        })
        return updated
      }

      if (!incoming.is_read) {
        setUnreadCount(count => count + 1)
      }

      const next = [incoming, ...prev]
      next.sort((a, b) => {
        const aTime = a?.created_at ? new Date(a.created_at).getTime() : 0
        const bTime = b?.created_at ? new Date(b.created_at).getTime() : 0
        return bTime - aTime
      })
      return next
    })
  }, [])

  const initializeNotifications = async () => {
    if (!user?.user_id) return

    try {
      console.log('🚀 NOTIFICATION CONTEXT - Initializing notifications for user:', user.user_id)
      // Initialize the notification service
      await UnifiedNotificationService.initialize(user.user_id)

      // Add subscription for real-time updates
      const subscription = {
        onNotification: handleRealtimeNotification,
        onUnreadCountChange: () => {}
      }

      UnifiedNotificationService.addSubscription(subscription)

      // Load initial notifications (with cache for instant display)
      await refreshNotifications(true)
      console.log('✅ NOTIFICATION CONTEXT - Notifications initialized successfully')

      // Cleanup subscription on unmount
      return () => {
        UnifiedNotificationService.removeSubscription(subscription)
      }
    } catch (error) {
      console.error('Error initializing notifications:', error)
    }
  }

  const cleanupNotifications = async () => {
    try {
      await UnifiedNotificationService.cleanup()
      setNotifications([])
      setUnreadCount(0)
    } catch (error) {
      console.error('Error cleaning up notifications:', error)
    }
  }

  const refreshNotifications = useCallback(async (showLoading: boolean = true) => {
    if (!user?.user_id) return

    if (showLoading) {
      setLoading(true)
    }

    try {
      // Load cached data first for instant display, then refresh in background
      const [notificationsData, unreadCountData] = await Promise.all([
        UnifiedNotificationService.getNotifications(user.user_id, 30, true),
        UnifiedNotificationService.getUnreadCount(user.user_id, true)
      ])

      // Update state immediately with cached/fresh data
      setNotifications(notificationsData)
      setUnreadCount(unreadCountData)

      // If we got cached data, refresh in background without blocking UI
      if (showLoading) {
        setLoading(false)
        
        // Background refresh for fresh data
        Promise.all([
          UnifiedNotificationService.getNotifications(user.user_id, 30, false),
          UnifiedNotificationService.getUnreadCount(user.user_id, false)
        ]).then(([freshNotifications, freshUnreadCount]) => {
          setNotifications(freshNotifications)
          setUnreadCount(freshUnreadCount)
        }).catch(() => {
          // Silent fail - keep cached data
        })
      }
    } catch (error) {
      console.error('Error refreshing notifications:', error)
      if (showLoading) {
        setLoading(false)
      }
    }
  }, [user?.user_id])

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const success = await UnifiedNotificationService.markAsRead(notificationId)
      if (!success) return

      setNotifications(prev =>
        prev.map(notification => {
          if (!notification) return notification
          if (notification.id !== notificationId) return notification
          return { ...notification, is_read: true }
        })
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }, [])

  const markAllAsRead = useCallback(async () => {
    if (!user?.user_id) return

    try {
      const success = await UnifiedNotificationService.markAllAsRead(user.user_id)
      if (success) {
        setNotifications(prev => 
          prev.map(n => ({ ...n, is_read: true }))
        )
        setUnreadCount(0)
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
    }
  }, [user?.user_id])

  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const success = await UnifiedNotificationService.deleteNotification(notificationId)
      if (success) {
        setNotifications(prev => prev.filter(n => n.id !== notificationId))
        // Check if the deleted notification was unread
        const deletedNotification = notifications.find(n => n.id === notificationId)
        if (deletedNotification && !deletedNotification.is_read) {
          setUnreadCount(prev => Math.max(0, prev - 1))
        }
      }
    } catch (error) {
      console.error('Error deleting notification:', error)
    }
  }, [notifications])

  const clearAllNotifications = useCallback(async () => {
    if (!user?.user_id) return

    try {
      const success = await UnifiedNotificationService.clearAllNotifications(user.user_id)
      if (success) {
        setNotifications([])
        setUnreadCount(0)
      }
    } catch (error) {
      console.error('Error clearing all notifications:', error)
    }
  }, [user?.user_id])

  const createNotification = useCallback(async (
    title: string, 
    message: string, 
    type: Notification['type'] = 'system', 
    data?: any
  ) => {
    if (!user?.user_id) return

    try {
      await UnifiedNotificationService.createNotification(user.user_id, title, message, type, data)
    } catch (error) {
      console.error('Error creating notification:', error)
    }
  }, [user?.user_id])

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    loading,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    createNotification
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}
