import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TouchableOpacity,
  Animated,
  Pressable,
  Image,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Colors from '../constants/Colors'
import { Typography, BorderRadius, Spacing, Shadows } from '../constants/Design'

interface EnhancedCardProps {
  children: React.ReactNode
  onPress?: () => void
  style?: ViewStyle
  variant?: 'default' | 'elevated' | 'outlined' | 'filled'
  interactive?: boolean
  disabled?: boolean
  loading?: boolean
  title?: string
  subtitle?: string
  icon?: keyof typeof Ionicons.glyphMap
  action?: {
    icon: keyof typeof Ionicons.glyphMap
    onPress: () => void
  }
}

export default function EnhancedCard({
  children,
  onPress,
  style,
  variant = 'default',
  interactive = false,
  disabled = false,
  loading = false,
  title,
  subtitle,
  icon,
  action,
}: EnhancedCardProps) {
  const [pressed, setPressed] = useState(false)
  const [scaleValue] = useState(new Animated.Value(1))

  const handlePressIn = () => {
    if (interactive && !disabled && !loading) {
      setPressed(true)
      Animated.spring(scaleValue, {
        toValue: 0.98,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }).start()
    }
  }

  const handlePressOut = () => {
    if (interactive && !disabled && !loading) {
      setPressed(false)
      Animated.spring(scaleValue, {
        toValue: 1,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }).start()
    }
  }

  const getCardStyles = (): ViewStyle => {
    const baseStyles: ViewStyle = {
      borderRadius: BorderRadius.lg,
      overflow: 'hidden',
    }

    const variantStyles: Record<string, ViewStyle> = {
      default: {
        backgroundColor: Colors.background.primary,
        ...Shadows.sm,
      },
      elevated: {
        backgroundColor: Colors.background.primary,
        ...Shadows.lg,
      },
      outlined: {
        backgroundColor: Colors.background.primary,
        borderWidth: 1,
        borderColor: Colors.border.light,
      },
      filled: {
        backgroundColor: Colors.neutral[50],
        borderWidth: 1,
        borderColor: Colors.border.light,
      },
    }

    const interactiveStyles: ViewStyle = interactive
      ? {
          ...(pressed && { opacity: 0.95 }),
        }
      : {}

    return {
      ...baseStyles,
      ...variantStyles[variant],
      ...interactiveStyles,
      ...(disabled && { opacity: 0.6 }),
      ...style,
    }
  }

  const CardContent = () => (
    <View style={styles.content}>
      {(title || subtitle || icon) && (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {icon && (
              <View style={styles.iconContainer}>
                <Ionicons
                  name={icon}
                  size={20}
                  color={Colors.primary[500]}
                />
              </View>
            )}
            <View style={styles.headerText}>
              {title && (
                <Text style={styles.title} numberOfLines={1}>
                  {title}
                </Text>
              )}
              {subtitle && (
                <Text style={styles.subtitle} numberOfLines={2}>
                  {subtitle}
                </Text>
              )}
            </View>
          </View>
          {action && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={action.onPress}
              disabled={disabled || loading}
            >
              <Ionicons
                name={action.icon}
                size={20}
                color={Colors.neutral[600]}
              />
            </TouchableOpacity>
          )}
        </View>
      )}
      <View style={styles.body}>{children}</View>
    </View>
  )

  if (interactive && onPress) {
    return (
      <Animated.View style={{ transform: [{ scale: scaleValue }] }}>
        <Pressable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={disabled || loading}
          style={getCardStyles()}
        >
          <CardContent />
        </Pressable>
      </Animated.View>
    )
  }

  return (
    <View style={getCardStyles()}>
      <CardContent />
    </View>
  )
}

// Predefined card variants for common use cases
export const TaskCard = ({
  title,
  description,
  price,
  location,
  onPress,
  ...props
}: {
  title: string
  description: string
  price: string
  location: string
  onPress?: () => void
} & Omit<EnhancedCardProps, 'children'>) => (
  <EnhancedCard
    onPress={onPress}
    interactive={!!onPress}
    variant="elevated"
    {...props}
  >
    <View style={styles.taskContent}>
      <Text style={styles.taskTitle} numberOfLines={2}>
        {title}
      </Text>
      <Text style={styles.taskDescription} numberOfLines={3}>
        {description}
      </Text>
      <View style={styles.taskFooter}>
        <View style={styles.taskLocation}>
          <Ionicons name="location-outline" size={16} color={Colors.neutral[500]} />
          <Text style={styles.locationText}>{location}</Text>
        </View>
        <Text style={styles.taskPrice}>{price}</Text>
      </View>
    </View>
  </EnhancedCard>
)

export const ProfileCard = ({
  name,
  role,
  rating,
  avatar,
  onPress,
  ...props
}: {
  name: string
  role: string
  rating: number
  avatar?: string
  onPress?: () => void
} & Omit<EnhancedCardProps, 'children'>) => (
  <EnhancedCard
    onPress={onPress}
    interactive={!!onPress}
    variant="outlined"
    {...props}
  >
    <View style={styles.profileContent}>
      <View style={styles.profileAvatar}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatarImage} />
        ) : (
          <Ionicons name="person" size={24} color={Colors.neutral[400]} />
        )}
      </View>
      <View style={styles.profileInfo}>
        <Text style={styles.profileName}>{name}</Text>
        <Text style={styles.profileRole}>{role}</Text>
        <View style={styles.ratingContainer}>
          <Ionicons name="star" size={14} color={Colors.warning[500]} />
          <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
        </View>
      </View>
    </View>
  </EnhancedCard>
)

const styles = StyleSheet.create({
  content: {
    padding: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  actionButton: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.neutral[100],
  },
  body: {
    // Body content styles
  },
  taskContent: {
    // Task card specific styles
  },
  taskTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  taskDescription: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  taskFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  taskLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  locationText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    marginLeft: 4,
  },
  taskPrice: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary[500],
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.neutral[200],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary[200],
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  profileRole: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    marginLeft: 4,
  },
})
