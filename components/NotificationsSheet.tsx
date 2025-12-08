import React, { useEffect, useRef, useCallback } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useToast } from '../contexts/ToastContext'
import { Colors } from '../constants/Colors'
import { useNotifications } from '../contexts/NotificationContext'
import { useAuth } from '../contexts/SimpleAuthContext'
import { Notification } from '../services/UnifiedNotificationService'
import { SkeletonList } from './SkeletonLoader'
import BottomSheet, { BottomSheetRef } from './BottomSheet'
import { showConfirmation } from '../utils/alertHelper'

interface NotificationsSheetProps {
  visible: boolean
  onClose: () => void
}

function NotificationsSheet({ visible, onClose }: NotificationsSheetProps) {
  const { isAuthenticated, isLoading } = useAuth()
  const { showSuccess } = useToast()
  const router = useRouter()
  const bottomSheetRef = useRef<BottomSheetRef>(null)
  const {
    notifications,
    unreadCount,
    loading,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
  } = useNotifications()

  useEffect(() => {
    if (visible) {
      // Refresh notifications when sheet opens, but don't block UI
      refreshNotifications()
    }
  }, [visible, refreshNotifications])

  const handleNotificationPress = useCallback(async (notification: Notification) => {
    // Mark as read first
    if (!notification.is_read) {
      await markAsRead(notification.id)
    }

    // Close the sheet before navigating
    onClose()

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
        // For system notifications, do nothing
        break
    }
  }, [markAsRead, router, onClose])

  const handleDelete = React.useCallback(
    async (notificationId: string) => {
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
    },
    [deleteNotification, showSuccess],
  )

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

  // Memoize helper functions to prevent recreation on every render
  const getNotificationIcon = React.useCallback((type: string) => {
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

  const getNotificationColor = React.useCallback((type: string) => {
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

  const formatTime = React.useCallback((dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

    if (diffInHours < 1) return 'Just now'
    if (diffInHours < 24) return `${diffInHours}h ago`
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`
    return date.toLocaleDateString()
  }, [])

  // Memoize notification list to prevent unnecessary re-renders
  const notificationList = React.useMemo(() => {
    return notifications
      .filter((notification): notification is (typeof notifications)[number] =>
        Boolean(notification && notification.id),
      )
      .map((notification) => {
        const icon = getNotificationIcon(notification.type || 'system')
        const color = getNotificationColor(notification.type || 'system')
        const time = notification.created_at ? formatTime(notification.created_at) : ''

        return (
          <TouchableOpacity
            key={`${notification.id}-${notification.is_read ? 'read' : 'unread'}`}
            style={[
              styles.notificationCard,
              notification.is_read ? styles.readCard : styles.unreadCard,
            ]}
            onPress={() => handleNotificationPress(notification)}
            activeOpacity={0.7}
          >
            <View style={styles.notificationContent}>
              <View style={styles.notificationHeader}>
                <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
                  <Ionicons name={icon} size={20} color={color} />
                </View>
                <View style={styles.notificationInfo}>
                  <Text
                    style={notification.is_read ? styles.readTitle : styles.unreadTitle}
                    numberOfLines={2}
                  >
                    {notification.title || 'Notification'}
                  </Text>
                  <Text style={styles.notificationTime}>{time}</Text>
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
              onPress={(e) => {
                e.stopPropagation()
                handleDelete(notification.id)
              }}
            >
              <Ionicons name="trash-outline" size={16} color={Colors.error[500]} />
            </TouchableOpacity>
          </TouchableOpacity>
        )
      })
  }, [
    notifications,
    getNotificationIcon,
    getNotificationColor,
    formatTime,
    handleNotificationPress,
    handleDelete,
  ])

  return (
    <BottomSheet
      ref={bottomSheetRef}
      visible={visible}
      onClose={onClose}
      snapPoints={[0.3, 0.9, 1.0]}
      initialSnapPoint={1}
      useInternalScroll={false}
    >
      <View style={styles.container}>
        {/* Fixed Header */}
        <View style={styles.header}>
          <View style={styles.headerActions}>
            {isAuthenticated && notifications.length > 0 ? (
              <TouchableOpacity
                onPress={unreadCount > 0 ? handleMarkAllAsRead : handleClearAll}
                style={styles.headerActionButton}
              >
                <Ionicons
                  name={unreadCount > 0 ? 'checkmark-done' : 'trash-outline'}
                  size={20}
                  color={unreadCount > 0 ? Colors.primary[500] : Colors.error[500]}
                />
              </TouchableOpacity>
            ) : (
              <View style={styles.headerActionPlaceholder} />
            )}
          </View>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Notifications</Text>
            {isAuthenticated && unreadCount > 0 ? (
              <Text style={styles.headerSubtitle}>{unreadCount} unread</Text>
            ) : null}
          </View>
          <View style={styles.headerActions}>
            <View style={styles.headerActionPlaceholder} />
          </View>
        </View>

        {/* Scrollable Content */}
        {!isAuthenticated || isLoading ? (
          <View style={styles.loadingContainer}>
            <SkeletonList count={3} />
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            bounces={true}
            alwaysBounceVertical={true}
            overScrollMode="always"
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <SkeletonList count={3} />
              </View>
            ) : notifications.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="notifications-off-outline" size={64} color={Colors.neutral[400]} />
                <Text style={styles.emptyTitle}>No Notifications</Text>
                <Text style={styles.emptySubtitle}>
                  You&apos;ll see notifications about tasks, messages, and updates here.
                </Text>
              </View>
            ) : (
              notificationList
            )}
          </ScrollView>
        )}
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
    backgroundColor: Colors.background.primary,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    left: 0,
    right: 0,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.neutral[900],
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.neutral[500],
    marginTop: 4,
    fontWeight: '500',
  },
  headerActions: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  headerActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActionPlaceholder: {
    width: 36,
    height: 36,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
    paddingTop: 12,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 200,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 300,
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
    borderColor: Colors.border.light,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  readCard: {
    backgroundColor: Colors.neutral[50], // Slightly gray instead of pure white
    borderColor: Colors.border.light,
    borderLeftWidth: 1, // Ensure consistent border layout
  },
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary[500],
    backgroundColor: Colors.primary[100],
    borderColor: Colors.primary[200],
  },
  notificationContent: {
    padding: 18,
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
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.error[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
})

export default React.memo(NotificationsSheet)
