import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Animated,
  Easing,
  TouchableWithoutFeedback,
  Keyboard,
  Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useAuth } from '../contexts/SimpleAuthContext'

export default function Auth() {
  const router = useRouter()
  const [phoneNumber, setPhoneNumber] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [isCodeSent, setIsCodeSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const { sendVerificationCode, verifyPhoneCode, isAuthenticated, loading: isLoading } = useAuth()
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(16)).current

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

  // Redirect away if already authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      // Small delay to ensure router is ready
      const timer = setTimeout(() => {
        router.replace('/')
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isAuthenticated, isLoading, router])

  // Reset auth state when user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      setVerificationCode('')
      setIsCodeSent(false)
      setLoading(false)
      setCountdown(0)
    }
  }, [isAuthenticated])

  const startCountdown = () => {
    setCountdown(60)
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const cleanPhoneNumber = (phone: string) => {
    let cleaned = phone.replace(/\D/g, '')
    if (cleaned.startsWith('0')) {
      cleaned = '251' + cleaned.substring(1)
    }
    if (!cleaned.startsWith('251')) {
      cleaned = '251' + cleaned
    }
    return '+' + cleaned
  }

  const handleSendCode = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert('Error', 'Please enter your phone number')
      return
    }

    const formattedPhone = cleanPhoneNumber(phoneNumber)

    if (formattedPhone.length !== 13) {
      Alert.alert('Error', 'Please enter a valid 9-digit phone number (e.g., 0912345678)')
      return
    }

    setLoading(true)

    try {
      const result = await sendVerificationCode(formattedPhone)

      if (result.success) {
        Alert.alert('Success', result.message)
        setIsCodeSent(true)
        startCountdown()
      } else {
        Alert.alert('Error', result.message)
      }
    } catch (error: any) {
      console.error('Exception in handleSendCode:', error)
      Alert.alert('Error', error.message || 'Failed to send verification code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async () => {
    if (verificationCode.length !== 6) {
      Alert.alert('Error', 'Please enter the 6-digit verification code')
      return
    }

    setLoading(true)
    try {
      const formattedPhone = cleanPhoneNumber(phoneNumber)
      const result = await verifyPhoneCode(formattedPhone, verificationCode)

      if (result.success) {
        Alert.alert('Success', result.message)

        // Reset form state
        setVerificationCode('')
        setIsCodeSent(false)
        setPhoneNumber('')
      } else {
        Alert.alert('Error', result.message)
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Verification failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResendCode = async () => {
    if (countdown === 0) {
      setLoading(true)
      try {
        const formattedPhone = cleanPhoneNumber(phoneNumber)
        const result = await sendVerificationCode(formattedPhone)

        if (result.success) {
          setVerificationCode('')
          Alert.alert('Success', 'New verification code sent')
          startCountdown()
        } else {
          Alert.alert('Error', result.message)
        }
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Failed to resend verification code')
      } finally {
        setLoading(false)
      }
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
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
          >
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {/* Hero */}
              <View style={styles.hero}>
                <View style={styles.heroTextBlock}>
                  <Text style={styles.heroGreeting}>Hey!</Text>
                  <Text style={styles.heroGreeting}>Welcome To</Text>
                  <View style={styles.brandRow}>
                    <Text style={styles.heroBrand}>MESCO</Text>
                    <Image
                      source={{
                        uri: 'https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/af4c84d7-57e5-42c9-9d89-94e58d60ec53',
                      }}
                      resizeMode="contain"
                      style={styles.heroMark}
                    />
                  </View>
                </View>
              </View>

              {/* Card */}
              <View style={styles.card}>
                {!isCodeSent ? (
                  <>
                    <Text style={styles.title}>ENTER YOUR PHONE NUMBER</Text>
                    <Text style={styles.subtitle}>We will send an OTP verification code</Text>

                    <View style={styles.phoneInputRow}>
                      <View style={styles.flagWrap}>
                        <Image
                          source={{
                            uri: 'https://flagcdn.com/w40/et.png',
                          }}
                          style={styles.flag}
                          resizeMode="cover"
                        />
                      </View>
                      <TextInput
                        style={styles.phoneInput}
                        placeholder="Phone number"
                        placeholderTextColor="#999"
                        value={phoneNumber}
                        onChangeText={setPhoneNumber}
                        keyboardType="phone-pad"
                        returnKeyType="done"
                        onSubmitEditing={handleSendCode}
                      />
                    </View>

                    <TouchableOpacity
                      style={[styles.primaryButton, loading && styles.buttonDisabled]}
                      onPress={handleSendCode}
                      disabled={loading}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.buttonText}>{loading ? 'Sending...' : 'CONTINUE'}</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      onPress={() => {
                        setIsCodeSent(false)
                        setVerificationCode('')
                      }}
                      style={styles.backLink}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.backLinkText}>← Change Number</Text>
                    </TouchableOpacity>

                    <Text style={styles.title}>OTP Verification</Text>
                    <Text style={styles.subtitle}>Enter the OTP verification code</Text>

                    <TextInput
                      style={styles.otpInput}
                      placeholder="000000"
                      placeholderTextColor="#CFCFCF"
                      value={verificationCode}
                      onChangeText={setVerificationCode}
                      keyboardType="number-pad"
                      maxLength={6}
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={handleVerifyCode}
                      textAlign="center"
                    />

                    <TouchableOpacity
                      style={[styles.primaryButton, loading && styles.buttonDisabled]}
                      onPress={handleVerifyCode}
                      disabled={loading}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.buttonText}>{loading ? 'Verifying...' : 'VERIFY'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={handleResendCode}
                      disabled={countdown > 0 || loading}
                      style={styles.resendLink}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.resendText,
                          (countdown > 0 || loading) && styles.resendTextDisabled,
                        ]}
                      >
                        {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend Code'}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}

                <View style={styles.footerWrap}>
                  <Text style={styles.footer}>Terms & Conditions Apply*</Text>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
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
  keyboardView: {
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
    width: 60,
    height: 60,
    marginLeft: 10,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 56,
    borderTopRightRadius: 56,
    paddingHorizontal: 28,
    paddingTop: 48,
    paddingBottom: 32,
    flex: 1,
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
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E9E9E9',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 32,
  },
  flagWrap: {
    width: 54,
    height: 42,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  flag: {
    width: '100%',
    height: '100%',
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F1F1F',
    paddingVertical: 12,
  },
  otpInput: {
    width: '100%',
    height: 64,
    backgroundColor: '#E9E9E9',
    borderRadius: 18,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 12,
    marginBottom: 28,
    color: '#1F1F1F',
  },
  primaryButton: {
    backgroundColor: '#7B4FFF',
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  backLink: {
    marginBottom: 10,
  },
  backLinkText: {
    color: '#371F80',
    fontSize: 14,
    fontWeight: '600',
  },
  resendLink: {
    marginTop: 12,
    alignItems: 'center',
  },
  resendText: {
    color: '#7B4FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  resendTextDisabled: {
    color: '#B0B0B0',
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
