import React, { useState } from 'react'
import { View, TouchableOpacity, Text, StyleSheet, Animated } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Colors from '../constants/Colors'

interface RatingCategory {
  id: string
  label: string
  icon: string
}

interface EnhancedRatingStarsProps {
  rating: number
  onRatingChange?: (rating: number) => void
  onCategoryRatingChange?: (category: string, rating: number) => void
  size?: number
  showNumber?: boolean
  readonly?: boolean
  maxRating?: number
  showCategories?: boolean
  categories?: RatingCategory[]
  categoryRatings?: Record<string, number>
}

const defaultCategories: RatingCategory[] = [
  { id: 'quality', label: 'Quality', icon: 'diamond' },
  { id: 'communication', label: 'Communication', icon: 'chatbubbles' },
  { id: 'punctuality', label: 'Punctuality', icon: 'time' },
  { id: 'professionalism', label: 'Professionalism', icon: 'briefcase' },
  { id: 'value', label: 'Value for Money', icon: 'card' },
]

export default function EnhancedRatingStars({
  rating,
  onRatingChange,
  onCategoryRatingChange,
  size = 20,
  showNumber = false,
  readonly = false,
  maxRating = 5,
  showCategories = false,
  categories = defaultCategories,
  categoryRatings = {}
}: EnhancedRatingStarsProps) {
  const [hoveredStar, setHoveredStar] = useState(0)
  const [scaleAnim] = useState(new Animated.Value(1))

  const handleStarPress = (starRating: number) => {
    if (!readonly && onRatingChange) {
      onRatingChange(starRating)
      
      // Add animation feedback
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.2,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }

  const handleCategoryRating = (category: string, starRating: number) => {
    if (!readonly && onCategoryRatingChange) {
      onCategoryRatingChange(category, starRating)
    }
  }

  const renderStar = (index: number, currentRating: number, onPress: (rating: number) => void) => {
    const starRating = index + 1
    const isFilled = starRating <= currentRating
    const isHovered = starRating <= hoveredStar

    return (
      <TouchableOpacity
        key={index}
        onPress={() => onPress(starRating)}
        disabled={readonly}
        style={styles.starContainer}
        onPressIn={() => setHoveredStar(starRating)}
        onPressOut={() => setHoveredStar(0)}
      >
        <Ionicons
          name={isFilled ? 'star' : 'star-outline'}
          size={size}
          color={
            isFilled 
              ? Colors.warning[500] 
              : isHovered 
                ? Colors.warning[300] 
                : Colors.neutral[300]
          }
        />
      </TouchableOpacity>
    )
  }

  const renderCategoryRating = (category: RatingCategory) => {
    const categoryRating = categoryRatings[category.id] || 0
    
    return (
      <View key={category.id} style={styles.categoryContainer}>
        <View style={styles.categoryHeader}>
          <Ionicons name={category.icon as any} size={16} color={Colors.primary[500]} />
          <Text style={styles.categoryLabel}>{category.label}</Text>
          {showNumber && (
            <Text style={styles.categoryRatingText}>
              {categoryRating.toFixed(1)}
            </Text>
          )}
        </View>
        <View style={styles.starsContainer}>
          {Array.from({ length: maxRating }, (_, index) => 
            renderStar(index, categoryRating, (rating) => handleCategoryRating(category.id, rating))
          )}
        </View>
      </View>
    )
  }

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
      {/* Overall Rating */}
      <View style={styles.overallRating}>
        <View style={styles.starsContainer}>
          {Array.from({ length: maxRating }, (_, index) => 
            renderStar(index, rating, handleStarPress)
          )}
        </View>
        {showNumber && (
          <Text style={[styles.ratingText, { fontSize: size * 0.7 }]}>
            {rating.toFixed(1)}
          </Text>
        )}
      </View>

      {/* Category Ratings */}
      {showCategories && (
        <View style={styles.categoriesContainer}>
          {categories.map(renderCategoryRating)}
        </View>
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
  },
  overallRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starContainer: {
    position: 'relative',
    marginRight: 4,
    padding: 2,
  },
  ratingText: {
    marginLeft: 8,
    fontWeight: '600',
    color: Colors.neutral[700],
  },
  categoriesContainer: {
    gap: 12,
  },
  categoryContainer: {
    backgroundColor: Colors.background.secondary,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border.primary,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.neutral[700],
    flex: 1,
  },
  categoryRatingText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary[600],
  },
})
