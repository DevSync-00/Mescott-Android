import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Animated,
  Easing,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'
import { Image } from 'expo-image'
import * as Haptics from 'expo-haptics'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useAuth } from '../contexts/SimpleAuthContext'
import { useToast } from '../contexts/ToastContext'
import { Ionicons, FontAwesome } from '@expo/vector-icons'
import * as Linking from 'expo-linking'
import { TelegramAuthService } from '../services/telegramAuth'

export default function Auth() {
  const router = useRouter()
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [telegramLink, setTelegramLink] = useState<string | null>(null)
  const [fallbackLink, setFallbackLink] = useState<string | null>(null)
  const [isAwaiting, setIsAwaiting] = useState(false)
  const [loading, setLoading] = useState(false)

  const { initiateTelegramAuth, handleTelegramCallback, isAuthenticated, loading: isLoading } = useAuth()
  const { showSuccess, showError } = useToast()
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(16)).current
  const pulseAnim = useRef(new Animated.Value(1)).current
  const scrollViewRef = useRef<any>(null)

  const unsubscribeRef = useRef<(() => void) | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

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
      // Fade out smoothly before navigation
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
        // Navigate after fade out completes
        router.replace('/')
      })
    }
  }, [isAuthenticated, isLoading, router, fadeAnim, slideAnim])

  // Clean up timers & subscriptions on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  // Pulse animation for the logo during awaiting state
  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null
    if (isAwaiting) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      )
      animation.start()
    } else {
      pulseAnim.setValue(1)
    }
    return () => {
      if (animation) {
        animation.stop()
      }
    }
  }, [isAwaiting])

  const handleCancelAndRetry = () => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current()
      unsubscribeRef.current = null
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setIsAwaiting(false)
    setSessionToken(null)
    setTelegramLink(null)
    setFallbackLink(null)
    setLoading(false)
  }

  const handleTimeout = () => {
    handleCancelAndRetry()
    showError('Verification session expired. Please try again.')
  }

  const handleContinueWithTelegram = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setLoading(true)
    try {
      const data = await initiateTelegramAuth({
        platform: Platform.OS,
        os_version: Platform.Version,
        device_name: Platform.select({ ios: 'iPhone', android: 'Android Device', default: 'Mobile Device' }),
      })

      if (!data || !data.session_token) {
        showError('Failed to initialize Telegram session. Please try again.')
        setLoading(false)
        return
      }

      setSessionToken(data.session_token)
      setTelegramLink(data.telegram_link)
      setFallbackLink(data.fallback_link)
      setIsAwaiting(true)

      // Subscribe to Supabase Realtime channel and DB changes
      unsubscribeRef.current = TelegramAuthService.subscribeToAuthStatus(
        data.session_token,
        async (jwtPayload) => {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
            timeoutRef.current = null
          }
          if (unsubscribeRef.current) {
            unsubscribeRef.current()
            unsubscribeRef.current = null
          }

          setLoading(true)
          const res = await handleTelegramCallback(jwtPayload)
          if (res.success) {
            showSuccess('Successfully signed in with Telegram!')
          } else {
            showError(res.message || 'Authentication verification failed.')
            handleCancelAndRetry()
          }
        }
      )

      // Set 5-minute timeout
      timeoutRef.current = setTimeout(() => {
        handleTimeout()
      }, 300000)

      // Open native Telegram app link or fallback to web link
      const canOpen = await Linking.canOpenURL(data.telegram_link)
      if (canOpen) {
        await Linking.openURL(data.telegram_link)
      } else {
        await Linking.openURL(data.fallback_link)
      }
    } catch (err: any) {
      console.error('Telegram auth initiation error:', err)
      showError('An error occurred during authentication. Please try again.')
      handleCancelAndRetry()
    } finally {
      setLoading(false)
    }
  }

  const handleOpenFallbackLink = async () => {
    if (fallbackLink) {
      await Linking.openURL(fallbackLink)
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#371F80" translucent={false} />

      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <Animated.View
          style={[
            styles.animatedContainer,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <KeyboardAwareScrollView
            innerRef={(ref) => {
              scrollViewRef.current = ref
            }}
            contentContainerStyle={styles.scrollContent}
            style={styles.scrollView}
            keyboardShouldPersistTaps="never"
            showsVerticalScrollIndicator={false}
            bounces={false}
            alwaysBounceVertical={false}
            alwaysBounceHorizontal={false}
            keyboardDismissMode="none"
            enableOnAndroid={true}
            enableAutomaticScroll={true}
            extraHeight={0}
            extraScrollHeight={0}
            scrollEnabled={true}
            viewIsInsideTabBar={false}
            enableResetScrollToCoords={false}
            keyboardOpeningTime={Platform.OS === 'ios' ? 250 : 0}
            scrollToOverflowEnabled={false}
            overScrollMode="never"
          >
            {/* Hero */}
            <View style={styles.hero}>
              <View style={styles.heroTextBlock}>
                <Text style={styles.heroGreeting}>Hey!</Text>
                <Text style={styles.heroGreeting}>Welcome To</Text>
                <View style={styles.brandRow}>
                  <Text style={styles.heroBrand}>MESCO</Text>
                  <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                    <Image
                      source={require('../assets/images/splash-icon-light.png')}
                      style={styles.heroMark}
                      contentFit="contain"
                      cachePolicy="memory-disk"
                    />
                  </Animated.View>
                </View>
              </View>
            </View>

            {/* Card */}
            <View style={styles.card}>
              {isAwaiting ? (
                <View style={styles.awaitingContainer}>
                  <Text style={styles.title}>Awaiting Approval</Text>
                  <Text style={styles.subtitle}>
                    Waiting for Telegram approval... please do not close Mescott.
                  </Text>

                  <View style={styles.spinnerWrap}>
                    <ActivityIndicator size="large" color="#24A1DE" style={styles.spinner} />
                  </View>

                  <Text style={styles.instructionsText}>
                    Ensure you click "Start" inside the Telegram app/bot to approve your login.
                  </Text>

                  <TouchableOpacity
                    style={styles.fallbackButton}
                    onPress={handleOpenFallbackLink}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.fallbackButtonText}>
                      App didn't switch? Open Telegram Web
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={handleCancelAndRetry}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelButtonText}>Cancel & Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.introContainer}>
                  <Text style={styles.title}>Frictionless Login</Text>
                  <Text style={styles.subtitle}>Sign in securely using your Telegram account</Text>

                  {/* How It Works Card */}
                  <View style={styles.howItWorksCard}>
                    <Text style={styles.howItWorksTitle}>- HOW IT WORKS -</Text>
                    <View style={styles.stepRow}>
                      <View style={styles.stepBadge}>
                        <Text style={styles.stepBadgeText}>1</Text>
                      </View>
                      <Text style={styles.stepText}>Tap "Continue with Telegram" below</Text>
                    </View>
                    <View style={styles.stepRow}>
                      <View style={styles.stepBadge}>
                        <Text style={styles.stepBadgeText}>2</Text>
                      </View>
                      <Text style={styles.stepText}>Click "Start" in the Telegram bot</Text>
                    </View>
                    <View style={styles.stepRow}>
                      <View style={styles.stepBadge}>
                        <Text style={styles.stepBadgeText}>3</Text>
                      </View>
                      <Text style={styles.stepText}>Return to Mescott automatically</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.telegramButton, loading && styles.buttonDisabled]}
                    onPress={handleContinueWithTelegram}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    <View style={styles.telegramBtnContent}>
                      <FontAwesome name="telegram" size={24} color="#FFF" style={styles.telegramIcon} />
                      <Text style={styles.telegramButtonText}>
                        {loading ? 'INITIATING...' : 'CONTINUE WITH TELEGRAM'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.footerWrap}>
                <Text style={styles.footer}>Terms & Conditions Apply*</Text>
              </View>
            </View>
          </KeyboardAwareScrollView>
        </Animated.View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#371F80',
  },
  animatedContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  hero: {
    backgroundColor: '#371F80',
    paddingTop: 56,
    paddingHorizontal: 32,
    paddingBottom: 36,
  },
  heroTextBlock: {
    marginTop: 8,
  },
  heroGreeting: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 40,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
  },
  heroBrand: {
    color: '#FFFFFF',
    fontSize: 56,
    fontWeight: '900',
    letterSpacing: 1,
  },
  heroMark: {
    width: 122,
    height: 122,
    marginLeft: -4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 56,
    borderTopRightRadius: 56,
    paddingHorizontal: 28,
    paddingTop: 48,
    paddingBottom: 32,
    minHeight: '100%',
    marginTop: -24,
  },
  title: {
    color: '#000000',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  subtitle: {
    color: '#371F80',
    fontSize: 15,
    marginBottom: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  footerWrap: {
    marginTop: 32,
    alignItems: 'center',
  },
  footer: {
    fontSize: 12,
    color: '#371F80',
    textAlign: 'center',
  },
  introContainer: {
    width: '100%',
  },
  awaitingContainer: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: 'rgba(55, 31, 128, 0.05)',
    borderRadius: 24,
    padding: 20,
  },
  howItWorksCard: {
    backgroundColor: '#F5F5FA',
    borderRadius: 20,
    padding: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#E8E8F0',
  },
  howItWorksTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#371F80',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 1,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#371F80',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  stepText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    flex: 1,
  },
  telegramButton: {
    backgroundColor: '#24A1DE',
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#24A1DE',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  telegramBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  telegramIcon: {
    marginRight: 8,
  },
  telegramButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  spinnerWrap: {
    marginVertical: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinner: {
    transform: [{ scale: 1.2 }],
  },
  instructionsText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  fallbackButton: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 20,
    width: '100%',
    alignItems: 'center',
    backgroundColor: '#FFF',
    marginBottom: 12,
  },
  fallbackButtonText: {
    color: '#24A1DE',
    fontSize: 14,
    fontWeight: '700',
  },
  cancelButton: {
    backgroundColor: '#FF4D4D',
    borderRadius: 24,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
})
