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
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  TextInput,
  TouchableOpacity,
} from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useAuth } from '../contexts/SimpleAuthContext'
import TelegramLoginScreen, { TelegramAuthData } from '../components/TelegramLoginScreen'
import { IS_SANDBOX_BUILD, checkBypassCredentials } from '../services/TelegramAuthService'

export default function Auth() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const { loginWithTelegram, loginWithBypass, isAuthenticated, loading: isLoading } = useAuth()
  
  // Staging Reviewer Bypass States
  const [reviewerMode, setReviewerMode] = useState(false)
  const [reviewerPhone, setReviewerPhone] = useState('')
  const [reviewerToken, setReviewerToken] = useState('')
  const [reviewerError, setReviewerError] = useState('')

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

  const handleReviewerSubmit = async () => {
    if (!reviewerPhone.trim() && !reviewerToken.trim()) {
      setReviewerError('Phone number and security bypass token are required')
      return
    }
    if (!reviewerPhone.trim()) {
      setReviewerError('Phone number is required')
      return
    }
    if (!reviewerToken.trim()) {
      setReviewerError('Security bypass token is required')
      return
    }
    
    setReviewerError('')
    setLoading(true)
    
    try {
      // 1. Intercept inputs to check if they match the reviewer parameters
      const isBypass = await checkBypassCredentials(reviewerPhone.trim(), reviewerToken.trim())
      if (isBypass) {
        // 2. Shortcut/bypass standard Telegram flow and call direct Supabase sign-in
        await loginWithBypass(reviewerPhone.trim(), reviewerToken.trim())
        setLoading(false)
        router.replace('/')
      } else {
        setLoading(false)
        Alert.alert('Bypass Denied', 'Invalid Google Reviewer credentials or sandbox configuration mismatch.')
      }
    } catch (err: any) {
      console.error('[Auth] Reviewer bypass error:', err)
      setLoading(false)
      Alert.alert('Bypass Error', err.message || 'An error occurred during verification.')
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />

      {/* Decorative Top-Right Vector Shape */}
      <View style={styles.vectorTopRight} pointerEvents="none" />

      {/* Decorative Bottom-Left Vector Shape */}
      <View style={styles.vectorBottomLeft} pointerEvents="none" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'space-between' }}
          keyboardShouldPersistTaps="handled"
        >
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

            {reviewerMode ? (
              <View style={styles.reviewerFormContainer}>
                <Text style={styles.reviewerTitle}>Google Play Reviewer Sign-In</Text>
                <Text style={styles.reviewerSubtitle}>
                  Please enter the test account phone number and security token provided.
                </Text>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Reviewer Phone Number</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="+12025550199"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="phone-pad"
                    value={reviewerPhone}
                    onChangeText={(text) => {
                      setReviewerPhone(text)
                      if (reviewerError) setReviewerError('')
                    }}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Security Bypass Token</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter bypass token"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={reviewerToken}
                    onChangeText={(text) => {
                      setReviewerToken(text)
                      if (reviewerError) setReviewerError('')
                    }}
                  />
                </View>

                {reviewerError ? (
                  <Text style={styles.formErrorText}>{reviewerError}</Text>
                ) : null}

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleReviewerSubmit}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryButtonText}>Sign In securely</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => {
                    setReviewerMode(false)
                    setReviewerError('')
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.secondaryButtonText}>Return to Telegram Sign-In</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* Flat, seamless Telegram WebView integration */
              <View style={styles.webViewWrapper}>
                <TelegramLoginScreen onAuthResult={handleAuthResult} />
              </View>
            )}

            {/* Google Reviewer access hook for staging / dev environments */}
            {IS_SANDBOX_BUILD && !reviewerMode && (
              <TouchableOpacity
                style={styles.reviewerAccessButton}
                onPress={() => setReviewerMode(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.reviewerAccessButtonText}>Google Play Reviewer Access</Text>
              </TouchableOpacity>
            )}

            {/* Footer info text */}
            <View style={styles.footerWrap}>
              <Text style={styles.footer}>© {new Date().getFullYear()} Mescott. All rights reserved.</Text>
              <Text style={styles.footerSub}>Terms & Conditions Apply*</Text>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Signing In Overlay State */}
      {loading && (
        <View style={styles.signingInOverlay}>
          <ActivityIndicator size="large" color="#7B42F6" />
          <Text style={styles.signingInText}>Securing Session...</Text>
        </View>
      )}
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
    backgroundColor: 'transparent',
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
    minHeight: 400,
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
  reviewerFormContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 16,
    justifyContent: 'center',
  },
  reviewerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3D0F95',
    marginBottom: 8,
    textAlign: 'center',
  },
  reviewerSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 20,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3D0F95',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E8EAED',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    minHeight: 48,
  },
  formErrorText: {
    color: '#FF3B30',
    fontSize: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#7B42F6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#7B42F6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 12,
  },
  secondaryButtonText: {
    color: '#7B42F6',
    fontSize: 16,
    fontWeight: '600',
  },
  reviewerAccessButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#7B42F6',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 40,
    marginTop: 12,
    marginBottom: 16,
  },
  reviewerAccessButtonText: {
    color: '#7B42F6',
    fontSize: 14,
    fontWeight: '600',
  },
})
