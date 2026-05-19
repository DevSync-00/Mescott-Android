import type { GiftedChatMessage } from './messageMapper'

const LOCAL_ID_PREFIXES = ['temp-', 'offline-']

export function isLocalMessageId(id: string): boolean {
  return LOCAL_ID_PREFIXES.some((prefix) => id.startsWith(prefix))
}

export function sortGiftedMessagesNewestFirst(messages: GiftedChatMessage[]): GiftedChatMessage[] {
  return [...messages].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

/** Keep in-flight / failed local messages when refreshing from server. */
export function mergeGiftedWithLocal(
  serverMessages: GiftedChatMessage[],
  existing: GiftedChatMessage[],
): GiftedChatMessage[] {
  const serverIds = new Set(serverMessages.map((m) => String(m._id)))

  const localOnly = existing.filter((m) => {
    const id = String(m._id)
    if (serverIds.has(id)) return false
    if (m.status === 'failed' || m.status === 'sending' || m.status === 'pending') {
      return true
    }
    return isLocalMessageId(id)
  })

  const merged = [...serverMessages]
  for (const local of localOnly) {
    if (!merged.some((m) => String(m._id) === String(local._id))) {
      merged.push(local)
    }
  }

  return sortGiftedMessagesNewestFirst(merged)
}

/** Replace optimistic temp message with confirmed server message. */
export function replaceOptimisticMessage(
  messages: GiftedChatMessage[],
  tempId: string,
  confirmed: GiftedChatMessage,
): GiftedChatMessage[] {
  const withoutTemp = messages.filter((m) => String(m._id) !== tempId)
  const existingIndex = withoutTemp.findIndex((m) => String(m._id) === String(confirmed._id))

  if (existingIndex >= 0) {
    const next = [...withoutTemp]
    next[existingIndex] = { ...next[existingIndex], ...confirmed, status: 'sent' }
    return sortGiftedMessagesNewestFirst(next)
  }

  return sortGiftedMessagesNewestFirst([confirmed, ...withoutTemp])
}
