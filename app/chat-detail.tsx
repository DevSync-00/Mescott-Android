import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  FlatList,
  Modal,
  Platform,
  Keyboard,
  InteractionManager,
} from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router'
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated'
import { useKeyboardHandler } from 'react-native-keyboard-controller'
import { useAuth } from '../contexts/SimpleAuthContext'
import { useToast } from '../contexts/ToastContext'
import { ChatService, Chat } from '../services/ChatService'
import { supabase } from '../lib/supabase'
import { Colors } from '../constants/Colors'
import { SkeletonList } from '../components/SkeletonLoader'
import { LinearGradient } from 'expo-linear-gradient'
import { showInfoAlert } from '../utils/alertHelper'
import TextureBackground from '../components/TextureBackground'

const { width: screenWidth } = Dimensions.get('window')
const MIN_INPUT_HEIGHT = 44
const MAX_INPUT_HEIGHT = 120

interface Message {
  id: string
  message: string
  sender_id: string
  created_at: string
  sender_name?: string
  is_read?: boolean
  message_type?: 'text' | 'image' | 'file' | 'system'
  status?: 'sending' | 'sent' | 'delivered' | 'read'
}

// Custom hook for smooth keyboard animation
const useGradualAnimation = () => {
  const height = useSharedValue(0)

  useKeyboardHandler(
    {
      onStart: (event) => {
        'worklet'
        height.value = Math.max(event.height, 0)
      },
      onMove: (event) => {
        'worklet'
        height.value = Math.max(event.height, 0)
      },
      onEnd: (event) => {
        'worklet'
        height.value = Math.max(event.height, 0)
      },
    },
    [],
  )
  return { height }
}

export default function ChatDetail() {
  const { user, isAuthenticated, loading: isLoading } = useAuth()
  const { showError } = useToast()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { chatId, taskId, otherUserName } = useLocalSearchParams<{
    chatId: string
    taskId: string
    taskTitle: string
    otherUserName: string
  }>()

  const [chat, setChat] = useState<Chat | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false) // Start as false - show cached immediately
  const [initialLoad, setInitialLoad] = useState(true) // Track if we've done initial load
  const [sending, setSending] = useState(false)
  const [participantName, setParticipantName] = useState<string>(otherUserName || 'Unknown')
  const [participantAvatarUrl, setParticipantAvatarUrl] = useState<string | null>(null)
  const participantFirstName = useMemo(() => {
    if (!participantName) return 'there'
    const [first] = participantName.trim().split(' ')
    return first || 'there'
  }, [participantName])
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [imageModalVisible, setImageModalVisible] = useState(false)
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null)
  const [optionsVisible, setOptionsVisible] = useState(false)
  const [inputHeight, setInputHeight] = useState(MIN_INPUT_HEIGHT)
  const [keyboardInset, setKeyboardInset] = useState(0)

  const flatListRef = useRef<FlatList>(null)
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keyboard animation hook
  const { height } = useGradualAnimation()

  // Animated style for input container - moves up with keyboard, overlays messages
  const inputContainerAnimated = useAnimatedStyle(() => {
    const keyboardHeight = Math.max(height.value, 0)
    return {
      transform: [{ translateY: -keyboardHeight }],
      paddingBottom: keyboardHeight > 0 ? 5 : Math.max(insets.bottom, 8),
    }
  }, [insets.bottom])

  // Optimized sorting - cache timestamps to avoid repeated Date parsing
  const timestampCache = useRef<Map<string, number>>(new Map())
  const sortedMessages = useMemo(() => {
    if (messages.length === 0) return []
    // Pre-compute timestamps only once per message ID
    return [...messages].sort((a, b) => {
      if (!timestampCache.current.has(a.created_at)) {
        timestampCache.current.set(a.created_at, new Date(a.created_at).getTime())
      }
      if (!timestampCache.current.has(b.created_at)) {
        timestampCache.current.set(b.created_at, new Date(b.created_at).getTime())
      }
      return (
        (timestampCache.current.get(a.created_at) || 0) -
        (timestampCache.current.get(b.created_at) || 0)
      )
    })
  }, [messages])

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/auth')
    }
  }, [isAuthenticated, isLoading])

  useEffect(() => {
    if (chatId && user?.id) {
      // Load cached messages synchronously if available - INSTANT display
      const cached = ChatService['messageCache'].get(chatId)
      if (cached && cached.length > 0) {
        setMessages(cached)
        setLoading(false)
        setInitialLoad(false)
      } else {
        setLoading(true)
      }

      // Use InteractionManager to load fresh data after UI is ready
      InteractionManager.runAfterInteractions(() => {
        loadChatData()
      })
    }
  }, [chatId, user?.id])

  useEffect(() => {
    if (otherUserName && otherUserName !== 'Unknown') {
      setParticipantName(otherUserName)
    }
  }, [otherUserName])

  useEffect(() => {
    if (chat?.id && user?.id && !isSubscribed) {
      subscribeToRealtimeChat()
    }
    return () => {
      if (chat?.id) {
        ChatService.unsubscribeFromChat(chat.id)
      }
    }
  }, [chat?.id, user?.id, isSubscribed])

  useFocusEffect(
    useCallback(() => {
      if (chatId && user?.id) {
        ChatService.markMessagesAsRead(chatId, user.id).catch(() => {})
      }
    }, [chatId, user?.id]),
  )

  // Scroll to end when keyboard appears and increase bottom padding so overlapped messages stay scrollable
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

    const handleKeyboardShow = (event: any) => {
      const height = event?.endCoordinates?.height || 0
      setKeyboardInset(height)
      // Immediate scroll when keyboard appears - no animation delay
      if (messages.length > 0) {
        flatListRef.current?.scrollToEnd({ animated: false })
      }
    }

    const handleKeyboardHide = () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
      setKeyboardInset(0)
    }

    const showSubscription = Keyboard.addListener(showEvent, handleKeyboardShow)
    const hideSubscription = Keyboard.addListener(hideEvent, handleKeyboardHide)

    return () => {
      showSubscription.remove()
      hideSubscription.remove()
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [])

  const loadChatData = async () => {
    if (!user?.id) return
    try {
      const targetChatId = chatId || null

      // Get cached messages immediately if available (for instant display)
      const messagesResult = targetChatId
        ? await ChatService.getChatMessagesFast(targetChatId, 30)
        : null
      // Use cached messages immediately if we don't have messages yet
      if (messagesResult?.cached && messagesResult.cached.length > 0) {
        if (messages.length === 0) {
          setMessages(messagesResult.cached)
          setLoading(false)
        }
      }

      // Load chat data and fresh messages in parallel
      const [chatDataResult, freshMessages] = await Promise.all([
        targetChatId
          ? ChatService.getChatById(targetChatId)
          : taskId
            ? ChatService.getOrCreateChat(taskId, user.id, 'temp-tasker-id')
            : null,
        messagesResult?.fresh || Promise.resolve([]),
      ])

      if (!chatDataResult) throw new Error('Chat not found')

      // Batch all state updates together
      setChat(chatDataResult)

      // Extract participant info from chat data immediately (no extra query)
      if (chatDataResult.customer && chatDataResult.tasker) {
        const isCustomer = user.id === chatDataResult.customer_id
        const otherParticipant = isCustomer ? chatDataResult.tasker : chatDataResult.customer
        if (otherParticipant?.full_name && otherParticipant.full_name !== 'Unknown') {
          setParticipantName(otherParticipant.full_name)
        }
        if (otherParticipant?.avatar_url) {
          setParticipantAvatarUrl(otherParticipant.avatar_url)
        }
      }

      // Update messages with fresh data (only if different from cached)
      if (freshMessages && freshMessages.length > 0) {
        setMessages(freshMessages)
      }

      // Set up realtime subscription and mark as read (non-blocking background tasks)
      Promise.all([
        subscribeToRealtimeChat().catch(() => {}),
        ChatService.markMessagesAsRead(chatDataResult.id, user.id).catch(() => {}),
      ])

      setInitialLoad(false)
      setLoading(false)
    } catch (error) {
      console.error('Error loading chat:', error)
      if (initialLoad) {
        showError('Failed to load chat')
      }
      setLoading(false)
    }
  }

  const subscribeToRealtimeChat = async () => {
    if (!chat?.id || isSubscribed) return
    try {
      await ChatService.subscribeToChat(chat.id, {
        onMessage: (message) => {
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === message.id)
            if (exists) return prev
            const newMsg: Message = {
              id: message.id,
              message: message.message,
              sender_id: message.sender_id,
              created_at: message.created_at,
              sender_name: message.sender?.full_name || 'Unknown',
              message_type: message.message_type || 'text',
              status: message.sender_id === user?.id ? 'delivered' : 'read',
            }
            return [...prev, newMsg].sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
            )
          })
          if (message.sender_id !== user?.id) {
            ChatService.markMessagesAsRead(chat.id, user!.id)
          }
        },
      })
      setIsSubscribed(true)
    } catch (error) {
      console.error('Subscription error:', error)
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || sending || !user?.id) return
    const text = newMessage.trim()
    setNewMessage('')

    const tempId = `temp_${Date.now()}`
    const tempMsg: Message = {
      id: tempId,
      message: text,
      sender_id: user.id,
      created_at: new Date().toISOString(),
      status: 'sending',
    }

    // Add message - sorting will be handled by sortedMessages memo
    setMessages((prev) => [...prev, tempMsg])

    try {
      setSending(true)
      let success = false
      if (chat?.id) {
        const result = await ChatService.sendMessage(chat.id, user.id, text)
        success = result !== null
      } else if (chatId) {
        const result = await ChatService.sendMessage(chatId, user.id, text)
        success = result !== null
      }

      if (success) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: 'sent' } : m)))
        // Reload messages in background without blocking UI
        const targetChatId = chat?.id || chatId
        if (targetChatId) {
          const { fresh } = await ChatService.getChatMessagesFast(targetChatId)
          fresh.then((msgs) => {
            if (msgs && msgs.length > 0) {
              // Sort messages (timestamp cache will optimize future sorts)
              const sorted = [...msgs].sort(
                (a: any, b: any) =>
                  new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
              )
              setMessages(sorted)
              // Scroll immediately after update
              flatListRef.current?.scrollToEnd({ animated: false })
            }
          })
        }
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== tempId))
        showError('Message failed to send')
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      showError('Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (date.toDateString() === today.toDateString()) return 'Today'
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const isMyMessage = (msg: Message) => msg.sender_id === user?.id

  const MessageItem = memo(
    ({ message, isMine, showDate, showAvatar, isGroupStart, isGroupEnd }: any) => {
      const handleImagePress = useCallback(() => {
        if (message.message_type === 'image') {
          setSelectedImageUri(message.message)
          setImageModalVisible(true)
        }
      }, [message.message_type, message.message])

      return (
        <View style={styles.messageWrapper}>
          {showDate && (
            <View style={styles.dateSeparator}>
              <Text style={styles.dateSeparatorText}>{formatDate(message.created_at)}</Text>
            </View>
          )}
          <View style={[styles.messageRow, isMine ? styles.myMessageRow : styles.otherMessageRow]}>
            <TouchableWithoutFeedback onLongPress={() => {}}>
              <View
                style={[
                  styles.messageBubble,
                  isMine ? styles.myMessageBubble : styles.otherMessageBubble,
                  isGroupEnd && (isMine ? styles.myBubbleTail : styles.otherBubbleTail),
                ]}
              >
                {message.message_type === 'image' ? (
                  <TouchableOpacity activeOpacity={0.9} onPress={handleImagePress}>
                    <Image
                      source={{ uri: message.message }}
                      style={styles.messageImage}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      transition={200}
                    />
                  </TouchableOpacity>
                ) : (
                  <Text
                    style={[
                      styles.messageText,
                      isMine ? styles.myMessageText : styles.otherMessageText,
                    ]}
                  >
                    {message.message}
                  </Text>
                )}
                <View style={styles.messageFooter}>
                  <Text
                    style={[
                      styles.messageTime,
                      isMine ? { color: 'rgba(255,255,255,0.8)' } : { color: Colors.neutral[500] },
                    ]}
                  >
                    {formatTime(message.created_at)}
                  </Text>
                  {isMine && message.status === 'sending' && (
                    <ActivityIndicator size={12} color="#999" style={{ marginLeft: 6 }} />
                  )}
                  {isMine && message.status === 'sent' && (
                    <Ionicons name="checkmark" size={16} color="#999" style={{ marginLeft: 6 }} />
                  )}
                  {isMine && message.status === 'read' && (
                    <Ionicons
                      name="checkmark-done"
                      size={16}
                      color={Colors.primary[500]}
                      style={{ marginLeft: 6 }}
                    />
                  )}
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </View>
      )
    },
    (prevProps, nextProps) => {
      // Custom comparison for better performance
      return (
        prevProps.message.id === nextProps.message.id &&
        prevProps.message.status === nextProps.message.status &&
        prevProps.isMine === nextProps.isMine &&
        prevProps.showDate === nextProps.showDate
      )
    },
  )

  // Memoize date formatting to avoid repeated calculations
  const dateCache = useRef<Map<string, string>>(new Map())
  const getCachedDate = useCallback((dateString: string) => {
    if (!dateCache.current.has(dateString)) {
      dateCache.current.set(dateString, formatDate(dateString))
    }
    return dateCache.current.get(dateString)!
  }, [])

  const renderMessage = useCallback(
    ({ item, index }: { item: Message; index: number }) => {
      const prev = sortedMessages[index - 1]
      const next = sortedMessages[index + 1]
      const isMine = isMyMessage(item)
      const prevDate = prev ? getCachedDate(prev.created_at) : null
      const itemDate = getCachedDate(item.created_at)
      const showDate = !prev || itemDate !== prevDate
      const showAvatar = !isMine && (!next || next.sender_id !== item.sender_id)
      const isGroupStart = !prev || prev.sender_id !== item.sender_id
      const isGroupEnd = !next || next.sender_id !== item.sender_id

      return (
        <MessageItem
          message={item}
          isMine={isMine}
          showDate={showDate}
          showAvatar={showAvatar}
          isGroupStart={isGroupStart}
          isGroupEnd={isGroupEnd}
        />
      )
    },
    [sortedMessages, getCachedDate],
  )
  MessageItem.displayName = 'MessageItem'

  const keyExtractor = useCallback((item: Message) => item.id, [])

  // Don't block rendering - show UI immediately even while loading
  const showLoading = isLoading || (loading && messages.length === 0)

  return (
    <TextureBackground>
      <SafeAreaView style={styles.container} edges={['left', 'right']}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Fixed Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <LinearGradient colors={['#f8f9fc', '#ffffff']} style={StyleSheet.absoluteFill} />
        <TouchableOpacity
          onPress={() => {
            // Always navigate to chats list (replace to avoid stack issues)
            router.replace('/chats')
          }}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.neutral[800]} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.userInfo}>
          {participantAvatarUrl ? (
            <Image 
              source={{ uri: participantAvatarUrl }} 
              style={styles.avatarImage}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{participantName[0]?.toUpperCase()}</Text>
            </View>
          )}
          <View>
            <Text style={styles.name}>{participantName}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setOptionsVisible(true)}>
          <Ionicons name="ellipsis-vertical" size={22} color={Colors.neutral[800]} />
        </TouchableOpacity>
      </View>

      {/* Main Content with Smooth Keyboard Animation */}
      <View style={{ flex: 1 }}>
        {showLoading ? (
          <View style={{ flex: 1, paddingTop: 20 }}>
            <SkeletonList count={4} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={sortedMessages}
            renderItem={renderMessage}
            keyExtractor={keyExtractor}
            contentContainerStyle={[
              styles.messagesList,
              {
                paddingBottom: keyboardInset > 0 ? keyboardInset + Math.max(insets.bottom, 10) : 10,
              },
            ]}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={Platform.OS === 'android'}
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={50}
            windowSize={10}
            initialNumToRender={15}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
            nestedScrollEnabled={true}
            scrollEventThrottle={16}
            maintainVisibleContentPosition={{
              minIndexForVisible: 0,
              autoscrollToTopThreshold: 10,
            }}
            onContentSizeChange={() => {
              // Only scroll if we have messages and not during initial load
              if (sortedMessages.length > 0 && !initialLoad) {
                // Use immediate scroll for better performance
                flatListRef.current?.scrollToEnd({ animated: false })
              }
            }}
            onLayout={(e) => {
              // Only scroll on initial layout when content is loaded
              if (
                sortedMessages.length > 0 &&
                e.nativeEvent.layout.height > 0 &&
                !loading &&
                !initialLoad
              ) {
                flatListRef.current?.scrollToEnd({ animated: false })
              }
            }}
            ListEmptyComponent={
              // Only show empty state if we're not loading and truly have no messages
              !loading && sortedMessages.length === 0 && !initialLoad ? (
                <View style={styles.emptyState}>
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={64}
                    color={Colors.primary[400]}
                  />
                  <Text style={styles.emptyTitle}>Say hi to {participantFirstName}</Text>
                  <Text style={styles.emptySubtitle}>Start the conversation!</Text>
                </View>
              ) : null
            }
          />
        )}

        {/* Input - Animated to stay above keyboard */}
        <Animated.View style={[styles.inputContainer, inputContainerAnimated]}>
          <View style={styles.inputRow}>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[
                  styles.textInput,
                  { height: Math.min(MAX_INPUT_HEIGHT, Math.max(MIN_INPUT_HEIGHT, inputHeight)) },
                ]}
                value={newMessage}
                onChangeText={setNewMessage}
                placeholder="Type a message..."
                placeholderTextColor={Colors.neutral[400]}
                multiline
                onContentSizeChange={(e) => setInputHeight(e.nativeEvent.contentSize.height + 20)}
              />
            </View>
            <TouchableOpacity
              style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
              onPress={sendMessage}
              disabled={!newMessage.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="send" size={22} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>

      {/* Image Modal */}
      <Modal visible={imageModalVisible} transparent animationType="fade">
        <View style={styles.imageModal}>
          <TouchableOpacity style={styles.closeModal} onPress={() => setImageModalVisible(false)}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {selectedImageUri && (
            <Image
              source={{ uri: selectedImageUri }}
              style={styles.fullImage}
              contentFit="contain"
              cachePolicy="memory-disk"
            />
          )}
        </View>
      </Modal>

      {/* Options Modal */}
      <Modal visible={optionsVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setOptionsVisible(false)}
        >
          <View style={styles.optionsSheet}>
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                setOptionsVisible(false)
                showInfoAlert('Delete chat', 'Coming soon')
              }}
            >
              <Text style={styles.deleteText}>Delete chat</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionItem} onPress={() => setOptionsVisible(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
    </TextureBackground>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background?.primary || '#fff',
  },
  loadingHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
    zIndex: 10,
  },
  backButton: { padding: 8 },
  userInfo: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  name: { fontSize: 16, fontWeight: '600', color: '#000' },
  status: { fontSize: 13, marginTop: 2 },

  messagesList: {
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyTitle: { fontSize: 20, fontWeight: '600', marginTop: 16, color: '#333' },
  emptySubtitle: { fontSize: 15, color: '#888', marginTop: 8 },

  messageWrapper: { marginVertical: 2 },
  dateSeparator: { alignItems: 'center', marginVertical: 16 },
  dateSeparatorText: {
    backgroundColor: 'rgba(0,0,0,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    fontSize: 12,
    color: '#666',
  },
  messageRow: {
    flexDirection: 'row',
    marginVertical: 4,
    paddingHorizontal: 6,
  },
  myMessageRow: {
    justifyContent: 'flex-end',
  },
  otherMessageRow: {
    justifyContent: 'flex-start',
  },

  messageBubble: {
    maxWidth: screenWidth * 0.8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 18,
    marginHorizontal: 8,
  },
  myMessageBubble: {
    backgroundColor: Colors.primary[500],
    borderBottomRightRadius: 6,
  },
  otherMessageBubble: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.neutral[200],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  myBubbleTail: { borderBottomRightRadius: 18 },
  otherBubbleTail: { borderBottomLeftRadius: 18 },

  messageText: { fontSize: 15.5, lineHeight: 21 },
  myMessageText: { 
    color: '#ffffff',
    fontWeight: '400',
  },
  otherMessageText: { 
    color: Colors.neutral[900],
    fontWeight: '400',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  messageTime: { fontSize: 11, color: '#666' },
  messageImage: { width: 220, height: 180, borderRadius: 12 },

  inputContainer: {
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ddd',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: '#f4f4f4',
    borderRadius: 20,
    marginRight: 8,
    paddingHorizontal: 12,
    maxHeight: 90,
  },
  textInput: {
    fontSize: 14,
    paddingTop: 8,
    paddingBottom: 8,
    textAlignVertical: 'center',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: { backgroundColor: '#ccc' },

  imageModal: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  closeModal: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 10,
    borderRadius: 30,
  },
  fullImage: { width: '100%', height: '100%' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  optionsSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },
  optionItem: { paddingVertical: 16 },
  deleteText: { color: '#ff3b30', fontSize: 17, fontWeight: '600', textAlign: 'center' },
  cancelText: { color: '#333', fontSize: 17, textAlign: 'center' },
})
