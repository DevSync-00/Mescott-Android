import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useAuth } from './SimpleAuthContext'
import { ChatService } from '../services/ChatService'
import { RealtimeChatService } from '../services/RealtimeChatService'
import { onChatRead } from '../lib/chat/chatEvents'

type ChatUnreadContextValue = {
  totalUnreadCount: number
  activeChatId: string | null
  setActiveChatId: (chatId: string | null) => void
  refreshTotalUnread: () => Promise<void>
}

const ChatUnreadContext = createContext<ChatUnreadContextValue | undefined>(undefined)

export function ChatUnreadProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth()
  const [totalUnreadCount, setTotalUnreadCount] = useState(0)
  const activeChatIdRef = useRef<string | null>(null)
  const [activeChatId, setActiveChatIdState] = useState<string | null>(null)

  const setActiveChatId = useCallback((chatId: string | null) => {
    activeChatIdRef.current = chatId
    setActiveChatIdState(chatId)
  }, [])

  const refreshTotalUnread = useCallback(async () => {
    if (!user?.id) {
      setTotalUnreadCount(0)
      return
    }
    const total = await ChatService.getTotalUnreadCount(user.id)
    setTotalUnreadCount(total)
  }, [user?.id])

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setTotalUnreadCount(0)
      setActiveChatId(null)
      RealtimeChatService.unsubscribeFromUserInbox()
      return
    }

    refreshTotalUnread().catch(() => {})

    RealtimeChatService.subscribeToUserInbox(user.id, {
      onNewMessage: (row) => {
        const chatId = String(row.chat_id)
        const senderId = String(row.sender_id)
        if (senderId === user.id) return
        if (activeChatIdRef.current === chatId) return
        setTotalUnreadCount((prev) => prev + 1)
      },
      onChatUpdated: () => {
        refreshTotalUnread().catch(() => {})
      },
    }).catch(() => {})

    const readSub = onChatRead(() => {
      refreshTotalUnread().catch(() => {})
    })

    return () => {
      readSub.remove()
      RealtimeChatService.unsubscribeFromUserInbox()
    }
  }, [isAuthenticated, user?.id, refreshTotalUnread, setActiveChatId])

  return (
    <ChatUnreadContext.Provider
      value={{
        totalUnreadCount,
        activeChatId,
        setActiveChatId,
        refreshTotalUnread,
      }}
    >
      {children}
    </ChatUnreadContext.Provider>
  )
}

export function useChatUnread(): ChatUnreadContextValue {
  const ctx = useContext(ChatUnreadContext)
  if (!ctx) {
    throw new Error('useChatUnread must be used within ChatUnreadProvider')
  }
  return ctx
}
