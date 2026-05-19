import { supabase } from '../lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { ChatService, Chat, Message } from './ChatService'
import { emitChatInboxChanged } from '../lib/chat/chatEvents'
export type { Chat }

export type InboxRealtimeHandlers = {
  onChatUpdated?: (chat: Record<string, unknown>) => void
  onNewMessage?: (message: Record<string, unknown>) => void
}

export interface RealtimeMessage extends Message {
  sender_name?: string
  sender_avatar?: string
}

type Subscriber = {
  onMessage: (message: RealtimeMessage) => void
  onUserOnline?: (userId: string, isOnline: boolean) => void
  onTyping?: (userId: string, isTyping: boolean) => void
}

export class RealtimeChatService {
  private static channels: Map<string, RealtimeChannel> = new Map()
  private static subscribers: Map<string, Set<Subscriber>> = new Map()
  private static inboxChannel: RealtimeChannel | null = null
  private static inboxUserId: string | null = null
  private static inboxHandlers: InboxRealtimeHandlers = {}
  private static profileCache: Map<
    string,
    { id: string; full_name: string; avatar_url: string | null; phone: string }
  > = new Map()

  // Buffering structures
  private static messageBuffers: Map<string, RealtimeMessage[]> = new Map()
  private static flushTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()
  private static readonly FLUSH_DELAY_MS = 50 // batch window

  // Lightweight profile getter (no await inside listeners)
  private static async fetchProfilesIfMissing(ids: string[]): Promise<void> {
    const missing = ids.filter((id) => id && !this.profileCache.has(id))
    if (missing.length === 0) return
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, phone')
        .in('id', missing)
      for (const p of data || []) {
        this.profileCache.set(p.id, p)
      }
    } catch (e) {
      // silent - caching is best-effort
      console.error('RealtimeChatService: profile fetch error', e)
    }
  }

  // Register subscriber and ensure channel + handler exist
  static async subscribeToChat(
    chatId: string,
    callbacks: {
      onMessage: (message: RealtimeMessage) => void
      onUserOnline?: (userId: string, isOnline: boolean) => void
      onTyping?: (userId: string, isTyping: boolean) => void
    },
  ): Promise<RealtimeChannel | null> {
    try {
      // Add subscriber
      const s: Subscriber = {
        onMessage: callbacks.onMessage,
        onUserOnline: callbacks.onUserOnline,
        onTyping: callbacks.onTyping,
      }
      if (!this.subscribers.has(chatId)) this.subscribers.set(chatId, new Set())
      this.subscribers.get(chatId)!.add(s)

      // If channel already exists, return it (we already have handlers)
      if (this.channels.has(chatId)) {
        return this.channels.get(chatId)!
      }

      // Create channel and set handlers only once per chat
      const channel = supabase
        .channel(`chat:${chatId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages_new',
            filter: `chat_id=eq.${chatId}`,
          },
          (payload) => this.enqueueRealtimeMessage(chatId, payload.new),
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages_new',
            filter: `chat_id=eq.${chatId}`,
          },
          (payload) => this.enqueueRealtimeMessage(chatId, payload.new),
        )
        .on('broadcast', { event: 'typing' }, (payload) => {
          const senderId = payload.payload?.userId as string | undefined
          const isTyping = !!payload.payload?.isTyping
          if (!senderId) return
          const subs = this.subscribers.get(chatId)
          subs?.forEach((sub) => sub.onTyping?.(senderId, isTyping))
        })
        // NOTE: consider separate handlers for presence/online events if you have a table for it
        .subscribe((status) => {
          // keep minimal logging; in production remove entirely or toggle by env
          // console.debug && console.debug('Realtime channel status', chatId, status)
        })

      this.channels.set(chatId, channel)
      return channel
    } catch (error) {
      console.error('RealtimeChatService: subscribeToChat error', error)
      return null
    }
  }

  // Enqueue message into per-chat buffer (non-blocking)
  private static enqueueRealtimeMessage(chatId: string, raw: any) {
    if (!raw) return
    // Convert shape to RealtimeMessage minimal fields - avoid heavy parsing here
    const msg: RealtimeMessage = {
      id: raw.id,
      chat_id: raw.chat_id,
      sender_id: raw.sender_id,
      message: raw.message,
      message_type: raw.message_type,
      is_read: raw.is_read,
      created_at: raw.created_at,
      updated_at: raw.updated_at,
    }
    if (!this.messageBuffers.has(chatId)) this.messageBuffers.set(chatId, [])
    this.messageBuffers.get(chatId)!.push(msg)

    // Schedule flush if not scheduled
    if (!this.flushTimers.has(chatId)) {
      const t = setTimeout(() => {
        this.flushTimers.delete(chatId)
        this.flushBuffer(chatId).catch((e) => {
          // keep errors isolated
          console.error('RealtimeChatService: flush error', e)
        })
      }, this.FLUSH_DELAY_MS)
      this.flushTimers.set(chatId, t)
    }
  }

  // Flush buffer: batch profile fetch + attach + notify subscribers
  private static async flushBuffer(chatId: string) {
    const buffer = this.messageBuffers.get(chatId)
    if (!buffer || buffer.length === 0) return
    // drain buffer atomically
    this.messageBuffers.set(chatId, [])
    const messages = buffer.splice(0, buffer.length)

    // Collect senderIds and fetch missing profiles once
    const senderIds = Array.from(new Set(messages.map((m) => m.sender_id).filter(Boolean)))
    await this.fetchProfilesIfMissing(senderIds)

    // Attach cached profiles
    const enriched: RealtimeMessage[] = messages.map((m) => {
      const profile = this.profileCache.get(m.sender_id)
      return {
        ...m,
        sender: profile,
      }
    })

    // Dispatch to all subscribers for this chat
    const subs = this.subscribers.get(chatId)
    if (subs && subs.size > 0) {
      // Notify subscribers synchronously but do not await anything here
      for (const sub of subs) {
        try {
          // deliver messages one-by-one or in batch depending on subscriber expectations
          for (const em of enriched) {
            sub.onMessage(em)
          }
        } catch (e) {
          // keep individual subscriber errors isolated
          console.error('RealtimeChatService: subscriber error', e)
        }
      }
    } else {
      // No active subscribers — optionally keep minimal caching (we already cache messages in ChatService)
    }
  }

  // Unsubscribe a single subscriber for a chat
  static unsubscribeFromChat(
    chatId: string,
    callbacks?: {
      onMessage?: (message: RealtimeMessage) => void
      onUserOnline?: (userId: string, isOnline: boolean) => void
      onTyping?: (userId: string, isTyping: boolean) => void
    },
  ): void {
    const subs = this.subscribers.get(chatId)
    if (!subs) return

    if (callbacks && callbacks.onMessage) {
      // remove matching subscriber(s) by comparing function reference
      for (const s of Array.from(subs)) {
        if (s.onMessage === callbacks.onMessage) subs.delete(s)
      }
    } else {
      // remove all subscribers for this chat
      subs.clear()
    }

    // If no more subscribers, tear down the channel to conserve resources
    if (subs.size === 0) {
      const channel = this.channels.get(chatId)
      if (channel) {
        try {
          supabase.removeChannel(channel)
        } catch (e) {
          // ignore removal errors
        }
      }
      this.channels.delete(chatId)
      this.subscribers.delete(chatId)
      // clear buffers/timers
      const t = this.flushTimers.get(chatId)
      if (t) {
        clearTimeout(t)
        this.flushTimers.delete(chatId)
      }
      this.messageBuffers.delete(chatId)
    }
  }

  /** Live updates for the messages list (chat row updates + new messages). */
  static async subscribeToUserInbox(
    userId: string,
    handlers: InboxRealtimeHandlers,
  ): Promise<void> {
    this.inboxHandlers = handlers

    if (this.inboxChannel && this.inboxUserId === userId) {
      return
    }

    if (this.inboxChannel) {
      try {
        await supabase.removeChannel(this.inboxChannel)
      } catch {
        // ignore
      }
      this.inboxChannel = null
    }

    this.inboxUserId = userId

    const dispatchChatUpdated = (row: Record<string, unknown>) => {
      if (!row?.id) return
      handlers.onChatUpdated?.(row)
      emitChatInboxChanged({
        type: 'chat_updated',
        chat: {
          id: String(row.id),
          last_message_at: row.last_message_at as string | null | undefined,
          last_message_text: row.last_message_text as string | null | undefined,
          last_message_sender_id: row.last_message_sender_id as string | null | undefined,
          updated_at: row.updated_at as string | undefined,
        },
      })
    }

    const dispatchNewMessage = (row: Record<string, unknown>) => {
      if (!row?.chat_id || !row?.sender_id) return
      handlers.onNewMessage?.(row)
      emitChatInboxChanged({
        type: 'new_message',
        chatId: String(row.chat_id),
        senderId: String(row.sender_id),
        message: String(row.message ?? ''),
        messageType: String(row.message_type ?? 'text'),
        createdAt: String(row.created_at ?? new Date().toISOString()),
      })
    }

    this.inboxChannel = supabase
      .channel(`inbox:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chats',
          filter: `customer_id=eq.${userId}`,
        },
        (payload) => dispatchChatUpdated(payload.new as Record<string, unknown>),
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chats',
          filter: `tasker_id=eq.${userId}`,
        },
        (payload) => dispatchChatUpdated(payload.new as Record<string, unknown>),
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages_new',
        },
        (payload) => dispatchNewMessage(payload.new as Record<string, unknown>),
      )
      .subscribe()
  }

  static unsubscribeFromUserInbox(): void {
    if (this.inboxChannel) {
      try {
        supabase.removeChannel(this.inboxChannel)
      } catch {
        // ignore
      }
    }
    this.inboxChannel = null
    this.inboxUserId = null
    this.inboxHandlers = {}
  }

  // Unsubscribe all chats
  static unsubscribeFromAllChats(): void {
    for (const channel of this.channels.values()) {
      try {
        supabase.removeChannel(channel)
      } catch (e) {}
    }
    this.channels.clear()
    this.subscribers.clear()
    // clear buffers and timers
    for (const t of this.flushTimers.values()) clearTimeout(t)
    this.flushTimers.clear()
    this.messageBuffers.clear()
    this.unsubscribeFromUserInbox()
  }

  // Lightweight wrappers that delegate to ChatService (unchanged)
  static async sendMessage(
    chatId: string,
    senderId: string,
    content: string,
    messageType: 'text' | 'image' | 'file' = 'text',
  ): Promise<boolean> {
    try {
      const message = await ChatService.sendMessage(chatId, senderId, content, messageType)
      return message !== null
    } catch (error) {
      console.error('RealtimeChatService: sendMessage error', error)
      return false
    }
  }

  static async markMessagesAsRead(chatId: string, userId: string): Promise<boolean> {
    try {
      return await ChatService.markMessagesAsRead(chatId, userId)
    } catch (error) {
      console.error('RealtimeChatService: markMessagesAsRead error', error)
      return false
    }
  }

  static async getUnreadCount(chatId: string, userId: string): Promise<number> {
    try {
      return await ChatService.getUnreadCount(chatId, userId)
    } catch (error) {
      console.error('RealtimeChatService: getUnreadCount error', error)
      return 0
    }
  }

  static async getAllUnreadCounts(userId: string): Promise<Map<string, number>> {
    try {
      return await ChatService.getAllUnreadCounts(userId)
    } catch (error) {
      console.error('RealtimeChatService: getAllUnreadCounts error', error)
      return new Map()
    }
  }

  static async getTotalUnreadCount(userId: string): Promise<number> {
    try {
      return await ChatService.getTotalUnreadCount(userId)
    } catch (error) {
      console.error('RealtimeChatService: getTotalUnreadCount error', error)
      return 0
    }
  }

  static async getChatMessages(
    chatId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<RealtimeMessage[]> {
    try {
      const messages = await ChatService.getChatMessages(chatId, limit, offset)
      return messages as RealtimeMessage[]
    } catch (error) {
      console.error('RealtimeChatService: getChatMessages error', error)
      return []
    }
  }

  static async getUserChats(userId: string): Promise<Chat[]> {
    try {
      return await ChatService.getUserChats(userId)
    } catch (error) {
      console.error('RealtimeChatService: getUserChats error', error)
      return []
    }
  }

  static async getOrCreateChat(
    taskId: string,
    customerId: string,
    taskerId: string,
  ): Promise<Chat | null> {
    try {
      return await ChatService.getOrCreateChat(taskId, customerId, taskerId)
    } catch (error) {
      console.error('RealtimeChatService: getOrCreateChat error', error)
      return null
    }
  }

  static async updateChatLastMessage(
    chatId: string,
    messageText: string,
    senderId: string,
  ): Promise<boolean> {
    try {
      return await ChatService.updateChatLastMessage(chatId, messageText, senderId)
    } catch (error) {
      console.error('RealtimeChatService: updateChatLastMessage error', error)
      return false
    }
  }

  static async deleteMessage(messageId: string, senderId: string): Promise<boolean> {
    try {
      return await ChatService.deleteMessage(messageId, senderId)
    } catch (error) {
      console.error('RealtimeChatService: deleteMessage error', error)
      return false
    }
  }

  static async getChatById(chatId: string): Promise<Chat | null> {
    try {
      return await ChatService.getChatById(chatId)
    } catch (error) {
      console.error('RealtimeChatService: getChatById error', error)
      return null
    }
  }

  // Typing indicator broadcast (best-effort, non-persistent)
  static async sendTyping(chatId: string, userId: string, isTyping: boolean): Promise<boolean> {
    try {
      // Ensure channel exists so broadcast has a target
      let channel = this.channels.get(chatId)
      if (!channel) {
        channel = await this.subscribeToChat(chatId, {
          onMessage: () => {},
        })
      }
      if (!channel) return false
      const res = await channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId, isTyping },
      })
      return res === 'ok'
    } catch (error) {
      console.error('RealtimeChatService: sendTyping error', error)
      return false
    }
  }
}
