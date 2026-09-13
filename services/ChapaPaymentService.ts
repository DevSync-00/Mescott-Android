import { supabase } from '../lib/supabase'
import { handleError } from '../utils/errorHandler'
import { CHAPA_CONFIG } from '../config/chapa'

// Chapa API Types
export interface ChapaPaymentRequest {
  amount: string
  currency: string
  email: string
  first_name: string
  last_name: string
  phone_number: string
  tx_ref: string
  callback_url: string
  return_url: string
  customization: {
    title: string
    description: string
    logo: string
  }
  meta?: {
    task_id?: string
    customer_id?: string
    tasker_id?: string
    vat_amount?: number
    platform_fee?: number
    net_amount?: number
  }
}

export interface ChapaPaymentResponse {
  status: string
  message: string
  data: {
    checkout_url: string
    /** Chapa sometimes omits this on success; we fall back to the request `tx_ref`. */
    tx_ref?: string
  }
}

export interface ChapaVerificationResponse {
  status: string
  message: string
  data: {
    tx_ref: string
    amount: number
    currency: string
    status: string
    created_at: string
    customer: {
      email: string
      first_name: string
      last_name: string
      phone_number: string
    }
    meta?: any
  }
}

export interface ChapaWebhookPayload {
  event: string
  data: {
    tx_ref: string
    status: string
    amount: number
    currency: string
    created_at: string
    customer: {
      email: string
      first_name: string
      last_name: string
      phone_number: string
    }
    meta?: any
  }
}

export interface PaymentCalculation {
  originalAmount: number
  vatAmount: number
  totalAmount: number
  platformFee: number
  netAmount: number
  breakdown: {
    subtotal: number
    vat: number
    platformFee: number
    total: number
    netToTasker: number
  }
}

export class ChapaPaymentService {
  // Calculate payment breakdown with VAT and platform fees
  static calculatePaymentBreakdown(originalAmount: number): PaymentCalculation {
    const vatAmount = originalAmount * CHAPA_CONFIG.vatRate
    const totalAmount = originalAmount + vatAmount
    const platformFee = totalAmount * CHAPA_CONFIG.platformFeeRate
    const netAmount = totalAmount - platformFee

    return {
      originalAmount,
      vatAmount,
      totalAmount,
      platformFee,
      netAmount,
      breakdown: {
        subtotal: originalAmount,
        vat: vatAmount,
        platformFee: platformFee,
        total: totalAmount,
        netToTasker: netAmount
      }
    }
  }

  // Initialize payment with Chapa
  static async initializePayment(
    taskId: string,
    customerUserId: string,
    amount: number,
    customerInfo: {
      email: string
      firstName: string
      lastName: string
      phone: string
    }
  ): Promise<{ checkoutUrl: string; txRef: string } | { success: false; error: string; checkoutUrl: null; txRef: null }> {
    try {
      // Calculate payment breakdown
      const calculation = this.calculatePaymentBreakdown(amount)
      
      // Generate unique transaction reference (max 50 characters)
      const txRef = `MUYA_${taskId.slice(0, 8)}_${Date.now().toString().slice(-8)}`
      
      // Get task details
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select('id, title, description, customer_id, tasker_id')
        .eq('id', taskId)
        .single()

      if (taskError || !task) {
        throw new Error('Task not found')
      }

      // Chapa rejects many user emails; use a stable fallback when profile email is missing/invalid
      const validEmail = 'test@gmail.com'

      const returnUrl = CHAPA_CONFIG.getReturnUrl(txRef)
      if (!returnUrl.startsWith('https://')) {
        throw new Error(
          'Chapa requires an HTTPS return URL. Set EXPO_PUBLIC_API_URL in .env and restart Expo with: npx expo start --clear',
        )
      }

      console.log('Chapa return_url:', returnUrl)

      // Prepare Chapa payment request
      const paymentRequest: ChapaPaymentRequest = {
        amount: calculation.totalAmount.toString(),
        currency: CHAPA_CONFIG.currency,
        email: String(validEmail).trim(), // Ensure it's a plain string
        first_name: customerInfo.firstName.trim(),
        last_name: customerInfo.lastName.trim(),
        phone_number: customerInfo.phone.replace(/\s+/g, ''), // Remove spaces from phone
        tx_ref: txRef,
        callback_url: CHAPA_CONFIG.webhookUrl,
        return_url: returnUrl,
        customization: {
          title: CHAPA_CONFIG.companyName,
          description: 'Payment for task completion',
          logo: CHAPA_CONFIG.companyLogo
        },
        meta: {
          task_id: taskId,
          customer_id: customerUserId,
          tasker_id: task.tasker_id,
          vat_amount: calculation.vatAmount,
          platform_fee: calculation.platformFee,
          net_amount: calculation.netAmount
        }
      }

      // Check if API credentials are configured
      if (!CHAPA_CONFIG.secretKey || CHAPA_CONFIG.secretKey.includes('xxxxxxxxxxxxxxxxxxxxxxxx') || CHAPA_CONFIG.secretKey === 'CHASECK_TEST-your_secret_key_here') {
        console.error('❌ Chapa API credentials not configured')
        console.error('Please create a .env file in the project root with:')
        console.error('EXPO_PUBLIC_CHAPA_SECRET_KEY=your_actual_secret_key')
        console.error('Get your keys from: https://dashboard.chapa.co/')
        return {
          success: false,
          error: 'Chapa API credentials not configured. Please set EXPO_PUBLIC_CHAPA_SECRET_KEY in your environment variables.',
          checkoutUrl: null,
          txRef: null
        }
      }

      const chapaUrl = `${CHAPA_CONFIG.baseUrl}/transaction/initialize`

      const requestBody = {
        ...paymentRequest,
        email: String(paymentRequest.email).trim(),
      }

      console.log('Sending to Chapa:', requestBody)

      // Make API call to Chapa with retry logic for rate limiting
      let response: Response | undefined
      let retryCount = 0
      const maxRetries = 3
      
      while (retryCount < maxRetries) {
        response = await fetch(chapaUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${CHAPA_CONFIG.secretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        })
        
        // If we get rate limited, wait and retry
        if (response.status === 429) {
          retryCount++
          const waitTime = Math.pow(2, retryCount) * 1000 // Exponential backoff: 2s, 4s, 8s
          console.log(`Rate limited. Retrying in ${waitTime/1000} seconds... (attempt ${retryCount}/${maxRetries})`)
          await new Promise(resolve => setTimeout(resolve, waitTime))
          continue
        }
        
        // If not rate limited, break out of retry loop
        break
      }

      if (!response) {
        throw new Error('Failed to get response from Chapa API')
      }

      const responseText = await response.text()
      console.log('Chapa Raw Response:', responseText)

      let result
      try {
        result = JSON.parse(responseText)
      } catch {
        throw new Error(`Invalid JSON from Chapa: ${responseText}`)
      }

      if (result.status !== 'success') {
        console.error('Chapa Error Details:', result)

        const msg = result.message
        if (typeof msg === 'object' && msg !== null) {
          const parts = Object.entries(msg).flatMap(([field, errors]) =>
            Array.isArray(errors)
              ? errors.map((e) => `${field}: ${e}`)
              : [`${field}: ${String(errors)}`],
          )
          throw new Error(`Chapa validation failed: ${parts.join('; ')}`)
        }

        throw new Error(`Chapa payment failed: ${msg || 'Unknown error'}`)
      }

      const checkoutUrl = result.data?.checkout_url
      if (!checkoutUrl || typeof checkoutUrl !== 'string') {
        throw new Error('Chapa did not return a checkout URL')
      }

      const resolvedTxRef =
        typeof result.data?.tx_ref === 'string' && result.data.tx_ref.length > 0
          ? result.data.tx_ref
          : txRef

      // Store payment record in database
      await this.createPaymentRecord(
        taskId,
        customerUserId,
        calculation,
        resolvedTxRef,
        'pending',
        task.tasker_id
      )

      return {
        checkoutUrl,
        txRef: resolvedTxRef
      }

    } catch (error) {
      const appError = handleError(error, 'initializePayment')
      console.error('Error initializing Chapa payment:', appError)
      return {
        success: false,
        error: appError.message || 'Payment initialization failed',
        checkoutUrl: null,
        txRef: null
      }
    }
  }

  // Verify payment status with Chapa
  static async verifyPayment(txRef: string): Promise<ChapaVerificationResponse | null> {
    try {
      const response = await fetch(`${CHAPA_CONFIG.baseUrl}/transaction/verify/${txRef}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${CHAPA_CONFIG.secretKey}`,
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`Chapa API Error: ${errorData.message || 'Unknown error'}`)
      }

      const result: ChapaVerificationResponse = await response.json()
      return result

    } catch (error) {
      const appError = handleError(error, 'verifyPayment')
      console.error('Error verifying Chapa payment:', appError)
      return null
    }
  }

  // Handle webhook from Chapa
  static async handleWebhook(payload: ChapaWebhookPayload): Promise<boolean> {
    try {
      const { tx_ref, status, amount, meta } = payload.data

      // Verify webhook signature (implement proper verification)
      // const signature = headers['chapa-signature']
      // if (!this.verifyWebhookSignature(payload, signature)) {
      //   throw new Error('Invalid webhook signature')
      // }

      // Update payment status in database
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          status: status === 'success' ? 'completed' : 'failed',
          updated_at: new Date().toISOString(),
          metadata: {
            ...meta,
            chapa_verification: payload.data
          }
        })
        .eq('metadata->>tx_ref', tx_ref)

      if (updateError) {
        throw updateError
      }

      // If payment successful, process wallet credit
      if (status === 'success') {
        await this.processSuccessfulPayment(tx_ref, meta?.tasker_id, amount, meta)
      }

      return true

    } catch (error) {
      const appError = handleError(error, 'handleWebhook')
      console.error('Error handling Chapa webhook:', appError)
      return false
    }
  }

  // Process successful payment and credit tasker wallet
  static async processSuccessfulPayment(
    txRef: string,
    taskerId: string | undefined,
    amount: number,
    meta: any
  ): Promise<void> {
    try {
      const paymentMeta = meta ?? {}
      let resolvedTaskerId = taskerId || paymentMeta.tasker_id
      let taskId = paymentMeta.task_id

      if (!taskId || !resolvedTaskerId || paymentMeta.net_amount === undefined) {
        const { data: localPayment } = await supabase
          .from('transactions')
          .select('task_id, amount, metadata')
          .eq('metadata->>tx_ref', txRef)
          .eq('type', 'task_payment')
          .maybeSingle()

        taskId = taskId || localPayment?.task_id || localPayment?.metadata?.task_id
        resolvedTaskerId =
          resolvedTaskerId ||
          localPayment?.metadata?.tasker_id ||
          localPayment?.metadata?.chapa_verification?.meta?.tasker_id

        if (paymentMeta.net_amount === undefined) {
          paymentMeta.net_amount =
            localPayment?.metadata?.net_amount ??
            localPayment?.metadata?.breakdown?.netToTasker ??
            localPayment?.metadata?.chapa_verification?.meta?.net_amount
        }

        if (paymentMeta.platform_fee === undefined) {
          paymentMeta.platform_fee =
            localPayment?.metadata?.platform_fee ??
            localPayment?.metadata?.breakdown?.platformFee ??
            localPayment?.metadata?.chapa_verification?.meta?.platform_fee
        }

        if (paymentMeta.vat_amount === undefined) {
          paymentMeta.vat_amount =
            localPayment?.metadata?.vat_amount ??
            localPayment?.metadata?.breakdown?.vat ??
            localPayment?.metadata?.chapa_verification?.meta?.vat_amount
        }
      }

      if (!resolvedTaskerId && taskId) {
        const { data: task } = await supabase
          .from('tasks')
          .select('tasker_id')
          .eq('id', taskId)
          .maybeSingle()

        resolvedTaskerId = task?.tasker_id
      }

      if (!resolvedTaskerId) {
        throw new Error('Tasker id not found for payment')
      }

      // Get tasker's user_id from profile
      const { data: taskerProfile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('id', resolvedTaskerId)
        .single()

      if (profileError || !taskerProfile) {
        throw new Error('Tasker profile not found')
      }

      const { data: existingDeposit, error: existingDepositError } = await supabase
        .from('transactions')
        .select('id')
        .eq('user_id', taskerProfile.user_id)
        .eq('type', 'deposit')
        .eq('metadata->>tx_ref', txRef)
        .maybeSingle()

      if (existingDepositError && existingDepositError.code !== 'PGRST116') {
        throw existingDepositError
      }

      if (existingDeposit) {
        if (taskId) {
          await supabase
            .from('tasks')
            .update({
              payment_status: 'paid',
              updated_at: new Date().toISOString()
            })
            .eq('id', taskId)
        }
        return
      }

      // Get or create tasker wallet
      let { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', taskerProfile.user_id)
        .single()

      if (walletError && walletError.code === 'PGRST116') {
        // Wallet doesn't exist, create it
        const { data: newWallet, error: createError } = await supabase
          .from('wallets')
          .insert([{
            user_id: taskerProfile.user_id,
            balance: 0,
            currency: CHAPA_CONFIG.currency,
            is_active: true
          }])
          .select()
          .single()

        if (createError) throw createError
        wallet = newWallet
      } else if (walletError) {
        throw walletError
      }

      // Calculate net amount to credit (after platform fee)
      const netAmount = paymentMeta.net_amount || (amount - (amount * CHAPA_CONFIG.platformFeeRate))

      // Update wallet balance
      const { error: updateWalletError } = await supabase
        .from('wallets')
        .update({
          balance: (wallet.balance + netAmount),
          updated_at: new Date().toISOString()
        })
        .eq('id', wallet.id)

      if (updateWalletError) throw updateWalletError

      // Create wallet transaction record
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert([{
          user_id: taskerProfile.user_id,
          type: 'deposit',
          amount: netAmount,
          currency: CHAPA_CONFIG.currency,
          status: 'completed',
          description: `Payment received for task completion`,
          metadata: {
            tx_ref: txRef,
            task_id: taskId,
            tasker_id: resolvedTaskerId,
            platform_fee: paymentMeta.platform_fee,
            vat_amount: paymentMeta.vat_amount,
            source: 'chapa_payment'
          }
        }])

      if (transactionError) throw transactionError

      // Update task payment status
      if (taskId) {
        await supabase
          .from('tasks')
          .update({
            payment_status: 'paid',
            updated_at: new Date().toISOString()
          })
          .eq('id', taskId)
      }

    } catch (error) {
      const appError = handleError(error, 'processSuccessfulPayment')
      console.error('Error processing successful payment:', appError)
      throw appError
    }
  }

  // Create payment record in database
  private static async createPaymentRecord(
    taskId: string,
    customerUserId: string,
    calculation: PaymentCalculation,
    txRef: string,
    status: string,
    taskerId?: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('transactions')
        .insert([{
          user_id: customerUserId,
          task_id: taskId,
          type: 'task_payment',
          amount: calculation.totalAmount,
          currency: CHAPA_CONFIG.currency,
          status: status,
          description: `Task payment via Chapa`,
          metadata: {
            tx_ref: txRef,
            payment_gateway: 'chapa',
            task_id: taskId,
            tasker_id: taskerId,
            breakdown: calculation.breakdown,
            vat_amount: calculation.vatAmount,
            platform_fee: calculation.platformFee,
            net_amount: calculation.netAmount,
            vat_rate: CHAPA_CONFIG.vatRate,
            platform_fee_rate: CHAPA_CONFIG.platformFeeRate
          }
        }])

      if (error) throw error

    } catch (error) {
      const appError = handleError(error, 'createPaymentRecord')
      console.error('Error creating payment record:', appError)
      throw appError
    }
  }

  static mapChapaStatus(chapaStatus: string): 'completed' | 'failed' | 'pending' {
    const normalized = (chapaStatus || '').toLowerCase()
    if (normalized === 'success' || normalized === 'successful') return 'completed'
    if (
      normalized === 'failed' ||
      normalized === 'failure' ||
      normalized === 'cancelled' ||
      normalized === 'canceled' ||
      normalized === 'declined'
    ) {
      return 'failed'
    }
    return 'pending'
  }

  private static async updateTransactionStatus(
    txRef: string,
    status: 'completed' | 'failed' | 'pending',
    chapaData?: ChapaVerificationResponse['data']
  ): Promise<void> {
    const { data: existing } = await supabase
      .from('transactions')
      .select('metadata')
      .eq('metadata->>tx_ref', txRef)
      .maybeSingle()

    const metadata = {
      ...(existing?.metadata ?? {}),
      ...(chapaData ? { chapa_verification: chapaData, payment_gateway: 'chapa' } : {}),
    }

    const { error } = await supabase
      .from('transactions')
      .update({
        status,
        updated_at: new Date().toISOString(),
        metadata,
      })
      .eq('metadata->>tx_ref', txRef)

    if (error) {
      console.error('Error updating transaction status:', error)
    }
  }

  /** Verify with Chapa API and map to app status (completed | failed | pending). */
  static async resolvePaymentStatus(txRef: string): Promise<{
    status: 'completed' | 'failed' | 'pending'
    amount: number
    breakdown: any
  } | null> {
    const dbRecord = await this.getPaymentStatus(txRef)
    const verification = await this.verifyPayment(txRef)

    if (verification?.data) {
      const status = this.mapChapaStatus(verification.data.status)

      if (status === 'failed') {
        await this.updateTransactionStatus(txRef, 'failed', verification.data)
      }

      return {
        status,
        amount: dbRecord?.amount ?? (Number(verification.data.amount) || 0),
        breakdown: dbRecord?.breakdown,
      }
    }

    if (dbRecord) {
      const dbStatus =
        dbRecord.status === 'completed' || dbRecord.status === 'failed'
          ? (dbRecord.status as 'completed' | 'failed')
          : 'pending'
      return { status: dbStatus, amount: dbRecord.amount, breakdown: dbRecord.breakdown }
    }

    return null
  }

  // Get payment status by transaction reference
  static async getPaymentStatus(txRef: string): Promise<{
    status: string
    amount: number
    breakdown: any
  } | null> {
    try {
      const { data: transaction, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('metadata->>tx_ref', txRef)
        .single()

      if (error) throw error

      return {
        status: transaction.status,
        amount: transaction.amount,
        breakdown: transaction.metadata?.breakdown
      }

    } catch (error) {
      const appError = handleError(error, 'getPaymentStatus')
      console.error('Error getting payment status:', appError)
      return null
    }
  }

  // Get tasker wallet balance
  static async getTaskerWalletBalance(taskerUserId: string): Promise<{
    balance: number
    currency: string
    isActive: boolean
  } | null> {
    try {
      const { data: wallet, error } = await supabase
        .from('wallets')
        .select('balance, currency, is_active')
        .eq('user_id', taskerUserId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // Wallet doesn't exist, return zero balance
          return {
            balance: 0,
            currency: CHAPA_CONFIG.currency,
            isActive: true
          }
        }
        throw error
      }

      return {
        balance: wallet.balance,
        currency: wallet.currency,
        isActive: wallet.is_active
      }

    } catch (error) {
      const appError = handleError(error, 'getTaskerWalletBalance')
      console.error('Error getting tasker wallet balance:', appError)
      return null
    }
  }

  // Get tasker transaction history
  static async getTaskerTransactionHistory(taskerUserId: string): Promise<any[]> {
    try {
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', taskerUserId)
        .in('type', ['deposit', 'withdrawal'])
        .order('created_at', { ascending: false })

      if (error) throw error

      return transactions || []

    } catch (error) {
      const appError = handleError(error, 'getTaskerTransactionHistory')
      console.error('Error getting tasker transaction history:', appError)
      return []
    }
  }

  // Withdraw from tasker wallet
  static async withdrawFromWallet(
    taskerUserId: string,
    amount: number,
    withdrawalMethod: string
  ): Promise<boolean> {
    try {
      // Get current wallet balance
      const walletBalance = await this.getTaskerWalletBalance(taskerUserId)
      if (!walletBalance || walletBalance.balance < amount) {
        throw new Error('Insufficient wallet balance')
      }

      // Create withdrawal transaction
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert([{
          user_id: taskerUserId,
          type: 'withdrawal',
          amount: amount,
          currency: CHAPA_CONFIG.currency,
          status: 'pending',
          description: `Withdrawal via ${withdrawalMethod}`,
          metadata: {
            withdrawal_method: withdrawalMethod,
            source: 'wallet_withdrawal'
          }
        }])

      if (transactionError) throw transactionError

      // Update wallet balance
      const { error: updateError } = await supabase
        .from('wallets')
        .update({
          balance: walletBalance.balance - amount,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', taskerUserId)

      if (updateError) throw updateError

      return true

    } catch (error) {
      const appError = handleError(error, 'withdrawFromWallet')
      console.error('Error withdrawing from wallet:', appError)
      return false
    }
  }
}
