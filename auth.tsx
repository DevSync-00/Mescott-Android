import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
  Modal,
  Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons, FontAwesome } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useAuth } from '../contexts/SimpleAuthContext'
import TelegramLoginScreen, { TelegramAuthData } from '../components/TelegramLoginScreen'

export default function Auth() {
  const router = useRouter()
  const [showWebView, setShowWebView] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pulseAnim] = useState(new Animated.Value(1))

  const { loginWithTelegram, isAuthenticated } = useAuth()

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/')
    }
  }, [isAuthenticated])

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null
    if (loading) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.12, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 900, useNativeDriver: true }),
        ])
      )
      animation.start()
    } else {
      pulseAnim.setValue(1)
    }
    return () => {
      if (animation) animation.stop()
    }
  }, [loading])

  const handleAuthResult = async (data: TelegramAuthData) => {
    setShowWebView(false)
    setLoading(true)
    try {
      await loginWithTelegram(data)
    } catch (err: any) {
      console.error('Telegram login error:', err)
      Alert.alert(
        'Login Failed',
        err.message || 'Could not complete Telegram login. Please try again.',
        [{ text: 'OK' }]
      )
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => setShowWebView(false)

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        {/* ── Logo + Wordmark ── */}
        <View style={styles.header}>
          <Animated.View style={[styles.logoWrap, { transform: [{ scale: pulseAnim }] }]}>
            {/* 
              Replace this path with the actual location of ios-light.png in your project.
              e.g. require('../assets/images/ios-light.png')
                or require('../assets/icon.png')
            */}
            <Image
              source={require('../assets/images/ios-light.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </Animated.View>
          <Text style={styles.brand}>MESCOTT</Text>
          <Text style={styles.tagline}>
            Your on-demand service marketplace.{'\n'}Sign in to get started.
          </Text>
        </View>

        {/* ── Telegram CTA ── */}
        <View style={styles.ctaWrap}>
          <TouchableOpacity
            style={[styles.tgButton, (loading || showWebView) && styles.tgButtonDisabled]}
            onPress={() => setShowWebView(true)}
            disabled={loading || showWebView}
            accessibilityLabel="Continue with Telegram"
            accessibilityRole="button"
          >
            {/* FontAwesome 'telegram' is already in @expo/vector-icons — no extra install needed */}
            <FontAwesome name="telegram" size={22} color="#FFFFFF" />
            <Text style={styles.tgButtonText}>
              {loading ? 'Signing in…' : 'Continue with Telegram'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Steps Card ── */}
        <View style={styles.stepsCard}>
          <Text style={styles.stepsLabel}>HOW IT WORKS</Text>

          {[
            {
              n: '1',
              title: 'Tap "Continue with Telegram"',
              sub: 'Opens a secure Telegram login prompt',
            },
            {
              n: '2',
              title: 'Confirm your identity in Telegram',
              sub: 'No password needed — one tap to approve',
            },
            {
              n: '3',
              title: "You're in — returned automatically",
              sub: 'Your account is ready instantly',
            },
          ].map((step) => (
            <View key={step.n} style={styles.stepRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>{step.n}</Text>
              </View>
              <View style={styles.stepBody}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepSub}>{step.sub}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Security note ── */}
        <View style={styles.securityRow}>
          <Ionicons name="shield-checkmark-outline" size={14} color="#AAAAAA" />
          <Text style={styles.securityText}>Verified by Telegram · No passwords stored</Text>
        </View>

        {/* ── Footer ── */}
        <Text style={styles.footerText}>
          By continuing you agree to our{' '}
          <Text style={styles.footerLink}>Terms of Service</Text>
          {' '}and{' '}
          <Text style={styles.footerLink}>Privacy Policy</Text>.
        </Text>

      </View>

      {/* ── Telegram WebView Modal ── */}
      <Modal
        visible={showWebView}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCancel}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>Sign in with Telegram</Text>
            <TouchableOpacity
              onPress={handleCancel}
              style={styles.closeButton}
              accessibilityLabel="Close Telegram login"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={22} color="#333333" />
            </TouchableOpacity>
          </View>
          <TelegramLoginScreen onAuthResult={handleAuthResult} onCancel={handleCancel} />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginTop: 16,
  },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#2E1D6E',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    overflow: 'hidden',
  },
  logoImage: {
    width: 52,
    height: 52,
  },
  brand: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1A1A1A',
    letterSpacing: 3,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 21,
  },
  ctaWrap: {
    width: '100%',
    alignItems: 'center',
  },
  tgButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#229ED9',
    width: '100%',
    maxWidth: 320,
    height: 50,
    borderRadius: 25,
  },
  tgButtonDisabled: {
    opacity: 0.6,
  },
  tgButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  stepsCard: {
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8E8E8',
    padding: 20,
    width: '100%',
    maxWidth: 320,
  },
  stepsLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#AAAAAA',
    letterSpacing: 1,
    marginBottom: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#2E1D6E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 1,
    flexShrink: 0,
  },
  stepBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#C8B8FF',
  },
  stepBody: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 13,
    color: '#333333',
    fontWeight: '500',
    lineHeight: 18,
  },
  stepSub: {
    fontSize: 12,
    color: '#999999',
    marginTop: 2,
    lineHeight: 17,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  securityText: {
    fontSize: 12,
    color: '#AAAAAA',
  },
  footerText: {
    fontSize: 11,
    color: '#BBBBBB',
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: 20,
  },
  footerLink: {
    color: '#888888',
    textDecorationLine: 'underline',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EFEFEF',
  },
  modalHeaderTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    marginLeft: 38,
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    padding: 4,
  },
})