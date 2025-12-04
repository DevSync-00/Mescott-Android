import { supabase } from '../lib/supabase'

export interface WithdrawalOrder {
  id: string
  user_id: string
  payment_method_id: string
  amount: number
  currency: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  withdrawal_method: 'bank_transfer' | 'mobile_money' | 'cash_pickup'
  withdrawal_details: any
  processing_fee: number
  net_amount: number
  admin_notes?: string
  processed_by?: string
  processed_at?: string
  failure_reason?: string
  created_at: string
  updated_at: string
  // Additional fields for display
  payment_method?: {
    type: string
    display_name: string
    masked_number: string
  }
}

export class WithdrawalOrderService {
  // Create a new withdrawal order
  static async createWithdrawalOrder(
    userId: string,
    paymentMethodId: string,
    amount: number,
    withdrawalMethod: 'bank_transfer' | 'mobile_money' | 'cash_pickup',
    withdrawalDetails: any
  ): Promise<WithdrawalOrder> {
    try {
      // No processing fee
      const processingFee = 0
      const netAmount = amount

      // Check if user has sufficient balance
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', userId)
        .single()

      if (walletError) throw walletError

      if (wallet.balance < amount) {
        throw new Error('Insufficient wallet balance')
      }

      // Create withdrawal order
      const { data, error } = await supabase
        .from('withdrawal_orders')
        .insert([{
          user_id: userId,
          payment_method_id: paymentMethodId,
          amount,
          currency: 'ETB',
          status: 'pending',
          withdrawal_method: withdrawalMethod,
          withdrawal_details: withdrawalDetails,
          processing_fee: processingFee,
          net_amount: netAmount
        }])
        .select()
        .single()

      if (error) throw error

      // Deduct amount from wallet (create a pending transaction)
      const { error: walletError2 } = await supabase
        .from('wallets')
        .update({ balance: wallet.balance - amount })
        .eq('user_id', userId)

      if (walletError2) throw walletError2

      // Create transaction record
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert([{
          user_id: userId,
          type: 'withdrawal',
          amount: -amount, // Negative for withdrawal
          currency: 'ETB',
          status: 'pending',
          payment_method_id: paymentMethodId,
          description: `Withdrawal request - ${withdrawalMethod}`,
          metadata: {
            withdrawal_order_id: data.id,
            withdrawal_method: withdrawalMethod
          }
        }])

      if (transactionError) throw transactionError

      return data
    } catch (error) {
      console.error('Error creating withdrawal order:', error)
      throw error
    }
  }

  // Get withdrawal orders for a user
  static async getWithdrawalOrders(userId: string): Promise<WithdrawalOrder[]> {
    try {
      const { data, error } = await supabase
        .from('withdrawal_orders')
        .select(`
          *,
          payment_methods (
            type,
            last4,
            brand
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error

      return data.map(order => ({
        ...order,
        payment_method: {
          type: order.payment_methods?.type || 'unknown',
          display_name: this.getPaymentMethodDisplayName(order.payment_methods),
          masked_number: this.getMaskedNumber(order.payment_methods)
        }
      }))
    } catch (error) {
      console.error('Error fetching withdrawal orders:', error)
      throw error
    }
  }

  // Cancel a pending withdrawal order
  static async cancelWithdrawalOrder(userId: string, orderId: string): Promise<void> {
    try {
      // Get the withdrawal order
      const { data: order, error: orderError } = await supabase
        .from('withdrawal_orders')
        .select('*')
        .eq('id', orderId)
        .eq('user_id', userId)
        .single()

      if (orderError) throw orderError

      if (order.status !== 'pending') {
        throw new Error('Cannot cancel non-pending withdrawal order')
      }

      // Update order status
      const { error: updateError } = await supabase
        .from('withdrawal_orders')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)

      if (updateError) throw updateError

      // Refund amount to wallet
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', userId)
        .single()

      if (walletError) throw walletError

      const { error: refundError } = await supabase
        .from('wallets')
        .update({ balance: wallet.balance + order.amount })
        .eq('user_id', userId)

      if (refundError) throw refundError

      // Update transaction status
      const { error: transactionError } = await supabase
        .from('transactions')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('metadata->>withdrawal_order_id', orderId)

      if (transactionError) throw transactionError
    } catch (error) {
      console.error('Error cancelling withdrawal order:', error)
      throw error
    }
  }

  // Helper function to get payment method display name
  private static getPaymentMethodDisplayName(paymentMethod: any): string {
    if (!paymentMethod) return 'Unknown Method'
    
    switch (paymentMethod.type) {
      case 'bank_account':
        return `${paymentMethod.brand || 'Bank'} •••• ${paymentMethod.last4 || '****'}`
      case 'mobile_money':
        return `Mobile Money •••• ${paymentMethod.last4 || '****'}`
      case 'cash_pickup':
        return 'Cash Pickup'
      default:
        return 'Unknown Method'
    }
  }

  // Helper function to get masked number
  private static getMaskedNumber(paymentMethod: any): string {
    if (!paymentMethod?.last4) return '•••• ••••'
    return `•••• ${paymentMethod.last4}`
  }
}
