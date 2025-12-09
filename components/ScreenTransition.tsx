import React, { useEffect, useRef } from 'react'
import { Animated, StyleSheet } from 'react-native'

interface ScreenTransitionProps {
  children: React.ReactNode
  duration?: number
}

export const ScreenTransition: React.FC<ScreenTransitionProps> = ({ 
  children, 
  duration = 300 
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration,
      useNativeDriver: true,
    }).start()
  }, [fadeAnim, duration])

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {children}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})

