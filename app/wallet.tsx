import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  RefreshControl,
  StatusBar,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useAuth } from '../contexts/SimpleAuthContext'
import { PaymentMethodService, PaymentMethod } from '../services/PaymentMethodService'
import { WalletService, Wallet as WalletType, WalletStats } from '../services/WalletService'
import WithdrawalModal from '../components/WithdrawalModal'
import { Colors } from '../constants/Colors'
import { SkeletonList } from '../components/SkeletonLoader'

export default function WalletScreen() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [wallet, setWallet] = useState<WalletType | null>(null)
  const [walletStats, setWalletStats] = useState<WalletStats | null>(null)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/auth')
    }
  }, [isAuthenticated, isLoading, router])

  useEffect(() => {
    if (isAuthenticated && user) {
      loadWalletData()
    }
  }, [isAuthenticated, user, loadWalletData])

  const loadWalletData = useCallback(async () => {
    if (!user) return

    try {
      setLoading(true)

      // Load wallet details with stats and transactions
      const walletDetails = await WalletService.getWalletDetails(user.user_id)
      setWallet(walletDetails.wallet)
      setWalletStats(walletDetails.stats)

      // Load payment methods
      const methods = await PaymentMethodService.getPaymentMethods(user.user_id)
      setPaymentMethods(methods)
    } catch (error) {
      console.error('Error loading wallet data:', error)
      Alert.alert('Error', 'Failed to load wallet data. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [user])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadWalletData()
    setRefreshing(false)
  }

  const handleWithdrawalSuccess = () => {
    loadWalletData() // Refresh data
  }

  const handleSetDefaultPaymentMethod = async (methodId: string) => {
    if (!user) return

    try {
      await PaymentMethodService.setDefaultPaymentMethod(user.user_id, methodId)
      // Update local state
      setPaymentMethods((prev) =>
        prev.map((method) => ({
          ...method,
          is_default: method.id === methodId,
        })),
      )
      Alert.alert('Success', 'Default payment method updated')
    } catch (error) {
      console.error('Error setting default payment method:', error)
      Alert.alert('Error', 'Failed to set default payment method')
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
    }).format(amount)
  }

  // Check if user is in tasker mode
  if (user?.current_mode !== 'tasker' && user?.role !== 'tasker' && user?.role !== 'both') {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
        <View style={[styles.header, { paddingTop: 8 + insets.top }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.push('/profile')}>
            <Ionicons name="arrow-back" size={24} color={Colors.neutral[700]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Wallet</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="wallet-outline" size={64} color={Colors.neutral[400]} />
          <Text style={styles.errorTitle}>Wallet Not Available</Text>
          <Text style={styles.errorSubtitle}>
            Wallet is only available for taskers. Switch to tasker mode to access your wallet.
          </Text>
          <TouchableOpacity style={styles.switchModeButton} onPress={() => router.push('/profile')}>
            <Text style={styles.switchModeButtonText}>Go to Profile</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
        <View style={[styles.header, { paddingTop: 8 + insets.top }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.push('/profile')}>
            <Ionicons name="arrow-back" size={24} color={Colors.neutral[700]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Wallet</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <SkeletonList count={3} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
      <View style={[styles.header, { paddingTop: 8 + insets.top }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.push('/profile')}>
          <Ionicons name="arrow-back" size={24} color={Colors.neutral[700]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Wallet</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[Colors.primary[500]]}
            tintColor={Colors.primary[500]}
          />
        }
      >
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Ionicons name="wallet" size={24} color={Colors.primary[500]} />
            <Text style={styles.balanceTitle}>Wallet Balance</Text>
          </View>
          <Text style={styles.balanceAmount}>{formatCurrency(wallet?.balance || 0)}</Text>
          <Text style={styles.balanceSubtitle}>Available for withdrawal</Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="trending-up" size={20} color={Colors.success[500]} />
            <Text style={styles.statValue}>{formatCurrency(walletStats?.totalEarnings || 0)}</Text>
            <Text style={styles.statLabel}>Total Earnings</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.primary[500]} />
            <Text style={styles.statValue}>{walletStats?.completedTasks || 0}</Text>
            <Text style={styles.statLabel}>Completed Tasks</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="arrow-up" size={20} color={Colors.warning[500]} />
            <Text style={styles.statValue}>
              {formatCurrency(walletStats?.totalWithdrawals || 0)}
            </Text>
            <Text style={styles.statLabel}>Total Withdrawals</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="calendar" size={20} color={Colors.primary[500]} />
            <Text style={styles.statValue}>
              {formatCurrency(walletStats?.thisMonthEarnings || 0)}
            </Text>
            <Text style={styles.statLabel}>This Month</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.withdrawButton]}
            onPress={() => setShowWithdrawalModal(true)}
          >
            <Ionicons name="arrow-up" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Withdraw Funds</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.historyButton]}
            onPress={() =>
              Alert.alert('Withdrawal History', 'Withdrawal history feature coming soon!')
            }
          >
            <Ionicons name="time" size={20} color={Colors.primary[500]} />
            <Text style={[styles.actionButtonText, styles.historyButtonText]}>History</Text>
          </TouchableOpacity>
        </View>

        {/* Payment Methods Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Payment Methods</Text>
          </View>

          {paymentMethods.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="card-outline" size={48} color={Colors.neutral[300]} />
              <Text style={styles.emptyTitle}>No Payment Methods</Text>
              <Text style={styles.emptySubtitle}>Payment methods will appear here once added</Text>
            </View>
          ) : (
            <View style={styles.paymentMethodsList}>
              {paymentMethods.map((method) => (
                <View
                  key={method.id}
                  style={[
                    styles.paymentMethodItem,
                    method.is_default && styles.paymentMethodItemDefault,
                  ]}
                >
                  <View style={styles.paymentMethodIcon}>
                    <Ionicons
                      name={
                        method.type === 'bank_account'
                          ? 'card-outline'
                          : method.type === 'mobile_money'
                            ? 'phone-portrait-outline'
                            : 'location-outline'
                      }
                      size={20}
                      color={method.is_default ? Colors.primary[600] : Colors.primary[500]}
                    />
                  </View>
                  <View style={styles.paymentMethodInfo}>
                    <Text
                      style={[
                        styles.paymentMethodName,
                        method.is_default && styles.paymentMethodNameDefault,
                      ]}
                    >
                      {method.display_name}
                    </Text>
                    <Text style={styles.paymentMethodType}>
                      {method.type === 'bank_account'
                        ? 'Bank Account'
                        : method.type === 'mobile_money'
                          ? 'Mobile Money'
                          : 'Cash Pickup'}
                    </Text>
                  </View>
                  {method.is_default ? (
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultText}>Default</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.setDefaultButton}
                      onPress={() => handleSetDefaultPaymentMethod(method.id)}
                    >
                      <Text style={styles.setDefaultText}>Set as Default</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Recent Transactions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <TouchableOpacity>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color={Colors.neutral[300]} />
            <Text style={styles.emptyTitle}>No Transactions Yet</Text>
            <Text style={styles.emptySubtitle}>
              Your transaction history will appear here once you start earning.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Withdrawal Modal */}
      <WithdrawalModal
        visible={showWithdrawalModal}
        onClose={() => setShowWithdrawalModal(false)}
        onWithdrawalSuccess={handleWithdrawalSuccess}
        currentBalance={wallet?.balance || 0}
        userId={user?.user_id || ''}
      />
    </SafeAreaView>
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
    backgroundColor: Colors.background.primary,
    paddingHorizontal: 20,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: Colors.neutral[100],
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: Colors.neutral[900],
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.neutral[600],
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.neutral[700],
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 16,
    color: Colors.neutral[500],
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  switchModeButton: {
    backgroundColor: Colors.primary[500],
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  switchModeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  balanceCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  balanceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral[700],
    marginLeft: 8,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.primary[600],
    marginBottom: 4,
  },
  balanceSubtitle: {
    fontSize: 14,
    color: Colors.neutral[500],
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  statCard: {
    backgroundColor: '#fff',
    width: '48%',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    marginRight: '2%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.neutral[700],
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.neutral[500],
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  withdrawButton: {
    backgroundColor: Colors.primary[500],
  },
  historyButton: {
    backgroundColor: Colors.primary[50],
    borderWidth: 1,
    borderColor: Colors.primary[200],
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    color: '#fff',
  },
  historyButtonText: {
    color: Colors.primary[600],
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral[700],
  },
  viewAllText: {
    fontSize: 14,
    color: Colors.primary[500],
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral[600],
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.neutral[500],
    textAlign: 'center',
    lineHeight: 20,
  },
  paymentMethodsList: {
    gap: 12,
  },
  paymentMethodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: Colors.background.primary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border.light,
    marginBottom: 8,
  },
  paymentMethodItemDefault: {
    borderColor: Colors.primary[300],
    backgroundColor: Colors.primary[50],
  },
  paymentMethodIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  paymentMethodInfo: {
    flex: 1,
  },
  paymentMethodName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.neutral[700],
    marginBottom: 2,
  },
  paymentMethodNameDefault: {
    fontWeight: '600',
    color: Colors.primary[700],
  },
  paymentMethodType: {
    fontSize: 12,
    color: Colors.neutral[500],
  },
  defaultBadge: {
    backgroundColor: Colors.success[100],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  defaultText: {
    fontSize: 10,
    color: Colors.success[600],
    fontWeight: '500',
  },
  setDefaultButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: Colors.primary[100],
  },
  setDefaultText: {
    fontSize: 12,
    color: Colors.primary[600],
    fontWeight: '500',
  },
})
