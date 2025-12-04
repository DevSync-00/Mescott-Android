import React from 'react'
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Colors from '../constants/Colors'

interface RatingStarsProps {
  rating: number
  onRatingChange?: (rating: number) => void
  size?: number
  showNumber?: boolean
  readonly?: boolean
  maxRating?: number
}

export default function RatingStars({
  rating,
  onRatingChange,
  size = 20,
  showNumber = false,
  readonly = false,
  maxRating = 5
}: RatingStarsProps) {
  const handleStarPress = (starRating: number) => {
    if (!readonly && onRatingChange) {
      onRatingChange(starRating)
    }
  }

  const renderStar = (index: number) => {
    const starRating = index + 1
    const isFilled = starRating <= rating
    const isHalfFilled = starRating === Math.ceil(rating) && rating % 1 !== 0

    return (
      <TouchableOpacity
        key={index}
        onPress={() => handleStarPress(starRating)}
        disabled={readonly}
        style={styles.starContainer}
      >
        <Ionicons
          name={isFilled ? 'star' : 'star-outline'}
          size={size}
          color={isFilled ? Colors.warning[500] : Colors.neutral[300]}
        />
        {isHalfFilled && (
          <View style={[styles.halfStar, { width: size / 2 }]}>
            <Ionicons
              name="star"
              size={size}
              color={Colors.warning[500]}
            />
          </View>
        )}
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.starsContainer}>
        {Array.from({ length: maxRating }, (_, index) => renderStar(index))}
      </View>
      {showNumber && (
        <Text style={[styles.ratingText, { fontSize: size * 0.7 }]}>
          {rating.toFixed(1)}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starContainer: {
    position: 'relative',
    marginRight: 2,
  },
  halfStar: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
  },
  ratingText: {
    marginLeft: 8,
    fontWeight: '600',
    color: Colors.neutral[700],
  },
})
