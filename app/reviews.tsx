import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  RefreshControl,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useAuth } from '../contexts/SimpleAuthContext'
import { RatingService, Review } from '../services/RatingService'
import ReviewCard from '../components/ReviewCard'
import RatingStars from '../components/RatingStars'
import Colors from '../constants/Colors'

export default function ReviewsScreen() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const { userId, userName } = useLocalSearchParams()
  const [reviews, setReviews] = useState<Review[]>([])
  const [averageRating, setAverageRating] = useState(0)
  const [totalReviews, setTotalReviews] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/auth')
    } else if (isAuthenticated && userId) {
      loadReviews()
    }
  }, [isAuthenticated, userId, isLoading])

  const loadReviews = async () => {
    try {
      setLoading(true)
      const [reviewsData, ratingData] = await Promise.all([
        RatingService.getUserReviews(userId as string),
        RatingService.getUserAverageRating(userId as string)
      ])
      
      setReviews(reviewsData)
      setAverageRating(ratingData.average)
      setTotalReviews(ratingData.count)
    } catch (error) {
      console.error('Error loading reviews:', error)
      Alert.alert('Error', 'Failed to load reviews')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadReviews()
    setRefreshing(false)
  }

  const handleWriteReview = () => {
    // This would navigate to a task selection screen or review form
    Alert.alert('Write Review', 'Select a completed task to review')
  }

  // Show loading while auth is being determined
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading reviews...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.push('/jobs')}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.neutral[900]} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{userName}&apos;s Reviews</Text>
          <Text style={styles.headerSubtitle}>{totalReviews} reviews</Text>
        </View>
        <TouchableOpacity 
          style={styles.writeReviewButton}
          onPress={handleWriteReview}
        >
          <Ionicons name="create" size={20} color={Colors.primary[500]} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Rating Summary */}
        <View style={styles.ratingSummary}>
          <View style={styles.ratingDisplay}>
            <Text style={styles.averageRating}>{averageRating.toFixed(1)}</Text>
            <RatingStars rating={averageRating} readonly size={24} />
            <Text style={styles.totalReviews}>{totalReviews} reviews</Text>
          </View>
          
          {/* Rating Breakdown */}
          <View style={styles.ratingBreakdown}>
            {[5, 4, 3, 2, 1].map((star) => {
              const count = reviews.filter(r => r.rating === star).length
              const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0
              
              return (
                <View key={star} style={styles.ratingBar}>
                  <Text style={styles.starLabel}>{star}★</Text>
                  <View style={styles.barContainer}>
                    <View style={[styles.bar, { width: `${percentage}%` }]} />
                  </View>
                  <Text style={styles.barCount}>{count}</Text>
                </View>
              )
            })}
          </View>
        </View>

        {/* Reviews List */}
        <View style={styles.reviewsSection}>
          <Text style={styles.sectionTitle}>All Reviews</Text>
          
          {reviews.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="star-outline" size={48} color={Colors.neutral[300]} />
              <Text style={styles.emptyTitle}>No reviews yet</Text>
              <Text style={styles.emptySubtitle}>
                This user hasn&apos;t received any reviews yet.
              </Text>
            </View>
          ) : (
            reviews.map((review) => (
              <ReviewCard
                key={review.id}
                id={review.id}
                reviewerName={review.reviewer_name || 'Anonymous'}
                reviewerAvatar={undefined}
                rating={review.rating}
                comment={review.comment}
                createdAt={review.created_at}
                reviewType={review.review_type}
                taskTitle={review.task_title}
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.neutral[600],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.primary,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.neutral[900],
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.neutral[600],
  },
  writeReviewButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  ratingSummary: {
    backgroundColor: Colors.background.primary,
    margin: 20,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border.primary,
  },
  ratingDisplay: {
    alignItems: 'center',
    marginBottom: 20,
  },
  averageRating: {
    fontSize: 48,
    fontWeight: 'bold',
    color: Colors.primary[600],
    marginBottom: 8,
  },
  totalReviews: {
    fontSize: 14,
    color: Colors.neutral[600],
    marginTop: 4,
  },
  ratingBreakdown: {
    gap: 8,
  },
  ratingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  starLabel: {
    fontSize: 14,
    color: Colors.neutral[700],
    width: 24,
  },
  barContainer: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.neutral[200],
    borderRadius: 4,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    backgroundColor: Colors.warning[500],
    borderRadius: 4,
  },
  barCount: {
    fontSize: 12,
    color: Colors.neutral[600],
    width: 24,
    textAlign: 'right',
  },
  reviewsSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral[900],
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
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
})
