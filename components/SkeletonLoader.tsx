import React, { useEffect, useRef } from 'react'
import { View, StyleSheet, Animated, ViewStyle, DimensionValue, StyleProp } from 'react-native'
import { Colors } from '../constants/Colors'
import { BorderRadius } from '../constants/Design'

interface SkeletonLoaderProps {
  width?: DimensionValue
  height?: number
  borderRadius?: number
  style?: StyleProp<ViewStyle>
  animated?: boolean
  children?: React.ReactNode
}

export default function SkeletonLoader({
  width = '100%',
  height = 20,
  borderRadius = BorderRadius.sm,
  style,
  animated = true,
  children,
}: SkeletonLoaderProps) {
  const shimmerAnimation = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (animated) {
      const shimmer = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnimation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerAnimation, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      )
      shimmer.start()

      return () => shimmer.stop()
    }
  }, [animated, shimmerAnimation])

  const shimmerStyle = {
    opacity: shimmerAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 0.7],
    }),
  }

  return (
    <View
      style={[
        styles.container,
        {
          width,
          height,
          borderRadius,
        },
        style,
      ]}
    >
      {animated ? <Animated.View style={[styles.shimmer, shimmerStyle]} /> : null}
      {children}
    </View>
  )
}

// Predefined skeleton components for common use cases
export const SkeletonCard = ({ style }: { style?: StyleProp<ViewStyle> }) => (
  <View style={[styles.card, style]}>
    <SkeletonLoader height={16} width="60%" style={styles.cardTitle} />
    <SkeletonLoader height={14} width="100%" style={styles.cardText} />
    <SkeletonLoader height={14} width="80%" style={styles.cardText} />
    <View style={styles.cardFooter}>
      <SkeletonLoader height={12} width="40%" />
      <SkeletonLoader height={12} width="30%" />
    </View>
  </View>
)

export const SkeletonList = ({ count = 3 }: { count?: number }) => (
  <View style={styles.list}>
    {Array.from({ length: count }).map((_, index) => (
      <SkeletonCard key={index} style={styles.listItem} />
    ))}
  </View>
)

export const SkeletonProfile = () => (
  <View style={styles.profile}>
    <SkeletonLoader width={60} height={60} borderRadius={30} />
    <View style={styles.profileInfo}>
      <SkeletonLoader height={18} width="70%" style={styles.profileName} />
      <SkeletonLoader height={14} width="50%" style={styles.profileSubtitle} />
    </View>
  </View>
)

export const SkeletonButton = ({ width = 120 }: { width?: number }) => (
  <SkeletonLoader height={48} width={width} borderRadius={BorderRadius.md} />
)

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.neutral[200],
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.neutral[100],
  },
  card: {
    backgroundColor: Colors.background.primary,
    borderRadius: BorderRadius.lg,
    padding: 16,
    marginBottom: 12,
    shadowColor: 'rgba(17, 24, 39, 0.12)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  cardTitle: {
    marginBottom: 8,
  },
  cardText: {
    marginBottom: 6,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  list: {
    padding: 16,
  },
  listItem: {
    marginBottom: 16,
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  profileInfo: {
    marginLeft: 12,
    flex: 1,
  },
  profileName: {
    marginBottom: 4,
  },
  profileSubtitle: {},
})
