import React, { useEffect, useState, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  Modal,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useToast } from '../contexts/ToastContext'
import { Colors } from '../constants/Colors'
import { TaskService, Task } from '../services/TaskService'
import { useAuth } from '../contexts/SimpleAuthContext'
import { router } from 'expo-router'
import BottomSheet, { BottomSheetRef } from './BottomSheet'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { showConfirmation } from '../utils/alertHelper'

const { width } = Dimensions.get('window')

interface TaskDetailSheetProps {
  taskId?: string | null
  visible: boolean
  onClose: () => void
}

export default function TaskDetailSheet({ taskId, visible, onClose }: TaskDetailSheetProps) {
  const { showError } = useToast()
  const bottomSheetRef = useRef<BottomSheetRef>(null)
  const scrollViewRef = useRef<ScrollView>(null)
  const lastScrollY = useRef(0)
  const { user } = useAuth()
  const insets = useSafeAreaInsets()
  const [task, setTask] = useState<Task | null>(null)
  const [imageModalVisible, setImageModalVisible] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (visible && taskId) {
      ;(async () => {
        try {
          setLoading(true)
          const t = await TaskService.getTaskById(taskId)
          setTask(t)
        } catch (e) {
          console.error('Error loading task:', e)
        } finally {
          setLoading(false)
        }
      })()
    }
  }, [visible, taskId])

  const handleEdit = () => {
    if (!task) return
    onClose()
    router.push({ pathname: '/post-task', params: { taskId: task.id, editMode: 'true' } })
  }

  const handleDelete = async () => {
    if (!task || !user) return
    showConfirmation(
      'Delete Task',
      'Are you sure you want to delete this task?',
      async () => {
        try {
          await TaskService.deleteTask(task.id, user.id)
          onClose()
        } catch {
          // Fallback cancel
          try {
            await TaskService.updateTask(task.id, user.id, { status: 'cancelled' } as any)
            onClose()
          } catch {
            showError('Failed to delete or cancel task')
          }
        }
      },
      undefined,
      'Delete',
      'Cancel',
      'warning'
    )
  }

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentScrollY = event.nativeEvent.contentOffset.y
    const scrollDelta = currentScrollY - lastScrollY.current

    // If at the top and scrolling up (negative delta), expand to full screen
    // This happens when user tries to scroll up beyond the top
    if (currentScrollY <= 5 && scrollDelta < -5) {
      bottomSheetRef.current?.expandToFull()
    }
    // If at the top and scrolling down (positive delta), collapse from full screen
    else if (currentScrollY <= 5 && scrollDelta > 5) {
      bottomSheetRef.current?.collapseFromFull()
    }

    lastScrollY.current = currentScrollY
  }

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
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Task Details</Text>
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 20 + 120 },
          ]}
          showsVerticalScrollIndicator={true}
          bounces={true}
          alwaysBounceVertical={true}
          overScrollMode="always"
          nestedScrollEnabled={true}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {task?.photos && task.photos.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesRow}>
              {task.photos.map((uri, idx) => (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={0.9}
                  onPress={() => {
                    setSelectedImageIndex(idx)
                    setImageModalVisible(true)
                  }}
                >
                  <Image source={{ uri }} style={styles.image} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <View style={styles.section}>
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={2}>
                {task?.title}
              </Text>
            </View>
            {typeof task?.budget === 'number' && (
              <Text style={styles.price}>{task?.budget} ETB</Text>
            )}
            <Text style={styles.meta}>
              {task?.category_name || 'Task'} • {task?.city || 'Location'}
            </Text>
            {!!task?.customer_name && (
              <View style={[styles.detailRow, { marginTop: 8 }]}>
                <Ionicons name="person-circle-outline" size={18} color={Colors.neutral[500]} />
                <Text style={styles.detailText}>Posted by {task.customer_name}</Text>
              </View>
            )}
          </View>

          {!!task?.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.description}>{task.description}</Text>
            </View>
          )}

          {/* Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Details</Text>
            <View style={styles.detailRow}>
              <Ionicons name="calendar-outline" size={16} color={Colors.neutral[500]} />
              <Text style={styles.detailText}>
                {task?.task_date ? new Date(task.task_date).toLocaleDateString() : 'N/A'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={16} color={Colors.neutral[500]} />
              <Text style={styles.detailText}>
                {task?.task_time
                  ? (() => {
                      const [hours, minutes] = task.task_time.split(':').map(Number)
                      const period = hours >= 12 ? 'PM' : 'AM'
                      const displayHours = hours % 12 || 12
                      return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
                    })()
                  : 'N/A'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={16} color={Colors.neutral[500]} />
              <Text style={styles.detailText}>{task?.address || task?.city || 'N/A'}</Text>
            </View>
            {/* Size and urgency intentionally omitted */}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {task &&
            user?.id === task.customer_id &&
            (task.status === 'open' || task.status === 'draft') && (
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.editButton]}
                  onPress={handleEdit}
                >
                  <Ionicons name="pencil" size={18} color="#fff" />
                  <Text style={styles.actionText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={handleDelete}
                >
                  <Ionicons name="trash" size={18} color="#fff" />
                  <Text style={styles.actionText}>Delete</Text>
                </TouchableOpacity>
              </View>
            )}
          {task && (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                onClose()
                router.push({ pathname: '/task-applications', params: { taskId: task.id } })
              }}
            >
              <Text style={styles.primaryText}>View Applications</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Fullscreen Image Modal */}
      <Modal
        visible={imageModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setImageModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalTopBar}>
            <TouchableOpacity onPress={() => setImageModalVisible(false)} style={styles.modalClose}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: width * selectedImageIndex, y: 0 }}
            style={styles.fullscreenScroll}
          >
            {(task?.photos || []).map((uri, i) => (
              <View key={i} style={{ width, alignItems: 'center', justifyContent: 'center' }}>
                <Image source={{ uri }} style={styles.fullscreenImage} resizeMode="contain" />
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.primary,
  },
  headerTitle: { fontSize: 18, fontWeight: '600', color: Colors.neutral[800] },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 200, // Extra padding to prevent cutoff and account for footer
    paddingTop: 8,
  },
  imagesRow: { paddingHorizontal: 16, paddingTop: 12 },
  image: { width: width * 0.7, height: 180, borderRadius: 12, marginRight: 12 },
  section: {
    backgroundColor: Colors.background.primary,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.primary,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: { flex: 1, fontSize: 20, fontWeight: '700', color: Colors.neutral[900], marginRight: 8 },
  urgentBadge: {
    backgroundColor: Colors.error[500],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  urgentText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  price: { fontSize: 22, fontWeight: '800', color: Colors.primary[600], marginBottom: 4 },
  meta: { fontSize: 12, color: Colors.neutral[600] },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: Colors.neutral[900], marginBottom: 8 },
  description: { fontSize: 14, color: Colors.neutral[700], lineHeight: 20 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  detailText: { fontSize: 14, color: Colors.neutral[700] },
  footer: {
    backgroundColor: Colors.background.primary,
    padding: 12,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border.primary,
    position: 'relative',
  },
  actionsRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
  },
  editButton: { backgroundColor: Colors.primary[500] },
  deleteButton: { backgroundColor: Colors.error[500] },
  actionText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  primaryButton: {
    backgroundColor: Colors.primary[600],
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTopBar: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    zIndex: 2,
    alignItems: 'flex-end',
    paddingHorizontal: 16,
  },
  modalClose: { padding: 8 },
  fullscreenScroll: { flexGrow: 0 },
  fullscreenImage: { width: width, height: '80%' },
})
