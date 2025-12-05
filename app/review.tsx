import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useAuth } from '../contexts/SimpleAuthContext'
import { RatingService } from '../services/RatingService'
import RatingStars from '../components/RatingStars'
import EnhancedRatingStars from '../components/EnhancedRatingStars'
import { Colors } from '../constants/Colors'

export default function ReviewScreen() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const { taskId, revieweeId, revieweeName, taskTitle } = useLocalSearchParams()
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [showEnhancedRating, setShowEnhancedRating] = useState(false)
  const [categoryRatings, setCategoryRatings] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/auth')
    }
  }, [isAuthenticated, isLoading, router])

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

  const handleSubmitReview = async () => {
    if (!user || !taskId || !revieweeId) {
      Alert.alert('Error', 'Missing required information')
      return
    }

    if (rating === 0) {
      Alert.alert('Error', 'Please select a rating')
      return
    }

    if (!comment.trim()) {
      Alert.alert('Error', 'Please write a comment')
      return
    }

    setLoading(true)
    try {
      const reviewData = {
        task_id: taskId as string,
        reviewer_id: user.id,
        reviewee_id: revieweeId as string,
        rating,
        comment: comment.trim(),
        review_type: 'customer_to_tasker' as const,
        is_public: true,
      }

      await RatingService.createReview(reviewData)

      Alert.alert('Success', 'Review submitted successfully!', [
        {
          text: 'OK',
          onPress: () => router.push('/jobs'),
        },
      ])
    } catch (error) {
      console.error('Error submitting review:', error)
      Alert.alert('Error', 'Failed to submit review. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior="height" style={styles.keyboardView}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.content}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity style={styles.backButton} onPress={() => router.push('/jobs')}>
                <Ionicons name="arrow-back" size={24} color={Colors.neutral[900]} />
              </TouchableOpacity>
              <View style={styles.headerContent}>
                <Text style={styles.headerTitle}>Write a Review</Text>
                <Text style={styles.headerSubtitle}>Share your experience</Text>
              </View>
              <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
              {/* Task Info */}
              <View style={styles.taskInfo}>
                <Text style={styles.taskTitle}>{taskTitle}</Text>
                <Text style={styles.revieweeName}>Reviewing: {revieweeName}</Text>
              </View>

              {/* Rating */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>How would you rate this experience? *</Text>
                <View style={styles.ratingContainer}>
                  <RatingStars
                    rating={rating}
                    onRatingChange={setRating}
                    size={32}
                    showNumber={true}
                  />
                </View>
                <Text style={styles.ratingHint}>
                  {rating === 0 && 'Tap a star to rate'}
                  {rating === 1 && 'Poor'}
                  {rating === 2 && 'Fair'}
                  {rating === 3 && 'Good'}
                  {rating === 4 && 'Very Good'}
                  {rating === 5 && 'Excellent'}
                </Text>

                {/* Enhanced Rating Toggle */}
                <TouchableOpacity
                  style={styles.enhancedRatingToggle}
                  onPress={() => setShowEnhancedRating(!showEnhancedRating)}
                >
                  <Ionicons
                    name={showEnhancedRating ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={Colors.primary[500]}
                  />
                  <Text style={styles.enhancedRatingToggleText}>
                    {showEnhancedRating ? 'Hide' : 'Show'} Detailed Rating
                  </Text>
                </TouchableOpacity>

                {/* Enhanced Category Ratings */}
                {showEnhancedRating && (
                  <View style={styles.enhancedRatingContainer}>
                    <Text style={styles.enhancedRatingTitle}>Rate by Category</Text>
                    <EnhancedRatingStars
                      rating={rating}
                      onRatingChange={setRating}
                      onCategoryRatingChange={(category, categoryRating) => {
                        setCategoryRatings((prev) => ({
                          ...prev,
                          [category]: categoryRating,
                        }))
                      }}
                      showCategories={true}
                      categoryRatings={categoryRatings}
                      size={24}
                      showNumber={true}
                    />
                  </View>
                )}
              </View>

              {/* Comment */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Write your review *</Text>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Tell others about your experience..."
                  placeholderTextColor={Colors.neutral[400]}
                  value={comment}
                  onChangeText={setComment}
                  multiline
                  numberOfLines={6}
                  maxLength={500}
                />
                <Text style={styles.characterCount}>{comment.length}/500</Text>
              </View>

              {/* Guidelines */}
              <View style={styles.guidelines}>
                <Text style={styles.guidelinesTitle}>Review Guidelines</Text>
                <Text style={styles.guidelinesText}>
                  • Be honest and constructive{'\n'}• Focus on the service provided{'\n'}• Avoid
                  personal attacks{'\n'}• Keep it professional
                </Text>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                onPress={handleSubmitReview}
                disabled={loading}
              >
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.submitButtonText}>
                  {loading ? 'Submitting...' : 'Submit Review'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
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
  placeholder: {
    width: 40,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.neutral[900],
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: Colors.neutral[600],
  },
  form: {
    flex: 1,
    paddingHorizontal: 20,
  },
  taskInfo: {
    backgroundColor: Colors.background.primary,
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: Colors.border.primary,
  },
  taskTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral[900],
    marginBottom: 4,
  },
  revieweeName: {
    fontSize: 14,
    color: Colors.neutral[600],
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral[900],
    marginBottom: 12,
  },
  ratingContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingHint: {
    fontSize: 14,
    color: Colors.neutral[600],
    textAlign: 'center',
    fontStyle: 'italic',
  },
  commentInput: {
    backgroundColor: Colors.background.primary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.primary,
    fontSize: 16,
    color: Colors.neutral[900],
    textAlignVertical: 'top',
    minHeight: 120,
  },
  characterCount: {
    fontSize: 12,
    color: Colors.neutral[500],
    textAlign: 'right',
    marginTop: 4,
  },
  guidelines: {
    backgroundColor: Colors.primary[50],
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: Colors.primary[200],
  },
  guidelinesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary[700],
    marginBottom: 8,
  },
  guidelinesText: {
    fontSize: 12,
    color: Colors.primary[600],
    lineHeight: 18,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary[500],
    paddingVertical: 16,
    borderRadius: 12,
    marginVertical: 32,
    marginBottom: 40,
    gap: 8,
    shadowColor: Colors.primary[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  submitButtonDisabled: {
    backgroundColor: Colors.neutral[300],
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.neutral[600],
    marginTop: 10,
  },
  enhancedRatingToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: Colors.primary[50],
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.primary[200],
  },
  enhancedRatingToggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.primary[600],
    marginLeft: 8,
  },
  enhancedRatingContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: Colors.background.secondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border.primary,
  },
  enhancedRatingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral[700],
    marginBottom: 12,
  },
})
