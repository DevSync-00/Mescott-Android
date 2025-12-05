import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { RatingService, CreateRatingRequest } from '../services/RatingService'
import Colors from '../constants/Colors'

interface RatingModalProps {
  visible: boolean
  onClose: () => void
  onRatingSubmitted: () => void
  taskId: string
  customerId: string
  technicianId: string
  customerUserId: string
  technicianUserId: string
  taskTitle: string
  technicianName: string
}

function RatingModal({
  visible,
  onClose,
  onRatingSubmitted,
  taskId,
  customerId,
  technicianId,
  customerUserId,
  technicianUserId,
  taskTitle,
  technicianName,
}: RatingModalProps) {
  const [rating, setRating] = useState(0)
  const [review, setReview] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleRatingSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please select a rating before submitting.')
      return
    }

    try {
      setSubmitting(true)

      const ratingData: CreateRatingRequest = {
        task_id: taskId,
        customer_id: customerId,
        technician_id: technicianId,
        rating: rating,
        review: review.trim(),
        customer_user_id: customerUserId,
        technician_user_id: technicianUserId,
      }

      const result = await RatingService.createRating(ratingData)

      if (result) {
        // Update task status to completed
        await RatingService.updateTaskAfterRating(taskId)

        // Update technician's profile rating
        await RatingService.updateTechnicianProfileRating(technicianId)

        Alert.alert('Thank You!', 'Your rating and review have been submitted successfully.', [
          {
            text: 'OK',
            onPress: () => {
              onRatingSubmitted()
              onClose()
              // Reset form
              setRating(0)
              setReview('')
            },
          },
        ])
      } else {
        Alert.alert('Error', 'Failed to submit rating. Please try again.')
      }
    } catch (error) {
      console.error('Error submitting rating:', error)
      Alert.alert('Error', 'Failed to submit rating. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const renderStars = () => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity key={star} onPress={() => setRating(star)} style={styles.starButton}>
            <Ionicons
              name={star <= rating ? 'star' : 'star-outline'}
              size={40}
              color={star <= rating ? Colors.warning[500] : Colors.neutral[300]}
            />
          </TouchableOpacity>
        ))}
      </View>
    )
  }

  const getRatingText = () => {
    switch (rating) {
      case 1:
        return 'Poor'
      case 2:
        return 'Fair'
      case 3:
        return 'Good'
      case 4:
        return 'Very Good'
      case 5:
        return 'Excellent'
      default:
        return 'Select a rating'
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={Colors.neutral[600]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Rate & Review</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Task Info */}
          <View style={styles.taskCard}>
            <Text style={styles.taskTitle}>{taskTitle}</Text>
            <Text style={styles.technicianName}>Technician: {technicianName}</Text>
          </View>

          {/* Rating Section */}
          <View style={styles.ratingCard}>
            <Text style={styles.sectionTitle}>How was your experience?</Text>
            {renderStars()}
            <Text style={styles.ratingText}>{getRatingText()}</Text>
          </View>

          {/* Review Section */}
          <View style={styles.reviewCard}>
            <Text style={styles.sectionTitle}>Write a review (optional)</Text>
            <TextInput
              style={styles.reviewInput}
              placeholder="Share your experience with this technician..."
              value={review}
              onChangeText={setReview}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={500}
            />
            <Text style={styles.characterCount}>{review.length}/500</Text>
          </View>

          {/* Guidelines */}
          <View style={styles.guidelinesCard}>
            <Text style={styles.guidelinesTitle}>Review Guidelines</Text>
            <Text style={styles.guidelineText}>• Be honest and constructive</Text>
            <Text style={styles.guidelineText}>• Focus on the technician&apos;s work quality</Text>
            <Text style={styles.guidelineText}>
              • Avoid personal attacks or inappropriate language
            </Text>
            <Text style={styles.guidelineText}>
              • Your review helps other customers make informed decisions
            </Text>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          {submitting ? (
            <View style={styles.loadingButton}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.loadingButtonText}>Submitting...</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.submitButton, rating === 0 && styles.submitButtonDisabled]}
              onPress={handleRatingSubmit}
              disabled={rating === 0}
            >
              <Ionicons name="star" size={20} color="#fff" />
              <Text style={styles.submitButtonText}>Submit Rating</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  )
}

export default React.memo(RatingModal)

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  closeButton: {
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
    paddingHorizontal: 20,
  },
  taskCard: {
    backgroundColor: Colors.background.primary,
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral[900],
    marginBottom: 8,
  },
  technicianName: {
    fontSize: 14,
    color: Colors.neutral[600],
  },
  ratingCard: {
    backgroundColor: Colors.background.primary,
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral[900],
    marginBottom: 20,
    textAlign: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  starButton: {
    padding: 8,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.neutral[700],
  },
  reviewCard: {
    backgroundColor: Colors.background.primary,
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  reviewInput: {
    borderWidth: 1,
    borderColor: Colors.border.light,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.neutral[900],
    backgroundColor: Colors.background.secondary,
    marginTop: 12,
    minHeight: 100,
  },
  characterCount: {
    fontSize: 12,
    color: Colors.neutral[500],
    textAlign: 'right',
    marginTop: 8,
  },
  guidelinesCard: {
    backgroundColor: Colors.info[50],
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    marginBottom: 20,
  },
  guidelinesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.info[700],
    marginBottom: 8,
  },
  guidelineText: {
    fontSize: 12,
    color: Colors.info[600],
    marginBottom: 4,
    lineHeight: 18,
  },
  footer: {
    padding: 20,
    backgroundColor: Colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary[500],
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: Colors.neutral[300],
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.neutral[400],
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  loadingButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
})
