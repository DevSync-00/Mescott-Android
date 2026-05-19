import { DeviceEventEmitter } from 'react-native'

export const CHAT_EVENTS = {
  READ: 'chat:read',
  INBOX_CHANGED: 'chat:inbox-changed',
} as const

export type ChatReadPayload = {
  chatId: string
}

export type ChatInboxChangedPayload =
  | { type: 'read'; chatId: string }
  | {
      type: 'chat_updated'
      chat: {
        id: string
        last_message_at?: string | null
        last_message_text?: string | null
        last_message_sender_id?: string | null
        updated_at?: string
      }
    }
  | {
      type: 'new_message'
      chatId: string
      senderId: string
      message: string
      messageType: string
      createdAt: string
    }

export function emitChatRead(chatId: string): void {
  DeviceEventEmitter.emit(CHAT_EVENTS.READ, { chatId } satisfies ChatReadPayload)
  DeviceEventEmitter.emit(CHAT_EVENTS.INBOX_CHANGED, {
    type: 'read',
    chatId,
  } satisfies ChatInboxChangedPayload)
}

export function emitChatInboxChanged(payload: ChatInboxChangedPayload): void {
  DeviceEventEmitter.emit(CHAT_EVENTS.INBOX_CHANGED, payload)
}

export function onChatRead(listener: (payload: ChatReadPayload) => void) {
  return DeviceEventEmitter.addListener(CHAT_EVENTS.READ, listener)
}

export function onChatInboxChanged(listener: (payload: ChatInboxChangedPayload) => void) {
  return DeviceEventEmitter.addListener(CHAT_EVENTS.INBOX_CHANGED, listener)
}
