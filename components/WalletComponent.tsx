import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { PaymentService } from '../services/PaymentService'
import { WalletService, WalletStats, WalletTransaction } from '../services/WalletService'
import Colors from '../constants/Colors'

interface WalletComponentProps {
  wallet: any
  transactions: WalletTransaction[]
  onWithdraw?: () => void
  onRefresh?: () => void
}

export default function WalletComponent({ wallet, transactions, onWithdraw, onRefresh }: WalletComponentProps) {
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    if (onRefresh) {
      setRefreshing(true)
      await onRefresh()
      setRefreshing(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-ET', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'deposit':
        return 'arrow-down-circle'
      case 'withdrawal':
        return 'arrow-up-circle'
      case 'refund':
        return 'refresh-circle'
      default:
        return 'card'
    }
  }

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'deposit':
        return Colors.success[500]
      case 'withdrawal':
        return Colors.warning[500]
      case 'refund':
        return Colors.info[500]
      default:
        return Colors.neutral[500]
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary[500]} />
        <Text style={styles.loadingText}>Loading wallet details...</Text>
      </View>
    )
  }

  if (!wallet) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="wallet-outline" size={48} color={Colors.neutral[300]} />
        <Text style={styles.errorTitle}>Unable to load wallet</Text>
        <Text style={styles.errorSubtitle}>Please try again later</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // Calculate stats from transactions
  const stats = {
    totalEarnings: transactions
      .filter(t => t.type === 'deposit')
      .reduce((sum, t) => sum + (t.amount || 0), 0),
    completedTasks: transactions
      .filter(t => t.type === 'deposit')
      .length,
    totalWithdrawals: transactions
      .filter(t => t.type === 'withdrawal')
      .reduce((sum, t) => sum + (t.amount || 0), 0),
    thisMonthEarnings: transactions
      .filter(t => t.type === 'deposit' && 
        new Date(t.created_at || '').getMonth() === new Date().getMonth())
      .reduce((sum, t) => sum + (t.amount || 0), 0),
    pendingWithdrawals: transactions
      .filter(t => t.type === 'withdrawal' && t.status === 'pending')
      .length
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
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
          <Text style={styles.statValue}>{formatCurrency(stats.totalEarnings)}</Text>
          <Text style={styles.statLabel}>Total Earnings</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="checkmark-circle" size={20} color={Colors.primary[500]} />
          <Text style={styles.statValue}>{stats.completedTasks}</Text>
          <Text style={styles.statLabel}>Completed Tasks</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="arrow-up" size={20} color={Colors.warning[500]} />
          <Text style={styles.statValue}>{formatCurrency(stats.totalWithdrawals)}</Text>
          <Text style={styles.statLabel}>Total Withdrawals</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="calendar" size={20} color={Colors.info[500]} />
          <Text style={styles.statValue}>{formatCurrency(stats.thisMonthEarnings)}</Text>
          <Text style={styles.statLabel}>This Month</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.withdrawButton]}
          onPress={onWithdraw}
          disabled={wallet?.balance <= 0}
        >
          <Ionicons name="arrow-up" size={20} color="#fff" />
          <Text style={styles.actionButtonText}>Withdraw</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, styles.historyButton]}>
          <Ionicons name="time" size={20} color={Colors.primary[500]} />
          <Text style={[styles.actionButtonText, styles.historyButtonText]}>History</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Transactions */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <TouchableOpacity>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        {transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color={Colors.neutral[300]} />
            <Text style={styles.emptyTitle}>No Transactions Yet</Text>
            <Text style={styles.emptySubtitle}>
              Your transaction history will appear here once you start earning.
            </Text>
          </View>
        ) : (
          <View style={styles.transactionsList}>
            {transactions.map((transaction) => (
              <View key={transaction.id} style={styles.transactionItem}>
                <View style={styles.transactionIcon}>
                  <Ionicons 
                    name={getTransactionIcon(transaction.type)} 
                    size={20} 
                    color={getTransactionColor(transaction.type)} 
                  />
                </View>
                <View style={styles.transactionDetails}>
                  <Text style={styles.transactionTitle}>
                    {transaction.transaction_type_display}
                  </Text>
                  <Text style={styles.transactionDescription}>
                    {transaction.description}
                  </Text>
                  <Text style={styles.transactionDate}>
                    {formatDate(transaction.created_at)}
                  </Text>
                </View>
                <View style={styles.transactionAmount}>
                  <Text style={[
                    styles.transactionAmountText,
                    { color: transaction.type === 'deposit' ? Colors.success[500] : Colors.warning[500] }
                  ]}>
                    {transaction.type === 'deposit' ? '+' : '-'}{formatCurrency(transaction.amount)}
                  </Text>
                  <Text style={styles.transactionStatus}>
                    {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Pending Withdrawals */}
      {stats.pendingWithdrawals > 0 && (
        <View style={styles.pendingCard}>
          <View style={styles.pendingHeader}>
            <Ionicons name="time" size={20} color={Colors.warning[500]} />
            <Text style={styles.pendingTitle}>Pending Withdrawals</Text>
          </View>
          <Text style={styles.pendingText}>
            You have {stats.pendingWithdrawals} withdrawal request{stats.pendingWithdrawals > 1 ? 's' : ''} pending approval.
          </Text>
        </View>
      )}

      {/* Info Card */}
      <View style={styles.infoCard}>
        <Ionicons name="information-circle" size={20} color={Colors.info[500]} />
        <Text style={styles.infoText}>
          Payments are processed automatically after task completion. 
          You can withdraw your earnings using various methods available in Ethiopia.
        </Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.neutral[600],
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral[600],
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 14,
    color: Colors.neutral[500],
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: Colors.primary[500],
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  balanceCard: {
    backgroundColor: Colors.background.primary,
    borderRadius: 16,
    padding: 24,
    margin: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
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
    color: Colors.neutral[900],
    marginLeft: 8,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.primary[500],
    marginBottom: 4,
  },
  balanceSubtitle: {
    fontSize: 14,
    color: Colors.neutral[600],
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 12,
  },
  statCard: {
    backgroundColor: Colors.background.primary,
    borderRadius: 12,
    padding: 16,
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.neutral[900],
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.neutral[600],
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 20,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  withdrawButton: {
    backgroundColor: Colors.primary[500],
  },
  historyButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.primary[500],
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  historyButtonText: {
    color: Colors.primary[500],
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
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
    color: Colors.neutral[900],
  },
  viewAllText: {
    fontSize: 14,
    color: Colors.primary[500],
    fontWeight: '500',
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
    paddingHorizontal: 20,
  },
  transactionsList: {
    gap: 12,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.primary,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.neutral[900],
    marginBottom: 2,
  },
  transactionDescription: {
    fontSize: 12,
    color: Colors.neutral[600],
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 11,
    color: Colors.neutral[500],
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  transactionAmountText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  transactionStatus: {
    fontSize: 11,
    color: Colors.neutral[500],
  },
  pendingCard: {
    backgroundColor: Colors.warning[50],
    borderRadius: 12,
    padding: 16,
    margin: 20,
    borderLeftWidth: 4,
    borderLeftColor: Colors.warning[500],
  },
  pendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  pendingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.warning[700],
    marginLeft: 8,
  },
  pendingText: {
    fontSize: 12,
    color: Colors.warning[600],
    lineHeight: 18,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.info[50],
    borderRadius: 12,
    padding: 16,
    margin: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: Colors.info[700],
    marginLeft: 12,
    lineHeight: 18,
  },
})
