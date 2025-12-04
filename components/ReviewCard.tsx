import React from 'react'
import { View, Text, StyleSheet, Image } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import RatingStars from './RatingStars'
import Colors from '../constants/Colors'

interface ReviewCardProps {
  id: string
  reviewerName: string
  reviewerAvatar?: string
  rating: number
  comment: string
  createdAt: string
  reviewType: 'customer_to_tasker' | 'tasker_to_customer'
  taskTitle?: string
}

export default function ReviewCard({
  reviewerName,
  reviewerAvatar,
  rating,
  comment,
  createdAt,
  reviewType,
  taskTitle
}: ReviewCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.reviewerInfo}>
          {reviewerAvatar ? (
            <Image source={{ uri: reviewerAvatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={20} color={Colors.neutral[400]} />
            </View>
          )}
          <View style={styles.reviewerDetails}>
            <Text style={styles.reviewerName}>{reviewerName}</Text>
            <Text style={styles.reviewDate}>{formatDate(createdAt)}</Text>
          </View>
        </View>
        <RatingStars rating={rating} readonly size={16} />
      </View>
      
      {taskTitle && (
        <Text style={styles.taskTitle}>Task: {taskTitle}</Text>
      )}
      
      <Text style={styles.comment}>{comment}</Text>
      
      <View style={styles.footer}>
        <View style={styles.reviewType}>
          <Ionicons 
            name={reviewType === 'customer_to_tasker' ? 'person' : 'briefcase'} 
            size={14} 
            color={Colors.neutral[500]} 
          />
          <Text style={styles.reviewTypeText}>
            {reviewType === 'customer_to_tasker' ? 'Customer Review' : 'Tasker Review'}
          </Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background.primary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  reviewerDetails: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral[900],
    marginBottom: 2,
  },
  reviewDate: {
    fontSize: 12,
    color: Colors.neutral[500],
  },
  taskTitle: {
    fontSize: 14,
    color: Colors.primary[600],
    marginBottom: 8,
    fontStyle: 'italic',
  },
  comment: {
    fontSize: 14,
    color: Colors.neutral[700],
    lineHeight: 20,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewType: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewTypeText: {
    fontSize: 12,
    color: Colors.neutral[500],
    marginLeft: 4,
  },
})
