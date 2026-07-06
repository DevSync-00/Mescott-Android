import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Alert,
  Animated,
  Easing,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useAuth } from '../contexts/SimpleAuthContext'
import TelegramLoginScreen, { TelegramAuthData } from '../components/TelegramLoginScreen'

export default function Auth() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const { loginWithTelegram, isAuthenticated, loading: isLoading } = useAuth()
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(12)).current

  // Smoothly fade/slide in the auth screen to avoid abrupt pop-in
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start()
  }, [fadeAnim, slideAnim])

  // Redirect away if already authenticated with smooth transition
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: -20,
          duration: 180,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => {
        router.replace('/')
      })
    }
  }, [isAuthenticated, isLoading, router, fadeAnim, slideAnim])

  const handleAuthResult = async (data: TelegramAuthData) => {
    console.log('[Auth] Extracted auth data received on client layer. Initiating sign-in...')
    setLoading(true)
    try {
      // 1. Submit the credentials to the Supabase context
      await loginWithTelegram(data)
      // 2. Drop the spinner BEFORE transition so the overlay never blocks navigation
      setLoading(false)
      // 3. Force route transition explicitly to the root screen layout
      router.replace('/')
    } catch (err: any) {
      console.error('[Auth] Navigation block catch:', err)
      setLoading(false)
      Alert.alert('Authentication Mismatch', err.message || 'Verification timed out. Please try again.')
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />

      <Animated.View
        style={[
          styles.animatedContainer,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Minimalist Top Branding Header */}
        <View style={styles.hero}>
          <Text style={styles.heroBrand}>Welcome To MESCOTT</Text>
        </View>

        {/* Inline Telegram Widget WebView covering main body */}
        <View style={styles.webViewWrapper}>
          <TelegramLoginScreen onAuthResult={handleAuthResult} />
        </View>

        {/* Signing In Overlay State */}
        {loading && (
          <View style={styles.signingInOverlay}>
            <ActivityIndicator size="large" color="#371F80" />
            <Text style={styles.signingInText}>Signing in...</Text>
          </View>
        )}

        {/* Footer text */}
        <View style={styles.footerWrap}>
          <Text style={styles.footer}>Terms & Conditions Apply*</Text>
        </View>
      </Animated.View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  animatedContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  hero: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  heroBrand: {
    color: '#371F80',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  webViewWrapper: {
    flex: 1,
    width: '100%',
    backgroundColor: '#FFFFFF',
  },
  signingInOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  signingInText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '700',
    color: '#371F80',
  },
  footerWrap: {
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  footer: {
    fontSize: 11,
    color: '#8E8E93',
    textAlign: 'center',
  },
})
