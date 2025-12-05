import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
  Dimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { PaymentService, Payment, PaymentCalculation } from '../services/PaymentService'
import { Colors } from '../constants/Colors'
import BottomSheet, { BottomSheetRef } from './BottomSheet'

const { width } = Dimensions.get('window')

interface ChapaPaymentModalProps {
  visible: boolean
  onClose: () => void
  payment: Payment | null
  onPaymentSuccess: (task?: any) => void
  customerInfo?: {
    email: string
    firstName: string
    lastName: string
    phone: string
  }
}

function ChapaPaymentModal({
  visible,
  onClose,
  payment,
  onPaymentSuccess,
  customerInfo,
}: ChapaPaymentModalProps) {
  const bottomSheetRef = useRef<BottomSheetRef>(null)
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null)
  const [txRef, setTxRef] = useState<string | null>(null)
  const [breakdown, setBreakdown] = useState<PaymentCalculation | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<string>('pending')

  useEffect(() => {
    if (visible && payment && customerInfo) {
      initializePayment()
    }
  }, [visible, payment, customerInfo])

  const initializePayment = async () => {
    if (!payment || !customerInfo) return

    try {
      setLoading(true)
      const result = await PaymentService.initializeChapaPayment(
        payment.task_id!,
        payment.user_id,
        customerInfo,
      )

      if (result) {
        setCheckoutUrl(result.checkoutUrl)
        setTxRef(result.txRef)
        setBreakdown(result.breakdown)
      } else {
        Alert.alert('Error', 'Failed to initialize payment. Please try again.')
      }
    } catch (error) {
      console.error('Error initializing payment:', error)

      // Show more specific error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      if (errorMessage.includes('credentials not configured')) {
        Alert.alert(
          'Configuration Required',
          'Chapa payment gateway is not configured. Please contact support or check the setup guide.',
          [
            { text: 'OK', style: 'default' },
            {
              text: 'Setup Guide',
              onPress: () => {
                // You could open a help screen here
                console.log('Open setup guide')
              },
            },
          ],
        )
      } else {
        Alert.alert('Payment Error', `Failed to initialize payment: ${errorMessage}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const handlePayment = async () => {
    if (!checkoutUrl) {
      Alert.alert('Error', 'Payment URL not available')
      return
    }

    try {
      setProcessing(true)

      // Open Chapa checkout in browser
      const supported = await Linking.canOpenURL(checkoutUrl)
      if (supported) {
        await Linking.openURL(checkoutUrl)

        // Start polling for payment status
        startPaymentStatusPolling()
      } else {
        Alert.alert('Error', 'Cannot open payment page')
      }
    } catch (error) {
      console.error('Error opening payment URL:', error)
      Alert.alert('Error', 'Failed to open payment page')
    } finally {
      setProcessing(false)
    }
  }

  const startPaymentStatusPolling = () => {
    if (!txRef) return

    const pollInterval = setInterval(async () => {
      try {
        const status = await PaymentService.verifyChapaPayment(txRef!)
        if (status) {
          setPaymentStatus(status.status)

          if (status.status === 'completed') {
            clearInterval(pollInterval)
            await PaymentService.processChapaPayment(txRef!)
            Alert.alert('Payment Successful!', 'Your payment has been processed successfully.', [
              {
                text: 'OK',
                onPress: () => {
                  onPaymentSuccess(payment) // Pass payment info which contains task_id
                  onClose()
                },
              },
            ])
          } else if (status.status === 'failed' || status.status === 'cancelled') {
            clearInterval(pollInterval)
            Alert.alert(
              'Payment Failed',
              'Your payment could not be processed. Please try again.',
              [{ text: 'OK' }],
            )
          }
        }
      } catch (error) {
        console.error('Error checking payment status:', error)
      }
    }, 3000) // Check every 3 seconds

    // Stop polling after 10 minutes
    setTimeout(() => {
      clearInterval(pollInterval)
    }, 600000)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  if (!payment) return null

  return (
    <BottomSheet
      ref={bottomSheetRef}
      visible={visible}
      onClose={onClose}
      snapPoints={[0.3, 0.9, 1.0]}
      initialSnapPoint={1}
      useInternalScroll={false}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Complete Payment</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={22} color={Colors.neutral[600]} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={true}
        >
          {/* Payment Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Payment Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Task:</Text>
              <Text style={styles.summaryValue}>{payment.task_title}</Text>
            </View>

            {breakdown && (
              <>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Subtotal:</Text>
                  <Text style={styles.summaryValue}>
                    {formatCurrency(breakdown.breakdown.subtotal)}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>VAT (15%):</Text>
                  <Text style={styles.summaryValue}>{formatCurrency(breakdown.breakdown.vat)}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total Amount:</Text>
                  <Text style={styles.summaryAmount}>
                    {formatCurrency(breakdown.breakdown.total)}
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Payment Method Info */}
          <View style={styles.paymentMethodCard}>
            <View style={styles.paymentMethodHeader}>
              <Ionicons name="card" size={24} color={Colors.primary[500]} />
              <Text style={styles.paymentMethodTitle}>Chapa Payment Gateway</Text>
            </View>
            <Text style={styles.paymentMethodDescription}>
              Secure payment processing powered by Chapa. Supports all major payment methods in
              Ethiopia.
            </Text>
            <View style={styles.paymentFeatures}>
              <View style={styles.featureItem}>
                <Ionicons name="shield-checkmark" size={16} color={Colors.success[500]} />
                <Text style={styles.featureText}>Secure & Encrypted</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="flash" size={16} color={Colors.success[500]} />
                <Text style={styles.featureText}>Instant Processing</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="card" size={16} color={Colors.success[500]} />
                <Text style={styles.featureText}>Multiple Payment Options</Text>
              </View>
            </View>
          </View>

          {/* Payment Status */}
          {paymentStatus !== 'pending' && (
            <View style={styles.statusCard}>
              <View style={styles.statusHeader}>
                <Ionicons
                  name={paymentStatus === 'completed' ? 'checkmark-circle' : 'time'}
                  size={20}
                  color={paymentStatus === 'completed' ? Colors.success[500] : Colors.warning[500]}
                />
                <Text style={styles.statusTitle}>
                  {paymentStatus === 'completed' ? 'Payment Completed' : 'Processing Payment...'}
                </Text>
              </View>
              <Text style={styles.statusDescription}>
                {paymentStatus === 'completed'
                  ? 'Your payment has been successfully processed.'
                  : 'Please wait while we process your payment.'}
              </Text>
            </View>
          )}

          {/* Security Notice */}
          <View style={styles.securityNotice}>
            <Ionicons name="shield-checkmark" size={20} color={Colors.success[500]} />
            <Text style={styles.securityText}>
              Your payment is processed securely through Chapa&apos;s encrypted payment gateway. We
              never store your payment information.
            </Text>
          </View>

          {/* Footer Button */}
          <View style={styles.footer}>
            {loading ? (
              <View style={styles.loadingButton}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.loadingButtonText}>Initializing Payment...</Text>
              </View>
            ) : processing ? (
              <View style={styles.loadingButton}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.loadingButtonText}>Opening Payment Page...</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.payButton}
                onPress={handlePayment}
                disabled={!checkoutUrl || paymentStatus === 'completed'}
              >
                <Ionicons name="card" size={20} color="#fff" />
                <Text style={styles.payButtonText}>
                  {paymentStatus === 'completed'
                    ? 'Payment Completed'
                    : `Pay ${formatCurrency(breakdown?.breakdown.total || payment.amount)}`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
    backgroundColor: Colors.background.primary,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.neutral[900],
    letterSpacing: 0.3,
  },
  headerActions: {
    width: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 120,
  },
  summaryCard: {
    backgroundColor: Colors.background.secondary,
    borderRadius: 16,
    padding: 20,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.border.light,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral[900],
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.neutral[600],
    flex: 1,
  },
  summaryValue: {
    fontSize: 14,
    color: Colors.neutral[900],
    flex: 2,
    textAlign: 'right',
  },
  summaryAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary[500],
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border.light,
    marginVertical: 12,
  },
  paymentMethodCard: {
    backgroundColor: Colors.background.secondary,
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: Colors.border.light,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  paymentMethodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  paymentMethodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral[900],
    marginLeft: 12,
  },
  paymentMethodDescription: {
    fontSize: 14,
    color: Colors.neutral[600],
    lineHeight: 20,
    marginBottom: 16,
  },
  paymentFeatures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: width * 0.4,
  },
  featureText: {
    fontSize: 12,
    color: Colors.neutral[600],
    marginLeft: 6,
  },
  statusCard: {
    backgroundColor: Colors.warning[50],
    borderRadius: 16,
    padding: 18,
    marginTop: 16,
    borderLeftWidth: 4,
    borderLeftColor: Colors.warning[500],
    borderWidth: 1,
    borderColor: Colors.warning[200],
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.warning[700],
    marginLeft: 8,
  },
  statusDescription: {
    fontSize: 12,
    color: Colors.warning[600],
    lineHeight: 18,
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.success[50],
    borderRadius: 16,
    padding: 18,
    marginTop: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.success[200],
  },
  securityText: {
    flex: 1,
    fontSize: 12,
    color: Colors.success[700],
    marginLeft: 12,
    lineHeight: 18,
  },
  footer: {
    paddingTop: 24,
    paddingBottom: 12,
    paddingHorizontal: 0,
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary[500],
    borderRadius: 16,
    paddingVertical: 18,
    gap: 10,
    shadowColor: Colors.primary[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loadingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.neutral[400],
    borderRadius: 16,
    paddingVertical: 18,
    gap: 10,
  },
  payButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
})

export default React.memo(ChapaPaymentModal)
