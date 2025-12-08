import React, { useEffect, useState, useRef, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  TextInput,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StatusBar,
} from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useAuth } from '../contexts/SimpleAuthContext'
import { useNotifications } from '../contexts/NotificationContext'
import { TaskService, Task } from '../services/TaskService'
import { Colors } from '../constants/Colors'
import { SkeletonList } from '../components/SkeletonLoader'
import NotificationsSheet from '../components/NotificationsSheet'
import CategorySearchSheet from '../components/CategorySearchSheet'
import { CATEGORIES } from '../constants/Categories'
import TextureBackground from '../components/TextureBackground'
// import TaskDetailSheet from '../components/TaskDetailSheet'

// Splash screen is handled in _layout.tsx

const { width } = Dimensions.get('window')

export default function Index() {
  const { isAuthenticated, loading: isLoading, user } = useAuth()
  const insets = useSafeAreaInsets()
  const { unreadCount } = useNotifications()
  const [featuredTasks, setFeaturedTasks] = useState<Task[]>([])
  const [loadingTasks, setLoadingTasks] = useState(true)
  const [notificationsVisible, setNotificationsVisible] = useState(false)
  const [showAllCategories, setShowAllCategories] = useState(false)
  const [categorySearchVisible, setCategorySearchVisible] = useState(false)
  // const [taskDetailVisible, setTaskDetailVisible] = useState(false)
  // const [selectedTaskIdForDetail, setSelectedTaskIdForDetail] = useState<string | null>(null)

  const loadTasks = useCallback(async () => {
    if (!user) return

    try {
      setLoadingTasks(true)

      // Load all available tasks to filter for featured
      const allTasks = await TaskService.getAvailableTasks(user.user_id)

      // Filter featured tasks: budget over 5000 birr OR General category
      const featuredTasksFiltered = allTasks.filter((task) => {
        const isHighBudget = task.budget > 5000
        const isGeneralCategory = task.category_name === 'General'
        return isHighBudget || isGeneralCategory
      })

      // Sort by budget (highest first), then by creation date (newest first)
      const sortedFeatured = featuredTasksFiltered.sort((a, b) => {
        if (b.budget !== a.budget) {
          return b.budget - a.budget
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })

      setFeaturedTasks(sortedFeatured.slice(0, 4)) // Show top 4
    } catch (error) {
      console.error('Error loading tasks:', error)
    } finally {
      setLoadingTasks(false)
    }
  }, [user])

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/auth')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isAuthenticated])

  useEffect(() => {
    loadTasks()
  }, [user, loadTasks])

  const scrollViewRef = useRef<ScrollView>(null)

  // Splash screen is handled in _layout.tsx

  if (isLoading) {
    return null // Let the native splash screen show
  }

  if (!isAuthenticated) {
    return null
  }

  const goToAuth = () => router.push('/auth')
  const goToJobs = () => router.push('/jobs')
  const goToPostTask = () => router.push('/post-task')
  const goToCategory = (categoryName: string) => {
    router.push({
      pathname: '/post-task',
      params: { category: categoryName },
    })
  }

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y
    // Prevent any top bounce - header should stay fixed
    if (offsetY < 0 && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: 0, animated: false })
    }
  }

  return (
    <TextureBackground>
      <SafeAreaView style={styles.container} edges={[]}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
        <View style={styles.containerContent}>
        {/* Fixed Header */}
        <View style={[styles.headerWrapper, { paddingTop: 8 + insets.top }]}>
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <View style={styles.greetingContainer}>
                <View style={styles.brandContainer}>
                  <Text style={styles.brandText}>MESCO</Text>
                  <Image
                    source={require('../assets/images/splash-icon-dark.png')}
                    style={styles.brandIcon}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                  />
                </View>
              </View>
              <View style={styles.headerButtons}>
                <TouchableOpacity
                  style={styles.notificationButton}
                  onPress={() => setNotificationsVisible(true)}
                >
                  <Ionicons name="notifications-outline" size={22} color={Colors.neutral[600]} />
                  {unreadCount > 0 && (
                    <View style={styles.notificationBadge}>
                      <Text style={styles.notificationCount}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Search Bar */}
            <TouchableOpacity
              style={styles.searchContainer}
              onPress={() => setCategorySearchVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="search" size={20} color={Colors.neutral[400]} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search for services..."
                placeholderTextColor={Colors.neutral[400]}
                editable={false}
                pointerEvents="none"
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Scrollable Content */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          bounces={true}
          alwaysBounceVertical={true}
          showsVerticalScrollIndicator={false}
          overScrollMode="always"
          scrollEventThrottle={16}
          onScroll={handleScroll}
        >
          {/* Quick Actions */}
          <View style={styles.quickActionsSection}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.quickActions}>
              <TouchableOpacity style={styles.quickActionCard} onPress={goToPostTask}>
                <View style={[styles.quickActionIcon, { backgroundColor: Colors.primary[100] }]}>
                  <Ionicons name="add-circle" size={24} color={Colors.primary[500]} />
                </View>
                <Text style={styles.quickActionText}>Post a Task</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.quickActionCard} onPress={goToJobs}>
                <View style={[styles.quickActionIcon, { backgroundColor: Colors.success[100] }]}>
                  <Ionicons name="briefcase" size={24} color={Colors.success[500]} />
                </View>
                <Text style={styles.quickActionText}>Find Work</Text>
              </TouchableOpacity>

              {!isAuthenticated && (
                <TouchableOpacity style={styles.quickActionCard} onPress={goToAuth}>
                  <View style={[styles.quickActionIcon, { backgroundColor: Colors.warning[100] }]}>
                    <Ionicons name="log-in" size={24} color={Colors.warning[500]} />
                  </View>
                  <Text style={styles.quickActionText}>Get Started</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Featured Tasks */}
          <View style={styles.featuredSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Featured Tasks</Text>
              <TouchableOpacity onPress={() => router.push('/jobs')}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>
            {loadingTasks ? (
              <View style={styles.emptyState}>
                <SkeletonList count={3} />
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.featuredScroll}
                contentContainerStyle={styles.featuredScrollContent}
              >
                {featuredTasks.map((task) => (
                  <TouchableOpacity
                    key={task.id}
                    style={styles.serviceCard}
                    onPress={() =>
                      router.push({ pathname: '/task-detail', params: { taskId: task.id } })
                    }
                  >
                    {/* Task Image */}
                    {task.photos && task.photos.length > 0 ? (
                      <View style={styles.serviceImageContainer}>
                        <Image
                          source={{ uri: task.photos[0] }}
                          style={styles.serviceImage}
                          resizeMode="cover"
                        />
                        {task.photos.length > 1 && (
                          <View style={styles.serviceImageCountBadge}>
                            <Text style={styles.serviceImageCountText}>
                              +{task.photos.length - 1}
                            </Text>
                          </View>
                        )}
                      </View>
                    ) : (
                      <View style={styles.serviceHeader}>
                        <View style={styles.serviceIconContainer}>
                          <Ionicons name="briefcase" size={24} color={Colors.primary[500]} />
                        </View>
                        {task.urgency === 'urgent' && (
                          <View style={styles.urgentBadge}>
                            <Ionicons name="flash" size={12} color="#FF6B6B" />
                          </View>
                        )}
                      </View>
                    )}
                    <Text style={styles.serviceTitle} numberOfLines={2}>
                      {task.title}
                    </Text>
                    <Text style={styles.serviceCategory}>{task.category_name || 'Task'}</Text>
                    {(task.task_date || task.task_time) && (
                      <View style={styles.serviceDateTime}>
                        {task.task_date && (
                          <View style={styles.dateTimeItem}>
                            <Ionicons
                              name="calendar-outline"
                              size={12}
                              color={Colors.primary[500]}
                            />
                            <Text style={styles.dateTimeText}>
                              {new Date(task.task_date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </Text>
                          </View>
                        )}
                        {task.task_time && (
                          <View style={styles.dateTimeItem}>
                            <Ionicons name="time-outline" size={12} color={Colors.primary[500]} />
                            <Text style={styles.dateTimeText}>
                              {(() => {
                                const [hours, minutes] = task.task_time.split(':').map(Number)
                                const period = hours >= 12 ? 'PM' : 'AM'
                                const displayHours = hours % 12 || 12
                                return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
                              })()}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                    <View style={styles.serviceFooter}>
                      <Text style={styles.servicePrice}>{task.budget} ETB</Text>
                      <Text style={styles.serviceReviews}>{task.city || 'Location'}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
                {featuredTasks.length === 0 && (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>No featured tasks available</Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>

          {/* Categories Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Browse Categories</Text>
              <TouchableOpacity onPress={() => setShowAllCategories(!showAllCategories)}>
                <Text style={styles.seeAllText}>{showAllCategories ? 'See Less' : 'See All'}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.categoriesGrid}>
              {(showAllCategories ? CATEGORIES : CATEGORIES.slice(0, 6)).map((category, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.categoryCard}
                  onPress={() => goToCategory(category.name)}
                >
                  <View style={[styles.categoryIcon, { backgroundColor: category.color + '20' }]}>
                    <Ionicons name={category.icon as any} size={28} color={category.color} />
                  </View>
                  <Text style={styles.categoryText}>{category.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* How It Works */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>How Mescott Works</Text>
            <View style={styles.stepsContainer}>
              {[
                {
                  number: '1',
                  title: 'Post a Task',
                  description: 'Tell us what you need done, when and where.',
                },
                {
                  number: '2',
                  title: 'Choose Your Tasker',
                  description: 'Browse qualified taskers by skills, reviews, and price.',
                },
                {
                  number: '3',
                  title: 'Get It Done',
                  description: 'Your tasker arrives and gets the job done.',
                },
              ].map((step, index) => (
                <View key={index} style={styles.stepCard}>
                  <View style={styles.stepNumberContainer}>
                    <Text style={styles.stepNumber}>{step.number}</Text>
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>{step.title}</Text>
                    <Text style={styles.stepDescription}>{step.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
        <NotificationsSheet
          visible={notificationsVisible}
          onClose={() => setNotificationsVisible(false)}
        />
        <CategorySearchSheet
          visible={categorySearchVisible}
          onClose={() => setCategorySearchVisible(false)}
          onSelectCategory={(name) => {
            setCategorySearchVisible(false)
            router.push({ pathname: '/post-task', params: { category: name } })
          }}
        />
        {/* Task Detail navigates to full page now; sheet removed */}
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
  content: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  headerWrapper: {
    paddingTop: 0,
  },
  header: {
    backgroundColor: Colors.background.primary,
    paddingHorizontal: 20,
    paddingVertical: 4,
    borderBottomWidth: 0,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  greetingContainer: {
    flex: 1,
    marginRight: 12,
    minWidth: 0,
  },
  greeting: {
    fontSize: 16,
    color: Colors.neutral[600],
    marginBottom: 4,
  },
  userName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.primary[500],
    marginTop: 4,
    letterSpacing: 0.5,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  brandText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.primary[500],
    marginTop: 4,
    letterSpacing: 0.5,
  },
  brandIcon: {
    width: 44,
    height: 44,
    marginLeft: -2,
    marginTop: -2,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.secondary,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border.primary,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.neutral[900],
    marginLeft: 12,
  },
  filterButton: {
    padding: 4,
  },
  quickActionsSection: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: Colors.background.primary,
    marginTop: 8,
    marginBottom: 8,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: Colors.background.primary,
    marginBottom: 20,
  },
  featuredSection: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 0,
    backgroundColor: Colors.background.primary,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.neutral[900],
  },
  seeAllText: {
    fontSize: 14,
    color: Colors.primary[500],
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 10,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.neutral[700],
    textAlign: 'center',
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  categoryCard: {
    width: (width - 52) / 2,
    backgroundColor: Colors.background.secondary,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  categoryIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.neutral[700],
    textAlign: 'center',
  },
  featuredScroll: {
    marginHorizontal: -20,
  },
  featuredScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  serviceCard: {
    width: 220,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 0.5,
    borderColor: Colors.border.light,
  },
  serviceImageContainer: {
    position: 'relative',
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  serviceImage: {
    width: '100%',
    height: 120,
    borderRadius: 12,
  },
  serviceImageCountBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  serviceImageCountText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  serviceIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary[200],
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warning[100],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ratingText: {
    fontSize: 12,
    color: Colors.warning[700],
    marginLeft: 4,
    fontWeight: '600',
  },
  serviceTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.neutral[900],
    marginBottom: 6,
    lineHeight: 20,
  },
  serviceCategory: {
    fontSize: 11,
    color: Colors.primary[600],
    marginBottom: 8,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  serviceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  servicePrice: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primary[600],
  },
  serviceReviews: {
    fontSize: 11,
    color: Colors.neutral[600],
    fontWeight: '500',
  },
  urgentBadge: {
    backgroundColor: '#FF6B6B20',
    borderRadius: 8,
    padding: 4,
  },
  emptyState: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.neutral[500],

    textAlign: 'center',
  },
  loadingTextSmall: {
    fontSize: 12,
    color: Colors.neutral[500],
    marginTop: 4,
  },
  stepsContainer: {
    gap: 10,
    marginTop: 10,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.secondary,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  stepNumberContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  stepNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral[900],
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 14,
    color: Colors.neutral[600],
    lineHeight: 20,
  },
  serviceDateTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 6,
    marginBottom: 12,
  },
  dateTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateTimeText: {
    fontSize: 10,
    color: Colors.neutral[600],
    fontWeight: '600',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
})
