import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Animated,
  Easing,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
} from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'
import { Image } from 'expo-image'
import * as Haptics from 'expo-haptics'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useAuth } from '../contexts/SimpleAuthContext'
import { useToast } from '../contexts/ToastContext'
import CountryPicker, { Country } from '../components/CountryPicker'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '../constants/Colors'

export default function Auth() {
  const router = useRouter()
  const [phoneNumber, setPhoneNumber] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [isCodeSent, setIsCodeSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [selectedCountry, setSelectedCountry] = useState<Country>({
    code: 'ET',
    name: 'Ethiopia',
    dialCode: '+251',
    flag: 'https://flagcdn.com/w80/et.png',
  })
  const [countryPickerVisible, setCountryPickerVisible] = useState(false)
  const { sendVerificationCode, verifyPhoneCode, isAuthenticated, loading: isLoading } = useAuth()
  const { showSuccess, showError } = useToast()
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(16)).current
  const scrollViewRef = useRef<any>(null)
  const phoneInputRef = useRef<TextInput>(null)
  const otpInputRef = useRef<TextInput>(null)

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
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '')
    
    // Remove the country code if it's already included
    const countryCode = selectedCountry.dialCode.replace('+', '')
    if (cleaned.startsWith(countryCode)) {
      cleaned = cleaned.substring(countryCode.length)
    }
    
    // Remove leading zero if present (common in some countries)
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1)
    }
    
    // Return formatted phone number with country code
    return selectedCountry.dialCode + cleaned
  }

  const handleSendCode = async () => {
    if (!phoneNumber.trim()) {
      showError('Please enter your phone number')
      return
    }

    const formattedPhone = cleanPhoneNumber(phoneNumber)

    // Basic validation - at least 7 digits after country code
    const digitsOnly = formattedPhone.replace(/\D/g, '')
    if (digitsOnly.length < 7) {
      showError('Please enter a valid phone number')
      return
    }

    setLoading(true)

    try {
      const result = await sendVerificationCode(formattedPhone)

      if (result.success) {
        showSuccess('Verification code sent successfully!')
        setIsCodeSent(true)
        startCountdown()
      } else {
        showError(result.message)
      }
    } catch (error: any) {
      console.error('Exception in handleSendCode:', error)
      showError(error.message || 'Failed to send verification code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async () => {
    if (verificationCode.length !== 6) {
      showError('Please enter the 6-digit verification code')
      return
    }

    setLoading(true)
    try {
      const formattedPhone = cleanPhoneNumber(phoneNumber)
      const result = await verifyPhoneCode(formattedPhone, verificationCode)

      if (result.success) {
        showSuccess(result.message || 'Verification successful!')

        // Reset form state (will be handled by auth state change)
        setVerificationCode('')
        setIsCodeSent(false)
        setPhoneNumber('')
        
        // Note: Navigation will be handled by useEffect above with smooth transition
      } else {
        showError(result.message)
        setLoading(false)
      }
    } catch (error: any) {
      showError(error.message || 'Verification failed. Please try again.')
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
          showSuccess('New verification code sent')
          startCountdown()
        } else {
          showError(result.message)
        }
      } catch (error: any) {
        showError(error.message || 'Failed to resend verification code')
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
                    <Text style={styles.subtitle}>We will send you an OTP verification code</Text>

                    <View style={styles.phoneInputRow}>
                      <TouchableOpacity
                        style={styles.flagWrap}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                          setCountryPickerVisible(true)
                        }}
                        activeOpacity={0.6}
                      >
                        <View style={styles.flagImageContainer}>
                          <Image
                            source={{ uri: selectedCountry.flag }}
                            style={styles.flag}
                            contentFit="cover"
                            transition={200}
                            cachePolicy="memory-disk"
                          />
                        </View>
                        <Ionicons
                          name="chevron-down"
                          size={16}
                          color="#666"
                          style={styles.flagChevron}
                        />
                      </TouchableOpacity>
                      <View style={styles.dialCodeContainer}>
                        <Text style={styles.dialCode}>{selectedCountry.dialCode}</Text>
                      </View>
                      <TextInput
                        ref={phoneInputRef}
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
                      style={styles.changeNumberButton}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="arrow-back" size={18} color={Colors.primary[600]} style={styles.changeNumberIcon} />
                      <Text style={styles.changeNumberText}>Change Number</Text>
                    </TouchableOpacity>

                    <Text style={styles.title}>OTP Verification</Text>
                    <Text style={styles.subtitle}>Enter the OTP verification code</Text>

                    <View>
                      <TextInput
                        ref={otpInputRef}
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
                    </View>

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
            </KeyboardAwareScrollView>
        </Animated.View>
      </TouchableWithoutFeedback>

      <CountryPicker
        visible={countryPickerVisible}
        onClose={() => setCountryPickerVisible(false)}
        onSelect={(country) => {
          setSelectedCountry(country)
          setCountryPickerVisible(false)
        }}
        selectedCountry={selectedCountry}
      />
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
    height: 40,
    borderRadius: 8,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 6,
    paddingVertical: 4,
    minWidth: 50,
  },
  flagImageContainer: {
    width: 36,
    height: 26,
    borderRadius: 5,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  flag: {
    width: 36,
    height: 26,
  },
  flagChevron: {
    marginLeft: 4,
    marginTop: 1,
  },
  dialCodeContainer: {
    marginRight: 8,
    justifyContent: 'center',
  },
  dialCode: {
    fontSize: 16,
    color: '#1F1F1F',
    fontWeight: '600',
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
  changeNumberButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary[50],
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.primary[200],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  changeNumberIcon: {
    marginRight: 8,
  },
  changeNumberText: {
    color: Colors.primary[600],
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
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
