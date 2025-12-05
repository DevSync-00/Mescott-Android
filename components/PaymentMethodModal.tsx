import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { PaymentMethodService, PaymentMethod } from '../services/PaymentMethodService'
import {
  ETHIOPIAN_BANKS,
  MOBILE_MONEY_PROVIDERS,
  validateAccountNumber,
  validatePhoneNumber,
} from '../constants/EthiopianBanks'
import { Colors } from '../constants/Colors'

interface PaymentMethodModalProps {
  visible: boolean
  onClose: () => void
  onPaymentMethodAdded: (method: PaymentMethod) => void
  userId: string
}

function PaymentMethodModal({
  visible,
  onClose,
  onPaymentMethodAdded,
  userId,
}: PaymentMethodModalProps) {
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'type' | 'details'>('type')
  const [selectedType, setSelectedType] = useState<'bank_account' | 'mobile_money' | null>(null)
  const [selectedBank, setSelectedBank] = useState<string>('')
  const [selectedProvider, setSelectedProvider] = useState<string>('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountHolder, setAccountHolder] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [showBankList, setShowBankList] = useState(false)
  const [showProviderList, setShowProviderList] = useState(false)
  const [isDefault, setIsDefault] = useState(false)

  const paymentTypes = [
    {
      id: 'bank_account',
      title: 'Bank Account',
      subtitle: 'Direct bank transfer',
      icon: 'card-outline',
      color: Colors.primary[500],
      description: 'Fast and secure bank transfers',
    },
    {
      id: 'mobile_money',
      title: 'Mobile Money',
      subtitle: 'Telebirr, M-Pesa, etc.',
      icon: 'phone-portrait-outline',
      color: Colors.success[500],
      description: 'Quick mobile wallet payments',
    },
  ]

  useEffect(() => {
    if (!visible) {
      resetForm()
    }
  }, [visible])

  const resetForm = () => {
    setStep('type')
    setSelectedType(null)
    setSelectedBank('')
    setSelectedProvider('')
    setAccountNumber('')
    setAccountHolder('')
    setPhoneNumber('')
    setShowBankList(false)
    setShowProviderList(false)
    setIsDefault(false)
  }

  const handleTypeSelect = (type: 'bank_account' | 'mobile_money') => {
    setSelectedType(type)
    setStep('details')
  }

  const handleBankSelect = (bankId: string) => {
    setSelectedBank(bankId)
    setShowBankList(false)
  }

  const handleProviderSelect = (providerId: string) => {
    setSelectedProvider(providerId)
    setShowProviderList(false)
  }

  const canSave = () => {
    if (!selectedType) return false

    switch (selectedType) {
      case 'bank_account':
        return selectedBank && accountNumber && accountHolder
      case 'mobile_money':
        return selectedProvider && phoneNumber
      default:
        return false
    }
  }

  const handleSave = async () => {
    if (!selectedType) return

    // Validation
    if (selectedType === 'bank_account') {
      if (!selectedBank) {
        Alert.alert('Error', 'Please select a bank.')
        return
      }
      if (!accountNumber) {
        Alert.alert('Error', 'Please enter account number.')
        return
      }
      if (!accountHolder) {
        Alert.alert('Error', 'Please enter account holder name.')
        return
      }
      if (!validateAccountNumber(selectedBank, accountNumber)) {
        Alert.alert('Error', 'Please enter a valid account number.')
        return
      }
    }

    if (selectedType === 'mobile_money') {
      if (!selectedProvider) {
        Alert.alert('Error', 'Please select a provider.')
        return
      }
      if (!phoneNumber) {
        Alert.alert('Error', 'Please enter phone number.')
        return
      }
      if (!validatePhoneNumber(selectedProvider, phoneNumber)) {
        Alert.alert('Error', 'Please enter a valid phone number.')
        return
      }
    }

    try {
      setLoading(true)

      const withdrawalDetails = getWithdrawalDetails()

      const method = await PaymentMethodService.addPaymentMethod(userId, selectedType, {
        last4: getLast4Digits(),
        brand: getBrandName(),
        withdrawal_details: withdrawalDetails,
      })

      // Set as default if requested
      if (isDefault) {
        await PaymentMethodService.setDefaultPaymentMethod(userId, method.id)
      }

      onPaymentMethodAdded(method)
      onClose()
      resetForm()
    } catch (error) {
      console.error('Error adding payment method:', error)
      Alert.alert('Error', 'Failed to add payment method. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const getWithdrawalDetails = () => {
    switch (selectedType) {
      case 'bank_account':
        const bank = ETHIOPIAN_BANKS.find((b) => b.id === selectedBank)
        return {
          account_number: accountNumber,
          bank_name: bank?.name || '',
          bank_id: selectedBank,
          account_holder_name: accountHolder,
        }
      case 'mobile_money':
        const provider = MOBILE_MONEY_PROVIDERS.find((p) => p.id === selectedProvider)
        return {
          phone_number: phoneNumber,
          provider: provider?.name || '',
          provider_id: selectedProvider,
        }
      default:
        return {}
    }
  }

  const getLast4Digits = () => {
    switch (selectedType) {
      case 'bank_account':
        return accountNumber.slice(-4)
      case 'mobile_money':
        return phoneNumber.slice(-4)
      default:
        return ''
    }
  }

  const getBrandName = () => {
    switch (selectedType) {
      case 'bank_account':
        return ETHIOPIAN_BANKS.find((b) => b.id === selectedBank)?.name || 'Bank'
      case 'mobile_money':
        return MOBILE_MONEY_PROVIDERS.find((p) => p.id === selectedProvider)?.name || 'Mobile Money'
      default:
        return 'Payment Method'
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={Colors.neutral[900]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Payment Method</Text>
          <View style={styles.headerRight} />
        </View>

        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: step === 'type' ? '50%' : '100%' }]} />
          </View>
          <Text style={styles.progressText}>{step === 'type' ? 'Step 1 of 2' : 'Step 2 of 2'}</Text>
        </View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {step === 'type' ? (
            <View style={styles.typeSelection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Choose Payment Method</Text>
                <Text style={styles.sectionSubtitle}>
                  Select how you&apos;d like to receive your earnings
                </Text>
              </View>

              <View style={styles.typesGrid}>
                {paymentTypes.map((type) => (
                  <TouchableOpacity
                    key={type.id}
                    style={styles.typeCard}
                    onPress={() => handleTypeSelect(type.id as any)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.typeIcon, { backgroundColor: type.color + '15' }]}>
                      <Ionicons name={type.icon as any} size={28} color={type.color} />
                    </View>
                    <Text style={styles.typeTitle}>{type.title}</Text>
                    <Text style={styles.typeSubtitle}>{type.subtitle}</Text>
                    <Text style={styles.typeDescription}>{type.description}</Text>
                    <View style={styles.typeArrow}>
                      <Ionicons name="chevron-forward" size={16} color={Colors.neutral[400]} />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.detailsForm}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {selectedType === 'bank_account' && 'Bank Account Information'}
                  {selectedType === 'mobile_money' && 'Mobile Money Details'}
                </Text>
                <Text style={styles.sectionSubtitle}>
                  {selectedType === 'bank_account' &&
                    'Enter your bank account details for withdrawals'}
                  {selectedType === 'mobile_money' && 'Add your mobile money account information'}
                </Text>

                {/* No Third-Party Payments Notice */}
                <View style={styles.noticeContainer}>
                  <Ionicons name="information-circle" size={16} color={Colors.primary[500]} />
                  <Text style={styles.noticeText}>
                    No third-party payments. Only add your own payment methods.
                  </Text>
                </View>
              </View>

              {selectedType === 'bank_account' && (
                <View style={styles.formSection}>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Bank *</Text>
                    <TouchableOpacity
                      style={[styles.selectField, showBankList && styles.selectFieldActive]}
                      onPress={() => {
                        setShowBankList(!showBankList)
                        setShowProviderList(false)
                      }}
                    >
                      <Text style={[styles.selectText, !selectedBank && styles.placeholder]}>
                        {selectedBank
                          ? ETHIOPIAN_BANKS.find((b) => b.id === selectedBank)?.name
                          : 'Select your bank'}
                      </Text>
                      <Ionicons
                        name={showBankList ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color={Colors.neutral[500]}
                      />
                    </TouchableOpacity>

                    {showBankList && (
                      <View style={styles.dropdownList}>
                        <ScrollView
                          style={styles.dropdownScroll}
                          showsVerticalScrollIndicator={false}
                        >
                          {ETHIOPIAN_BANKS.map((bank) => (
                            <TouchableOpacity
                              key={bank.id}
                              style={styles.dropdownItem}
                              onPress={() => handleBankSelect(bank.id)}
                            >
                              <Text style={styles.dropdownItemText}>{bank.name}</Text>
                              {selectedBank === bank.id && (
                                <Ionicons name="checkmark" size={16} color={Colors.primary[500]} />
                              )}
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Account Number *</Text>
                    <TextInput
                      style={styles.inputField}
                      value={accountNumber}
                      onChangeText={setAccountNumber}
                      placeholder="Enter your account number"
                      keyboardType="numeric"
                      maxLength={20}
                    />
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Account Holder Name *</Text>
                    <TextInput
                      style={styles.inputField}
                      value={accountHolder}
                      onChangeText={setAccountHolder}
                      placeholder="Enter the account holder's full name"
                      autoCapitalize="words"
                    />
                  </View>
                </View>
              )}

              {selectedType === 'mobile_money' && (
                <View style={styles.formSection}>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Provider *</Text>
                    <TouchableOpacity
                      style={[styles.selectField, showProviderList && styles.selectFieldActive]}
                      onPress={() => {
                        setShowProviderList(!showProviderList)
                        setShowBankList(false)
                      }}
                    >
                      <Text style={[styles.selectText, !selectedProvider && styles.placeholder]}>
                        {selectedProvider
                          ? MOBILE_MONEY_PROVIDERS.find((p) => p.id === selectedProvider)?.name
                          : 'Select provider'}
                      </Text>
                      <Ionicons
                        name={showProviderList ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color={Colors.neutral[500]}
                      />
                    </TouchableOpacity>

                    {showProviderList && (
                      <View style={styles.dropdownList}>
                        <ScrollView
                          style={styles.dropdownScroll}
                          showsVerticalScrollIndicator={false}
                        >
                          {MOBILE_MONEY_PROVIDERS.map((provider) => (
                            <TouchableOpacity
                              key={provider.id}
                              style={styles.dropdownItem}
                              onPress={() => handleProviderSelect(provider.id)}
                            >
                              <Text style={styles.dropdownItemText}>{provider.name}</Text>
                              {selectedProvider === provider.id && (
                                <Ionicons name="checkmark" size={16} color={Colors.primary[500]} />
                              )}
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Phone Number *</Text>
                    <TextInput
                      style={styles.inputField}
                      value={phoneNumber}
                      onChangeText={setPhoneNumber}
                      placeholder="Enter your phone number"
                      keyboardType="phone-pad"
                      maxLength={15}
                    />
                  </View>
                </View>
              )}

              {/* Default Method Toggle */}
              <View style={styles.defaultSection}>
                <View style={styles.defaultRow}>
                  <View style={styles.defaultInfo}>
                    <Text style={styles.defaultTitle}>Set as Default</Text>
                    <Text style={styles.defaultSubtitle}>
                      Use this method for future withdrawals
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.toggle, isDefault && styles.toggleActive]}
                    onPress={() => setIsDefault(!isDefault)}
                  >
                    <View style={[styles.toggleThumb, isDefault && styles.toggleThumbActive]} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        {step === 'details' && (
          <View style={styles.footer}>
            <TouchableOpacity style={styles.backButton} onPress={() => setStep('type')}>
              <Ionicons name="arrow-back" size={20} color={Colors.neutral[600]} />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, !canSave() && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={!canSave() || loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={20} color="#fff" />
                  <Text style={styles.saveButtonText}>Add Payment Method</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral[900],
  },
  headerRight: {
    width: 40,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.background.primary,
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.neutral[200],
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary[500],
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: Colors.neutral[500],
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  typeSelection: {
    padding: 20,
  },
  sectionHeader: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.neutral[900],
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 16,
    color: Colors.neutral[600],
    lineHeight: 24,
  },
  noticeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary[50],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  noticeText: {
    fontSize: 12,
    color: Colors.primary[700],
    fontWeight: '500',
    flex: 1,
  },
  typesGrid: {
    gap: 16,
  },
  typeCard: {
    backgroundColor: Colors.background.primary,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border.light,
    position: 'relative',
  },
  typeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  typeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral[900],
    marginBottom: 4,
  },
  typeSubtitle: {
    fontSize: 14,
    color: Colors.neutral[600],
    marginBottom: 8,
  },
  typeDescription: {
    fontSize: 12,
    color: Colors.neutral[500],
    lineHeight: 18,
  },
  typeArrow: {
    position: 'absolute',
    top: 20,
    right: 20,
  },
  detailsForm: {
    padding: 20,
  },
  formSection: {
    backgroundColor: Colors.background.primary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.neutral[700],
    marginBottom: 8,
  },
  selectField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.neutral[50],
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  selectFieldActive: {
    borderColor: Colors.primary[500],
    backgroundColor: Colors.primary[50],
  },
  selectText: {
    fontSize: 16,
    color: Colors.neutral[900],
    flex: 1,
  },
  placeholder: {
    color: Colors.neutral[500],
  },
  dropdownList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: Colors.background.primary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border.light,
    marginTop: 4,
    maxHeight: 200,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  dropdownItemText: {
    fontSize: 16,
    color: Colors.neutral[700],
    flex: 1,
  },
  inputField: {
    backgroundColor: Colors.neutral[50],
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: Colors.neutral[900],
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  defaultSection: {
    backgroundColor: Colors.background.primary,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  defaultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  defaultInfo: {
    flex: 1,
  },
  defaultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral[900],
    marginBottom: 4,
  },
  defaultSubtitle: {
    fontSize: 14,
    color: Colors.neutral[600],
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.neutral[300],
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: Colors.primary[500],
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
    gap: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: Colors.neutral[100],
    flex: 1,
    gap: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral[600],
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: Colors.primary[500],
    flex: 2,
    gap: 8,
  },
  saveButtonDisabled: {
    backgroundColor: Colors.neutral[300],
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
})

export default React.memo(PaymentMethodModal)
