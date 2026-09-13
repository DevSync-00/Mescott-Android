import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Dimensions,
  Image,
  GestureResponderEvent,
  Platform,
  FlatList,
  StatusBar,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useFocusEffect } from 'expo-router'
import { useAuth } from '../contexts/SimpleAuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { TaskService, Task } from '../services/TaskService'
import { getTaskStatusColor, getTaskStatusLabel } from '../lib/chat/taskContext'
import { ChatService } from '../services/ChatService'
import { SearchService, SearchFilters } from '../services/SearchService'
import { PaymentService, Payment } from '../services/PaymentService'
import { supabase } from '../lib/supabase'
import { getCache } from '../lib/cache'
import { isPaymentPaid } from '../lib/paymentStatus'
import AdvancedSearch from '../components/AdvancedSearch'
import LoadingErrorState from '../components/LoadingErrorState'
import ChapaPaymentModal from '../components/ChapaPaymentModal'
import JobsHeader from '../components/JobsHeader'
import { Colors } from '../constants/Colors'
import { SkeletonList } from '../components/SkeletonLoader'
// import TaskDetailSheet from '../components/TaskDetailSheet'
import { moderateFont } from '../utils/fontScale'
import TextureBackground from '../components/TextureBackground'

const { width } = Dimensions.get('window')

const categories = [
  'All',
  'General',
  'Cleaning',
  'Handyman',
  'Delivery',
  'Photography',
  'Technology',
  'Gardening',
  'Moving',
  'Pet Care',
  'Tutoring',
  'Cooking',
  'Painting',
  'Plumbing',
  'Electrical',
  'Carpentry',
  'Event Planning',
]

const budgetRanges = [
  { label: 'jobs.any_budget', min: 0, max: Infinity },
  { label: 'jobs.under_25', min: 0, max: 25 },
  { label: 'jobs.25_50', min: 25, max: 50 },
  { label: 'jobs.50_100', min: 50, max: 100 },
  { label: 'jobs.100_200', min: 100, max: 200 },
  { label: 'jobs.over_200', min: 200, max: Infinity },
]

export default function Jobs() {
  const { user, isAuthenticated, loading: isLoading } = useAuth()
  const insets = useSafeAreaInsets()
  const { t } = useLanguage()
  const router = useRouter()

  const [searchQuery] = useState('')
  const [selectedCategoryAvailable, setSelectedCategoryAvailable] = useState('All')
  const [selectedCategoryMyTasks, setSelectedCategoryMyTasks] = useState('All')
  const [activeTab, setActiveTab] = useState('available')

  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [appliedTasks, setAppliedTasks] = useState<Set<string>>(new Set())

  // Enhanced filtering states
  const [selectedBudgetRange] = useState(0)
  const [selectedSort] = useState('newest')
  const [selectedDate] = useState('any')
  const [selectedUrgency] = useState('any')
  const [selectedLocation] = useState('any')
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false)
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({})
  const [error, setError] = useState<string | null>(null)
  const [pendingPayments, setPendingPayments] = useState<Payment[]>([])
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [viewMode, setViewMode] = useState<'detailed' | 'compact'>('detailed')
  const [favoriteTasks, setFavoriteTasks] = useState<Set<string>>(new Set())
  // const [detailVisible, setDetailVisible] = useState(false)
  // const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/auth')
    }
  }, [isAuthenticated, isLoading, router])

  // Optimized batch check for applied tasks
  const checkAppliedTasks = useCallback(
    async (tasks: Task[]) => {
      if (!user || tasks.length === 0) return

      try {
        // Get user's profile ID first
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.user_id)
          .maybeSingle()

        if (!profile) return

        // Batch check all tasks in a single query
        const taskIds = tasks.map((t) => t.id)
        const { data: applications } = await supabase
          .from('task_applications')
          .select('task_id')
          .eq('tasker_id', profile.id)
          .in('task_id', taskIds)
          .in('status', ['pending', 'accepted'])

        const appliedSet = new Set<string>(
          applications?.map((app) => app.task_id) || []
        )
        setAppliedTasks(appliedSet)
      } catch (error) {
        console.error('Error checking applied tasks:', error)
      }
    },
    [user],
  )

  const loadTasks = useCallback(async () => {
    if (!user) {
      return
    }

    // Show cached data immediately for instant display
    const cacheKey = activeTab === 'available' 
      ? `tasks:available:${user.user_id}`
      : `tasks:my:${user.user_id}`
    
    const cachedTasks = await getCache<Task[]>(cacheKey)
    if (cachedTasks && cachedTasks.length > 0) {
      setTasks(cachedTasks)
      setLoading(false)
      // Check applied tasks in background
      if (activeTab === 'available' && (user.role === 'tasker' || user.role === 'both')) {
        checkAppliedTasks(cachedTasks).catch(() => {})
      }
    }

    // Load fresh data
    setLoading(true)
    try {
      let fetchedTasks: Task[] = []

      if (activeTab === 'available') {
        fetchedTasks = await TaskService.getAvailableTasks(user.user_id)
      } else {
        fetchedTasks = await TaskService.getMyTasks(user.user_id)
      }

      setTasks(fetchedTasks)

      // Check which tasks user has already applied to (in parallel)
      if (activeTab === 'available' && (user.role === 'tasker' || user.role === 'both')) {
        // Don't await - let it run in background
        checkAppliedTasks(fetchedTasks).catch(() => {})
      }
    } catch (error) {
      console.error('Error loading tasks:', error)
      // Don't show alert if we have cached data
      if (!cachedTasks || cachedTasks.length === 0) {
        Alert.alert('Error', 'Failed to load tasks')
      }
    } finally {
      setLoading(false)
    }
  }, [user, activeTab, checkAppliedTasks])

  const loadPendingPayments = useCallback(async () => {
    if (!user) return

    try {
      const payments = await PaymentService.getPendingPayments(user.user_id)
      setPendingPayments(payments)
    } catch (error) {
      console.error('Error loading pending payments:', error)
    }
  }, [user])

  useEffect(() => {
    if (isAuthenticated) {
      loadTasks()
      // Load payments in background (non-blocking)
      loadPendingPayments().catch(() => {})
    }
  }, [activeTab, user, isAuthenticated, loadTasks, loadPendingPayments])

  // Refresh tasks when screen comes into focus (but don't block UI)
  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated && user) {
        // Load fresh data in background without blocking
        loadTasks().catch(() => {})
        loadPendingPayments().catch(() => {})
      }
    }, [isAuthenticated, user, loadTasks, loadPendingPayments]),
  )

  const fabBottomOffset = 40 + insets.bottom
  const listBottomPadding = fabBottomOffset + 0

  const handlePayNow = async (task: Task) => {
    if (!user || !task.id) return

    const pendingPayment = pendingPayments.find((p) => p.task_id === task.id)

    if (!pendingPayment) {
      Alert.alert('Error', 'No pending payment found for this task')
      return
    }

    setSelectedPayment(pendingPayment)
    setShowPaymentModal(true)
  }

  const openReviewForTask = useCallback(
    (task: Task) => {
      if (!task.id || !task.tasker_id) {
        Alert.alert('Cannot review', 'This task has no assigned tasker to review.')
        return
      }
      router.push({
        pathname: '/review',
        params: {
          taskId: task.id,
          revieweeId: task.tasker_id,
          revieweeName: task.tasker_name || 'Tasker',
          taskTitle: task.title,
        },
      })
    },
    [router],
  )

  const handlePaymentSuccess = useCallback(
    async (payment?: Payment | null) => {
      await loadPendingPayments()

      const taskId = payment?.task_id
      let task: Task | null = taskId ? tasks.find((t) => t.id === taskId) ?? null : null

      if (!task && taskId) {
        task = await TaskService.getTaskById(taskId)
      }

      await loadTasks()

      if (task) {
        openReviewForTask(task)
      }
    },
    [loadPendingPayments, loadTasks, tasks, openReviewForTask],
  )

  const hasPendingPayment = (task: Task) => {
    return pendingPayments.some((p) => p.task_id === task.id)
  }

  const isTaskPaid = (task: Task) => isPaymentPaid(task.payment_status)

  if (!isAuthenticated) {
    return null
  }

  const handleAdvancedSearch = async (filters: SearchFilters) => {
    try {
      setLoading(true)
      setError(null)
      setSearchFilters(filters)

      const searchResult = await SearchService.searchTasks(filters)
      setTasks(searchResult.tasks)
    } catch (error) {
      console.error('Error in advanced search:', error)
      setError('Search failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleApplyToTask = async (taskId: string) => {
    if (!user) return

    // Check if user is a tasker
    if (user.role !== 'tasker' && user.role !== 'both') {
      Alert.alert(
        'Become a Tasker',
        'You need to become a tasker to apply for tasks. Would you like to apply now?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Apply Now',
            onPress: () => router.push('/tasker-application'),
          },
        ],
      )
      return
    }

    // Find the task to get its details
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    // Navigate to application form
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

  const filteredTasks = tasks
    .filter((task) => {
      const matchesSearch =
        searchQuery === '' ||
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description.toLowerCase().includes(searchQuery.toLowerCase())

      const selectedCategory =
        activeTab === 'available' ? selectedCategoryAvailable : selectedCategoryMyTasks
      const matchesCategory =
        selectedCategory === 'All' ||
        task.category_name?.toLowerCase() === selectedCategory.toLowerCase()

      const matchesBudget =
        selectedBudgetRange === 0 ||
        (task.budget >= budgetRanges[selectedBudgetRange].min &&
          task.budget <= budgetRanges[selectedBudgetRange].max)

      const matchesDate =
        selectedDate === 'any' ||
        (selectedDate === 'today' && task.task_date === new Date().toISOString().split('T')[0]) ||
        (selectedDate === 'tomorrow' &&
          task.task_date === new Date(Date.now() + 86400000).toISOString().split('T')[0]) ||
        (selectedDate === 'this_week' &&
          task.task_date &&
          new Date(task.task_date) <= new Date(Date.now() + 7 * 86400000))

      const matchesUrgency = selectedUrgency === 'any' || task.urgency === selectedUrgency

      const matchesLocation =
        selectedLocation === 'any' ||
        task.city?.toLowerCase().includes(selectedLocation.toLowerCase()) ||
        task.address?.toLowerCase().includes(selectedLocation.toLowerCase())

      return (
        matchesSearch &&
        matchesCategory &&
        matchesBudget &&
        matchesDate &&
        matchesUrgency &&
        matchesLocation
      )
    })
    .sort((a, b) => {
      switch (selectedSort) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'price_low':
          return a.budget - b.budget
        case 'price_high':
          return b.budget - a.budget
        case 'urgency':
          const urgencyOrder = { urgent: 3, within_week: 2, flexible: 1 }
          return (urgencyOrder[b.urgency] || 0) - (urgencyOrder[a.urgency] || 0)
        default:
          return 0
      }
    })

  const formatUrgency = (urgency?: string) => {
    if (!urgency) return ''
    const map: Record<string, string> = {
      urgent: 'Urgent',
      within_week: 'Within a week',
      flexible: 'Flexible',
    }
    return map[urgency] || urgency.replace(/_/g, ' ')
  }

  const toggleFavorite = (taskId: string) => {
    setFavoriteTasks((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })
  }

  const handleFavoritePress = (taskId: string) => (event: GestureResponderEvent) => {
    event.stopPropagation()
    toggleFavorite(taskId)
  }

  const handleViewModeChange = (mode: 'detailed' | 'compact') => {
    setViewMode(mode)
  }

  return (
    <TextureBackground>
      <SafeAreaView style={styles.container} edges={[]}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
        <View style={styles.containerContent}>
        {/* Fixed Header (does not scroll) */}
        <View style={styles.headerWrapper}>
          <JobsHeader title={activeTab === 'available' ? 'Available' : t('jobs.my_tasks')} />
        </View>

        {/* Fixed Controls: Tabs + Category chips */}
        <View style={styles.headerControls}>
          {/* Tab Navigation (fixed) */}
          <View style={styles.tabContainer}>
            <View
              style={[
                styles.tabIndicator,
                { left: activeTab === 'available' ? 4 : (width - 32 - 8) / 2 + 4 },
              ]}
            />
            <TouchableOpacity
              style={[styles.tab, activeTab === 'available' && styles.activeTab]}
              onPress={() => {
                setActiveTab('available')
              }}
              activeOpacity={0.8}
            >
              <View>
                <Text style={[styles.tabText, activeTab === 'available' && styles.activeTabText]}>
                  Available
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'my' && styles.activeTab]}
              onPress={() => {
                setActiveTab('my')
              }}
              activeOpacity={0.8}
            >
              <View>
                <Text style={[styles.tabText, activeTab === 'my' && styles.activeTabText]}>
                  My Tasks
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Divider under tab bar */}
          <View style={styles.tabDivider} />

          {/* Category Chips (fixed; for both Available and My Tasks) */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.headerChipsScroll}
            bounces={false}
            alwaysBounceVertical={false}
            overScrollMode="never"
          >
            {categories.map((category) => {
              const selectedCategory =
                activeTab === 'available' ? selectedCategoryAvailable : selectedCategoryMyTasks
              const isActive = selectedCategory === category
              const setSelectedCategory =
                activeTab === 'available'
                  ? setSelectedCategoryAvailable
                  : setSelectedCategoryMyTasks

              return (
                <TouchableOpacity
                  key={category}
                  style={[styles.filterChip, isActive && styles.filterChipActive]}
                  onPress={() => setSelectedCategory(category)}
                >
                  <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                    {category}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        </View>

        {/* Content below header */}
        <View style={styles.content}>
          {/* Tabs moved to fixed header */}

          {/* Search and advanced filters removed for this version */}

          {/* Tasks List */}
          {loading ? (
            <SkeletonList count={5} />
          ) : error ? (
            <LoadingErrorState loading={false} error={error} empty={false} onRetry={loadTasks} />
          ) : filteredTasks.length === 0 ? (
            <LoadingErrorState
              loading={false}
              error={null}
              empty={true}
              emptyMessage="No tasks found. Try adjusting your search criteria."
              emptyIcon="briefcase-outline"
              onRetry={loadTasks}
            />
          ) : (
            <FlatList
              data={filteredTasks}
              keyExtractor={(item) => item.id}
              removeClippedSubviews={Platform.OS === 'android'}
              maxToRenderPerBatch={10}
              updateCellsBatchingPeriod={50}
              windowSize={10}
              initialNumToRender={10}
              // Note: getItemLayout disabled due to dynamic heights based on viewMode
              // This is fine as FlatList will calculate automatically
              ListHeaderComponent={
                <>
                  {/* Tasker Registration Prompt */}
                  {user &&
                    user.role !== 'tasker' &&
                    user.role !== 'both' &&
                    user.tasker_application_status !== 'pending' &&
                    activeTab === 'available' && (
                      <View style={styles.taskerPrompt}>
                        <View style={styles.taskerPromptContent}>
                          <Ionicons name="briefcase" size={18} color={Colors.primary[500]} />
                          <View style={styles.taskerPromptText}>
                            <Text style={styles.taskerPromptTitle}>Want to apply for tasks?</Text>
                            <Text style={styles.taskerPromptSubtitle}>
                              Become a tasker to start earning money
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={styles.taskerPromptButton}
                            onPress={() => router.push('/tasker-application')}
                          >
                            <Text style={styles.taskerPromptButtonText}>Apply Now</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  {/* View Toggle */}
                  <View style={styles.viewToggleRow}>
                    <Text style={styles.viewToggleLabel}>Layout</Text>
                    <View style={styles.viewToggleButtons}>
                      {(['detailed', 'compact'] as const).map((mode) => (
                        <TouchableOpacity
                          key={mode}
                          style={[
                            styles.viewToggleButton,
                            viewMode === mode && styles.viewToggleButtonActive,
                          ]}
                          onPress={() => handleViewModeChange(mode)}
                        >
                          <Ionicons
                            name={mode === 'detailed' ? 'albums-outline' : 'list-outline'}
                            size={16}
                            color={viewMode === mode ? '#fff' : Colors.neutral[600]}
                          />
                          <Text
                            style={[
                              styles.viewToggleButtonText,
                              viewMode === mode && styles.viewToggleButtonTextActive,
                            ]}
                          >
                            {mode === 'detailed' ? 'Detailed' : 'Compact'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </>
              }
              renderItem={({ item: task }) => {
                const isFavorite = favoriteTasks.has(task.id)

                return (
                  <TouchableOpacity
                    style={[styles.taskCard, viewMode === 'compact' && styles.taskCardCompact]}
                    onPress={() => {
                      router.push({ pathname: '/task-detail', params: { taskId: task.id } })
                    }}
                  >
                    {/* Urgency Bar */}
                    {task.urgency && (
                      <View
                        style={[
                          styles.urgencyBar,
                          task.urgency === 'urgent' && styles.urgencyBarUrgent,
                          task.urgency === 'within_week' && styles.urgencyBarWithinWeek,
                          task.urgency === 'flexible' && styles.urgencyBarFlexible,
                        ]}
                      />
                    )}

                    {/* Task Image */}
                    {viewMode === 'detailed' && task.photos && task.photos.length > 0 && (
                      <View style={styles.taskImageContainer}>
                        <Image
                          source={{ uri: task.photos[0], cache: 'force-cache' }}
                          style={styles.taskImage}
                          resizeMode="cover"
                          progressiveRenderingEnabled={true}
                        />
                        {/* Image overlay with count badge */}
                        {task.photos.length > 1 && (
                          <View style={styles.imageOverlay}>
                            <View style={styles.imageCountBadge}>
                              <Text style={styles.imageCountText}>+{task.photos.length - 1}</Text>
                            </View>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Task Header */}
                    <View style={styles.taskHeader}>
                      <View style={styles.taskTitleRow}>
                        <Text style={styles.taskTitle} numberOfLines={1} ellipsizeMode="tail">
                          {task.title}
                        </Text>
                      </View>
                      <View style={styles.headerActions}>
                        <View style={styles.priceContainer}>
                          <Text style={styles.taskPrice}>{task.budget} ETB</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.favoriteButton}
                          onPress={handleFavoritePress(task.id)}
                        >
                          <Ionicons
                            name={isFavorite ? 'heart' : 'heart-outline'}
                            size={18}
                            color={isFavorite ? Colors.error[400] : Colors.neutral[400]}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {(task.category_name || task.urgency) && (
                      <View style={styles.taskBadgesRow}>
                        {task.category_name && (
                          <View style={styles.badge}>
                            <Ionicons
                              name="pricetag-outline"
                              size={12}
                              color={Colors.primary[500]}
                            />
                            <Text style={styles.badgeText}>{task.category_name}</Text>
                          </View>
                        )}
                        {task.urgency && (
                          <View style={[styles.badge, styles.badgeUrgent]}>
                            <Ionicons name="flash" size={12} color={Colors.error[500]} />
                            <Text style={[styles.badgeText, styles.badgeTextUrgent]}>
                              {formatUrgency(task.urgency)}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Task Description */}
                    {viewMode === 'detailed' && (
                      <View style={styles.descriptionContainer}>
                        <Text style={styles.taskDescription} numberOfLines={3} ellipsizeMode="tail">
                          {task.description}
                        </Text>
                      </View>
                    )}

                    {/* Task Meta */}
                    <View
                      style={[styles.taskMeta, viewMode === 'compact' && styles.taskMetaCompact]}
                    >
                      <View style={styles.metaItem}>
                        <Ionicons name="location-outline" size={16} color={Colors.neutral[500]} />
                        <Text style={styles.metaText} numberOfLines={1} ellipsizeMode="tail">
                          {task.address}
                        </Text>
                      </View>
                      {task.task_date && (
                        <View style={styles.metaItem}>
                          <Ionicons name="calendar-outline" size={16} color={Colors.primary[500]} />
                          <Text style={styles.metaText}>
                            {new Date(task.task_date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </Text>
                        </View>
                      )}
                      {task.task_time && (
                        <View style={styles.metaItem}>
                          <Ionicons name="time-outline" size={16} color={Colors.primary[500]} />
                          <Text style={styles.metaText}>
                            {(() => {
                              const [hours, minutes] = task.task_time.split(':').map(Number)
                              const period = hours >= 12 ? 'PM' : 'AM'
                              const displayHours = hours % 12 || 12
                              return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
                            })()}
                          </Text>
                        </View>
                      )}
                      {task.flexible_date && (
                        <View style={styles.metaItem}>
                          <Ionicons name="refresh-outline" size={16} color={Colors.neutral[500]} />
                          <Text style={styles.metaText}>Flexible</Text>
                        </View>
                      )}
                    </View>

                    {/* Task Footer */}
                    <View style={styles.taskFooter}>
                      <View style={styles.footerTopRow}>
                        <View style={styles.taskTags}>
                          <View style={styles.categoryTag}>
                            <Text style={styles.categoryTagText}>{task.category_name}</Text>
                          </View>
                          {activeTab === 'my' && task.status !== 'assigned' && (
                            <View
                              style={[
                                styles.statusTag,
                                { backgroundColor: getTaskStatusColor(task.status) + '15' },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.statusTagText,
                                  { color: getTaskStatusColor(task.status) },
                                ]}
                              >
                                {getTaskStatusLabel(task.status)}
                              </Text>
                            </View>
                          )}
                        </View>

                        {/* Action Button - Different for available vs my tasks */}
                        {activeTab === 'available' ? (
                          <TouchableOpacity
                            style={[
                              styles.actionButton,
                              appliedTasks.has(task.id) && styles.appliedButton,
                            ]}
                            onPress={(e) => {
                              e.stopPropagation()
                              if (appliedTasks.has(task.id)) {
                                Alert.alert(
                                  'Already Applied',
                                  'You have already applied to this task.',
                                )
                              } else {
                                handleApplyToTask(task.id)
                              }
                            }}
                          >
                            <Text
                              style={[
                                styles.actionButtonText,
                                appliedTasks.has(task.id) && styles.appliedButtonText,
                              ]}
                            >
                              {appliedTasks.has(task.id) ? 'Already Applied' : 'Apply'}
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          // My Tasks - Show different actions based on task status
                          <>
                            {task.status === 'completed' ? (
                              hasPendingPayment(task) ? (
                                <TouchableOpacity
                                  style={[styles.actionButton, styles.payButton]}
                                  onPress={(e) => {
                                    e.stopPropagation()
                                    handlePayNow(task)
                                  }}
                                >
                                  <Ionicons name="card" size={16} color="#fff" />
                                  <Text style={styles.actionButtonText}>Pay Now</Text>
                                </TouchableOpacity>
                              ) : isTaskPaid(task) ? (
                                <View style={styles.completedBadge}>
                                  <Ionicons
                                    name="checkmark-circle"
                                    size={16}
                                    color={Colors.success[500]}
                                  />
                                  <Text style={styles.completedText}>Paid</Text>
                                </View>
                              ) : (
                                <View style={styles.paymentPendingBadge}>
                                  <Ionicons
                                    name="time-outline"
                                    size={16}
                                    color={Colors.warning[600]}
                                  />
                                  <Text style={styles.paymentPendingText}>Payment Pending</Text>
                                </View>
                              )
                            ) : task.tasker_id ? (
                              <TouchableOpacity
                                style={[styles.actionButton, styles.messageButton]}
                                onPress={async (e) => {
                                  e.stopPropagation()
                                  if (!user?.id || !task.tasker_id) {
                                    Alert.alert(
                                      'Error',
                                      'Unable to start chat. Missing user or tasker information.',
                                    )
                                    return
                                  }

                                  try {
                                    // Get or create chat for this task
                                    const chat = await ChatService.getOrCreateChat(
                                      task.id,
                                      user.id, // This is the profile ID
                                      task.tasker_id, // This is also a profile ID
                                    )

                                    if (chat) {
                                      router.push({
                                        pathname: '/chat-detail',
                                        params: {
                                          chatId: chat.id,
                                          taskId: task.id,
                                          taskTitle: task.title,
                                          otherUserName: task.tasker_name || 'Tasker',
                                        },
                                      })
                                    } else {
                                      Alert.alert(
                                        'Error',
                                        'Unable to start chat. Please try again.',
                                      )
                                    }
                                  } catch (error) {
                                    console.error('Error creating chat:', error)
                                    Alert.alert('Error', 'Unable to start chat. Please try again.')
                                  }
                                }}
                              >
                                <Ionicons name="chatbubble" size={16} color="#fff" />
                                <Text style={styles.actionButtonText}>Message</Text>
                              </TouchableOpacity>
                            ) : (
                              <TouchableOpacity
                                style={styles.actionButton}
                                onPress={(e) => {
                                  e.stopPropagation()
                                  router.push({
                                    pathname: '/task-applications',
                                    params: { taskId: task.id },
                                  })
                                }}
                              >
                                <Text style={styles.actionButtonText}>View Applications</Text>
                              </TouchableOpacity>
                            )}
                          </>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                )
              }}
              style={styles.tasksList}
              contentContainerStyle={[styles.scrollContent, { paddingBottom: listBottomPadding }]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>
      </View>

      {/* Advanced Search Modal */}
      <AdvancedSearch
        visible={showAdvancedSearch}
        onClose={() => setShowAdvancedSearch(false)}
        onSearch={handleAdvancedSearch}
        initialFilters={searchFilters}
      />

      {/* Payment Modal */}
      <ChapaPaymentModal
        visible={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false)
          setSelectedPayment(null)
        }}
        payment={selectedPayment}
        onPaymentSuccess={(payment) => {
          handlePaymentSuccess(payment)
        }}
        customerInfo={{
          email: user?.profile?.email || 'customer@mescott.co',
          firstName: user?.name?.split(' ')[0] || 'Customer',
          lastName: user?.name?.split(' ').slice(1).join(' ') || 'User',
          phone: user?.phone || '+251911234567',
        }}
      />

      {/* Task Detail navigates to full page now; sheet removed */}

      {/* Floating Create Task Button */}
      <View
        style={[
          styles.fab,
          {
            bottom: fabBottomOffset, // Moved up dynamically with safe area
            right: 20,
          },
        ]}
      >
        <View style={styles.fabRingOuter} pointerEvents="none" />
        <View style={styles.fabRingInner} pointerEvents="none" />
        <TouchableOpacity
          style={styles.fabButton}
          onPress={() => {
            router.push({ pathname: '/post-task' })
          }}
          activeOpacity={1}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
    </TextureBackground>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  containerContent: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    flex: 1,
  },
  headerWrapper: {
    paddingTop: 0,
  },
  headerControls: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
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
    fontSize: moderateFont(12),
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12, // spacing between tabs and search
    marginBottom: 12, // breathing room below search
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: moderateFont(16),
    color: Colors.neutral[900],
    marginLeft: 12,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 0,
    borderRadius: 14,
    paddingVertical: 4,
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  tabIndicator: {
    position: 'absolute',
    left: 0,
    top: 4,
    bottom: 4,
    width: (width - 32 - 8) / 2,
    backgroundColor: Colors.primary[500],
    borderRadius: 10,
    zIndex: 0,
  },
  tabDivider: {
    height: 1,
    backgroundColor: Colors.border.light,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  activeTab: {
    backgroundColor: 'transparent',
  },
  tabText: {
    fontSize: moderateFont(16),
    fontWeight: '500',
    color: Colors.neutral[600],
    letterSpacing: 0.2,
  },
  activeTabText: {
    fontSize: moderateFont(16),
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  filtersSection: {
    paddingVertical: 16,
    backgroundColor: Colors.background.primary,
  },
  filtersScroll: {
    paddingHorizontal: 20,
  },
  headerChipsScroll: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
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
    fontSize: moderateFont(14),
    color: Colors.neutral[600],
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  filterButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: Colors.primary[50],
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary[500],
  },
  filterPanel: {
    backgroundColor: Colors.background.primary,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  filterScroll: {
    flexDirection: 'row',
  },
  filterSection: {
    marginRight: 24,
    minWidth: 200,
  },
  filterLabel: {
    fontSize: moderateFont(14),
    fontWeight: '600',
    color: Colors.neutral[700],
    marginBottom: 8,
  },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.primary[50],
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.primary[200],
    marginLeft: 16,
  },
  clearFiltersText: {
    fontSize: moderateFont(12),
    fontWeight: '600',
    color: Colors.primary[600],
    marginLeft: 4,
  },
  tasksList: {
    flex: 1,
    backgroundColor: '#FAFAFA', // Match container background
  },
  scrollContent: {
    paddingTop: 16, // Add spacing between tab section and first task card
    paddingBottom: 8, // Reduced padding for less white space
    flexGrow: 1, // Ensure content can grow to fill available space
  },
  viewToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
  },
  viewToggleLabel: {
    fontSize: moderateFont(14),
    fontWeight: '600',
    color: Colors.neutral[700],
  },
  viewToggleButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  viewToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border.light,
    backgroundColor: '#fff',
    gap: 6,
  },
  viewToggleButtonActive: {
    backgroundColor: Colors.primary[500],
    borderColor: Colors.primary[500],
  },
  viewToggleButtonText: {
    fontSize: moderateFont(12),
    fontWeight: '600',
    color: Colors.neutral[600],
    textTransform: 'capitalize',
  },
  viewToggleButtonTextActive: {
    color: '#fff',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: moderateFont(16),
    color: Colors.neutral[600],
  },
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8, // Increased vertical spacing between cards
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 0.5,
    borderColor: Colors.neutral[200],
    overflow: 'hidden',
  },
  urgencyBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    zIndex: 1,
  },
  urgencyBarUrgent: {
    backgroundColor: Colors.error[500],
  },
  urgencyBarWithinWeek: {
    backgroundColor: Colors.warning[500],
  },
  urgencyBarFlexible: {
    backgroundColor: Colors.success[500],
  },
  taskCardCompact: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  taskImageContainer: {
    position: 'relative',
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  taskImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  imageCountBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  imageCountText: {
    color: 'white',
    fontSize: moderateFont(12),
    fontWeight: '600',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 8,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  taskTitleRow: {
    flex: 1,
    marginRight: 12,
  },
  taskTitle: {
    fontSize: moderateFont(16),
    fontWeight: '600',
    color: Colors.neutral[900],
    lineHeight: moderateFont(20),
  },
  priceContainer: {
    backgroundColor: Colors.primary[50],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary[200],
  },
  taskPrice: {
    fontSize: moderateFont(16),
    fontWeight: '700', // Bold font for price
    color: Colors.primary[600],
  },
  favoriteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border.light,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background.primary,
  },
  taskBadgesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: Colors.neutral[100],
    gap: 4,
  },
  badgeUrgent: {
    backgroundColor: Colors.error[50],
  },
  badgeText: {
    fontSize: moderateFont(11),
    color: Colors.neutral[700],
    fontWeight: '600',
  },
  badgeTextUrgent: {
    color: Colors.error[600],
  },
  descriptionContainer: {
    marginBottom: 10,
  },
  taskDescription: {
    fontSize: moderateFont(14),
    color: Colors.neutral[600],
    lineHeight: moderateFont(18),
  },
  taskMeta: {
    flexDirection: 'row',
    marginBottom: 10,
    gap: 16,
  },
  taskMetaCompact: {
    flexWrap: 'wrap',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  metaText: {
    fontSize: moderateFont(12),
    color: Colors.neutral[500],
    marginLeft: 4,
  },
  taskFooter: {
    paddingTop: 8,
  },
  footerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    gap: 12,
  },
  taskTags: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  categoryTag: {
    backgroundColor: Colors.primary[100],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  categoryTagText: {
    fontSize: moderateFont(11),
    color: Colors.primary[600],
    fontWeight: '600',
  },
  ratingTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warning[100],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  ratingText: {
    fontSize: moderateFont(12),
    color: Colors.warning[700],
    marginLeft: 4,
    fontWeight: '600',
  },
  statusTag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusTagText: {
    fontSize: moderateFont(12),
    fontWeight: '600',
  },
  actionButton: {
    backgroundColor: Colors.primary[500],
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: moderateFont(14),
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  appliedButton: {
    backgroundColor: Colors.neutral[200],
    borderColor: Colors.neutral[300],
    shadowOpacity: 0.1,
  },
  appliedButtonText: {
    color: Colors.neutral[500],
    fontWeight: '600',
  },
  payButton: {
    backgroundColor: Colors.success[600],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: Colors.success[600],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: Colors.success[700],
  },
  rateButton: {
    backgroundColor: Colors.warning[500],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: Colors.warning[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: Colors.warning[600],
  },
  messageButton: {
    backgroundColor: Colors.primary[500],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success[100],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  completedText: {
    color: Colors.success[600],
    fontSize: moderateFont(12),
    fontWeight: '600',
  },
  paymentPendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warning[100],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  paymentPendingText: {
    color: Colors.warning[600],
    fontSize: moderateFont(12),
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: moderateFont(18),
    fontWeight: '600',
    color: Colors.neutral[600],
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: moderateFont(14),
    color: Colors.neutral[500],
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  taskerPrompt: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: Colors.primary[50],
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary[200],
  },
  taskerPromptContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  taskerPromptText: {
    flex: 1,
  },
  taskerPromptTitle: {
    fontSize: moderateFont(14),
    fontWeight: '600',
    color: Colors.primary[700],
    marginBottom: 1,
  },
  taskerPromptSubtitle: {
    fontSize: moderateFont(12),
    color: Colors.primary[600],
  },
  taskerPromptButton: {
    backgroundColor: Colors.primary[500],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  taskerPromptButtonText: {
    color: '#fff',
    fontSize: moderateFont(12),
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary[500],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
    zIndex: 1000,
  },
  fabRingOuter: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: Colors.primary[300],
    opacity: 0.4,
    zIndex: 0,
  },
  fabRingInner: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
    borderColor: Colors.primary[400],
    opacity: 0.6,
    zIndex: 0,
  },
  fabButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    zIndex: 1,
    shadowColor: Colors.primary[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
})
