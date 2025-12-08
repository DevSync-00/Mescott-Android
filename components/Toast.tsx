import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '../constants/Colors'

export interface ToastProps {
  visible: boolean
  message: string
  type?: 'success' | 'error' | 'warning' | 'info'
  duration?: number
  onHide?: () => void
  action?: {
    label: string
    onPress: () => void
  }
}

export default function Toast({
  visible,
  message,
  type = 'info',
  duration = 3000,
  onHide,
  action,
}: ToastProps) {
  const [fadeAnim] = useState(new Animated.Value(0))
  const [slideAnim] = useState(new Animated.Value(-100))

  useEffect(() => {
    if (visible) {
      showToast()
    } else {
      hideToast()
    }
  }, [visible])

  const showToast = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start()

    if (duration > 0) {
      setTimeout(() => {
        hideToast()
      }, duration)
    }
  }

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide?.()
    })
  }

  const getToastStyle = () => {
    switch (type) {
      case 'success':
        return {
          backgroundColor: Colors.success[500],
          borderLeftColor: Colors.success[600],
        }
      case 'error':
        return {
          backgroundColor: Colors.error[500],
          borderLeftColor: Colors.error[600],
        }
      case 'warning':
        return {
          backgroundColor: Colors.warning[500],
          borderLeftColor: Colors.warning[600],
        }
      case 'info':
      default:
        return {
          backgroundColor: '#371F80', // Match app's purple theme
          borderLeftColor: Colors.primary[600],
        }
    }
  }

  const getIcon = () => {
    switch (type) {
      case 'success':
        return 'checkmark-circle'
      case 'error':
        return 'close-circle'
      case 'warning':
        return 'warning'
      case 'info':
      default:
        return 'information-circle'
    }
  }

  if (!visible) return null

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={[styles.toast, getToastStyle()]}>
        <View style={styles.content}>
          <Ionicons name={getIcon()} size={20} color="#fff" style={styles.icon} />
          <Text style={styles.message} numberOfLines={2}>
            {message}
          </Text>
          {action && (
            <TouchableOpacity style={styles.actionButton} onPress={action.onPress}>
              <Text style={styles.actionText}>{action.label}</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={hideToast}>
          <Ionicons name="close" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  toast: {
    borderRadius: 16,
    borderLeftWidth: 4,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingRight: 48,
  },
  icon: {
    marginRight: 12,
  },
  message: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  actionButton: {
    marginLeft: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 8,
  },
  actionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
})
