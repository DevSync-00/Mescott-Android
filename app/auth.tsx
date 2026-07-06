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
  TextInput,
} from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'
import { Image } from 'expo-image'
import * as Haptics from 'expo-haptics'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useAuth } from '../contexts/SimpleAuthContext'
import { useToast } from '../contexts/ToastContext'
import { FontAwesome } from '@expo/vector-icons'
import TelegramLoginScreen, { TelegramAuthData } from '../components/TelegramLoginScreen'

export default function Auth() {
  const router = useRouter()
  const [phoneNumber, setPhoneNumber] = useState('+251')
  const [inputError, setInputError] = useState<string | null>(null)
  const [showWebView, setShowWebView] = useState(false)
  const [loading, setLoading] = useState(false)

  const { loginWithTelegram, isAuthenticated, loading: isLoading } = useAuth()
  const { showSuccess, showError } = useToast()
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(16)).current
  const pulseAnim = useRef(new Animated.Value(1)).current
  const scrollViewRef = useRef<any>(null)

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

  // Pulse animation for the logo
  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null
    if (loading) {
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
  }, [loading])

  const handleContinueWithTelegram = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    
    // Validate phone number format
    const digits = phoneNumber.replace(/\D/g, '')
    if (digits.length < 8) {
      setInputError('Please enter a valid phone number with country code')
      return
    }

    setInputError(null)
    setShowWebView(true)
    setLoading(true)
  }

  const handleAuthResult = async (data: TelegramAuthData) => {
    setShowWebView(false)
    try {
      await loginWithTelegram(data)
      showSuccess('Successfully signed in with Telegram!')
    } catch (err: any) {
      console.error('Telegram login error:', err)
      showError(err.message || 'Could not complete Telegram login. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setShowWebView(false)
    setLoading(false)
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
              {showWebView ? (
                <View style={styles.awaitingContainer}>
                  <Text style={styles.awaitingTitle}>Check Telegram</Text>
                  <Text style={styles.awaitingText}>
                    We have sent a verification request to your Telegram. Please open Telegram and tap "Confirm" inside the secure verification thread.
                  </Text>
                  <ActivityIndicator size="large" color="#371F80" style={styles.awaitingLoader} />
                  
                  <TouchableOpacity onPress={handleCancel} style={styles.awaitingCancelButton}>
                    <Text style={styles.awaitingCancelText}>Cancel & Try Again</Text>
                  </TouchableOpacity>

                  {/* Hidden Background Webview for Automation */}
                  <View style={styles.hiddenWebView}>
                    <TelegramLoginScreen
                      phoneNumber={phoneNumber}
                      onAuthResult={handleAuthResult}
                      onCancel={handleCancel}
                    />
                  </View>
                </View>
              ) : (
                <View style={styles.introContainer}>
                  <Text style={styles.title}>Frictionless Login</Text>
                  <Text style={styles.subtitle}>Sign in instantly using your phone number</Text>

                  <View style={styles.inputContainer}>
                    <FontAwesome name="phone" size={20} color="#371F80" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      value={phoneNumber}
                      onChangeText={(text) => {
                        if (!text.startsWith('+')) {
                          setPhoneNumber('+' + text.replace(/\D/g, ''))
                        } else {
                          setPhoneNumber('+' + text.substring(1).replace(/\D/g, ''))
                        }
                        if (inputError) setInputError(null)
                      }}
                      placeholder="e.g. +251 912 345 678"
                      placeholderTextColor="#999999"
                      keyboardType="phone-pad"
                    />
                  </View>
                  {inputError && <Text style={styles.errorText}>{inputError}</Text>}

                  <TouchableOpacity
                    style={[styles.telegramButton, loading && styles.buttonDisabled]}
                    onPress={handleContinueWithTelegram}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    <View style={styles.telegramBtnContent}>
                      <FontAwesome name="telegram" size={24} color="#FFF" style={styles.telegramIcon} />
                      <Text style={styles.telegramButtonText}>
                        {loading ? 'SENDING REQUEST...' : 'CONTINUE WITH TELEGRAM'}
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E8E8F0',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginBottom: 16,
    backgroundColor: '#F9F9FC',
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#333333',
    fontWeight: '600',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    fontWeight: '600',
    marginTop: -8,
    marginBottom: 16,
    marginLeft: 12,
  },
  awaitingContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 24,
  },
  awaitingTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#371F80',
    marginBottom: 12,
    textAlign: 'center',
  },
  awaitingText: {
    fontSize: 15,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  awaitingLoader: {
    marginBottom: 40,
    transform: [{ scale: 1.3 }],
  },
  awaitingCancelButton: {
    borderWidth: 1.5,
    borderColor: '#E8E8F0',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 28,
    backgroundColor: '#FFFFFF',
  },
  awaitingCancelText: {
    color: '#371F80',
    fontSize: 14,
    fontWeight: '700',
  },
  hiddenWebView: {
    width: 1,
    height: 1,
    opacity: 0.01,
    position: 'absolute',
  },
})
