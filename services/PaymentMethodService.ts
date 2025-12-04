import { supabase } from '../lib/supabase'
import { EthiopianBank, MobileMoneyProvider, getBankById, getMobileMoneyProviderById } from '../constants/EthiopianBanks'

export interface PaymentMethod {
  id: string
  user_id: string
  type: 'bank_account' | 'mobile_money'
  last4?: string
  brand?: string
  expiry_month?: number
  expiry_year?: number
  is_default: boolean
  created_at: string
  // Additional fields for display
  display_name?: string
  masked_number?: string
  withdrawal_details?: {
    account_number?: string
    bank_name?: string
    bank_id?: string
    phone_number?: string
    provider?: string
    provider_id?: string
    pickup_location?: string
    account_holder_name?: string
  }
}

export class PaymentMethodService {
  // Get all payment methods for a user
  static async getPaymentMethods(userId: string): Promise<PaymentMethod[]> {
    try {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('user_id', userId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) throw error

      return data.map(method => ({
        ...method,
        display_name: this.getDisplayName(method),
        masked_number: this.getMaskedNumber(method),
        withdrawal_details: this.getWithdrawalDetails(method)
      }))
    } catch (error) {
      console.error('Error fetching payment methods:', error)
      throw error
    }
  }

  // Add a new payment method
  static async addPaymentMethod(
    userId: string,
    type: 'bank_account' | 'mobile_money',
    details: {
      last4?: string
      brand?: string
      expiry_month?: number
      expiry_year?: number
      withdrawal_details?: {
        account_number?: string
        bank_name?: string
        bank_id?: string
        phone_number?: string
        provider?: string
        provider_id?: string
        account_holder_name?: string
      }
    }
  ): Promise<PaymentMethod> {
    try {
      const { data, error } = await supabase
        .from('payment_methods')
        .insert([{
          user_id: userId,
          type,
          last4: details.last4,
          brand: details.brand,
          expiry_month: details.expiry_month,
          expiry_year: details.expiry_year,
          is_default: false, // New methods are not default by default
          withdrawal_details: details.withdrawal_details
        }])
        .select()
        .single()

      if (error) throw error

      return {
        ...data,
        display_name: this.getDisplayName(data),
        masked_number: this.getMaskedNumber(data),
        withdrawal_details: this.getWithdrawalDetails(data)
      }
    } catch (error) {
      console.error('Error adding payment method:', error)
      throw error
    }
  }

  // Set a payment method as default
  static async setDefaultPaymentMethod(userId: string, methodId: string): Promise<void> {
    try {
      // First, unset all other default methods
      await supabase
        .from('payment_methods')
        .update({ is_default: false })
        .eq('user_id', userId)

      // Then set the selected method as default
      const { error } = await supabase
        .from('payment_methods')
        .update({ is_default: true })
        .eq('id', methodId)
        .eq('user_id', userId)

      if (error) throw error
    } catch (error) {
      console.error('Error setting default payment method:', error)
      throw error
    }
  }

  // Delete a payment method
  static async deletePaymentMethod(userId: string, methodId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('payment_methods')
        .delete()
        .eq('id', methodId)
        .eq('user_id', userId)

      if (error) throw error
    } catch (error) {
      console.error('Error deleting payment method:', error)
      throw error
    }
  }

  // Helper function to get display name
  private static getDisplayName(method: any): string {
    const withdrawalDetails = this.getWithdrawalDetails(method)
    
    switch (method.type) {
      case 'bank_account':
        const bank = getBankById(withdrawalDetails?.bank_id)
        const bankName = bank?.name || withdrawalDetails?.bank_name || method.brand || 'Bank'
        const accountNumber = withdrawalDetails?.account_number || method.last4
        const maskedAccount = accountNumber ? `••••${accountNumber.slice(-4)}` : '••••'
        return `${bankName} ${maskedAccount}`
      case 'mobile_money':
        const provider = getMobileMoneyProviderById(withdrawalDetails?.provider_id)
        const providerName = provider?.name || withdrawalDetails?.provider || method.brand || 'Mobile Money'
        const phoneNumber = withdrawalDetails?.phone_number
        const maskedPhone = phoneNumber ? `••••${phoneNumber.slice(-4)}` : '••••'
        return `${providerName} ${maskedPhone}`
      case 'cash_pickup':
        const location = withdrawalDetails?.pickup_location || 'Location'
        return `Cash Pickup - ${location}`
      default:
        return 'Unknown Method'
    }
  }

  // Helper function to get masked number
  private static getMaskedNumber(method: any): string {
    const withdrawalDetails = this.getWithdrawalDetails(method)
    
    switch (method.type) {
      case 'bank_account':
        const accountNumber = withdrawalDetails?.account_number
        if (accountNumber) {
          return `••••${accountNumber.slice(-4)}`
        }
        return '•••• ••••'
      case 'mobile_money':
        const phoneNumber = withdrawalDetails?.phone_number
        if (phoneNumber) {
          return `••••${phoneNumber.slice(-4)}`
        }
        return '•••• ••••'
      case 'cash_pickup':
        return 'N/A'
      default:
        return '•••• ••••'
    }
  }

  // Helper function to get withdrawal details
  private static getWithdrawalDetails(method: any): any {
    return method.withdrawal_details || {}
  }
}
