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
import { Image } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useAuth } from '../contexts/SimpleAuthContext'
import TelegramLoginScreen, { TelegramAuthData } from '../components/TelegramLoginScreen'

export default function Auth() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const { loginWithTelegram, isAuthenticated, loading: isLoading } = useAuth()
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(16)).current

  // Smoothly fade/slide in the auth screen to avoid abrupt pop-in
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
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
          duration: 200,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: -20,
          duration: 200,
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

      {/* Decorative Top-Right Vector Shape */}
      <View style={styles.vectorTopRight} />

      {/* Decorative Bottom-Left Vector Shape */}
      <View style={styles.vectorBottomLeft} />

      <Animated.View
        style={[
          styles.animatedContainer,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Modern Branding Header with Connected Logo */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Welcome to</Text>
          <View style={styles.logoRow}>
            <Text style={styles.logoText}>MESCO</Text>
            <Image
              source={require('../assets/images/adaptive-icon.png')}
              style={styles.logoImage}
              contentFit="contain"
            />
          </View>
          <Text style={styles.heroSubtitle}>Ethiopia's Leading Marketplace Platform</Text>
        </View>

        {/* Flat, seamless Telegram WebView integration */}
        <View style={styles.webViewWrapper}>
          <TelegramLoginScreen onAuthResult={handleAuthResult} />
        </View>

        {/* Signing In Overlay State */}
        {loading && (
          <View style={styles.signingInOverlay}>
            <ActivityIndicator size="large" color="#7B42F6" />
            <Text style={styles.signingInText}>Securing Session...</Text>
          </View>
        )}

        {/* Footer info text */}
        <View style={styles.footerWrap}>
          <Text style={styles.footer}>© {new Date().getFullYear()} Mescott. All rights reserved.</Text>
          <Text style={styles.footerSub}>Terms & Conditions Apply*</Text>
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
  vectorTopRight: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(123, 66, 246, 0.08)',
    zIndex: 0,
  },
  vectorBottomLeft: {
    position: 'absolute',
    bottom: -80,
    left: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(55, 31, 128, 0.05)',
    zIndex: 0,
  },
  animatedContainer: {
    flex: 1,
    zIndex: 1,
    backgroundColor: '#FFFFFF',
  },
  hero: {
    paddingTop: 32,
    paddingBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#3D0F95',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  logoImage: {
    width: 72,
    height: 72,
    marginLeft: -15,
    marginTop: -2,
  },
  heroSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 6,
    fontWeight: '500',
  },
  webViewWrapper: {
    flex: 1,
    width: '100%',
    backgroundColor: '#FFFFFF',
  },
  signingInOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  signingInText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '700',
    color: '#7B42F6',
    letterSpacing: 0.5,
  },
  footerWrap: {
    paddingBottom: 24,
    paddingTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '500',
    textAlign: 'center',
  },
  footerSub: {
    fontSize: 10,
    color: '#C7C7CC',
    marginTop: 4,
    textAlign: 'center',
  },
})

