import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { PaymentService, Payment, PaymentMethod } from '../services/PaymentService'
import Colors from '../constants/Colors'

interface PaymentModalProps {
  visible: boolean
  onClose: () => void
  payment: Payment | null
  onPaymentSuccess: () => void
}

export default function PaymentModal({ visible, onClose, payment, onPaymentSuccess }: PaymentModalProps) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    if (visible && payment) {
      loadPaymentMethods()
    }
  }, [visible, payment])

  const loadPaymentMethods = async () => {
    if (!payment) return
    
    try {
      setLoading(true)
      const methods = await PaymentService.getPaymentMethods(payment.user_id)
      setPaymentMethods(methods)
      
      // Select default method if available
      const defaultMethod = methods.find(m => m.is_default)
      if (defaultMethod) {
        setSelectedMethod(defaultMethod.id)
      } else if (methods.length > 0) {
        setSelectedMethod(methods[0].id)
      }
    } catch (error) {
      console.error('Error loading payment methods:', error)
      Alert.alert('Error', 'Failed to load payment methods')
    } finally {
      setLoading(false)
    }
  }

  const handlePayment = async () => {
    if (!payment || !selectedMethod) {
      Alert.alert('Error', 'Please select a payment method')
      return
    }

    try {
      setProcessing(true)
      const success = await PaymentService.processPayment(payment.id, selectedMethod)
      
      if (success) {
        Alert.alert(
          'Payment Processing',
          'Your payment is being processed. You will receive a confirmation once it\'s completed.',
          [
            {
              text: 'OK',
              onPress: () => {
                onPaymentSuccess()
                onClose()
              }
            }
          ]
        )
      } else {
        Alert.alert('Error', 'Failed to process payment. Please try again.')
      }
    } catch (error) {
      console.error('Error processing payment:', error)
      Alert.alert('Error', 'An unexpected error occurred while processing payment.')
    } finally {
      setProcessing(false)
    }
  }

  if (!payment) return null

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={Colors.neutral[600]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Complete Payment</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Payment Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Payment Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Task:</Text>
              <Text style={styles.summaryValue}>{payment.task_title}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Amount:</Text>
              <Text style={styles.summaryAmount}>{payment.amount} {payment.currency}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Description:</Text>
              <Text style={styles.summaryValue}>{payment.description}</Text>
            </View>
          </View>

          {/* Payment Methods */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Payment Method</Text>
            
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={Colors.primary[500]} />
                <Text style={styles.loadingText}>Loading payment methods...</Text>
              </View>
            ) : paymentMethods.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="card-outline" size={48} color={Colors.neutral[300]} />
                <Text style={styles.emptyTitle}>No Payment Methods</Text>
                <Text style={styles.emptySubtitle}>
                  You need to add a payment method to complete this payment.
                </Text>
                <TouchableOpacity style={styles.addMethodButton}>
                  <Ionicons name="add" size={20} color="#fff" />
                  <Text style={styles.addMethodText}>Add Payment Method</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.methodsList}>
                {paymentMethods.map((method) => (
                  <TouchableOpacity
                    key={method.id}
                    style={[
                      styles.methodCard,
                      selectedMethod === method.id && styles.methodCardSelected
                    ]}
                    onPress={() => setSelectedMethod(method.id)}
                  >
                    <View style={styles.methodInfo}>
                      <Ionicons 
                        name={method.type === 'card' ? 'card' : 'wallet'} 
                        size={24} 
                        color={selectedMethod === method.id ? Colors.primary[500] : Colors.neutral[600]} 
                      />
                      <View style={styles.methodDetails}>
                        <Text style={[
                          styles.methodName,
                          selectedMethod === method.id && styles.methodNameSelected
                        ]}>
                          {method.display_name}
                        </Text>
                        <Text style={styles.methodType}>
                          {method.type === 'card' ? 'Credit/Debit Card' : 
                           method.type === 'bank_account' ? 'Bank Account' :
                           method.type === 'mobile_money' ? 'Mobile Money' : 'Wallet'}
                        </Text>
                      </View>
                    </View>
                    {selectedMethod === method.id && (
                      <Ionicons name="checkmark-circle" size={24} color={Colors.primary[500]} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Security Notice */}
          <View style={styles.securityNotice}>
            <Ionicons name="shield-checkmark" size={20} color={Colors.success[500]} />
            <Text style={styles.securityText}>
              Your payment information is secure and encrypted. We use industry-standard security measures to protect your data.
            </Text>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.payButton,
              (!selectedMethod || processing) && styles.payButtonDisabled
            ]}
            onPress={handlePayment}
            disabled={!selectedMethod || processing}
          >
            {processing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="card" size={20} color="#fff" />
                <Text style={styles.payButtonText}>
                  Pay {payment.amount} {payment.currency}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral[900],
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  summaryCard: {
    backgroundColor: Colors.background.primary,
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
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
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral[900],
    marginBottom: 16,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginLeft: 12,
    fontSize: 14,
    color: Colors.neutral[600],
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral[600],
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.neutral[500],
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  addMethodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary[500],
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  addMethodText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  methodsList: {
    gap: 12,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background.primary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  methodCardSelected: {
    borderColor: Colors.primary[500],
    backgroundColor: Colors.primary[50],
  },
  methodInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  methodDetails: {
    marginLeft: 12,
    flex: 1,
  },
  methodName: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.neutral[900],
    marginBottom: 4,
  },
  methodNameSelected: {
    color: Colors.primary[700],
  },
  methodType: {
    fontSize: 12,
    color: Colors.neutral[500],
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.success[50],
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    marginBottom: 20,
  },
  securityText: {
    flex: 1,
    fontSize: 12,
    color: Colors.success[700],
    marginLeft: 12,
    lineHeight: 18,
  },
  footer: {
    padding: 20,
    backgroundColor: Colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary[500],
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  payButtonDisabled: {
    backgroundColor: Colors.neutral[300],
  },
  payButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
})
