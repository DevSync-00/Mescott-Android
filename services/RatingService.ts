import { supabase } from '../lib/supabase'
import { handleError } from '../utils/errorHandler'

const REVIEWS_TABLE = 'task_reviews'

export interface Rating {
  id: string
  task_id: string
  customer_id: string
  technician_id: string
  rating: number
  review: string
  created_at: string
  updated_at: string
  customer_user_id: string
  technician_user_id: string
}

export interface CreateRatingRequest {
  task_id: string
  customer_id: string
  technician_id: string
  rating: number
  review: string
  customer_user_id: string
  technician_user_id: string
}

export interface Review {
  id: string
  task_id: string
  reviewer_id: string
  reviewee_id: string
  review_type: 'customer_to_tasker' | 'tasker_to_customer'
  rating: number
  comment: string
  is_anonymous: boolean
  is_public: boolean
  created_at: string
  updated_at: string
  reviewer_name?: string
  task_title?: string
}

export interface CreateReviewInput {
  task_id: string
  reviewer_id: string
  reviewee_id: string
  rating: number
  comment: string
  review_type: Review['review_type']
  is_anonymous?: boolean
  is_public?: boolean
}

export interface ReviewPermission {
  canReview: boolean
  reason?: string
}

export class RatingService {
  private static mapReview(record: any): Review {
    return {
      id: record.id,
      task_id: record.task_id,
      reviewer_id: record.reviewer_id,
      reviewee_id: record.reviewee_id,
      review_type: record.review_type,
      rating: record.rating,
      comment: record.comment,
      is_anonymous: record.is_anonymous ?? false,
      is_public: record.is_public ?? true,
      created_at: record.created_at,
      updated_at: record.updated_at,
      reviewer_name: record.reviewer?.full_name,
      task_title: record.task?.title,
    }
  }

  static async createReview(review: CreateReviewInput): Promise<Review | null> {
    try {
      const { data, error } = await supabase
        .from(REVIEWS_TABLE)
        .insert([{
          task_id: review.task_id,
          reviewer_id: review.reviewer_id,
          reviewee_id: review.reviewee_id,
          review_type: review.review_type,
          rating: review.rating,
          comment: review.comment,
          is_anonymous: review.is_anonymous ?? false,
          is_public: review.is_public ?? true,
        }])
        .select(`
          *,
          reviewer:reviewer_id(full_name),
          task:task_id(title)
        `)
        .single()

      if (error) throw error
      return this.mapReview(data)
    } catch (error) {
      const appError = handleError(error, 'createReview')
      console.error('Error creating review:', appError)
      return null
    }
  }

  static async updateReview(reviewId: string, updates: Partial<Pick<Review, 'rating' | 'comment' | 'is_anonymous'>>): Promise<Review | null> {
    try {
      const { data, error } = await supabase
        .from(REVIEWS_TABLE)
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', reviewId)
        .select(`
          *,
          reviewer:reviewer_id(full_name),
          task:task_id(title)
        `)
        .single()

      if (error) throw error
      return this.mapReview(data)
    } catch (error) {
      const appError = handleError(error, 'updateReview')
      console.error('Error updating review:', appError)
      return null
    }
  }

  static async deleteReview(reviewId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from(REVIEWS_TABLE)
        .delete()
        .eq('id', reviewId)

      if (error) throw error
      return true
    } catch (error) {
      const appError = handleError(error, 'deleteReview')
      console.error('Error deleting review:', appError)
      return false
    }
  }

  static async getReviewByTaskAndUsers(
    taskId: string,
    reviewerId: string,
    revieweeId: string,
    reviewType: Review['review_type']
  ): Promise<Review | null> {
    try {
      const { data, error } = await supabase
        .from(REVIEWS_TABLE)
        .select(`
          *,
          reviewer:reviewer_id(full_name),
          task:task_id(title)
        `)
        .eq('task_id', taskId)
        .eq('reviewer_id', reviewerId)
        .eq('reviewee_id', revieweeId)
        .eq('review_type', reviewType)
        .maybeSingle()

      if (error) throw error
      return data ? this.mapReview(data) : null
    } catch (error) {
      const appError = handleError(error, 'getReviewByTaskAndUsers')
      console.error('Error fetching review:', appError)
      return null
    }
  }

  static async getUserReviews(userId: string): Promise<Review[]> {
    try {
      const { data, error } = await supabase
        .from(REVIEWS_TABLE)
        .select(`
          *,
          reviewer:reviewer_id(full_name),
          task:task_id(title)
        `)
        .eq('reviewee_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []).map(this.mapReview)
    } catch (error) {
      const appError = handleError(error, 'getUserReviews')
      console.error('Error getting user reviews:', appError)
      return []
    }
  }

  static async getUserAverageRating(userId: string): Promise<{ average: number; count: number }> {
    try {
      const { data, error } = await supabase
        .from(REVIEWS_TABLE)
        .select('rating')
        .eq('reviewee_id', userId)

      if (error) throw error
      if (!data || data.length === 0) {
        return { average: 0, count: 0 }
      }

      const total = data.reduce((sum, row) => sum + row.rating, 0)
      return { average: total / data.length, count: data.length }
    } catch (error) {
      const appError = handleError(error, 'getUserAverageRating')
      console.error('Error getting average rating:', appError)
      return { average: 0, count: 0 }
    }
  }

  static async canUserReview(
    taskId: string,
    reviewerId: string,
    revieweeId: string,
    reviewType: Review['review_type']
  ): Promise<ReviewPermission> {
    try {
      if (reviewerId === revieweeId) {
        return { canReview: false, reason: 'You cannot review yourself' }
      }

      const { data: task, error } = await supabase
        .from('tasks')
        .select('customer_id, tasker_id, status')
        .eq('id', taskId)
        .maybeSingle()

      if (error) throw error
      if (!task) {
        return { canReview: false, reason: 'Task not found' }
      }

      const isCustomer = task.customer_id === reviewerId
      const isTasker = task.tasker_id === reviewerId

      if (reviewType === 'customer_to_tasker') {
        if (!isCustomer) {
          return { canReview: false, reason: 'Only the task customer can leave this review' }
        }
        if (task.tasker_id !== revieweeId) {
          return { canReview: false, reason: 'Selected tasker does not match this task' }
        }
      } else if (reviewType === 'tasker_to_customer') {
        if (!isTasker) {
          return { canReview: false, reason: 'Only the assigned tasker can leave this review' }
        }
        if (task.customer_id !== revieweeId) {
          return { canReview: false, reason: 'Selected customer does not match this task' }
        }
      }

      if (task.status !== 'completed') {
        return { canReview: false, reason: 'You can only review completed tasks' }
      }

      const existing = await this.getReviewByTaskAndUsers(taskId, reviewerId, revieweeId, reviewType)
      if (existing) {
        return { canReview: false, reason: 'You have already reviewed this user for this task' }
      }

      return { canReview: true }
    } catch (error) {
      const appError = handleError(error, 'canUserReview')
      console.error('Error checking review permissions:', appError)
      return { canReview: false, reason: 'Unable to check review permissions' }
    }
  }

  // Create a new rating and review
  static async createRating(ratingData: CreateRatingRequest): Promise<Rating | null> {
    try {
      const { data, error } = await supabase
        .from('ratings')
        .insert([{
          task_id: ratingData.task_id,
          customer_id: ratingData.customer_id,
          technician_id: ratingData.technician_id,
          rating: ratingData.rating,
          review: ratingData.review,
          customer_user_id: ratingData.customer_user_id,
          technician_user_id: ratingData.technician_user_id
        }])
        .select()
        .single()

      if (error) throw error

      return data

    } catch (error) {
      const appError = handleError(error, 'createRating')
      console.error('Error creating rating:', appError)
      return null
    }
  }

  // Get ratings for a specific task
  static async getTaskRatings(taskId: string): Promise<Rating[]> {
    try {
      const { data, error } = await supabase
        .from('ratings')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false })

      if (error) throw error

      return data || []

    } catch (error) {
      const appError = handleError(error, 'getTaskRatings')
      console.error('Error getting task ratings:', appError)
      return []
    }
  }

  // Get ratings for a specific technician
  static async getTechnicianRatings(technicianId: string): Promise<Rating[]> {
    try {
      const { data, error } = await supabase
        .from('ratings')
        .select('*')
        .eq('technician_id', technicianId)
        .order('created_at', { ascending: false })

      if (error) throw error

      return data || []

    } catch (error) {
      const appError = handleError(error, 'getTechnicianRatings')
      console.error('Error getting technician ratings:', appError)
      return []
    }
  }

  // Check if customer has already rated a task
  static async hasCustomerRatedTask(taskId: string, customerUserId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('ratings')
        .select('id')
        .eq('task_id', taskId)
        .eq('customer_user_id', customerUserId)
        .single()

      if (error && error.code !== 'PGRST116') throw error

      return !!data

    } catch (error) {
      const appError = handleError(error, 'hasCustomerRatedTask')
      console.error('Error checking if customer rated task:', appError)
      return false
    }
  }

  // Update task status after rating is submitted (OPTIMIZED VERSION)
  static async updateTaskAfterRating(taskId: string): Promise<boolean> {
    try {
      console.log('🚀 OPTIMIZED RATING COMPLETION - Starting for task:', taskId)
      
      // Get task details
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select('id, title, customer_id, tasker_id, status, final_price, budget')
        .eq('id', taskId)
        .single()

      if (taskError || !task) {
        console.error('❌ Task not found for rating completion:', taskError)
        throw new Error('Task not found')
      }

      console.log('✅ Task validation passed, proceeding with rating completion')

      // Execute all operations in parallel for better performance
      const operations = await Promise.allSettled([
        // 1. Update task status
        supabase
          .from('tasks')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', taskId),

        // 2. Delete chat and messages (non-blocking)
        this.deleteChatForCompletedTask(taskId),

        // 3. Create payment requirement if needed
        this.createPaymentForCompletedTask(task)
      ])

      // Check if the main task update succeeded
      const taskUpdateResult = operations[0]
      if (taskUpdateResult.status === 'rejected') {
        console.error('❌ Failed to update task status after rating:', taskUpdateResult.reason)
        throw taskUpdateResult.reason
      }

      console.log('✅ Task rating completion successful:', taskId)
      return true

    } catch (error) {
      const appError = handleError(error, 'updateTaskAfterRating')
      console.error('❌ Error updating task after rating:', appError)
      return false
    }
  }

  // Helper method to delete chat for completed task (reused from TaskService)
  private static async deleteChatForCompletedTask(taskId: string): Promise<void> {
    try {
      console.log('🗑️ Deleting chat for completed task after rating:', taskId)
      
      // Find chat for this task
      const { data: chat, error: findError } = await supabase
        .from('chats')
        .select('id')
        .eq('task_id', taskId)
        .maybeSingle()

      if (findError) {
        console.error('Error finding chat:', findError)
        return
      }

      if (!chat) {
        console.log('ℹ️ No chat found for task:', taskId)
        return
      }

      // Delete messages and chat in parallel
      const [messagesResult, chatResult] = await Promise.allSettled([
        supabase
          .from('messages_new')
          .delete()
          .eq('chat_id', chat.id),
        supabase
          .from('chats')
          .delete()
          .eq('id', chat.id)
      ])

      if (messagesResult.status === 'rejected') {
        console.error('Error deleting messages:', messagesResult.reason)
      }
      if (chatResult.status === 'rejected') {
        console.error('Error deleting chat:', chatResult.reason)
      }

      if (messagesResult.status === 'fulfilled' && chatResult.status === 'fulfilled') {
        console.log('✅ Chat and messages deleted successfully for task after rating:', taskId)
      }

    } catch (error) {
      console.error('Error in deleteChatForCompletedTask:', error)
    }
  }

  // Helper method to create payment for completed task (reused from TaskService)
  private static async createPaymentForCompletedTask(task: any): Promise<void> {
    try {
      if (!task.tasker_id) {
        console.log('ℹ️ No tasker assigned, skipping payment creation')
        return
      }

      const paymentAmount = task.final_price || task.budget
      if (!paymentAmount) {
        console.log('ℹ️ No payment amount, skipping payment creation')
        return
      }

      console.log('💰 Creating payment requirement for task after rating:', task.id)

      // Import PaymentService dynamically to avoid circular dependencies
      const { PaymentService } = await import('./PaymentService')
      
      await PaymentService.createTaskPayment(
        task.id,
        task.customer_id,
        paymentAmount,
        `Payment for completed task: ${task.title}`
      )

      console.log('✅ Payment requirement created successfully after rating')

    } catch (error) {
      console.error('Error creating payment for completed task after rating:', error)
    }
  }

  // Get average rating for a technician
  static async getTechnicianAverageRating(technicianId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('ratings')
        .select('rating')
        .eq('technician_id', technicianId)

      if (error) throw error

      if (!data || data.length === 0) return 0

      const totalRating = data.reduce((sum, rating) => sum + rating.rating, 0)
      return totalRating / data.length

    } catch (error) {
      const appError = handleError(error, 'getTechnicianAverageRating')
      console.error('Error getting technician average rating:', appError)
      return 0
    }
  }

  // Update technician's profile rating
  static async updateTechnicianProfileRating(technicianId: string): Promise<boolean> {
    try {
      const averageRating = await this.getTechnicianAverageRating(technicianId)
      
      const { error } = await supabase
        .from('profiles')
        .update({
          rating: averageRating,
          updated_at: new Date().toISOString()
        })
        .eq('id', technicianId)

      if (error) throw error

      return true

    } catch (error) {
      const appError = handleError(error, 'updateTechnicianProfileRating')
      console.error('Error updating technician profile rating:', appError)
      return false
    }
  }
}