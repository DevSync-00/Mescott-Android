import React, { useState } from 'react'
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Animated,
  Pressable,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Colors from '../constants/Colors'
import { Typography, BorderRadius, Spacing, Shadows } from '../constants/Design'

interface EnhancedButtonProps {
  title: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'small' | 'medium' | 'large'
  disabled?: boolean
  loading?: boolean
  icon?: keyof typeof Ionicons.glyphMap
  iconPosition?: 'left' | 'right'
  fullWidth?: boolean
  style?: ViewStyle
  textStyle?: TextStyle
}

export default function EnhancedButton({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  style,
  textStyle,
}: EnhancedButtonProps) {
  const [pressed, setPressed] = useState(false)
  const [scaleValue] = useState(new Animated.Value(1))

  const handlePressIn = () => {
    setPressed(true)
    Animated.spring(scaleValue, {
      toValue: 0.96,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start()
  }

  const handlePressOut = () => {
    setPressed(false)
    Animated.spring(scaleValue, {
      toValue: 1,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start()
  }

  const getButtonStyles = (): ViewStyle => {
    const baseStyles: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: BorderRadius.md,
      ...Shadows.sm,
    }

    // Size styles
    const sizeStyles: Record<string, ViewStyle> = {
      small: {
        height: 36,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
      },
      medium: {
        height: 48,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
      },
      large: {
        height: 56,
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.lg,
      },
    }

    // Variant styles
    const variantStyles: Record<string, ViewStyle> = {
      primary: {
        backgroundColor: disabled ? Colors.neutral[300] : Colors.primary[500],
        borderWidth: 0,
      },
      secondary: {
        backgroundColor: disabled ? Colors.neutral[200] : Colors.neutral[100],
        borderWidth: 1,
        borderColor: Colors.neutral[300],
      },
      outline: {
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: disabled ? Colors.neutral[300] : Colors.primary[500],
      },
      ghost: {
        backgroundColor: 'transparent',
        borderWidth: 0,
      },
      danger: {
        backgroundColor: disabled ? Colors.neutral[300] : Colors.error[500],
        borderWidth: 0,
      },
    }

    return {
      ...baseStyles,
      ...sizeStyles[size],
      ...variantStyles[variant],
      ...(fullWidth && { width: '100%' }),
      ...(pressed && { opacity: 0.8 }),
      ...style,
    }
  }

  const getTextStyles = (): TextStyle => {
    const baseTextStyles: TextStyle = {
      fontWeight: Typography.fontWeight.semibold,
      textAlign: 'center',
    }

    const sizeTextStyles: Record<string, TextStyle> = {
      small: {
        fontSize: Typography.fontSize.sm,
      },
      medium: {
        fontSize: Typography.fontSize.md,
      },
      large: {
        fontSize: Typography.fontSize.lg,
      },
    }

    const variantTextStyles: Record<string, TextStyle> = {
      primary: {
        color: disabled ? Colors.neutral[500] : '#FFFFFF',
      },
      secondary: {
        color: disabled ? Colors.neutral[400] : Colors.neutral[700],
      },
      outline: {
        color: disabled ? Colors.neutral[400] : Colors.primary[500],
      },
      ghost: {
        color: disabled ? Colors.neutral[400] : Colors.primary[500],
      },
      danger: {
        color: disabled ? Colors.neutral[500] : '#FFFFFF',
      },
    }

    return {
      ...baseTextStyles,
      ...sizeTextStyles[size],
      ...variantTextStyles[variant],
      ...textStyle,
    }
  }

  const renderIcon = () => {
    if (!icon) return null

    const iconSize = size === 'small' ? 16 : size === 'medium' ? 20 : 24
    const iconColor = getTextStyles().color

    return (
      <Ionicons
        name={icon}
        size={iconSize}
        color={iconColor}
        style={{
          marginRight: iconPosition === 'left' ? Spacing.sm : 0,
          marginLeft: iconPosition === 'right' ? Spacing.sm : 0,
        }}
      />
    )
  }

  return (
    <Animated.View style={{ transform: [{ scale: scaleValue }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={getButtonStyles()}
      >
        {loading ? (
          <ActivityIndicator
            size="small"
            color={getTextStyles().color}
            style={{ marginRight: Spacing.sm }}
          />
        ) : (
          iconPosition === 'left' && renderIcon()
        )}
        
        <Text style={getTextStyles()}>
          {loading ? 'Loading...' : title}
        </Text>
        
        {!loading && iconPosition === 'right' && renderIcon()}
      </Pressable>
    </Animated.View>
  )
}

// Predefined button variants for common use cases
export const PrimaryButton = (props: Omit<EnhancedButtonProps, 'variant'>) => (
  <EnhancedButton {...props} variant="primary" />
)

export const SecondaryButton = (props: Omit<EnhancedButtonProps, 'variant'>) => (
  <EnhancedButton {...props} variant="secondary" />
)

export const OutlineButton = (props: Omit<EnhancedButtonProps, 'variant'>) => (
  <EnhancedButton {...props} variant="outline" />
)

export const GhostButton = (props: Omit<EnhancedButtonProps, 'variant'>) => (
  <EnhancedButton {...props} variant="ghost" />
)

export const DangerButton = (props: Omit<EnhancedButtonProps, 'variant'>) => (
  <EnhancedButton {...props} variant="danger" />
)
