import React, { useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '../constants/Colors'
import * as Haptics from 'expo-haptics'

const { width } = Dimensions.get('window')

export interface AlertButton {
  text: string
  onPress?: () => void
  style?: 'default' | 'cancel' | 'destructive'
}

interface CustomAlertProps {
  visible: boolean
  title?: string
  message: string
  buttons?: AlertButton[]
  onDismiss?: () => void
  type?: 'success' | 'error' | 'warning' | 'info'
}

export default function CustomAlert({
  visible,
  title,
  message,
  buttons = [{ text: 'OK' }],
  onDismiss,
  type = 'info',
}: CustomAlertProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current
  const opacityAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(50)).current

  useEffect(() => {
    if (visible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 120,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          easing: (t) => 1 - Math.pow(1 - t, 2), // gentler easing
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 30,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [visible])

  const getIcon = () => {
    switch (type) {
      case 'success':
        return { name: 'checkmark-circle', color: Colors.success[600] }
      case 'error':
        return { name: 'close-circle', color: Colors.error[600] }
      case 'warning':
        return { name: 'warning', color: Colors.warning[600] } // Slightly darker, less bright
      case 'info':
      default:
        return { name: 'information-circle', color: Colors.primary[600] }
    }
  }

  const handleButtonPress = (button: AlertButton) => {
    if (button.onPress) {
      button.onPress()
    }
    onDismiss?.()
  }

  const handleDismiss = () => {
    onDismiss?.()
  }

  if (!visible) return null

  const icon = getIcon()

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleDismiss}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={handleDismiss}>
        <Animated.View
          style={[
            styles.overlay,
            {
              opacity: opacityAnim,
            },
          ]}
        >
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.alertContainer,
                {
                  transform: [
                    { scale: scaleAnim },
                    { translateY: slideAnim },
                  ],
                },
              ]}
            >
              <View style={styles.content}>
                {/* Icon */}
                <View style={[styles.iconContainer, { backgroundColor: icon.color + '0D' }]}>
                  <Ionicons name={icon.name as any} size={28} color={icon.color} />
                </View>

                {/* Title */}
                {title && <Text style={styles.title}>{title}</Text>}

                {/* Message */}
                <Text style={styles.message}>{message}</Text>

                {/* Buttons */}
                <View style={styles.buttonContainer}>
                  {buttons.map((button, index) => {
                    const isDestructive = button.style === 'destructive'
                    const isCancel = button.style === 'cancel'
                    const isLast = index === buttons.length - 1

                    return (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.button,
                          isLast && buttons.length === 1 && styles.buttonFullWidth,
                          isDestructive && styles.buttonDestructive,
                          isCancel && styles.buttonCancel,
                          !isLast && styles.buttonMarginRight,
                        ]}
                        onPress={() => handleButtonPress(button)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.buttonText,
                            isDestructive && styles.buttonTextDestructive,
                            isCancel && styles.buttonTextCancel,
                          ]}
                        >
                          {button.text}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // Softer, less intrusive overlay
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  alertContainer: {
    width: width - 48,
    maxWidth: 340,
    backgroundColor: Colors.background.primary,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  content: {
    padding: 20,
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.neutral[900],
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  message: {
    fontSize: 14,
    color: Colors.neutral[600],
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: Colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    shadowColor: Colors.primary[500],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  buttonFullWidth: {
    width: '100%',
  },
  buttonMarginRight: {
    marginRight: 0,
  },
  buttonDestructive: {
    backgroundColor: Colors.error[500],
    shadowColor: Colors.error[500],
  },
  buttonCancel: {
    backgroundColor: Colors.neutral[50],
    borderWidth: 1,
    borderColor: Colors.border.light,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.3,
  },
  buttonTextDestructive: {
    color: '#fff',
  },
  buttonTextCancel: {
    color: Colors.neutral[700],
  },
})

