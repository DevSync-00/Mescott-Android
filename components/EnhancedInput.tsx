import React, { useState, useRef } from 'react'
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TouchableOpacity,
  Animated,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '../constants/Colors'
import { Typography, BorderRadius, Spacing } from '../constants/Design'

const focusShadow: ViewStyle = {
  shadowColor: 'rgba(0, 0, 0, 0.12)',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.12,
  shadowRadius: 16,
  elevation: 6,
}

interface EnhancedInputProps {
  label?: string
  placeholder?: string
  value: string
  onChangeText: (text: string) => void
  onBlur?: () => void
  onFocus?: () => void
  error?: string
  helperText?: string
  disabled?: boolean
  secureTextEntry?: boolean
  multiline?: boolean
  numberOfLines?: number
  maxLength?: number
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad'
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  autoCorrect?: boolean
  leftIcon?: keyof typeof Ionicons.glyphMap
  rightIcon?: keyof typeof Ionicons.glyphMap
  onRightIconPress?: () => void
  style?: ViewStyle
  inputStyle?: TextStyle
  required?: boolean
  variant?: 'default' | 'filled' | 'outlined'
}

export default function EnhancedInput({
  label,
  placeholder,
  value,
  onChangeText,
  onBlur,
  onFocus,
  error,
  helperText,
  disabled = false,
  secureTextEntry = false,
  multiline = false,
  numberOfLines = 1,
  maxLength,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  autoCorrect = true,
  leftIcon,
  rightIcon,
  onRightIconPress,
  style,
  inputStyle,
  required = false,
  variant = 'default',
}: EnhancedInputProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const inputRef = useRef<TextInput>(null)
  const focusAnimation = useRef(new Animated.Value(0)).current

  const handleFocus = () => {
    setIsFocused(true)
    onFocus?.()
    Animated.timing(focusAnimation, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start()
  }

  const handleBlur = () => {
    setIsFocused(false)
    onBlur?.()
    Animated.timing(focusAnimation, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start()
  }

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword)
  }

  const getContainerStyles = (): ViewStyle => {
    const baseStyles: ViewStyle = {
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      flexDirection: 'row',
      alignItems: multiline ? 'flex-start' : 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: multiline ? Spacing.md : 0,
      minHeight: 48,
    }

    const variantStyles: Record<string, ViewStyle> = {
      default: {
        backgroundColor: Colors.background.primary,
        borderColor: error
          ? Colors.error[500]
          : isFocused
            ? Colors.primary[500]
            : Colors.border.light,
      },
      filled: {
        backgroundColor: Colors.neutral[50],
        borderColor: error ? Colors.error[500] : isFocused ? Colors.primary[500] : 'transparent',
      },
      outlined: {
        backgroundColor: 'transparent',
        borderColor: error
          ? Colors.error[500]
          : isFocused
            ? Colors.primary[500]
            : Colors.border.medium,
      },
    }

    const stateStyles: ViewStyle = {
      ...(disabled && {
        backgroundColor: Colors.neutral[100],
        borderColor: Colors.neutral[300],
        opacity: 0.6,
      }),
      ...(isFocused ? focusShadow : null),
    }

    return {
      ...baseStyles,
      ...variantStyles[variant],
      ...stateStyles,
      ...style,
    }
  }

  const getInputStyles = (): TextStyle => {
    return {
      flex: 1,
      fontSize: Typography.fontSize.md,
      color: disabled ? Colors.text.tertiary : Colors.text.primary,
      paddingVertical: Spacing.sm,
      ...(multiline && {
        textAlignVertical: 'top',
        minHeight: 80,
      }),
      ...inputStyle,
    }
  }

  const getLabelStyles = (): Animated.WithAnimatedObject<TextStyle> => {
    const animatedColor = focusAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [Colors.text.secondary, Colors.primary[500]],
    })

    return {
      fontSize: Typography.fontSize.sm,
      fontWeight: Typography.fontWeight.medium,
      marginBottom: Spacing.xs,
      color: error ? Colors.error[500] : animatedColor,
    }
  }

  return (
    <View style={styles.wrapper}>
      {label && (
        <Animated.Text style={getLabelStyles()}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Animated.Text>
      )}

      <View style={getContainerStyles()}>
        {leftIcon && (
          <View style={styles.leftIconContainer}>
            <Ionicons
              name={leftIcon}
              size={20}
              color={
                disabled
                  ? Colors.neutral[400]
                  : isFocused
                    ? Colors.primary[500]
                    : Colors.neutral[500]
              }
            />
          </View>
        )}

        <TextInput
          ref={inputRef}
          style={getInputStyles()}
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          placeholderTextColor={Colors.text.tertiary}
          secureTextEntry={secureTextEntry && !showPassword}
          multiline={multiline}
          numberOfLines={numberOfLines}
          maxLength={maxLength}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          editable={!disabled}
          selectionColor={Colors.primary[500]}
        />

        {(rightIcon || (secureTextEntry && value.length > 0)) && (
          <TouchableOpacity
            style={styles.rightIconContainer}
            onPress={secureTextEntry ? togglePasswordVisibility : onRightIconPress}
            disabled={disabled}
          >
            <Ionicons
              name={
                secureTextEntry ? (showPassword ? 'eye-off-outline' : 'eye-outline') : rightIcon!
              }
              size={20}
              color={
                disabled
                  ? Colors.neutral[400]
                  : isFocused
                    ? Colors.primary[500]
                    : Colors.neutral[500]
              }
            />
          </TouchableOpacity>
        )}
      </View>

      {(error || helperText) && (
        <Text style={[styles.helperText, error && styles.errorText]}>{error || helperText}</Text>
      )}

      {maxLength && (
        <Text style={styles.characterCount}>
          {value.length}/{maxLength}
        </Text>
      )}
    </View>
  )
}

// Predefined input variants for common use cases
export const EmailInput = (props: Omit<EnhancedInputProps, 'keyboardType' | 'autoCapitalize'>) => (
  <EnhancedInput
    {...props}
    keyboardType="email-address"
    autoCapitalize="none"
    leftIcon="mail-outline"
  />
)

export const PasswordInput = (props: Omit<EnhancedInputProps, 'secureTextEntry'>) => (
  <EnhancedInput {...props} secureTextEntry leftIcon="lock-closed-outline" />
)

export const PhoneInput = (props: Omit<EnhancedInputProps, 'keyboardType'>) => (
  <EnhancedInput {...props} keyboardType="phone-pad" leftIcon="call-outline" />
)

export const SearchInput = (props: Omit<EnhancedInputProps, 'leftIcon'>) => (
  <EnhancedInput {...props} leftIcon="search-outline" variant="filled" />
)

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: Spacing.md,
  },
  required: {
    color: Colors.error[500],
  },
  leftIconContainer: {
    marginRight: Spacing.sm,
    justifyContent: 'center',
  },
  rightIconContainer: {
    marginLeft: Spacing.sm,
    padding: Spacing.xs,
    justifyContent: 'center',
  },
  helperText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
  },
  errorText: {
    color: Colors.error[500],
  },
  characterCount: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.tertiary,
    textAlign: 'right',
    marginTop: Spacing.xs,
  },
})
