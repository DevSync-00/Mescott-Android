import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { RatingService, Review } from '../services/RatingService'
import { useAuth } from '../contexts/SimpleAuthContext'
import { useToast } from '../contexts/ToastContext'
import { Colors } from '../constants/Colors'

interface RatingComponentProps {
  taskId: string
  revieweeId: string
  reviewType: 'customer_to_tasker' | 'tasker_to_customer'
  onReviewSubmitted?: (review: Review) => void
  onReviewUpdated?: (review: Review) => void
  onReviewDeleted?: (reviewId: string) => void
  showSubmitButton?: boolean
  compact?: boolean
}

export default function RatingComponent({
  taskId,
  revieweeId,
  reviewType,
  onReviewSubmitted,
  onReviewUpdated,
  onReviewDeleted,
  showSubmitButton = true,
  compact = false
}: RatingComponentProps) {
  const { user } = useAuth()
  const { showToast } = useToast()
  
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [existingReview, setExistingReview] = useState<Review | null>(null)
  const [canReview, setCanReview] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (user?.id) {
      checkReviewPermissions()
      loadExistingReview()
    }
  }, [user?.id, taskId, revieweeId, reviewType])

  const checkReviewPermissions = async () => {
    if (!user?.id) return

    try {
      const result = await RatingService.canUserReview(taskId, user.id, revieweeId, reviewType)
      setCanReview(result.canReview)
      setReason(result.reason || '')
    } catch (error) {
      console.error('Error checking review permissions:', error)
      setCanReview(false)
      setReason('Error checking permissions')
    }
  }

  const loadExistingReview = async () => {
    if (!user?.id) return

    try {
      const review = await RatingService.getReviewByTaskAndUsers(taskId, user.id, revieweeId, reviewType)
      if (review) {
        setExistingReview(review)
        setRating(review.rating)
        setComment(review.comment)
        setIsAnonymous(review.is_anonymous)
      }
    } catch (error) {
      console.error('Error loading existing review:', error)
    }
  }

  const handleSubmitReview = async () => {
    if (!user?.id || !canReview) return

    if (rating === 0) {
      showToast('Please select a rating', 'error')
      return
    }

    if (comment.trim().length < 10) {
      showToast('Please write a comment (at least 10 characters)', 'error')
      return
    }

    setSubmitting(true)
    try {
      if (existingReview) {
        // Update existing review
        const updatedReview = await RatingService.updateReview(existingReview.id, {
          rating,
          comment: comment.trim(),
          is_anonymous: isAnonymous
        })

        if (updatedReview) {
          setExistingReview(updatedReview)
          showToast('Review updated successfully', 'success')
          onReviewUpdated?.(updatedReview)
          setShowModal(false)
        } else {
          showToast('Failed to update review', 'error')
        }
      } else {
        // Create new review
        const newReview = await RatingService.createReview({
          task_id: taskId,
          reviewer_id: user.id,
          reviewee_id: revieweeId,
          rating,
          comment: comment.trim(),
          review_type: reviewType,
          is_anonymous: isAnonymous,
        })

        if (newReview) {
          setExistingReview(newReview)
          showToast('Review submitted successfully', 'success')
          onReviewSubmitted?.(newReview)
          setShowModal(false)
        } else {
          showToast('Failed to submit review', 'error')
        }
      }
    } catch (error) {
      console.error('Error submitting review:', error)
      showToast('An error occurred while submitting the review', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteReview = () => {
    if (!existingReview) return

    Alert.alert(
      'Delete Review',
      'Are you sure you want to delete this review? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true)
            try {
              const success = await RatingService.deleteReview(existingReview.id)
              if (success) {
                setExistingReview(null)
                setRating(0)
                setComment('')
                setIsAnonymous(false)
                showToast('Review deleted successfully', 'success')
                onReviewDeleted?.(existingReview.id)
              } else {
                showToast('Failed to delete review', 'error')
              }
            } catch (error) {
              console.error('Error deleting review:', error)
              showToast('An error occurred while deleting the review', 'error')
            } finally {
              setLoading(false)
            }
          }
        }
      ]
    )
  }

  const renderStars = (currentRating: number, interactive: boolean = false) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={interactive ? () => setRating(star) : undefined}
            disabled={!interactive}
            style={styles.starButton}
          >
            <Ionicons
              name={star <= currentRating ? 'star' : 'star-outline'}
              size={compact ? 16 : 20}
              color={star <= currentRating ? Colors.warning[500] : Colors.neutral[300]}
            />
          </TouchableOpacity>
        ))}
      </View>
    )
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={Colors.primary[500]} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    )
  }

  if (!canReview && !existingReview) {
    return (
      <View style={styles.cannotReviewContainer}>
        <Ionicons name="information-circle-outline" size={20} color={Colors.neutral[500]} />
        <Text style={styles.cannotReviewText}>
          {reason || 'You cannot review this user'}
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {existingReview ? (
        <View style={styles.existingReviewContainer}>
          <View style={styles.reviewHeader}>
            <Text style={styles.reviewTitle}>
              {existingReview.is_anonymous ? 'Anonymous Review' : 'Your Review'}
            </Text>
            <View style={styles.reviewActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => setShowModal(true)}
              >
                <Ionicons name="create-outline" size={16} color={Colors.primary[500]} />
                <Text style={styles.actionButtonText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleDeleteReview}
              >
                <Ionicons name="trash-outline" size={16} color={Colors.error[500]} />
                <Text style={[styles.actionButtonText, { color: Colors.error[500] }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
          {renderStars(existingReview.rating)}
          <Text style={styles.reviewComment}>{existingReview.comment}</Text>
          <Text style={styles.reviewDate}>
            {new Date(existingReview.created_at).toLocaleDateString()}
          </Text>
        </View>
      ) : (
        <View style={styles.newReviewContainer}>
          <Text style={styles.newReviewTitle}>
            {reviewType === 'customer_to_tasker' ? 'Rate the Tasker' : 'Rate the Customer'}
          </Text>
          {renderStars(rating, true)}
          <TouchableOpacity
            style={styles.submitButton}
            onPress={() => setShowModal(true)}
            disabled={!canReview}
          >
            <Text style={styles.submitButtonText}>
              {rating > 0 ? 'Update Review' : 'Write Review'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Review Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {existingReview ? 'Edit Review' : 'Write Review'}
            </Text>
            <TouchableOpacity
              onPress={handleSubmitReview}
              disabled={submitting || rating === 0 || comment.trim().length < 10}
            >
              <Text style={[
                styles.modalSave,
                (submitting || rating === 0 || comment.trim().length < 10) && styles.modalSaveDisabled
              ]}>
                {submitting ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.ratingSection}>
              <Text style={styles.ratingLabel}>Rating *</Text>
              {renderStars(rating, true)}
              <Text style={styles.ratingText}>
                {rating === 0 ? 'Select a rating' : 
                 rating === 1 ? 'Poor' :
                 rating === 2 ? 'Fair' :
                 rating === 3 ? 'Good' :
                 rating === 4 ? 'Very Good' : 'Excellent'}
              </Text>
            </View>

            <View style={styles.commentSection}>
              <Text style={styles.commentLabel}>Comment *</Text>
              <TextInput
                style={styles.commentInput}
                value={comment}
                onChangeText={setComment}
                placeholder={`Share your experience with this ${reviewType === 'customer_to_tasker' ? 'tasker' : 'customer'}...`}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              <Text style={styles.commentCounter}>
                {comment.length}/500 characters (minimum 10)
              </Text>
            </View>

            <View style={styles.anonymousSection}>
              <TouchableOpacity
                style={styles.checkbox}
                onPress={() => setIsAnonymous(!isAnonymous)}
              >
                <Ionicons
                  name={isAnonymous ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={isAnonymous ? Colors.primary[500] : Colors.neutral[400]}
                />
                <Text style={styles.checkboxText}>Submit anonymously</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.guidelinesSection}>
              <Text style={styles.guidelinesTitle}>Review Guidelines</Text>
              <Text style={styles.guidelinesText}>
                • Be honest and constructive in your feedback{'\n'}
                • Focus on the work quality and communication{'\n'}
                • Avoid personal attacks or inappropriate language{'\n'}
                • Your review helps others make informed decisions
              </Text>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: Colors.neutral[600],
  },
  cannotReviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.neutral[100],
    borderRadius: 8,
  },
  cannotReviewText: {
    marginLeft: 8,
    fontSize: 14,
    color: Colors.neutral[600],
  },
  existingReviewContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral[900],
  },
  reviewActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionButtonText: {
    fontSize: 14,
    color: Colors.primary[500],
    fontWeight: '500',
  },
  reviewComment: {
    fontSize: 14,
    color: Colors.neutral[700],
    marginTop: 8,
    lineHeight: 20,
  },
  reviewDate: {
    fontSize: 12,
    color: Colors.neutral[500],
    marginTop: 8,
  },
  newReviewContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  newReviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral[900],
    marginBottom: 12,
  },
  submitButton: {
    backgroundColor: Colors.primary[500],
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  starButton: {
    padding: 2,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[200],
  },
  modalCancel: {
    fontSize: 16,
    color: Colors.neutral[600],
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral[900],
  },
  modalSave: {
    fontSize: 16,
    color: Colors.primary[500],
    fontWeight: '600',
  },
  modalSaveDisabled: {
    color: Colors.neutral[400],
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  ratingSection: {
    marginBottom: 24,
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.neutral[900],
    marginBottom: 12,
  },
  ratingText: {
    fontSize: 14,
    color: Colors.neutral[600],
    marginTop: 8,
  },
  commentSection: {
    marginBottom: 24,
  },
  commentLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.neutral[900],
    marginBottom: 12,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: Colors.neutral[300],
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: Colors.neutral[900],
    minHeight: 100,
  },
  commentCounter: {
    fontSize: 12,
    color: Colors.neutral[500],
    marginTop: 4,
    textAlign: 'right',
  },
  anonymousSection: {
    marginBottom: 24,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkboxText: {
    fontSize: 16,
    color: Colors.neutral[700],
  },
  guidelinesSection: {
    backgroundColor: Colors.neutral[50],
    padding: 16,
    borderRadius: 8,
  },
  guidelinesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.neutral[900],
    marginBottom: 8,
  },
  guidelinesText: {
    fontSize: 12,
    color: Colors.neutral[600],
    lineHeight: 18,
  },
})
