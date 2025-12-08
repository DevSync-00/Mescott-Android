import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Image,
  Modal,
  StatusBar,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { useAuth } from '../contexts/SimpleAuthContext'
import { useToast } from '../contexts/ToastContext'
import { TaskService, Task } from '../services/TaskService'
import { TaskApplicationService } from '../services/TaskApplicationService'
import { PaymentService } from '../services/PaymentService'
import ChapaPaymentModal from '../components/ChapaPaymentModal'
import { Colors } from '../constants/Colors'
import { SkeletonCard } from '../components/SkeletonLoader'
import { showConfirmation, showInfoAlert, showErrorAlert, showSuccessAlert } from '../utils/alertHelper'
import TextureBackground from '../components/TextureBackground'

const { width } = Dimensions.get('window')

export default function TaskDetail() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const { showSuccess, showError } = useToast()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { taskId } = useLocalSearchParams()

  const [task, setTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasApplied, setHasApplied] = useState(false)
  const [imageModalVisible, setImageModalVisible] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [pendingPayments, setPendingPayments] = useState<any[]>([])
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<any>(null)

  // Refresh when screen gains focus
  useFocusEffect(
    React.useCallback(() => {
      if (isAuthenticated && taskId) {
        loadTaskDetails()
        loadPendingPayments()
      }
    }, [isAuthenticated, taskId, loadTaskDetails, loadPendingPayments]),
  )

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/auth')
      return
    }

    if (isAuthenticated && taskId) {
      loadTaskDetails()
      loadPendingPayments()
    }
  }, [taskId, isAuthenticated, isLoading, loadTaskDetails, loadPendingPayments, router])

  const loadTaskDetails = useCallback(async () => {
    if (!taskId || !user) return

    setLoading(true)
    try {
      const taskDetails = await TaskService.getTaskById(taskId as string)
      setTask(taskDetails)

      if (user.role === 'tasker' || user.role === 'both') {
        const applied = await TaskApplicationService.hasUserAppliedToTask(
          user.user_id,
          taskId as string,
        )
        setHasApplied(applied)
      }
    } catch (error) {
      console.error('Error loading task details:', error)
      showError('Failed to load task details')
    } finally {
      setLoading(false)
    }
  }, [taskId, user])

  const loadPendingPayments = useCallback(async () => {
    if (!user) return

    try {
      const payments = await PaymentService.getPendingPayments(user.id)
      setPendingPayments(payments)
    } catch (error) {
      console.error('Error loading pending payments:', error)
    }
  }, [user])

  const hasPendingPayment = (task: Task) => {
    return pendingPayments.some((p) => p.task_id === task.id)
  }

  const handlePayNow = async (task: Task) => {
    if (!user || !task.id) return

    const pendingPayment = pendingPayments.find((p) => p.task_id === task.id)

    if (!pendingPayment) {
      showError('No pending payment found for this task')
      return
    }

    setSelectedPayment(pendingPayment)
    setShowPaymentModal(true)
  }

  const handlePaymentSuccess = () => {
    loadPendingPayments()
    loadTaskDetails()
    setShowPaymentModal(false)
    setSelectedPayment(null)
  }

  const handleEditTask = () => {
    if (!task || !user) return

    router.push({
      pathname: '/post-task',
      params: {
        taskId: task.id,
        editMode: 'true',
      },
    })
  }

  const handleDeleteTask = () => {
    if (!task || !user) return

    showConfirmation(
      'Delete Task',
      'Are you sure you want to delete this task? This action cannot be undone.',
      async () => {
        try {
          await TaskService.deleteTask(task.id, user.id)
          showSuccess('Task deleted successfully')
          router.push('/jobs')
        } catch {
          try {
            await TaskService.updateTask(task.id, user.id, { status: 'cancelled' } as any)
            showInfoAlert(
              'Task Cancelled',
              'The task could not be deleted, so it was cancelled instead.'
            )
            router.push('/jobs')
          } catch (e: any) {
            showError(e?.message || 'Failed to delete or cancel task')
          }
        }
      },
      undefined,
      'Delete',
      'Cancel',
      'warning'
    )
  }

  const handleApply = async () => {
    if (!user || !task) return

    if (task.customer_id === user.id) {
      if (task.status === 'completed' && hasPendingPayment(task)) {
        handlePayNow(task)
        return
      }

      router.push(`/task-applications?taskId=${task.id}`)
      return
    }

    if (user.role !== 'tasker' && user.role !== 'both') {
      showConfirmation(
        'Become a Tasker',
        'You need to become a tasker to apply for tasks. Would you like to apply now?',
        () => router.push('/tasker-application'),
        undefined,
        'Apply Now',
        'Cancel',
        'info'
      )
      return
    }

    if (hasApplied) {
      showInfoAlert('Already Applied', 'You have already applied to this task.')
      return
    }

    router.push({
      pathname: '/apply-task',
      params: {
        taskId: task.id,
        taskTitle: task.title,
        customerName: task.customer_name,
        budget: task.budget.toString(),
      },
    })
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return Colors.success[500]
      case 'assigned':
        return Colors.primary[500]
      case 'in_progress':
        return Colors.warning[500]
      case 'completed':
        return Colors.success[600]
      case 'cancelled':
        return Colors.error[500]
      default:
        return Colors.neutral[500]
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open':
        return 'Open'
      case 'assigned':
        return 'Assigned'
      case 'in_progress':
        return 'In Progress'
      case 'completed':
        return 'Completed'
      case 'cancelled':
        return 'Cancelled'
      default:
        return 'Unknown'
    }
  }

  if (isLoading) {
    return (
      <TextureBackground>
        <SafeAreaView style={styles.container} edges={[]}>
          <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
          <View style={styles.loadingContainer}>
            <SkeletonCard style={{ marginBottom: 16, height: 200 }} />
            <SkeletonCard style={{ marginBottom: 16, height: 150 }} />
            <SkeletonCard style={{ marginBottom: 16, height: 150 }} />
          </View>
        </SafeAreaView>
      </TextureBackground>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  if (loading) {
    return (
      <TextureBackground>
        <SafeAreaView style={styles.container} edges={[]}>
          <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
          <View style={[styles.header, { paddingTop: 8 + insets.top }]}>
            <LinearGradient colors={['#f8f9fc', '#ffffff']} style={StyleSheet.absoluteFill} />
            <TouchableOpacity onPress={() => router.push('/jobs')} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={Colors.neutral[800]} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Task Details</Text>
            <View style={styles.placeholder} />
          </View>
          <View style={styles.loadingContainer}>
            <SkeletonCard style={{ marginBottom: 16, height: 200 }} />
            <SkeletonCard style={{ marginBottom: 16, height: 150 }} />
            <SkeletonCard style={{ marginBottom: 16, height: 150 }} />
          </View>
        </SafeAreaView>
      </TextureBackground>
    )
  }

  if (!task) {
    return (
      <TextureBackground>
        <SafeAreaView style={styles.container} edges={[]}>
          <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
          <View style={[styles.header, { paddingTop: 8 + insets.top }]}>
            <LinearGradient colors={['#f8f9fc', '#ffffff']} style={StyleSheet.absoluteFill} />
            <TouchableOpacity onPress={() => router.push('/jobs')} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={Colors.neutral[800]} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Task Details</Text>
            <View style={styles.placeholder} />
          </View>
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={64} color={Colors.error[500]} />
            <Text style={styles.errorTitle}>Task Not Found</Text>
            <Text style={styles.errorSubtitle}>
              This task may have been removed or doesn&apos;t exist.
            </Text>
          </View>
        </SafeAreaView>
      </TextureBackground>
    )
  }

  const images = task.images || task.photos || []

  return (
    <TextureBackground>
      <SafeAreaView style={styles.container} edges={[]}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />

      {/* Fixed Header */}
      <View style={[styles.header, { paddingTop: 8 + insets.top }]}>
        <LinearGradient colors={['#f8f9fc', '#ffffff']} style={StyleSheet.absoluteFill} />
        <TouchableOpacity onPress={() => router.push('/jobs')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.neutral[800]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Task Details</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
        alwaysBounceVertical={true}
      >
        {/* Image Carousel */}
        {images.length > 0 && (
          <View style={styles.imageSection}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / width)
                setActiveImageIndex(index)
              }}
              scrollEventThrottle={16}
            >
              {images.map((uri, index) => (
                <TouchableOpacity
                  key={index}
                  activeOpacity={0.9}
                  onPress={() => {
                    setSelectedImageIndex(index)
                    setImageModalVisible(true)
                  }}
                  style={styles.imageContainer}
                >
                  <Image source={{ uri }} style={styles.taskImage} resizeMode="cover" />
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Image Dots */}
            {images.length > 1 && (
              <View style={styles.dotsContainer}>
                {images.map((_, i) => (
                  <View key={i} style={[styles.dot, i === activeImageIndex && styles.dotActive]} />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Task Header Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.titleRow}>
              <Text style={styles.taskTitle}>{task.title}</Text>
              {task.is_urgent && (
                <View style={styles.urgentBadge}>
                  <Ionicons name="flash" size={12} color="#fff" />
                  <Text style={styles.urgentText}>URGENT</Text>
                </View>
              )}
            </View>
            <View
              style={[styles.statusBadge, { backgroundColor: getStatusColor(task.status) + '20' }]}
            >
              <Text style={[styles.statusText, { color: getStatusColor(task.status) }]}>
                {getStatusLabel(task.status)}
              </Text>
            </View>
          </View>

          <View style={styles.priceRow}>
            <View style={styles.priceContainer}>
              <Text style={styles.priceLabel}>Budget</Text>
              <Text style={styles.price}>{task.budget} ETB</Text>
            </View>
            <View style={styles.categoryContainer}>
              <Ionicons name="folder-outline" size={16} color={Colors.primary[500]} />
              <Text style={styles.categoryText}>{task.category_name}</Text>
            </View>
          </View>
        </View>

        {/* Description Card */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="document-text-outline" size={20} color={Colors.primary[500]} />
            <Text style={styles.cardTitle}>Description</Text>
          </View>
          <Text style={styles.description}>{task.description}</Text>
        </View>

        {/* Details Card */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.primary[500]} />
            <Text style={styles.cardTitle}>Task Details</Text>
          </View>

          <View style={styles.detailsList}>
            <View style={styles.detailItem}>
              <View style={styles.detailIconContainer}>
                <Ionicons name="location" size={18} color={Colors.primary[500]} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Location</Text>
                <Text style={styles.detailValue}>{task.address || task.city}</Text>
              </View>
            </View>

            {task.task_date && (
              <View style={styles.detailItem}>
                <View style={styles.detailIconContainer}>
                  <Ionicons name="calendar" size={18} color={Colors.primary[500]} />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Date</Text>
                  <Text style={styles.detailValue}>
                    {new Date(task.task_date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
              </View>
            )}

            {task.task_time && (
              <View style={styles.detailItem}>
                <View style={styles.detailIconContainer}>
                  <Ionicons name="time" size={18} color={Colors.primary[500]} />
                </View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Time</Text>
                  <Text style={styles.detailValue}>
                    {(() => {
                      const [hours, minutes] = task.task_time.split(':').map(Number)
                      const period = hours >= 12 ? 'PM' : 'AM'
                      const displayHours = hours % 12 || 12
                      return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
                    })()}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.detailItem}>
              <View style={styles.detailIconContainer}>
                <Ionicons name="person" size={18} color={Colors.primary[500]} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Posted by</Text>
                <Text style={styles.detailValue}>{task.customer_name}</Text>
              </View>
            </View>

            <View style={styles.detailItem}>
              <View style={styles.detailIconContainer}>
                <Ionicons name="time-outline" size={18} color={Colors.neutral[400]} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Posted</Text>
                <Text style={styles.detailValue}>{formatTime(task.created_at)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Customer Rating Card */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="star" size={20} color={Colors.warning[500]} />
            <Text style={styles.cardTitle}>Customer Rating</Text>
          </View>
          <View style={styles.ratingRow}>
            <View style={styles.ratingStars}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Ionicons
                  key={star}
                  name={star <= (task.customer_rating || 5) ? 'star' : 'star-outline'}
                  size={24}
                  color={Colors.warning[500]}
                />
              ))}
            </View>
            <Text style={styles.ratingText}>{(task.customer_rating || 5.0).toFixed(1)} / 5.0</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {task.customer_id === user?.id && (task.status === 'open' || task.status === 'draft') && (
            <View style={styles.ownerActions}>
              <TouchableOpacity style={styles.secondaryButton} onPress={handleEditTask}>
                <Ionicons name="pencil" size={20} color={Colors.primary[500]} />
                <Text style={styles.secondaryButtonText}>Edit Task</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dangerButton} onPress={handleDeleteTask}>
                <Ionicons name="trash-outline" size={20} color={Colors.error[500]} />
                <Text style={styles.dangerButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryButton, hasApplied && styles.appliedButton]}
            onPress={handleApply}
          >
            <LinearGradient
              colors={
                hasApplied
                  ? [Colors.neutral[300], Colors.neutral[300]]
                  : [Colors.primary[500], Colors.primary[600]]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryButtonGradient}
            >
              <Ionicons
                name={
                  task.customer_id === user?.id
                    ? 'people'
                    : hasApplied
                      ? 'checkmark-circle'
                      : 'briefcase'
                }
                size={22}
                color="#fff"
              />
              <Text style={styles.primaryButtonText}>
                {task.customer_id === user?.id
                  ? task.status === 'completed' && hasPendingPayment(task)
                    ? 'Pay Now'
                    : 'View Applications'
                  : hasApplied
                    ? 'Already Applied'
                    : 'Apply Now'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Image Viewer Modal */}
      <Modal
        visible={imageModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setImageModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <StatusBar backgroundColor="rgba(0,0,0,0.95)" barStyle="light-content" />

          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setImageModalVisible(false)}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {selectedImageIndex + 1} / {images.length}
            </Text>
            <View style={styles.placeholder} />
          </View>

          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: width * selectedImageIndex, y: 0 }}
            style={styles.modalScroll}
          >
            {images.map((uri, i) => (
              <View key={i} style={styles.modalImageContainer}>
                <Image source={{ uri }} style={styles.modalImage} resizeMode="contain" />
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Payment Modal */}
      <ChapaPaymentModal
        visible={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false)
          setSelectedPayment(null)
        }}
        payment={selectedPayment}
        onPaymentSuccess={handlePaymentSuccess}
        customerInfo={{
          email: user?.profile?.email || 'customer@mescott.com',
          firstName: user?.name?.split(' ')[0] || 'Customer',
          lastName: user?.name?.split(' ').slice(1).join(' ') || 'User',
          phone: user?.phone || '+251911234567',
        }}
      />
    </SafeAreaView>
    </TextureBackground>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.neutral[200],
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral[900],
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.error[600],
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 14,
    color: Colors.neutral[500],
    textAlign: 'center',
  },
  imageSection: {
    marginBottom: 20,
    marginHorizontal: -20,
  },
  imageContainer: {
    width,
    height: 280,
    backgroundColor: Colors.neutral[100],
  },
  taskImage: {
    width: '100%',
    height: '100%',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.neutral[300],
  },
  dotActive: {
    width: 24,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary[500],
  },
  card: {
    backgroundColor: Colors.background.primary,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.neutral[200],
  },
  cardHeader: {
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  taskTitle: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    color: Colors.neutral[900],
    marginRight: 12,
    lineHeight: 32,
  },
  urgentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.error[500],
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  urgentText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceContainer: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 12,
    color: Colors.neutral[500],
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  price: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.primary[600],
  },
  categoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary[50],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary[600],
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.neutral[900],
  },
  description: {
    fontSize: 16,
    color: Colors.neutral[700],
    lineHeight: 24,
  },
  detailsList: {
    gap: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  detailIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: Colors.neutral[500],
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral[900],
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ratingStars: {
    flexDirection: 'row',
    gap: 4,
  },
  ratingText: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.neutral[900],
  },
  actionsContainer: {
    paddingHorizontal: 0,
    paddingBottom: 20,
    gap: 12,
  },
  ownerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.neutral[100],
    borderWidth: 1,
    borderColor: Colors.neutral[300],
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral[900],
  },
  dangerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.error[50],
    borderWidth: 1,
    borderColor: Colors.error[200],
    gap: 8,
  },
  dangerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.error[600],
  },
  primaryButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: Colors.primary[500],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  appliedButton: {
    shadowOpacity: 0.1,
    elevation: 1,
  },
  primaryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  modalCloseButton: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalScroll: {
    flex: 1,
  },
  modalImageContainer: {
    width,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: width - 40,
    height: '100%',
  },
})
