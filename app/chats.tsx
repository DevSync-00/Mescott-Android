import React, { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  StatusBar,
  Platform,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useFocusEffect } from 'expo-router'
import { useAuth } from '../contexts/SimpleAuthContext'
import { useToast } from '../contexts/ToastContext'
import { ChatService, Chat, Message } from '../services/ChatService'
import { useChatUnread } from '../contexts/ChatUnreadContext'
import {
  onChatInboxChanged,
  type ChatInboxChangedPayload,
} from '../lib/chat/chatEvents'
import { Colors } from '../constants/Colors'
import { SkeletonList } from '../components/SkeletonLoader'
import { showConfirmation } from '../utils/alertHelper'
import TextureBackground from '../components/TextureBackground'
import {
  formatChatListPreview,
  getTaskStatusColor,
  getTaskStatusLabel,
} from '../lib/chat/taskContext'
import ChatsFilterBar, { type ChatsInboxFilter } from '../components/chat/ChatsFilterBar'
import ChatsEmptyState from '../components/chat/ChatsEmptyState'

export default function Chats() {
  const { isAuthenticated, isLoading, user } = useAuth()
  const { showToast, showError } = useToast()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [chats, setChats] = useState<Chat[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [inboxFilter, setInboxFilter] = useState<ChatsInboxFilter>('all')
  const { activeChatId, refreshTotalUnread, totalUnreadCount } = useChatUnread()
  const pendingDeleteRef = useRef<{
    chat: Chat
    timeoutId: ReturnType<typeof setTimeout>
  } | null>(null)

  const isTasker = user?.current_mode === 'tasker'

  // Cache timestamp calculations for better performance
  const timestampCache = useRef<Map<string, number>>(new Map())
  const getTimestamp = useCallback((chat: Chat) => {
    const key = chat.id
    if (!timestampCache.current.has(key)) {
      const ts = chat.last_message_at
        ? new Date(chat.last_message_at).getTime()
        : chat.updated_at
          ? new Date(chat.updated_at).getTime()
          : chat.created_at
            ? new Date(chat.created_at).getTime()
            : 0
      timestampCache.current.set(key, ts)
    }
    return timestampCache.current.get(key) || 0
  }, [])

  const sortChatsByActivity = useCallback(
    (list: Chat[]) => [...list].sort((a, b) => getTimestamp(b) - getTimestamp(a)),
    [getTimestamp],
  )

  const loadChats = useCallback(
    async (forceRefresh = false) => {
      if (!user?.id) return

      try {
        if (chats.length === 0) {
          setLoading(true)
        }
        const userChats = await ChatService.getUserChats(user.id, forceRefresh)
        setChats(sortChatsByActivity(userChats))
      } catch (error) {
        console.error('Error loading chats:', error)
      } finally {
        setLoading(false)
      }
    },
    [user, chats.length, sortChatsByActivity],
  )

  const applyInboxChange = useCallback(
    (payload: ChatInboxChangedPayload) => {
      if (payload.type === 'read') {
        setChats((prev) =>
          prev.map((c) => (c.id === payload.chatId ? { ...c, unread_count: 0 } : c)),
        )
        return
      }

      if (payload.type === 'chat_updated') {
        const { chat } = payload
        setChats((prev) => {
          const idx = prev.findIndex((c) => c.id === chat.id)
          if (idx < 0) return prev
          const next = [...prev]
          next[idx] = { ...next[idx], ...chat }
          return sortChatsByActivity(next)
        })
        return
      }

      if (payload.type === 'new_message') {
        const { chatId, senderId, message, messageType, createdAt } = payload
        setChats((prev) => {
          const idx = prev.findIndex((c) => c.id === chatId)
          if (idx < 0) return prev

          const current = prev[idx]
          const fromOther = !!user?.id && senderId !== user.id
          const isActive = activeChatId === chatId

          const updated: Chat = {
            ...current,
            last_message_at: createdAt,
            last_message_text: message,
            last_message_sender_id: senderId,
            last_message: {
              id: `rt-${createdAt}`,
              chat_id: chatId,
              sender_id: senderId,
              message,
              message_type: (
                ['text', 'image', 'file', 'system'].includes(messageType)
                  ? messageType
                  : 'text'
              ) as Message['message_type'],
              is_read: !fromOther || isActive,
              created_at: createdAt,
              updated_at: createdAt,
            },
            unread_count:
              fromOther && !isActive
                ? (current.unread_count || 0) + 1
                : isActive
                  ? 0
                  : current.unread_count || 0,
          }

          const next = prev.filter((_, i) => i !== idx)
          next.unshift(updated)
          return next
        })
      }
    },
    [user?.id, activeChatId, sortChatsByActivity],
  )

  const getOtherParticipant = useCallback(
    (chat: Chat) => {
      if (!user) return null

      if (chat.customer_id === user.id) {
        return chat.tasker
      } else {
        return chat.customer
      }
    },
    [user],
  )

  useFocusEffect(
    React.useCallback(() => {
      if (!isLoading && !isAuthenticated) {
        router.replace('/auth')
      }
    }, [isAuthenticated, isLoading, router]),
  )

  useEffect(() => {
    if (isAuthenticated) {
      loadChats()
    }
  }, [isAuthenticated, loadChats])

  // Remove legacy client-side unread suppression (server is source of truth)
  useEffect(() => {
    if (!user?.id) return
    AsyncStorage.removeItem(`cleared_unread_${user.id}`).catch(() => {})
  }, [user?.id])

  useEffect(() => {
    const sub = onChatInboxChanged(applyInboxChange)
    return () => sub.remove()
  }, [applyInboxChange])

  useFocusEffect(
    React.useCallback(() => {
      if (isAuthenticated) {
        loadChats(true)
        refreshTotalUnread().catch(() => {})
      }
    }, [isAuthenticated, loadChats, refreshTotalUnread]),
  )


  const onRefresh = async () => {
    setRefreshing(true)
    await loadChats()
    setRefreshing(false)
  }

  const handleChatSelect = useCallback(
    async (chatId: string) => {
      // Preload messages BEFORE navigation for instant display
      ChatService.preloadChatMessages(chatId).catch(() => {})

      setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, unread_count: 0 } : c)))

      router.push(`/chat-detail?chatId=${chatId}`)

      if (user?.id) {
        ChatService.markMessagesAsRead(chatId, user.id)
          .then(() => refreshTotalUnread())
          .catch(() => {})
      }
    },
    [user, router, refreshTotalUnread],
  )


  const formatLastMessageTime = (timestamp: string | null) => {
    if (!timestamp) return ''

    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 1) {
      return 'Just now'
    } else if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (diffInHours < 168) {
      // 7 days
      return date.toLocaleDateString([], { weekday: 'short' })
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
    }
  }

  const getLastMessagePreview = useCallback(
    (chat: Chat) => formatChatListPreview(chat, user?.id || ''),
    [user?.id],
  )

  const displayChats = useMemo(() => {
    let list = chats
    if (inboxFilter === 'unread') {
      list = list.filter((chat) => (chat.unread_count || 0) > 0)
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      list = list.filter((chat) => {
        const otherParticipant = getOtherParticipant(chat)
        const participantName = otherParticipant?.full_name || 'Unknown User'
        const taskTitle = chat.task?.title || 'Task Discussion'
        return (
          participantName.toLowerCase().includes(query) ||
          taskTitle.toLowerCase().includes(query)
        )
      })
    }
    return list
  }, [chats, inboxFilter, searchQuery, getOtherParticipant])

  const emptyVariant = useMemo(() => {
    if (searchQuery.trim()) return 'no-search' as const
    if (inboxFilter === 'unread') return 'no-unread' as const
    return 'no-chats' as const
  }, [searchQuery, inboxFilter])

  const handleEmptyPrimaryAction = useCallback(() => {
    if (isTasker) {
      router.push('/jobs')
    } else {
      router.push('/post-task')
    }
  }, [isTasker, router])

  const finalizeChatDelete = useCallback(
    async (chatId: string) => {
      const ok = await ChatService.deleteChatAndMessages(chatId, user?.id || '')
      if (!ok) {
        showError('Could not delete conversation. Please try again.')
        loadChats(true).catch(() => {})
      }
    },
    [user?.id, showError, loadChats],
  )

  const handleDeleteChat = useCallback(
    (item: Chat) => {
      showConfirmation(
        'Delete this conversation?',
        'All messages will be removed. You can undo within 5 seconds after confirming.',
        () => {
          if (pendingDeleteRef.current) {
            clearTimeout(pendingDeleteRef.current.timeoutId)
            pendingDeleteRef.current = null
          }

          setChats((prev) => prev.filter((c) => c.id !== item.id))

          const timeoutId = setTimeout(() => {
            pendingDeleteRef.current = null
            finalizeChatDelete(item.id).catch(() => {})
          }, 5000)

          pendingDeleteRef.current = { chat: item, timeoutId }

          showToast('Conversation deleted', 'info', 5000, {
            label: 'Undo',
            onPress: () => {
              if (pendingDeleteRef.current?.chat.id !== item.id) return
              clearTimeout(pendingDeleteRef.current.timeoutId)
              pendingDeleteRef.current = null
              setChats((prev) => sortChatsByActivity([item, ...prev]))
            },
          })
        },
        undefined,
        'Delete',
        'Cancel',
        'warning',
      )
    },
    [finalizeChatDelete, showToast, sortChatsByActivity],
  )

  useEffect(() => {
    return () => {
      if (pendingDeleteRef.current) {
        clearTimeout(pendingDeleteRef.current.timeoutId)
        const { chat } = pendingDeleteRef.current
        finalizeChatDelete(chat.id).catch(() => {})
      }
    }
  }, [finalizeChatDelete])

  // Preload messages for top chats when list loads
  useEffect(() => {
    if (chats.length > 0) {
      // Preload messages for top 3 chats (most likely to be opened)
      const topChats = chats.slice(0, 3)
      topChats.forEach((chat) => {
        ChatService.preloadChatMessages(chat.id).catch(() => {})
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chats.length > 0 ? chats[0]?.id : null]) // Only when first chat changes

  // Memoized chat item component for better performance
  const ChatItem = memo(
    ({ item, onPress, onLongPress }: { item: Chat; onPress: () => void; onLongPress: () => void }) => {
      const otherParticipant = getOtherParticipant(item)
      const unreadCount = item.unread_count || 0
      const hasUnread = unreadCount > 0
      const lastMessage = getLastMessagePreview(item)
      const lastMessageTime = useMemo(
        () => formatLastMessageTime(item.last_message_at),
        [item.last_message_at]
      )

      return (
        <TouchableOpacity
          style={[styles.chatItem, hasUnread && styles.unreadChatItem]}
          onPress={onPress}
          onLongPress={onLongPress}
          activeOpacity={0.7}
        >
          <View style={styles.avatarContainer}>
            {otherParticipant?.avatar_url ? (
              <Image
                source={{ uri: otherParticipant.avatar_url }}
                style={styles.avatar}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={200}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>
                  {(otherParticipant?.full_name || 'U')[0].toUpperCase()}
                </Text>
              </View>
            )}
            {hasUnread && <View style={styles.unreadBadge} />}
          </View>

          <View style={styles.chatContent}>
            <View style={styles.chatHeader}>
              <Text style={[styles.participantName, hasUnread && styles.unreadText]} numberOfLines={1}>
                {otherParticipant?.full_name || 'Unknown User'}
              </Text>
              <Text style={styles.lastMessageTime}>{lastMessageTime}</Text>
            </View>

            <View style={styles.chatFooter}>
              <Text style={[styles.lastMessage, hasUnread && styles.unreadText]} numberOfLines={1}>
                {lastMessage}
              </Text>
              {hasUnread && (
                <View style={styles.unreadCount}>
                  <Text style={styles.unreadCountText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </View>

            {item.task && (
              <View style={styles.taskContextRow}>
                <View style={styles.taskTitleRow}>
                  <Ionicons name="briefcase-outline" size={11} color={Colors.primary[500]} />
                  <Text
                    style={[styles.taskTitleStrong, hasUnread && styles.unreadText]}
                    numberOfLines={1}
                  >
                    {item.task.title}
                  </Text>
                </View>
                {item.task.status ? (
                  <View
                    style={[
                      styles.taskStatusPill,
                      { backgroundColor: getTaskStatusColor(item.task.status) + '18' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.taskStatusText,
                        { color: getTaskStatusColor(item.task.status) },
                      ]}
                    >
                      {getTaskStatusLabel(item.task.status)}
                    </Text>
                  </View>
                ) : null}
              </View>
            )}
          </View>
        </TouchableOpacity>
      )
    },
    (prevProps, nextProps) => {
      return (
        prevProps.item.id === nextProps.item.id &&
        prevProps.item.unread_count === nextProps.item.unread_count &&
        prevProps.item.last_message_at === nextProps.item.last_message_at &&
        prevProps.item.last_message_text === nextProps.item.last_message_text &&
        prevProps.item.last_message_sender_id === nextProps.item.last_message_sender_id &&
        prevProps.item.task?.status === nextProps.item.task?.status &&
        prevProps.item.task?.title === nextProps.item.task?.title
      )
    }
  )
  ChatItem.displayName = 'ChatItem'

  const renderChat = useCallback(
    ({ item }: { item: Chat }) => {
      return (
        <ChatItem
          item={item}
          onPress={() => handleChatSelect(item.id)}
          onLongPress={() => handleDeleteChat(item)}
        />
      )
    },
    [handleChatSelect, handleDeleteChat],
  )

  if (isLoading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
        <View style={styles.loadingContainer}>
          <View style={styles.loadingContent}>
            <View style={styles.loadingIcon}>
              <Ionicons name="chatbubbles" size={48} color={Colors.primary[500]} />
            </View>
            <Text style={styles.loadingTitle}>Loading Messages</Text>
            <Text style={styles.loadingSubtitle}>Fetching your conversations...</Text>
          </View>
        </View>
      </View>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <TextureBackground>
      <SafeAreaView style={styles.container} edges={[]}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
        <View style={styles.containerContent}>
        {/* Header */}
        <View style={[styles.headerWrapper, { paddingTop: 8 + insets.top }]}>
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>Messages</Text>
            </View>
          </View>
        </View>

        {/* Search Bar - Separated for better UX */}
        <View style={styles.searchWrapper}>
          <View style={styles.searchContainer}>
            <View style={styles.searchIconContainer}>
              <Ionicons name="search" size={18} color={Colors.neutral[500]} />
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder="Search conversations..."
              placeholderTextColor={Colors.neutral[400]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity 
                onPress={() => setSearchQuery('')} 
                style={styles.clearButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={18} color={Colors.neutral[400]} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ChatsFilterBar
          value={inboxFilter}
          unreadCount={totalUnreadCount}
          onChange={setInboxFilter}
        />

        {/* Chat List */}
        {loading ? (
          <SkeletonList count={5} />
        ) : displayChats.length === 0 ? (
          <ChatsEmptyState
            variant={emptyVariant}
            isTasker={isTasker}
            onPrimaryAction={handleEmptyPrimaryAction}
          />
        ) : (
          <FlatList
            data={displayChats}
            keyExtractor={(item) => item.id}
            renderItem={renderChat}
            style={styles.chatsList}
            contentContainerStyle={styles.chatsListContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[Colors.primary[500]]}
                tintColor={Colors.primary[500]}
              />
            }
            showsVerticalScrollIndicator={false}
            bounces={true}
            alwaysBounceVertical={true}
            overScrollMode="always"
            removeClippedSubviews={Platform.OS === 'android'}
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={50}
            windowSize={10}
            initialNumToRender={10}
            getItemLayout={(data, index) => ({
              length: 96,
              offset: 96 * index,
              index,
            })}
          />
        )}

      </View>
    </SafeAreaView>
    </TextureBackground>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  containerContent: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  headerWrapper: {
    paddingTop: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background.primary,
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.neutral[900],
    marginBottom: 8,
  },
  loadingSubtitle: {
    fontSize: 16,
    color: Colors.neutral[600],
    textAlign: 'center',
  },
  header: {
    backgroundColor: Colors.background.primary,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 0,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.neutral[900],
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.neutral[600],
    marginTop: 2,
  },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: Colors.background.primary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border.light,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral[100],
    borderRadius: 10,
    paddingHorizontal: 0,
    paddingVertical: 0,
    minHeight: 40,
  },
  searchIconContainer: {
    paddingLeft: 12,
    paddingRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.neutral[900],
    paddingVertical: 10,
    paddingRight: 8,
  },
  clearButton: {
    paddingRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatsList: {
    flex: 1,
  },
  chatsListContent: {
    paddingTop: 0,
    paddingBottom: 100,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border.light,
  },
  unreadChatItem: {
    backgroundColor: Colors.primary[50],
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.neutral[100],
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.primary[600],
  },
  unreadBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary[500],
    borderWidth: 2,
    borderColor: Colors.background.primary,
  },
  chatContent: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  participantName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.neutral[900],
    flex: 1,
  },
  unreadText: {
    fontWeight: '700',
    color: Colors.neutral[900],
  },
  lastMessageTime: {
    fontSize: 11,
    color: Colors.neutral[500],
    fontWeight: '500',
  },
  chatFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 1,
  },
  lastMessage: {
    fontSize: 13,
    color: Colors.neutral[600],
    flex: 1,
    lineHeight: 18,
  },
  unreadCount: {
    backgroundColor: Colors.primary[500],
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
    paddingHorizontal: 6,
  },
  unreadCountText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  taskContextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
  },
  taskTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    minWidth: 0,
  },
  taskTitleStrong: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.neutral[600],
    flex: 1,
  },
  taskStatusPill: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  taskStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.neutral[700],
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: Colors.neutral[500],
    textAlign: 'center',
    lineHeight: 22,
  },
})
