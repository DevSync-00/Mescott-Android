/** Shared accessibility copy for the production chat UI. */

export function buildConversationRowLabel(options: {
  participantName: string
  lastMessage: string
  unreadCount: number
  taskTitle?: string | null
}): string {
  const { participantName, lastMessage, unreadCount, taskTitle } = options
  const parts = [participantName, lastMessage]
  if (taskTitle?.trim()) {
    parts.push(`Task: ${taskTitle.trim()}`)
  }
  if (unreadCount > 0) {
    parts.push(`${unreadCount > 99 ? '99 plus' : unreadCount} unread messages`)
  }
  return parts.join('. ')
}

export const CHAT_LIST_ROW_HINT =
  'Opens the conversation. Long press to delete with confirmation and undo.'

export const CHAT_SEARCH_LABEL = 'Search conversations'

export const CHAT_ATTACH_HINT = 'Opens menu to attach a photo or document'

export const CHAT_SEND_HINT = 'Sends your message'

export const CHAT_SCROLL_BOTTOM_LABEL = 'Scroll to latest messages'

export const CHAT_MESSAGE_IMAGE_LABEL = 'View image full screen'

export const CHAT_RETRY_MESSAGE_HINT = 'Retries sending this message'
