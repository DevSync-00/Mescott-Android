import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
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
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useAuth } from '../contexts/SimpleAuthContext'
import { useToast } from '../contexts/ToastContext'
import TelegramLoginScreen, { TelegramAuthData } from '../components/TelegramLoginScreen'

export default function Auth() {
  const router = useRouter()
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

  const handleAuthResult = async (data: TelegramAuthData) => {
    setLoading(true)
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
                <View style={brandRowStyle}>
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
              <View style={styles.webViewContainer}>
                <TelegramLoginScreen onAuthResult={handleAuthResult} />
              </View>

              {loading && (
                <View style={styles.signingInOverlay}>
                  <ActivityIndicator size="large" color="#371F80" />
                  <Text style={styles.signingInText}>Signing in...</Text>
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

const brandRowStyle = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  marginTop: 14,
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
    paddingTop: 36,
    paddingBottom: 32,
    minHeight: '100%',
    marginTop: -24,
  },
  webViewContainer: {
    width: '100%',
    height: 420,
    borderRadius: 24,
    overflow: 'hidden',
  },
  signingInOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
    borderTopLeftRadius: 56,
    borderTopRightRadius: 56,
  },
  signingInText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '700',
    color: '#371F80',
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
})
