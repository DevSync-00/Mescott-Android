import React, { useEffect, useMemo, useCallback, memo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useNotifications } from '../contexts/NotificationContext'
import { Notification } from '../services/UnifiedNotificationService'
import { useAuth } from '../contexts/SimpleAuthContext'
import { useToast } from '../contexts/ToastContext'
import { Colors } from '../constants/Colors'
import { SkeletonList } from '../components/SkeletonLoader'
import Header from '../components/Header'
import { showConfirmation } from '../utils/alertHelper'
import TextureBackground from '../components/TextureBackground'

export default function Notifications() {
  const router = useRouter()
  const { isAuthenticated, isLoading } = useAuth()
  const { showSuccess } = useToast()
  const insets = useSafeAreaInsets()
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
  } = useNotifications()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/auth')
    }
  }, [isAuthenticated, isLoading, router])

  const handleNotificationPress = useCallback(async (notification: Notification) => {
    // Mark as read first
    if (!notification.is_read) {
      await markAsRead(notification.id)
    }

    const data = notification.data || {}
    
    // Navigate based on notification type and data
    switch (notification.type) {
      case 'message':
        // Navigate to chat detail
        if (data.chat_id) {
          router.push({
            pathname: '/chat-detail',
            params: { chatId: data.chat_id }
          })
        } else {
          // Fallback to chats list
          router.push('/chats')
        }
        break

      case 'task':
      case 'application':
        // Navigate to task detail
        if (data.task_id) {
          router.push({
            pathname: '/task-detail',
            params: { taskId: data.task_id }
          })
        } else {
          // Fallback to jobs page
          router.push('/jobs')
        }
        break

      case 'payment':
        // Navigate to wallet/payment page
        router.push('/wallet')
        break

      case 'booking':
        // Navigate to bookings page
        router.push('/bookings')
        break

      default:
        // For system notifications, do nothing or show info
        break
    }
  }, [markAsRead, router])

  const handleDelete = async (notificationId: string) => {
    showConfirmation(
      'Delete Notification',
      'Are you sure you want to delete this notification?',
      () => {
        deleteNotification(notificationId)
        showSuccess('Notification deleted')
      },
      undefined,
      'Delete',
      'Cancel',
      'warning'
    )
  }

  const handleMarkAllAsRead = () => {
    showConfirmation(
      'Mark All as Read',
      'Are you sure you want to mark all notifications as read?',
      () => {
        markAllAsRead()
        showSuccess('All notifications marked as read')
      },
      undefined,
      'Mark All',
      'Cancel',
      'info'
    )
  }

  const handleClearAll = () => {
    showConfirmation(
      'Clear All Notifications',
      'Are you sure you want to clear all notifications? This action cannot be undone.',
      () => {
        clearAllNotifications()
        showSuccess('All notifications cleared')
      },
      undefined,
      'Clear All',
      'Cancel',
      'warning'
    )
  }


  const formatTime = useCallback((dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

    if (diffInHours < 1) return 'Just now'
    if (diffInHours < 24) return `${diffInHours}h ago`
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`
    return date.toLocaleDateString()
  }, [])

  const getNotificationIcon = useCallback((type: string) => {
    switch (type) {
      case 'task':
        return 'briefcase-outline'
      case 'message':
        return 'chatbubble-outline'
      case 'application':
        return 'person-add-outline'
      case 'booking':
        return 'calendar-outline'
      case 'payment':
        return 'card-outline'
      case 'system':
        return 'settings-outline'
      default:
        return 'notifications-outline'
    }
  }, [])

  const getNotificationColor = useCallback((type: string) => {
    switch (type) {
      case 'task':
        return Colors.primary[500]
      case 'message':
        return Colors.success[500]
      case 'application':
        return Colors.warning[500]
      case 'booking':
        return Colors.primary[500]
      case 'payment':
        return Colors.success[600]
      case 'system':
        return Colors.neutral[500]
      default:
        return Colors.neutral[400]
    }
  }, [])

  const safeNotifications = useMemo(
    () =>
      notifications.filter((notification): notification is Notification =>
        Boolean(notification && notification.id),
      ),
    [notifications],
  )

  return (
    <TextureBackground>
      <SafeAreaView style={styles.container} edges={[]}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
        <View style={styles.containerContent}>
        <View style={[styles.headerWrapper, { paddingTop: 4 + insets.top }]}>
          <Header
            title="Notifications"
            subtitle={unreadCount > 0 ? `${unreadCount} unread` : undefined}
            showBackButton={true}
            onBackPress={() => router.push('/')}
            rightAction={
              notifications.length > 0
                ? {
                    icon: unreadCount > 0 ? 'checkmark-done' : 'trash-outline',
                    label: unreadCount > 0 ? 'Mark All Read' : 'Clear All',
                    onPress: unreadCount > 0 ? handleMarkAllAsRead : handleClearAll,
                    color: unreadCount > 0 ? Colors.primary[500] : Colors.error[500],
                  }
                : undefined
            }
          />
        </View>

        <ScrollView style={styles.content}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <SkeletonList count={3} />
            </View>
          ) : safeNotifications.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={64} color={Colors.neutral[400]} />
              <Text style={styles.emptyTitle}>No Notifications</Text>
              <Text style={styles.emptySubtitle}>
                You&apos;ll see notifications about tasks, messages, and updates here.
              </Text>
            </View>
          ) : (
            safeNotifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onPress={handleNotificationPress}
                onDelete={handleDelete}
                getNotificationIcon={getNotificationIcon}
                getNotificationColor={getNotificationColor}
                formatTime={formatTime}
              />
            ))
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
    </TextureBackground>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  containerContent: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  headerWrapper: {
    paddingTop: 0,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: Colors.neutral[600],
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral[700],
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.neutral[500],
    textAlign: 'center',
    lineHeight: 20,
  },
  notificationCard: {
    backgroundColor: Colors.background.secondary,
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border.primary,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  readCard: {
    backgroundColor: Colors.background.primary,
    borderColor: Colors.border.primary,
  },
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary[500],
    backgroundColor: Colors.primary[100],
    borderColor: Colors.primary[200],
  },
  notificationContent: {
    padding: 16,
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationInfo: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral[900],
    marginBottom: 2,
  },
  readTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral[900],
    marginBottom: 2,
  },
  unreadTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.neutral[900],
    marginBottom: 2,
  },
  notificationTime: {
    fontSize: 12,
    color: Colors.neutral[500],
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary[500],
  },
  notificationMessage: {
    fontSize: 14,
    color: Colors.neutral[700],
    lineHeight: 20,
  },
  readMessage: {
    fontSize: 14,
    color: Colors.neutral[700],
    lineHeight: 20,
  },
  unreadMessage: {
    fontSize: 14,
    color: Colors.neutral[800],
    lineHeight: 20,
  },
  deleteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
    borderRadius: 4,
    backgroundColor: Colors.error[50],
  },
})

// Memoized notification item component for better performance
interface NotificationItemProps {
  notification: Notification
  onPress: (notification: Notification) => void
  onDelete: (id: string) => void
  getNotificationIcon: (type: string) => string
  getNotificationColor: (type: string) => string
  formatTime: (dateString: string) => string
}

const NotificationItem = memo(({
  notification,
  onPress,
  onDelete,
  getNotificationIcon,
  getNotificationColor,
  formatTime,
}: NotificationItemProps) => {
  const icon = getNotificationIcon(notification.type)
  const color = getNotificationColor(notification.type)

  return (
    <TouchableOpacity
      style={[
        styles.notificationCard,
        notification.is_read ? styles.readCard : styles.unreadCard,
      ]}
      onPress={() => onPress(notification)}
      activeOpacity={0.7}
    >
      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: color + '20' },
            ]}
          >
            <Ionicons
              name={icon}
              size={20}
              color={color}
            />
          </View>
          <View style={styles.notificationInfo}>
            <Text style={notification.is_read ? styles.readTitle : styles.unreadTitle}>
              {notification.title || 'Notification'}
            </Text>
            <Text style={styles.notificationTime}>
              {formatTime(notification.created_at)}
            </Text>
          </View>
          {!notification.is_read && <View style={styles.unreadDot} />}
        </View>

        {notification.message ? (
          <Text style={notification.is_read ? styles.readMessage : styles.unreadMessage}>
            {notification.message}
          </Text>
        ) : null}
      </View>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => onDelete(notification.id)}
      >
        <Ionicons name="trash-outline" size={16} color={Colors.error[500]} />
      </TouchableOpacity>
    </TouchableOpacity>
  )
})

NotificationItem.displayName = 'NotificationItem'
