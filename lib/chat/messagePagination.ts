import type { Message } from '../../services/ChatService'

export const CHAT_MESSAGE_PAGE_SIZE = 30
export const CHAT_INITIAL_MESSAGE_LIMIT = 50

/** True if another page of older messages may exist. */
export function hasMoreChatMessages(fetchedCount: number, pageSize: number): boolean {
  return fetchedCount >= pageSize
}

/**
 * Merge an older page into newest-first Gifted list ids (deduped).
 * `olderPage` is chronological (oldest → newest) from ChatService.
 */
export function mergeOlderMessageIds<T extends { _id: string | number }>(
  currentNewestFirst: T[],
  olderPage: T[],
): T[] {
  const existing = new Set(currentNewestFirst.map((m) => String(m._id)))
  const toAppend: T[] = []
  for (const msg of olderPage) {
    const id = String(msg._id)
    if (!existing.has(id)) {
      existing.add(id)
      toAppend.push(msg)
    }
  }
  return [...currentNewestFirst, ...toAppend]
}

export function countServerMessages(messages: Array<{ _id: string | number }>): number {
  return messages.filter((m) => {
    const id = String(m._id)
    return !id.startsWith('temp-') && !id.startsWith('offline-')
  }).length
}

export function nextMessageOffset(serverMessageCount: number): number {
  return serverMessageCount
}

export type { Message }
