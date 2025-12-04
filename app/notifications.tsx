import React, { useState, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StatusBar
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useNotifications } from '../contexts/NotificationContext'
import { Notification } from '../services/UnifiedNotificationService'
import { useAuth } from '../contexts/SimpleAuthContext'
import Colors from '../constants/Colors'
import SkeletonLoader, { SkeletonList } from '../components/SkeletonLoader'
import Header from '../components/Header'

export default function Notifications() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()
  const insets = useSafeAreaInsets()
  const {
    notifications,
    unreadCount,
    loading,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications
  } = useNotifications()


  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/auth')
    }
  }, [isAuthenticated, isLoading])

  const handleRefresh = async () => {
    await refreshNotifications()
  }

  const handleMarkAsRead = async (notificationId: string) => {
    await markAsRead(notificationId)
  }

  const handleDelete = async (notificationId: string) => {
    Alert.alert(
      'Delete Notification',
      'Are you sure you want to delete this notification?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => deleteNotification(notificationId)
        }
      ]
    )
  }

  const handleMarkAllAsRead = () => {
    Alert.alert(
      'Mark All as Read',
      'Are you sure you want to mark all notifications as read?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Mark All', 
          onPress: markAllAsRead
        }
      ]
    )
  }

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Notifications',
      'Are you sure you want to clear all notifications? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear All', 
          style: 'destructive',
          onPress: clearAllNotifications
        }
      ]
    )
  }

  const getNotificationIcon = (type: string) => {
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
  }

  const getNotificationColor = (type: string) => {
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
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) return 'Just now'
    if (diffInHours < 24) return `${diffInHours}h ago`
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`
    return date.toLocaleDateString()
  }


  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
        <View style={styles.loadingContainer}>
          <SkeletonList count={3} />
        </View>
      </SafeAreaView>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  const safeNotifications = useMemo(
    () =>
      notifications.filter(
        (notification): notification is Notification =>
          Boolean(notification && notification.id)
      ),
    [notifications]
  )

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
      <View style={styles.containerContent}>
      <View style={[styles.headerWrapper, { paddingTop: 4 + insets.top }]}>
        <Header
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : undefined}
        showBackButton={true}
        onBackPress={() => router.push('/')}
        rightAction={notifications.length > 0 ? {
          icon: unreadCount > 0 ? 'checkmark-done' : 'trash-outline',
          label: unreadCount > 0 ? 'Mark All Read' : 'Clear All',
        onPress: unreadCount > 0 ? handleMarkAllAsRead : handleClearAll,
        color: unreadCount > 0 ? Colors.primary[500] : Colors.error[500]
      } : undefined}
        />
      </View>

      <ScrollView 
        style={styles.content}
      >
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
            <TouchableOpacity 
              key={notification.id} 
              style={[
                styles.notificationCard,
                notification.is_read ? styles.readCard : styles.unreadCard
              ]}
              onPress={() => handleMarkAsRead(notification.id)}
            >
              <View style={styles.notificationContent}>
                <View style={styles.notificationHeader}>
                  <View style={[
                    styles.iconContainer,
                    { backgroundColor: getNotificationColor(notification.type) + '20' }
                  ]}>
                    <Ionicons 
                      name={getNotificationIcon(notification.type)} 
                      size={20} 
                      color={getNotificationColor(notification.type)} 
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
                  {!notification.is_read && (
                    <View style={styles.unreadDot} />
                  )}
                </View>
                
                {notification.message ? (
                  <Text style={notification.is_read ? styles.readMessage : styles.unreadMessage}>
                    {notification.message}
                  </Text>
                ) : null}

              </View>

              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDelete(notification.id)}
              >
                <Ionicons name="trash-outline" size={16} color={Colors.error[500]} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
  },
  containerContent: {
    flex: 1,
    backgroundColor: Colors.background.primary,
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
    backgroundColor: Colors.background.primary,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border.primary,
    overflow: 'hidden',
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
