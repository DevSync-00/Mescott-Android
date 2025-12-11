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
  DeviceEventEmitter,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useFocusEffect } from 'expo-router'
import { useAuth } from '../contexts/SimpleAuthContext'
import { RealtimeChatService } from '../services/RealtimeChatService'
import { ChatService, Chat } from '../services/ChatService'
import { Colors } from '../constants/Colors'
import { SkeletonList } from '../components/SkeletonLoader'
import { showConfirmation } from '../utils/alertHelper'
import TextureBackground from '../components/TextureBackground'
import { supabase } from '../lib/supabase'

export default function Chats() {
  const { isAuthenticated, isLoading, user } = useAuth()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [chats, setChats] = useState<Chat[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredChats, setFilteredChats] = useState<Chat[]>([])
  const [clearedChats, setClearedChats] = useState<Set<string>>(new Set())
  const CLEARED_KEY = user ? `cleared_unread_${user.id}` : 'cleared_unread'
  
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

  const loadChats = useCallback(async () => {
    if (!user?.id) return

    try {
      // Only show loading on initial load, not on refresh
      if (chats.length === 0) {
        setLoading(true)
      }
      const userChats = await RealtimeChatService.getUserChats(user.id)
      // Sort by most recent activity using cached timestamps
      const sorted = [...userChats].sort((a, b) => {
        return getTimestamp(b) - getTimestamp(a) // Most recent first
      })
      // Apply client-side suppression for chats the user has opened
      const suppressed = sorted.map((c) => (clearedChats.has(c.id) ? { ...c, unread_count: 0 } : c))
      setChats(suppressed)
    } catch (error) {
      console.error('Error loading chats:', error)
    } finally {
      setLoading(false)
    }
  }, [user, clearedChats, chats.length, getTimestamp])

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

  // Load persisted cleared chats
  useEffect(() => {
    ;(async () => {
      if (!user?.id) return
      try {
        const stored = await AsyncStorage.getItem(`cleared_unread_${user.id}`)
        if (stored) {
          const ids: string[] = JSON.parse(stored)
          setClearedChats(new Set(ids))
        }
      } catch {}
    })()
  }, [user?.id])

  // React to read events from chat detail
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('chat:read', (payload: any) => {
      const id = payload?.chatId
      if (!id) return
      setChats((prev) => prev.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c)))
      setFilteredChats((prev) => prev.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c)))
      setClearedChats((prev) => new Set([...Array.from(prev), id]))
    })
    return () => sub.remove()
  }, [])

  // When cleared set changes, re-apply suppression to current lists
  useEffect(() => {
    if (clearedChats.size === 0) return
    setChats((prev) => prev.map((c) => (clearedChats.has(c.id) ? { ...c, unread_count: 0 } : c)))
    setFilteredChats((prev) =>
      prev.map((c) => (clearedChats.has(c.id) ? { ...c, unread_count: 0 } : c)),
    )
  }, [clearedChats])

  // Keep list fresh when returning from detail
  useFocusEffect(
    React.useCallback(() => {
      if (isAuthenticated) {
        loadChats()
      }
    }, [isAuthenticated, loadChats]),
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

      // Optimistically clear unread badge for immediate feedback
      setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, unread_count: 0 } : c)))
      setFilteredChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, unread_count: 0 } : c)))
      setClearedChats((prev) => {
        const next = new Set([...Array.from(prev), chatId])
        const clearedKey = user ? `cleared_unread_${user.id}` : 'cleared_unread'
        AsyncStorage.setItem(clearedKey, JSON.stringify(Array.from(next))).catch(() => {})
        return next
      })

      // Navigate immediately to chats detail (not replace, so back button works)
      router.push(`/chat-detail?chatId=${chatId}`)

      if (user?.id) {
        // Mark as read in background (non-blocking)
        RealtimeChatService.markMessagesAsRead(chatId, user.id).catch(() => {})
        // Reload chats in background without blocking navigation
        loadChats().catch(() => {})
      }
    },
    [user, router, loadChats],
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

  const getLastMessagePreview = (chat: Chat) => {
    const last = chat.last_message
    const type = last?.message_type
    const messageText = last?.message || chat.last_message_text || ''

    const label =
      type === 'image'
        ? '📷 Photo'
        : type === 'file'
          ? `📎 ${(messageText.split('/').pop() || 'File')}`
          : type === 'system'
            ? 'ℹ️ System'
            : messageText

    if (label && label.trim()) {
      return label.length > 70 ? `${label.slice(0, 70)}…` : label
    }

    if ((chat.unread_count || 0) > 0) {
      return 'New message'
    }
    return 'Start a conversation'
  }

  // Memoized filtered chats for better performance
  const filteredChatsMemo = useMemo(() => {
    if (!searchQuery.trim()) return chats
    const query = searchQuery.toLowerCase()
    return chats.filter((chat) => {
      const otherParticipant = getOtherParticipant(chat)
      const participantName = otherParticipant?.full_name || 'Unknown User'
      const taskTitle = chat.task?.title || 'Task Discussion'
      return (
        participantName.toLowerCase().includes(query) ||
        taskTitle.toLowerCase().includes(query)
      )
    })
  }, [searchQuery, chats, getOtherParticipant])

  useEffect(() => {
    setFilteredChats(filteredChatsMemo)
  }, [filteredChatsMemo])

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
      const effectiveUnread = clearedChats.has(item.id) ? 0 : item.unread_count || 0
      const hasUnread = effectiveUnread > 0
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
                    {effectiveUnread > 99 ? '99+' : effectiveUnread}
                  </Text>
                </View>
              )}
            </View>

            {item.task && (
              <View style={styles.taskInfo}>
                <Ionicons name="briefcase-outline" size={10} color={Colors.neutral[400]} />
                <Text style={styles.taskTitle} numberOfLines={1}>
                  {item.task.title}
                </Text>
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
        prevProps.item.last_message_text === nextProps.item.last_message_text
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
          onLongPress={() => {
            showConfirmation(
              'Delete conversation',
              'This will delete all messages for this chat. Continue?',
              async () => {
                try {
                  const ok = await ChatService.deleteChatAndMessages(item.id, user?.id || '')
                  if (ok) {
                    setChats((prev) => prev.filter((c) => c.id !== item.id))
                    setFilteredChats((prev) => prev.filter((c) => c.id !== item.id))
                  }
                } catch (e) {
                  console.error('Delete chat failed', e)
                }
              },
              undefined,
              'Delete',
              'Cancel',
              'warning'
            )
          }}
        />
      )
    },
    [handleChatSelect, user?.id],
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

        {/* Chat List */}
        {loading ? (
          <SkeletonList count={5} />
        ) : filteredChats.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={64} color={Colors.neutral[300]} />
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'No matching conversations' : 'No messages yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? 'Try adjusting your search terms'
                : 'Start a conversation by accepting a task application'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredChats}
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
  taskInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  taskTitle: {
    fontSize: 10,
    color: Colors.neutral[400],
    flex: 1,
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
