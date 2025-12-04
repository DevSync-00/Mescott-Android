import { supabase } from '../lib/supabase'
import { handleError } from '../utils/errorHandler'
import { ChapaPaymentService } from './ChapaPaymentService'

export interface Wallet {
  id: string
  user_id: string
  balance: number
  currency: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface WalletTransaction {
  id: string
  user_id: string
  task_id?: string
  type: 'deposit' | 'withdrawal' | 'refund' | 'task_payment'
  amount: number
  currency: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  description: string
  metadata?: any
  created_at: string
  updated_at: string
  // Additional fields for display
  task_title?: string
  formatted_amount?: string
  transaction_type_display?: string
}

export interface WalletStats {
  totalBalance: number
  totalEarnings: number
  totalWithdrawals: number
  pendingWithdrawals: number
  completedTasks: number
  averageEarningPerTask: number
  thisMonthEarnings: number
  lastTransactionDate?: string
}

export class WalletService {
  // Get or create wallet for user
  static async getOrCreateWallet(userId: string): Promise<Wallet | null> {
    try {
      // Try to get existing wallet
      let { data: wallet, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error && error.code === 'PGRST116') {
        // Wallet doesn't exist, create it
        const { data: newWallet, error: createError } = await supabase
          .from('wallets')
          .insert([{
            user_id: userId,
            balance: 0,
            currency: 'ETB',
            is_active: true
          }])
          .select()
          .single()

        if (createError) throw createError
        wallet = newWallet
      } else if (error) {
        throw error
      }

      return wallet
    } catch (error) {
      const appError = handleError(error, 'getOrCreateWallet')
      console.error('Error getting or creating wallet:', appError)
      return null
    }
  }

  // Get wallet balance
  static async getWalletBalance(userId: string): Promise<number> {
    try {
      const wallet = await this.getOrCreateWallet(userId)
      return wallet?.balance || 0
    } catch (error) {
      console.error('Error getting wallet balance:', error)
      return 0
    }
  }

  // Get wallet details with stats
  static async getWalletDetails(userId: string): Promise<{
    wallet: Wallet | null
    stats: WalletStats
    recentTransactions: WalletTransaction[]
  }> {
    try {
      const wallet = await this.getOrCreateWallet(userId)
      
      // Get wallet statistics
      const stats = await this.getWalletStats(userId)
      
      // Get recent transactions
      const recentTransactions = await this.getRecentTransactions(userId, 10)

      return {
        wallet,
        stats,
        recentTransactions
      }
    } catch (error) {
      const appError = handleError(error, 'getWalletDetails')
      console.error('Error getting wallet details:', appError)
      return {
        wallet: null,
        stats: this.getDefaultStats(),
        recentTransactions: []
      }
    }
  }

  // Get wallet statistics
  static async getWalletStats(userId: string): Promise<WalletStats> {
    try {
      // Get all transactions for the user
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error

      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

      // Calculate statistics
      const completedTransactions = transactions?.filter(t => t.status === 'completed') || []
      const deposits = completedTransactions.filter(t => t.type === 'deposit')
      const withdrawals = completedTransactions.filter(t => t.type === 'withdrawal')
      const pendingWithdrawals = transactions?.filter(t => t.type === 'withdrawal' && t.status === 'pending') || []
      
      const thisMonthDeposits = deposits.filter(t => 
        new Date(t.created_at) >= startOfMonth
      )

      const totalEarnings = deposits.reduce((sum, t) => sum + t.amount, 0)
      const totalWithdrawals = withdrawals.reduce((sum, t) => sum + t.amount, 0)
      const thisMonthEarnings = thisMonthDeposits.reduce((sum, t) => sum + t.amount, 0)

      // Get completed tasks count
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('id')
        .eq('tasker_id', userId)
        .eq('status', 'completed')

      const completedTasks = tasks?.length || 0
      const averageEarningPerTask = completedTasks > 0 ? totalEarnings / completedTasks : 0

      const lastTransaction = transactions?.[0]
      const lastTransactionDate = lastTransaction?.created_at

      return {
        totalBalance: (await this.getWalletBalance(userId)),
        totalEarnings,
        totalWithdrawals,
        pendingWithdrawals: pendingWithdrawals.length,
        completedTasks,
        averageEarningPerTask,
        thisMonthEarnings,
        lastTransactionDate
      }
    } catch (error) {
      const appError = handleError(error, 'getWalletStats')
      console.error('Error getting wallet stats:', appError)
      return this.getDefaultStats()
    }
  }

  // Get recent transactions
  static async getRecentTransactions(userId: string, limit: number = 20): Promise<WalletTransaction[]> {
    try {
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select(`
          *,
          tasks!inner(
            id,
            title
          )
        `)
        .eq('user_id', userId)
        .in('type', ['deposit', 'withdrawal', 'refund'])
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error

      return transactions?.map(transaction => ({
        ...transaction,
        task_title: transaction.tasks?.title,
        formatted_amount: `${transaction.amount} ${transaction.currency}`,
        transaction_type_display: this.getTransactionTypeDisplay(transaction.type)
      })) || []
    } catch (error) {
      const appError = handleError(error, 'getRecentTransactions')
      console.error('Error getting recent transactions:', appError)
      return []
    }
  }

  // Get all transactions with pagination
  static async getTransactions(
    userId: string, 
    page: number = 1, 
    limit: number = 20,
    type?: string
  ): Promise<{
    transactions: WalletTransaction[]
    totalCount: number
    hasMore: boolean
  }> {
    try {
      const offset = (page - 1) * limit

      let query = supabase
        .from('transactions')
        .select(`
          *,
          tasks!inner(
            id,
            title
          )
        `, { count: 'exact' })
        .eq('user_id', userId)
        .in('type', ['deposit', 'withdrawal', 'refund'])
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (type) {
        query = query.eq('type', type)
      }

      const { data: transactions, error, count } = await query

      if (error) throw error

      const formattedTransactions = transactions?.map(transaction => ({
        ...transaction,
        task_title: transaction.tasks?.title,
        formatted_amount: `${transaction.amount} ${transaction.currency}`,
        transaction_type_display: this.getTransactionTypeDisplay(transaction.type)
      })) || []

      return {
        transactions: formattedTransactions,
        totalCount: count || 0,
        hasMore: (count || 0) > offset + limit
      }
    } catch (error) {
      const appError = handleError(error, 'getTransactions')
      console.error('Error getting transactions:', appError)
      return {
        transactions: [],
        totalCount: 0,
        hasMore: false
      }
    }
  }

  // Request withdrawal
  static async requestWithdrawal(
    userId: string,
    amount: number,
    withdrawalMethod: 'bank_transfer' | 'mobile_money' | 'cash_pickup',
    accountDetails: {
      accountNumber?: string
      bankName?: string
      mobileNumber?: string
      provider?: string
      pickupLocation?: string
    }
  ): Promise<boolean> {
    try {
      // Check if user has sufficient balance
      const currentBalance = await this.getWalletBalance(userId)
      if (currentBalance < amount) {
        throw new Error('Insufficient wallet balance')
      }

      // Create withdrawal request
      const { error } = await supabase
        .from('transactions')
        .insert([{
          user_id: userId,
          type: 'withdrawal',
          amount: amount,
          currency: 'ETB',
          status: 'pending',
          description: `Withdrawal request via ${withdrawalMethod}`,
          metadata: {
            withdrawal_method: withdrawalMethod,
            account_details: accountDetails,
            requested_at: new Date().toISOString()
          }
        }])

      if (error) throw error

      return true
    } catch (error) {
      const appError = handleError(error, 'requestWithdrawal')
      console.error('Error requesting withdrawal:', appError)
      return false
    }
  }

  // Process withdrawal (admin function)
  static async processWithdrawal(
    transactionId: string,
    status: 'completed' | 'failed' | 'cancelled',
    adminNotes?: string
  ): Promise<boolean> {
    try {
      // Get the withdrawal transaction
      const { data: transaction, error: getError } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', transactionId)
        .single()

      if (getError || !transaction) {
        throw new Error('Withdrawal transaction not found')
      }

      // Update transaction status
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          status: status,
          updated_at: new Date().toISOString(),
          metadata: {
            ...transaction.metadata,
            admin_notes: adminNotes,
            processed_at: new Date().toISOString()
          }
        })
        .eq('id', transactionId)

      if (updateError) throw updateError

      // If withdrawal is completed, update wallet balance
      if (status === 'completed') {
        const { data: wallet, error: walletLookupError } = await supabase
          .from('wallets')
          .select('balance')
          .eq('user_id', transaction.user_id)
          .single()

        if (walletLookupError) throw walletLookupError

        const currentBalance = wallet?.balance ?? 0
        const updatedBalance = Math.max(0, currentBalance - transaction.amount)

        const { error: walletError } = await supabase
          .from('wallets')
          .update({
            balance: updatedBalance,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', transaction.user_id)

        if (walletError) throw walletError
      }

      return true
    } catch (error) {
      const appError = handleError(error, 'processWithdrawal')
      console.error('Error processing withdrawal:', appError)
      return false
    }
  }

  // Get withdrawal methods available in Ethiopia
  static getWithdrawalMethods(): Array<{
    id: string
    name: string
    description: string
    icon: string
    minAmount: number
    maxAmount: number
    processingTime: string
    fee: number
  }> {
    return [
      {
        id: 'bank_transfer',
        name: 'Bank Transfer',
        description: 'Transfer to your bank account',
        icon: 'bank',
        minAmount: 100,
        maxAmount: 50000,
        processingTime: '1-3 business days',
        fee: 0
      },
      {
        id: 'mobile_money',
        name: 'Mobile Money',
        description: 'Transfer to your mobile money account',
        icon: 'phone-portrait',
        minAmount: 10,
        maxAmount: 10000,
        processingTime: 'Instant',
        fee: 5
      },
    ]
  }

  // Helper methods
  private static getTransactionTypeDisplay(type: string): string {
    switch (type) {
      case 'deposit':
        return 'Payment Received'
      case 'withdrawal':
        return 'Withdrawal'
      case 'refund':
        return 'Refund'
      case 'task_payment':
        return 'Task Payment'
      default:
        return 'Transaction'
    }
  }

  private static getDefaultStats(): WalletStats {
    return {
      totalBalance: 0,
      totalEarnings: 0,
      totalWithdrawals: 0,
      pendingWithdrawals: 0,
      completedTasks: 0,
      averageEarningPerTask: 0,
      thisMonthEarnings: 0
    }
  }

  // Get earnings breakdown by time period
  static async getEarningsBreakdown(
    userId: string,
    period: 'week' | 'month' | 'year' = 'month'
  ): Promise<{
    period: string
    totalEarnings: number
    taskCount: number
    averagePerTask: number
    dailyBreakdown: Array<{
      date: string
      earnings: number
      taskCount: number
    }>
  }> {
    try {
      const now = new Date()
      let startDate: Date

      switch (period) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          break
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1)
          break
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      }

      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'deposit')
        .eq('status', 'completed')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true })

      if (error) throw error

      const totalEarnings = transactions?.reduce((sum, t) => sum + t.amount, 0) || 0
      const taskCount = transactions?.length || 0
      const averagePerTask = taskCount > 0 ? totalEarnings / taskCount : 0

      // Group by day
      const dailyBreakdown = this.groupTransactionsByDay(transactions || [])

      return {
        period,
        totalEarnings,
        taskCount,
        averagePerTask,
        dailyBreakdown
      }
    } catch (error) {
      const appError = handleError(error, 'getEarningsBreakdown')
      console.error('Error getting earnings breakdown:', appError)
      return {
        period,
        totalEarnings: 0,
        taskCount: 0,
        averagePerTask: 0,
        dailyBreakdown: []
      }
    }
  }

  private static groupTransactionsByDay(transactions: any[]): Array<{
    date: string
    earnings: number
    taskCount: number
  }> {
    const grouped = transactions.reduce((acc, transaction) => {
      const date = new Date(transaction.created_at).toISOString().split('T')[0]
      if (!acc[date]) {
        acc[date] = { earnings: 0, taskCount: 0 }
      }
      acc[date].earnings += transaction.amount
      acc[date].taskCount += 1
      return acc
    }, {})

    return Object.entries(grouped).map(([date, data]: [string, any]) => ({
      date,
      earnings: data.earnings,
      taskCount: data.taskCount
    }))
  }
}
