import { supabase } from '../lib/supabase'
import { getCache, setCache } from '../lib/cache'
import { getIsOnline } from '../lib/connectivity'
import { useAppStore } from '../state/store'
import { NotificationService } from './NotificationService'
import { UnifiedNotificationService } from './UnifiedNotificationService'
import uuid from 'react-native-uuid'

export interface Chat {
  id: string
  task_id: string
  customer_id: string
  tasker_id: string
  last_message_at: string | null
  last_message_text: string | null
  last_message_sender_id: string | null
  created_at: string
  updated_at: string
  // Populated fields
  task?: {
    id: string
    title: string
    status: string
  }
  customer?: {
    id: string
    full_name: string
    avatar_url: string | null
    phone: string
  }
  tasker?: {
    id: string
    full_name: string
    avatar_url: string | null
    phone: string
  }
  last_message?: Message
  unread_count?: number
}

export interface Message {
  id: string
  chat_id: string
  sender_id: string
  message: string
  message_type: 'text' | 'image' | 'file' | 'system'
  is_read: boolean
  created_at: string
  updated_at: string
  // Populated fields
  sender?: {
    id: string
    full_name: string
    avatar_url: string | null
    phone: string
  }
}

export class ChatService {
  // In-memory caches to avoid redundant network calls.
  // NOTE: This resets on app restart; for persistence, consider MMKV/AsyncStorage.
  private static profileCache: Map<
    string,
    { id: string; full_name: string; avatar_url: string | null; phone: string }
  > = new Map()
  private static messageCache: Map<string, Message[]> = new Map()

  // Cache for user chats
  private static userChatsCache: Map<string, { chats: Chat[]; timestamp: number }> = new Map()
  private static readonly CHATS_CACHE_TTL = 30000 // 30 seconds
  private static readonly CHATS_PERSIST_TTL = 5 * 60 * 1000 // 5 minutes for offline reads
  private static readonly MESSAGES_PERSIST_TTL = 10 * 60 * 1000 // 10 minutes

  // Get all chats for a user
  static async getUserChats(userId: string, forceRefresh: boolean = false): Promise<Chat[]> {
    try {
      // Check cache first
      const cached = this.userChatsCache.get(userId)
      const now = Date.now()
      if (!forceRefresh && cached && now - cached.timestamp < this.CHATS_CACHE_TTL) {
        return cached.chats
      }

      // Check persistent cache (longer TTL) for offline/fast load
      if (!forceRefresh) {
        const persisted = await getCache<Chat[]>(`chat:list:${userId}`)
        if (persisted && persisted.length > 0) {
          this.userChatsCache.set(userId, { chats: persisted, timestamp: now })
          return persisted
        }
      }

      const { data, error } = await supabase
        .from('chats')
        .select(
          `
          id,
          task_id,
          customer_id,
          tasker_id,
          last_message_at,
          last_message_text,
          last_message_sender_id,
          created_at,
          updated_at,
          task:task_id (
            id,
            title,
            status
          ),
          customer:customer_id (
            id,
            full_name,
            avatar_url,
            phone
          ),
          tasker:tasker_id (
            id,
            full_name,
            avatar_url,
            phone
          )
        `,
        )
        .or(`customer_id.eq.${userId},tasker_id.eq.${userId}`)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(50) // Limit initial load for faster response

      if (error) {
        throw error
      }

      const chats = (data || []).map((c: any) => ({
        ...c,
        // Convert relation arrays to single objects
        task: Array.isArray(c.task) ? c.task[0] : c.task,
        customer: Array.isArray(c.customer) ? c.customer[0] : c.customer,
        tasker: Array.isArray(c.tasker) ? c.tasker[0] : c.tasker,
      }))

      // Fetch all unread counts in parallel for better performance
      const unreadPromise = this.getAllUnreadCounts(userId)

      // Pre-calculate timestamps to avoid repeated Date parsing
      const chatsWithTime = chats.map((c) => ({
        chat: c,
        time: c.last_message_at
          ? new Date(c.last_message_at).getTime()
          : c.updated_at
            ? new Date(c.updated_at).getTime()
            : c.created_at
              ? new Date(c.created_at).getTime()
              : 0,
      }))

      // Sort by pre-calculated time
      chatsWithTime.sort((a, b) => b.time - a.time)

      // Wait for unread counts
      const unreadMap = await unreadPromise

      // Map unread counts efficiently
      const sortedChats = chatsWithTime.map(({ chat }) => ({
        ...chat,
        unread_count: unreadMap.get(chat.id) || 0,
      })) as Chat[]

      // Cache the result
      this.userChatsCache.set(userId, { chats: sortedChats, timestamp: now })
      setCache(`chat:list:${userId}`, sortedChats, this.CHATS_PERSIST_TTL).catch(() => {})

      return sortedChats
    } catch (error) {
      console.error('Error getting user chats:', error)
      // Return cached version on error if available
      const cached = this.userChatsCache.get(userId)
      if (cached?.chats?.length) return cached.chats
      const persisted = await getCache<Chat[]>(`chat:list:${userId}`)
      return persisted || []
    }
  }

  // Get or create a chat for a task
  static async getOrCreateChat(
    taskId: string,
    customerId: string,
    taskerId: string,
  ): Promise<Chat | null> {
    try {
      // First, try to find existing chat
      const { data: existingChat, error: findError } = await supabase
        .from('chats')
        .select(
          `
          *,
          task:task_id (
            id,
            title,
            status
          ),
          customer:customer_id (
            id,
            full_name,
            avatar_url,
            phone
          ),
          tasker:tasker_id (
            id,
            full_name,
            avatar_url,
            phone
          )
        `,
        )
        .eq('task_id', taskId)
        .eq('customer_id', customerId)
        .eq('tasker_id', taskerId)
        .single()

      if (existingChat && !findError) {
        return existingChat
      }

      // Create new chat if it doesn't exist
      const { data: newChat, error: createError } = await supabase
        .from('chats')
        .insert({
          task_id: taskId,
          customer_id: customerId,
          tasker_id: taskerId,
        })
        .select(
          `
          *,
          task:task_id (
            id,
            title,
            status
          ),
          customer:customer_id (
            id,
            full_name,
            avatar_url,
            phone
          ),
          tasker:tasker_id (
            id,
            full_name,
            avatar_url,
            phone
          )
        `,
        )
        .single()

      if (createError) {
        throw createError
      }

      return newChat
    } catch (error) {
      console.error('Error in getOrCreateChat:', error)
      return null
    }
  }

  // Get messages for a chat
  static async getChatMessages(
    chatId: string,
    limit: number = 30,
    offset: number = 0,
  ): Promise<Message[]> {
    try {
      // Check cache first for instant load
      const cached =
        this.messageCache.get(chatId) || (await getCache<Message[]>(`chat:messages:${chatId}`))

      const { data, error } = await supabase
        .from('messages_new')
        // Select only essential fields for faster query
        .select('id, chat_id, sender_id, message, message_type, is_read, created_at, updated_at')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) throw error

      const messages = (data || []) as Message[]

      // Attach sender details using profile cache with a single fetch for missing profiles
      const uniqueSenderIds = Array.from(new Set(messages.map((m) => m.sender_id)))
      const missingSenderIds = uniqueSenderIds.filter((id) => !this.profileCache.has(id))

      if (missingSenderIds.length > 0) {
        // Batch fetch missing profiles
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, phone')
          .in('id', missingSenderIds)

        for (const p of profilesData || []) {
          this.profileCache.set(p.id, p)
        }
      }

      // Use a faster map approach
      const messagesWithSenders = messages.map((m) => ({
        ...m,
        sender: this.profileCache.get(m.sender_id) || undefined,
      }))

      // Update cache (store oldest-first for render ordering)
      const ordered = [...messagesWithSenders].reverse()
      this.messageCache.set(chatId, ordered)
      setCache(`chat:messages:${chatId}`, ordered, this.MESSAGES_PERSIST_TTL).catch(() => {})
      return ordered
    } catch (error) {
      console.error('Error getting chat messages:', error)
      // Return cached version on error
      const cached = this.messageCache.get(chatId)
      if (cached?.length) return cached
      const persisted = await getCache<Message[]>(`chat:messages:${chatId}`)
      return persisted || []
    }
  }

  // Return cached messages instantly if available; network refresh runs in background.
  static async getChatMessagesFast(
    chatId: string,
    limit: number = 30,
    offset: number = 0,
  ): Promise<{ cached: Message[]; fresh: Promise<Message[]> }> {
    const cached =
      this.messageCache.get(chatId) || (await getCache<Message[]>(`chat:messages:${chatId}`)) || []
    // Start fetching fresh messages immediately (non-blocking)
    const fresh = this.getChatMessages(chatId, limit, offset)
    return { cached, fresh }
  }

  // Preload messages for a chat (call this when user is on chats list)
  static async preloadChatMessages(chatId: string, limit: number = 30): Promise<void> {
    // Only preload if not already cached
    if (!this.messageCache.has(chatId)) {
      this.getChatMessages(chatId, limit, 0).catch(() => {
        // Silently fail - preloading is optional
      })
    }
  }

  // Send a message with offline-aware behavior
  static async sendMessage(
    chatId: string,
    senderId: string,
    content: string,
    messageType: 'text' | 'image' | 'file' = 'text',
  ): Promise<Message | null> {
    const online = getIsOnline()

    // Optimistic update if offline
    if (!online) {
      const optimistic: Message = {
        id: `offline-${uuid.v4()}`,
        chat_id: chatId,
        sender_id: senderId,
        message: content,
        message_type: messageType,
        is_read: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sender: this.profileCache.get(senderId),
      }

      const persisted = await getCache<Message[]>(`chat:messages:${chatId}`)
      const existingMessages = this.messageCache.get(chatId) || persisted || []
      const updatedMessages = [...existingMessages, optimistic]
      this.messageCache.set(chatId, updatedMessages)
      setCache(`chat:messages:${chatId}`, updatedMessages, this.MESSAGES_PERSIST_TTL).catch(
        () => {},
      )

      useAppStore.getState().enqueueOfflineAction({
        type: 'chat:send',
        payload: { chatId, senderId, content, messageType },
      })
      return optimistic
    }

    return this.sendMessageOnline(chatId, senderId, content, messageType)
  }

  private static async sendMessageOnline(
    chatId: string,
    senderId: string,
    content: string,
    messageType: 'text' | 'image' | 'file' = 'text',
  ): Promise<Message | null> {
    try {
      const { data, error } = await supabase
        .from('messages_new')
        .insert({
          chat_id: chatId,
          sender_id: senderId,
          message: content,
          message_type: messageType,
        })
        .select('*')
        .single()

      if (error) {
        throw error
      }

      // Attach sender from cache or fetch once and cache
      let senderData = this.profileCache.get(senderId)
      if (!senderData) {
        const { data: fetched } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, phone')
          .eq('id', senderId)
          .single()
        if (fetched) {
          this.profileCache.set(fetched.id, fetched)
          senderData = fetched
        }
      }

      const messageWithSender = {
        ...data,
        sender: senderData,
      }

      // Update in-memory and persistent caches for instant UI reflection/offline read
      const persisted = await getCache<Message[]>(`chat:messages:${chatId}`)
      const existingMessages = this.messageCache.get(chatId) || persisted || []
      const updatedMessages = [...existingMessages, messageWithSender]
      this.messageCache.set(chatId, updatedMessages)
      setCache(`chat:messages:${chatId}`, updatedMessages, this.MESSAGES_PERSIST_TTL).catch(
        () => {},
      )

      // Update chat's last message info
      await this.updateChatLastMessage(chatId, content, senderId)

      // Send notification to the other participant
      try {
        // Get chat details to find the other participant
        const { data: chatData } = await supabase
          .from('chats')
          .select('customer_id, tasker_id, task_id')
          .eq('id', chatId)
          .single()

        if (chatData) {
          const receiverId =
            chatData.customer_id === senderId ? chatData.tasker_id : chatData.customer_id

          if (receiverId) {
            // Get sender name for notification
            const senderName = messageWithSender.sender?.full_name || 'Unknown'

            await NotificationService.notifyNewMessage(
              chatId,
              senderId,
              receiverId,
              content,
              senderName,
            )
          }
        }
      } catch (notificationError) {
        console.error('Error sending message notification:', notificationError)
        // Don't throw here - message should be sent even if notification fails
      }

      return messageWithSender
    } catch (error) {
      console.error('Error sending message:', error)
      return null
    }
  }

  // Process queued offline message send
  static async processQueuedMessage(payload: {
    chatId: string
    senderId: string
    content: string
    messageType?: 'text' | 'image' | 'file'
  }) {
    return this.sendMessageOnline(
      payload.chatId,
      payload.senderId,
      payload.content,
      payload.messageType || 'text',
    )
  }

  // Mark messages as read
  static async markMessagesAsRead(chatId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('messages_new')
        .update({
          is_read: true,
        })
        .eq('chat_id', chatId)
        .eq('is_read', false)
        .neq('sender_id', userId) // Don't mark own messages as read

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error marking messages as read:', error)
      return false
    }
  }

  // Get unread count for a chat
  static async getUnreadCount(chatId: string, userId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('messages_new')
        .select('*', { count: 'exact', head: true })
        .eq('chat_id', chatId)
        .eq('is_read', false)
        .neq('sender_id', userId)

      if (error) throw error
      return count || 0
    } catch (error) {
      console.error('Error getting unread count:', error)
      return 0
    }
  }

  // Batched unread counts for all chats the user is part of.
  static async getAllUnreadCounts(userId: string): Promise<Map<string, number>> {
    try {
      // Prefer server-side aggregation via RPC for performance on large datasets
      const { data, error } = await supabase.rpc('get_unread_counts', { in_user_id: userId })
      if (!error && Array.isArray(data)) {
        const map = new Map<string, number>()
        for (const row of data as Array<{ chat_id: string; unread_count: number }>) {
          map.set(row.chat_id, row.unread_count)
        }
        return map
      }
    } catch (e) {
      // Fallback below
    }

    // Fallback: fetch chat ids then one grouped query (less optimal, but keeps correctness)
    try {
      const { data: chats } = await supabase
        .from('chats')
        .select('id')
        .or(`customer_id.eq.${userId},tasker_id.eq.${userId}`)

      const chatIds = (chats || []).map((c) => c.id)
      const result = new Map<string, number>()
      if (chatIds.length === 0) return result

      // Query unread messages for these chats; client-group since PostgREST group-by aliases are limited
      const { data: unread } = await supabase
        .from('messages_new')
        .select('chat_id')
        .in('chat_id', chatIds)
        .eq('is_read', false)
        .neq('sender_id', userId)

      for (const row of unread || []) {
        result.set(row.chat_id, (result.get(row.chat_id) || 0) + 1)
      }
      return result
    } catch (error) {
      console.error('Error getting all unread counts (fallback):', error)
      return new Map()
    }
  }

  // Get total unread count for user
  static async getTotalUnreadCount(userId: string): Promise<number> {
    try {
      const unreadMap = await this.getAllUnreadCounts(userId)
      let total = 0
      unreadMap.forEach((v) => {
        total += v
      })
      return total
    } catch (error) {
      console.error('Error getting total unread count:', error)
      return 0
    }
  }

  // Update chat last message info
  static async updateChatLastMessage(
    chatId: string,
    messageText: string,
    senderId: string,
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('chats')
        .update({
          last_message_at: new Date().toISOString(),
          last_message_text: messageText,
          last_message_sender_id: senderId,
        })
        .eq('id', chatId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error updating chat last message:', error)
      return false
    }
  }

  // Delete a message (only sender can delete)
  static async deleteMessage(messageId: string, senderId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('messages_new')
        .delete()
        .eq('id', messageId)
        .eq('sender_id', senderId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error deleting message:', error)
      return false
    }
  }

  // Get chat by ID
  static async getChatById(chatId: string): Promise<Chat | null> {
    try {
      const { data, error } = await supabase
        .from('chats')
        .select(
          `
          *,
          task:task_id (
            id,
            title,
            status
          ),
          customer:customer_id (
            id,
            full_name,
            avatar_url,
            phone
          ),
          tasker:tasker_id (
            id,
            full_name,
            avatar_url,
            phone
          )
        `,
        )
        .eq('id', chatId)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error getting chat by ID:', error)
      return null
    }
  }

  // Get chat messages by chat ID (alias for getChatMessages)
  static async getChatMessagesByChatId(
    chatId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<Message[]> {
    return this.getChatMessages(chatId, limit, offset)
  }

  // Subscribe to chat for real-time updates (delegate to RealtimeChatService)
  static async subscribeToChat(
    chatId: string,
    callbacks: {
      onMessage: (message: any) => void
      onTyping?: (userId: string, isTyping: boolean) => void
      onUserOnline?: (userId: string, isOnline: boolean) => void
    },
  ): Promise<any> {
    const { RealtimeChatService } = await import('./RealtimeChatService')
    return RealtimeChatService.subscribeToChat(chatId, callbacks)
  }

  // Unsubscribe from chat (delegate to RealtimeChatService)
  static unsubscribeFromChat(chatId: string): void {
    // This will be handled by RealtimeChatService
    const { RealtimeChatService } = require('./RealtimeChatService')
    RealtimeChatService.unsubscribeFromChat(chatId)
  }

  // Send message to chat (alias for sendMessage)
  static async sendMessageToChat(
    chatId: string,
    messageText: string,
    senderId: string,
  ): Promise<boolean> {
    const message = await this.sendMessage(chatId, senderId, messageText)
    return message !== null
  }

  // Delete chat and all messages (used when task is completed)
  static async deleteChatAndMessages(chatId: string, userId?: string): Promise<boolean> {
    try {
      // First, delete all messages in the chat
      const { error: messagesError } = await supabase
        .from('messages_new')
        .delete()
        .eq('chat_id', chatId)

      if (messagesError) {
        throw messagesError
      }

      // Then, delete the chat itself
      const query = supabase.from('chats').delete().eq('id', chatId)

      // Respect RLS: only allow participants to delete
      // If userId provided, scope delete to chats where the user is a participant
      if (userId) {
        // PostgREST .or applies to the whole filter; keep id filter and add participant guard
        // The id filter is already applied; .or will not remove it
        // This helps satisfy typical RLS policies
        // @ts-ignore - chaining .or after .eq is allowed
        query.or(`customer_id.eq.${userId},tasker_id.eq.${userId}`)
      }

      const { error: chatError } = await query

      if (chatError) {
        throw chatError
      }

      return true
    } catch (error) {
      console.error('Error deleting chat and messages:', error)
      return false
    }
  }

  // Delete chat by task ID (used when task is completed)
  static async deleteChatByTaskId(taskId: string): Promise<boolean> {
    try {
      // First, find the chat for this task
      const { data: chat, error: findError } = await supabase
        .from('chats')
        .select('id')
        .eq('task_id', taskId)
        .single()

      if (findError) {
        return true // No chat to delete, consider it successful
      }

      if (!chat) {
        return true // No chat to delete, consider it successful
      }

      // Delete the chat and all its messages
      return await this.deleteChatAndMessages(chat.id)
    } catch (error) {
      console.error('Error deleting chat by task ID:', error)
      return false
    }
  }
}
