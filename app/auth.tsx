import React, { useState, useEffect } from 'react'
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
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useAuth } from '../contexts/SimpleAuthContext'

export default function Auth() {
  const router = useRouter()
  const [isSignUp, setIsSignUp] = useState(false)
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [isCodeSent, setIsCodeSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const { sendVerificationCode, verifyPhoneCode, isAuthenticated, loading: isLoading } = useAuth()

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
    if (isSignUp) {
      if (!fullName.trim()) {
        Alert.alert('Error', 'Please enter your full name')
        return
      }

      if (!username.trim()) {
        Alert.alert('Error', 'Please enter a username')
        return
      }
    }

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
      const result = await sendVerificationCode(formattedPhone, isSignUp, fullName, username)

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
        setFullName('')
        setUsername('')
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
        const result = await sendVerificationCode(formattedPhone, isSignUp, fullName, username)

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
      <StatusBar barStyle="dark-content" backgroundColor="#fff" translucent={false} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={true}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logo}>MESCOTT</Text>
            <Text style={styles.subtitle}>
              {isCodeSent
                ? 'Verify your phone number'
                : isSignUp
                  ? 'Create your account'
                  : 'Good to see you again'}
            </Text>
          </View>

          {/* Form Container */}
          <View style={styles.formContainer}>
            {/* Auth Mode Toggle */}
            {!isCodeSent && (
              <View style={styles.authToggle}>
                <TouchableOpacity
                  style={[styles.toggleButton, !isSignUp && styles.toggleButtonActive]}
                  onPress={() => setIsSignUp(false)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.toggleText, !isSignUp && styles.toggleTextActive]}>
                    Sign In
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.toggleButton, isSignUp && styles.toggleButtonActive]}
                  onPress={() => setIsSignUp(true)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.toggleText, isSignUp && styles.toggleTextActive]}>
                    Sign Up
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Form Fields */}
            {!isCodeSent ? (
              <>
                {isSignUp && (
                  <>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        style={styles.input}
                        placeholder="Full Name"
                        placeholderTextColor="#999"
                        value={fullName}
                        onChangeText={setFullName}
                        autoCapitalize="words"
                        returnKeyType="next"
                      />
                    </View>

                    <View style={styles.inputWrapper}>
                      <TextInput
                        style={styles.input}
                        placeholder="Username"
                        placeholderTextColor="#999"
                        value={username}
                        onChangeText={setUsername}
                        autoCapitalize="none"
                        returnKeyType="next"
                      />
                    </View>
                  </>
                )}

                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    placeholder="Phone Number (0912345678)"
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
                  activeOpacity={0.8}
                >
                  <Text style={styles.buttonText}>{loading ? 'Sending Code...' : 'Continue'}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* Back Button */}
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => {
                    setIsCodeSent(false)
                    setVerificationCode('')
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.backButtonText}>← Change Number</Text>
                </TouchableOpacity>

                <Text style={styles.codeHint}>Enter the 6-digit code sent to {phoneNumber}</Text>

                {/* Verification Code Input */}
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={[styles.input, styles.codeInput]}
                    placeholder="000000"
                    placeholderTextColor="#ccc"
                    value={verificationCode}
                    onChangeText={setVerificationCode}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={handleVerifyCode}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.primaryButton, loading && styles.buttonDisabled]}
                  onPress={handleVerifyCode}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.buttonText}>{loading ? 'Verifying...' : 'Verify'}</Text>
                </TouchableOpacity>

                {/* Resend Code */}
                <TouchableOpacity
                  style={[styles.resendButton, countdown > 0 && styles.resendButtonDisabled]}
                  onPress={handleResendCode}
                  disabled={countdown > 0}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.resendText, countdown > 0 && styles.resendTextDisabled]}>
                    {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend Code'}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* Footer */}
            <Text style={styles.footer}>
              By continuing, you agree to our Terms of Service and Privacy Policy
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 32,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logo: {
    fontSize: 36,
    fontWeight: '800',
    color: '#6F4685',
    letterSpacing: 2,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
  },
  formContainer: {
    flex: 1,
  },
  authToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    marginBottom: 40,
    overflow: 'hidden',
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  toggleButtonActive: {
    backgroundColor: '#6F4685',
  },
  toggleText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#999',
  },
  toggleTextActive: {
    color: '#fff',
  },
  inputWrapper: {
    marginBottom: 16,
  },
  input: {
    fontSize: 16,
    color: '#6F4685',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
  },
  codeInput: {
    fontSize: 24,
    letterSpacing: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  codeHint: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#6F4685',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    paddingVertical: 12,
    marginBottom: 24,
  },
  backButtonText: {
    color: '#6F4685',
    fontSize: 15,
    fontWeight: '500',
  },
  resendButton: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 16,
  },
  resendButtonDisabled: {
    opacity: 0.4,
  },
  resendText: {
    color: '#6F4685',
    fontSize: 15,
    fontWeight: '500',
  },
  resendTextDisabled: {
    color: '#999',
  },
  footer: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 48,
    lineHeight: 18,
  },
})
