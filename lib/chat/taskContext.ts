import { Colors } from '../../constants/Colors'
import type { Chat } from '../../services/ChatService'

export function getTaskStatusColor(status: string): string {
  switch (status) {
    case 'open':
    case 'draft':
      return Colors.success[500]
    case 'pending':
      return Colors.warning[500]
    case 'assigned':
    case 'in_progress':
      return Colors.primary[500]
    case 'completed':
      return Colors.success[600]
    case 'cancelled':
      return Colors.error[500]
    default:
      return Colors.neutral[500]
  }
}

export function getTaskStatusLabel(status: string): string {
  switch (status) {
    case 'open':
      return 'Open'
    case 'draft':
      return 'Draft'
    case 'pending':
      return 'Pending'
    case 'assigned':
      return 'Assigned'
    case 'in_progress':
      return 'In Progress'
    case 'completed':
      return 'Completed'
    case 'cancelled':
      return 'Cancelled'
    default:
      return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Task'
  }
}

type PreviewInput = Pick<
  Chat,
  'last_message' | 'last_message_text' | 'last_message_sender_id' | 'unread_count'
>

/** List row preview with optional "You:" prefix for the current user's last message. */
export function formatChatListPreview(chat: PreviewInput, currentUserId: string): string {
  const last = chat.last_message
  const type = last?.message_type
  const messageText = last?.message || chat.last_message_text || ''
  const senderId = chat.last_message_sender_id || last?.sender_id
  const isOwn = !!currentUserId && senderId === currentUserId

  let label =
    type === 'image'
      ? '📷 Photo'
      : type === 'file'
        ? `📎 ${messageText.split('/').pop() || 'File'}`
        : type === 'system'
          ? messageText.trim() || 'System update'
          : messageText

  if (!label?.trim()) {
    if ((chat.unread_count || 0) > 0) return 'New message'
    return 'Start a conversation'
  }

  if (type !== 'system' && isOwn) {
    label = `You: ${label}`
  }

  return label.length > 70 ? `${label.slice(0, 70)}…` : label
}
