import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StatusBar,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useAuth } from '../contexts/SimpleAuthContext'
import { useToast } from '../contexts/ToastContext'
import { BookingService, Booking } from '../services/BookingService'
import { Colors } from '../constants/Colors'
import { formatETB } from '../lib/formatCurrency'
import { SkeletonList } from '../components/SkeletonLoader'
import { showConfirmation } from '../utils/alertHelper'

const statusColors = {
  pending: Colors.warning[500],
  confirmed: Colors.primary[500],
  in_progress: Colors.primary[500],
  completed: Colors.success[500],
  cancelled: Colors.error[500],
  open: Colors.primary[500],
  assigned: Colors.primary[500],
}

const statusLabels = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  open: 'Open',
  assigned: 'Assigned',
}

const taskStatusLabels = {
  open: 'Open',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export default function Bookings() {
  const { user, isAuthenticated, loading: isLoading } = useAuth()
  const { showError } = useToast()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadBookings = useCallback(
    async (isRefresh = false) => {
      if (!user) return

      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      try {
        const fetchedBookings = await BookingService.getUserBookings(user.user_id)
        setBookings(fetchedBookings)
      } catch (error) {
        console.error('🚀 BOOKINGS PAGE - Error loading bookings:', error)
        showError('Failed to load bookings')
      } finally {
        if (isRefresh) {
          setRefreshing(false)
        } else {
          setLoading(false)
        }
      }
    },
    [user, showError],
  )

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/auth')
    }
  }, [isAuthenticated, isLoading, router])

  const statuses = ['all', 'pending', 'completed']

  useEffect(() => {
    if (user && isAuthenticated) {
      loadBookings()
    }
  }, [user, isAuthenticated, loadBookings])

  // Show loading while auth is being determined
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

  const onRefresh = () => {
    loadBookings(true)
  }

  const filteredBookings =
    selectedStatus === 'all'
      ? bookings
      : bookings.filter((booking) => booking.status === selectedStatus)

  const updateBookingStatus = async (bookingId: string, newStatus: Booking['status']) => {
    try {
      // Optimistically update the UI immediately
      setBookings((prevBookings) =>
        prevBookings.map((booking) =>
          booking.id === bookingId ? { ...booking, status: newStatus } : booking,
        ),
      )

      // Update in background without blocking UI
      BookingService.updateBookingAndTaskStatus(bookingId, newStatus, user?.id)
        .then((success) => {
          if (success) {
            // Reload to get fresh data (runs in background)
            loadBookings(true).catch(console.error)
          } else {
            // Revert optimistic update on failure
            loadBookings(true).catch(console.error)
            showError('Failed to update booking status. Please try again.')
          }
        })
        .catch((error) => {
          console.error('Error updating booking status:', error)
          // Revert optimistic update on error
          loadBookings(true).catch(console.error)
          showError('An unexpected error occurred. Please try again.')
        })
    } catch (error) {
      console.error('Error updating booking status:', error)
      // Revert optimistic update
      loadBookings(true).catch(console.error)
      showError('An unexpected error occurred. Please try again.')
    }
  }

  const handleChatPress = async (booking: Booking) => {
    if (!user?.id) return

    try {
      // Get or create chat for this booking
      const chatId = await BookingService.getOrCreateChatForBooking(
        booking.id,
        booking.customer_id,
        booking.technician_id,
      )

      if (chatId) {
        // Navigate to chat with the chat ID
        router.push(`/chat-detail?chatId=${chatId}&bookingId=${booking.id}`)
      } else {
        showError('Failed to create chat')
      }
    } catch (error) {
      console.error('🚀 BOOKINGS - Error creating chat:', error)
      showError('Failed to create chat')
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
      <View style={styles.containerContent}>
        {/* Header */}
        <View style={[styles.headerWrapper, { paddingTop: 8 + insets.top }]}>
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <View style={styles.headerText}>
                <Text style={styles.headerTitle}>My Bookings</Text>
                <Text style={styles.headerSubtitle}>
                  {user ? `Manage your ${user.current_mode} bookings` : 'Manage your bookings'}
                </Text>
              </View>
              <View style={styles.headerStats}>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{filteredBookings.length}</Text>
                  <Text style={styles.statLabel}>Total</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>
                    {filteredBookings.filter((b) => b.status === 'pending').length}
                  </Text>
                  <Text style={styles.statLabel}>Pending</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Filter Section */}
          <View style={styles.filterSection}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterScroll}
              bounces={false}
              alwaysBounceVertical={false}
              overScrollMode="never"
            >
              {statuses.map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[styles.filterChip, selectedStatus === status && styles.filterChipActive]}
                  onPress={() => setSelectedStatus(status)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      selectedStatus === status && styles.filterChipTextActive,
                    ]}
                  >
                    {status === 'all' ? 'All' : statusLabels[status as keyof typeof statusLabels]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Bookings List */}
        <ScrollView
          style={styles.bookingsList}
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ ...styles.scrollContent, paddingBottom: 24 }}
          bounces={true}
          alwaysBounceVertical={true}
          overScrollMode="always"
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.primary[500]]}
              tintColor={Colors.primary[500]}
            />
          }
        >
          {loading ? (
            <SkeletonList count={5} />
          ) : (
            filteredBookings.map((booking) => (
              <View key={booking.id} style={styles.bookingCard}>
                {/* Booking Header */}
                <View style={styles.bookingHeader}>
                  <View style={styles.bookingInfo}>
                    <Text style={styles.bookingTitle} numberOfLines={1} ellipsizeMode="tail">
                      {booking.task_title || booking.service_name}
                    </Text>
                    <Text style={styles.bookingCustomer}>
                      {user?.current_mode === 'customer'
                        ? `Tasker: ${booking.technician_name}`
                        : `Customer: ${booking.customer_name}`}
                    </Text>
                  </View>
                  <View style={styles.statusContainer}>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: statusColors[booking.status] + '20' },
                      ]}
                    >
                      <Text style={[styles.statusText, { color: statusColors[booking.status] }]}>
                        {statusLabels[booking.status]}
                      </Text>
                    </View>
                    {booking.is_task_based &&
                      booking.task_status &&
                      booking.task_status !== booking.status && (
                        <View
                          style={[
                            styles.taskStatusBadge,
                            { backgroundColor: statusColors[booking.task_status] + '20' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.taskStatusText,
                              { color: statusColors[booking.task_status] },
                            ]}
                          >
                            Task: {taskStatusLabels[booking.task_status]}
                          </Text>
                        </View>
                      )}
                  </View>
                </View>

                {/* Booking Description */}
                <Text style={styles.bookingDescription}>{booking.service_description}</Text>

                {/* Booking Details */}
                <View style={styles.bookingDetails}>
                  <View style={styles.detailRow}>
                    <View style={styles.detailItem}>
                      <Ionicons name="calendar-outline" size={18} color={Colors.neutral[500]} />
                      <Text style={styles.detailText}>
                        {formatDate(booking.booking_date)} at {formatTime(booking.start_time)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.detailRow}>
                    <View style={styles.detailItem}>
                      <Ionicons name="location-outline" size={18} color={Colors.neutral[500]} />
                      <Text style={styles.detailText}>{booking.address}</Text>
                    </View>
                  </View>
                  <View style={styles.detailRow}>
                    <View style={styles.detailItem}>
                      <Ionicons name="cash-outline" size={18} color={Colors.neutral[500]} />
                      <Text style={styles.detailText}>
                        {formatETB(booking.agreed_price ?? 0)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionButtons}>
                  {/* Chat Button - Always available for confirmed bookings */}
                  {(booking.status === 'confirmed' || booking.status === 'in_progress') && (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.chatButton]}
                      onPress={() => handleChatPress(booking)}
                    >
                      <Ionicons name="chatbubble-outline" size={18} color="#fff" />
                      <Text style={styles.actionButtonText}>Message</Text>
                    </TouchableOpacity>
                  )}

                  {booking.status === 'pending' && user?.current_mode === 'tasker' && (
                    <>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.acceptButton]}
                        onPress={() => {
                          showConfirmation(
                            'Accept Booking',
                            'Are you sure you want to accept this booking?',
                            () => updateBookingStatus(booking.id, 'confirmed'),
                            undefined,
                            'Accept',
                            'Cancel',
                            'info'
                          )
                        }}
                      >
                        <Ionicons name="checkmark" size={18} color="#fff" />
                        <Text style={styles.actionButtonText}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.declineButton]}
                        onPress={() => {
                          showConfirmation(
                            'Decline Booking',
                            'Are you sure you want to decline this booking?',
                            () => updateBookingStatus(booking.id, 'cancelled'),
                            undefined,
                            'Decline',
                            'Cancel',
                            'warning'
                          )
                        }}
                      >
                        <Ionicons name="close" size={18} color="#fff" />
                        <Text style={styles.actionButtonText}>Decline</Text>
                      </TouchableOpacity>
                    </>
                  )}

                  {booking.status === 'confirmed' && user?.current_mode === 'tasker' && (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.completeButton]}
                      onPress={() => {
                        showConfirmation(
                          'Complete Task',
                          'Are you sure you have completed this task?',
                          () => updateBookingStatus(booking.id, 'completed'),
                          undefined,
                          'Complete',
                          'Cancel',
                          'info'
                        )
                      }}
                    >
                      <Ionicons name="checkmark-circle" size={18} color="#fff" />
                      <Text style={styles.actionButtonText}>Complete Task</Text>
                    </TouchableOpacity>
                  )}

                  {/* Customer actions */}
                  {booking.status === 'confirmed' && user?.current_mode === 'customer' && (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.cancelButton]}
                      onPress={() => {
                        showConfirmation(
                          'Cancel Booking',
                          'Are you sure you want to cancel this booking?',
                          () => updateBookingStatus(booking.id, 'cancelled'),
                          undefined,
                          'Yes, Cancel',
                          'No',
                          'warning'
                        )
                      }}
                    >
                      <Ionicons name="close-circle" size={18} color="#fff" />
                      <Text style={styles.actionButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  )}

                  {booking.status === 'completed' && (
                    <View style={styles.completedBadge}>
                      <Ionicons name="checkmark-circle" size={18} color={Colors.success[500]} />
                      <Text style={styles.completedText}>Task Completed</Text>
                    </View>
                  )}

                  {booking.status === 'cancelled' && (
                    <View style={styles.cancelledBadge}>
                      <Ionicons name="close-circle" size={18} color={Colors.error[500]} />
                      <Text style={styles.cancelledText}>Task Cancelled</Text>
                    </View>
                  )}
                </View>
              </View>
            ))
          )}

          {!loading && filteredBookings.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={64} color={Colors.neutral[300]} />
              <Text style={styles.emptyTitle}>No bookings found</Text>
              <Text style={styles.emptySubtitle}>
                {selectedStatus === 'all'
                  ? "You don't have any bookings yet"
                  : `No ${selectedStatus} bookings found`}
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  containerContent: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  headerWrapper: {
    paddingTop: 0,
  },
  header: {
    backgroundColor: Colors.background.primary,
    paddingHorizontal: 20,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.neutral[900],
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: Colors.neutral[600],
  },
  headerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary[50],
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary[600],
  },
  statLabel: {
    fontSize: 11,
    color: Colors.primary[500],
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: Colors.primary[200],
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: Colors.error[500],
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  filterSection: {
    paddingVertical: 16,
    backgroundColor: Colors.background.primary,
  },
  filterScroll: {
    paddingHorizontal: 20,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.background.secondary,
    marginRight: 12,
    borderWidth: 1,
    borderColor: Colors.border.primary,
  },
  filterChipActive: {
    backgroundColor: Colors.primary[500],
    borderColor: Colors.primary[500],
  },
  filterChipText: {
    fontSize: 14,
    color: Colors.neutral[600],
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  bookingsList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingTop: 0,
    paddingBottom: 100, // Base padding, will be overridden to 120 in contentContainerStyle
    flexGrow: 1, // Ensure content can grow to fill available space
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.neutral[600],
  },
  bookingCard: {
    backgroundColor: Colors.background.primary,
    borderRadius: 16,
    padding: 20,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: Colors.border.light,
    minHeight: 200,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  bookingInfo: {
    flex: 1,
    marginRight: 12,
  },
  bookingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral[900],
    marginBottom: 4,
    flexShrink: 1,
  },
  bookingCustomer: {
    fontSize: 14,
    color: Colors.neutral[600],
  },
  statusContainer: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  taskStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  taskStatusText: {
    fontSize: 10,
    fontWeight: '500',
  },
  bookingDescription: {
    fontSize: 15,
    color: Colors.neutral[600],
    marginBottom: 16,
    lineHeight: 20,
  },
  bookingDetails: {
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  detailText: {
    fontSize: 14,
    color: Colors.neutral[500],
    marginLeft: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 6,
  },
  acceptButton: {
    backgroundColor: Colors.success[500],
  },
  declineButton: {
    backgroundColor: Colors.error[500],
  },
  startButton: {
    backgroundColor: Colors.primary[500],
  },
  completeButton: {
    backgroundColor: Colors.success[500],
  },
  chatButton: {
    backgroundColor: Colors.primary[600],
  },
  cancelButton: {
    backgroundColor: Colors.error[500],
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  completedBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: Colors.success[100],
    borderRadius: 10,
    gap: 6,
  },
  completedText: {
    color: Colors.success[600],
    fontSize: 14,
    fontWeight: '600',
  },
  cancelledBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: Colors.error[100],
    borderRadius: 10,
    gap: 6,
  },
  cancelledText: {
    color: Colors.error[600],
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral[600],
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.neutral[500],
    textAlign: 'center',
    paddingHorizontal: 40,
  },
})
