import type { Message } from '../../services/ChatService'

export type MessageDeliveryStatus = 'sending' | 'pending' | 'sent' | 'read' | 'failed'

export type GiftedChatMessage = {
  _id: string
  text: string
  createdAt: Date
  user: { _id: string; name?: string; avatar?: string | null }
  image?: string
  fileUrl?: string
  system?: boolean
  status?: MessageDeliveryStatus
  pendingPayload?: {
    text?: string
    image?: string
    fileUrl?: string
    messageType: 'text' | 'image' | 'file'
  }
}

export type MapToGiftedOptions = {
  userId: string
  participantName?: string
  statusOverride?: MessageDeliveryStatus
  pendingPayload?: GiftedChatMessage['pendingPayload']
}

export function getDeliveryStatus(
  msg: Pick<Message, 'id' | 'sender_id' | 'is_read'>,
  userId: string,
  override?: MessageDeliveryStatus,
): MessageDeliveryStatus {
  if (override) return override
  const id = String(msg.id)
  if (id.startsWith('offline-')) return 'pending'
  if (msg.sender_id !== userId) return 'sent'
  return msg.is_read ? 'read' : 'sent'
}

export function mapMessageToGifted(
  msg: Message,
  options: MapToGiftedOptions,
): GiftedChatMessage {
  if (msg.message_type === 'system') {
    return {
      _id: msg.id,
      text: msg.message || '',
      createdAt: new Date(msg.created_at),
      system: true,
      user: { _id: 'system', name: 'Mescott' },
    }
  }

  const status = getDeliveryStatus(msg, options.userId, options.statusOverride)

  return {
    _id: msg.id,
    text:
      msg.message_type === 'file'
        ? '📎 ' + (msg.message?.split('/').pop() || 'File')
        : msg.message_type === 'image'
          ? ''
          : msg.message || '',
    createdAt: new Date(msg.created_at),
    user: {
      _id: msg.sender_id,
      name: msg.sender?.full_name || options.participantName || 'User',
      avatar: msg.sender?.avatar_url || undefined,
    },
    image: msg.message_type === 'image' ? msg.message : undefined,
    fileUrl: msg.message_type === 'file' ? msg.message : undefined,
    status,
    pendingPayload: options.pendingPayload,
  }
}

export function buildPendingPayload(message: GiftedChatMessage): GiftedChatMessage['pendingPayload'] {
  const messageType = message.image ? 'image' : message.fileUrl ? 'file' : 'text'
  return {
    text: message.text,
    image: message.image,
    fileUrl: message.fileUrl,
    messageType,
  }
}

export function giftedFromOutgoingDraft(
  draft: GiftedChatMessage,
  status: MessageDeliveryStatus = 'sending',
): GiftedChatMessage {
  return {
    ...draft,
    status,
    pendingPayload: buildPendingPayload(draft),
  }
}
