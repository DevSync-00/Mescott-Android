import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  ActivityIndicator,
  Alert,
  Dimensions,
  StatusBar,
  Image,
  FlatList,
  Modal,
  Platform,
  Keyboard,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import { Ionicons } from '@expo/vector-icons'
import { DeviceEventEmitter } from 'react-native'
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router'
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated'
import { useKeyboardHandler } from 'react-native-keyboard-controller'
import { useAuth } from '../contexts/SimpleAuthContext'
import { ChatService, Chat } from '../services/ChatService'
import { BookingService } from '../services/BookingService'
import { SimpleNotificationService } from '../services/SimpleNotificationService'
import { supabase } from '../lib/supabase'
import Colors from '../constants/Colors'
import SkeletonLoader, { SkeletonList, SkeletonProfile } from '../components/SkeletonLoader'
import { ImageService } from '../services/ImageService'
import { LinearGradient } from 'expo-linear-gradient'

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
    []
  )
  return { height }
}

export default function ChatDetail() {
  const { user, isAuthenticated, loading: isLoading } = useAuth()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { chatId, taskId, taskTitle, otherUserName } = useLocalSearchParams<{
    chatId: string
    taskId: string
    taskTitle: string
    otherUserName: string
  }>()

  const [chat, setChat] = useState<Chat | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [participantName, setParticipantName] = useState<string>(otherUserName || 'Unknown')
  const [participantAvatarUrl, setParticipantAvatarUrl] = useState<string | null>(null)
  const participantFirstName = useMemo(() => {
    if (!participantName) return 'there'
    const [first] = participantName.trim().split(' ')
    return first || 'there'
  }, [participantName])
  const [lastSeen, setLastSeen] = useState<string>('')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [imageModalVisible, setImageModalVisible] = useState(false)
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null)
  const [optionsVisible, setOptionsVisible] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [inputHeight, setInputHeight] = useState(MIN_INPUT_HEIGHT)

  const flatListRef = useRef<FlatList>(null)
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  // Keyboard animation hook
  const { height } = useGradualAnimation()
  
  // Animated style for input container - moves up with keyboard, overlays messages
  const inputContainerAnimated = useAnimatedStyle(() => {
    const keyboardHeight = Math.max(height.value, 0)
    return {
      transform: [{ translateY: -keyboardHeight }],
      paddingBottom: keyboardHeight > 0 ? 5 : Math.max(insets.bottom, 10),
    }
  }, [insets.bottom])

  const sortedMessages = useMemo(() => {
    return [...messages].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
  }, [messages])

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/auth')
    }
  }, [isAuthenticated, isLoading])

  useEffect(() => {
    if (chatId && user?.id) {
      loadChatData()
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
    }, [chatId, user?.id])
  )

  // Scroll to end when keyboard appears (debounced to prevent lag)
  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      // Clear any pending scroll
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
      // Delay scroll to avoid conflicts with keyboard animation
      scrollTimeoutRef.current = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true })
      }, 0)
    })
    return () => {
      showSubscription.remove()
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

  const loadParticipantName = async (chatData: Chat) => {
    if (!user?.id || !chatData) return
    try {
      // Prefer hydrated chat relations when available
      if (chatData.customer && chatData.tasker) {
        const isCustomer = user.id === chatData.customer_id
        const otherParticipant = isCustomer ? chatData.tasker : chatData.customer

        if (otherParticipant?.full_name && otherParticipant.full_name !== 'Unknown') {
          setParticipantName(otherParticipant.full_name)
        }

        if (otherParticipant?.avatar_url) {
          setParticipantAvatarUrl(otherParticipant.avatar_url)
        }
      }

      const otherParticipantId = user.id === chatData.customer_id ? chatData.tasker_id : chatData.customer_id
      if (otherParticipantId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', otherParticipantId)
          .single()

        if (profile?.full_name) {
          setParticipantName(profile.full_name)
        }
        if (profile?.avatar_url) {
          setParticipantAvatarUrl(profile.avatar_url)
        }
      }
    } catch (error) {
      console.error('Error loading participant name:', error)
    }
  }

  const loadChatData = async () => {
    if (!user?.id) return
    try {
      setLoading(true)
      let chatData = null

      if (chatId) {
        chatData = await ChatService.getChatById(chatId)
      } else if (taskId) {
        chatData = await ChatService.getOrCreateChat(taskId, user.id, 'temp-tasker-id')
      }

      if (!chatData) throw new Error('Chat not found')
      setChat(chatData)
      await loadParticipantName(chatData)

      const targetChatId = chatId || chatData.id
      const { cached, fresh } = await ChatService.getChatMessagesFast(targetChatId)

      if (cached && cached.length > 0) {
        setMessages(cached.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()))
      }

      fresh.then((msgs) => {
        if (msgs) {
          setMessages(msgs.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()))
        }
      })

      subscribeToRealtimeChat().catch(() => {})
      ChatService.markMessagesAsRead(chatData.id, user.id)
    } catch (error) {
      console.error('Error loading chat:', error)
      Alert.alert('Error', 'Failed to load chat')
    } finally {
      setLoading(false)
    }
  }

  const subscribeToRealtimeChat = async () => {
    if (!chat?.id || isSubscribed) return
    try {
      await ChatService.subscribeToChat(chat.id, {
        onMessage: (message) => {
          setMessages(prev => {
            const exists = prev.some(m => m.id === message.id)
            if (exists) return prev
            const newMsg: Message = {
              id: message.id,
              message: message.message,
              sender_id: message.sender_id,
              created_at: message.created_at,
              sender_name: message.sender?.full_name || 'Unknown',
              message_type: message.message_type || 'text',
              status: message.sender_id === user?.id ? 'delivered' : 'read'
            }
            return [...prev, newMsg].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
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
      status: 'sending'
    }

    setMessages(prev => [...prev, tempMsg].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()))

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
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'sent' } : m))
        // Reload chat data immediately to ensure everything is up to date
        await loadChatData()
        // Scroll to end after reload to show the new message
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true })
        }, 100)
      } else {
        setMessages(prev => prev.filter(m => m.id !== tempId))
        Alert.alert('Error', 'Message failed to send')
      }
    } catch (error) {
      setMessages(prev => prev.filter(m => m.id !== tempId))
      Alert.alert('Error', 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
    if (date.toDateString() === today.toDateString()) return 'Today'
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const isMyMessage = (msg: Message) => msg.sender_id === user?.id

  const MessageItem = memo(({ message, isMine, showDate, showAvatar, isGroupStart, isGroupEnd }: any) => {
    const handleImagePress = () => {
      if (message.message_type === 'image') {
        setSelectedImageUri(message.message)
        setImageModalVisible(true)
      }
    }

    return (
      <View style={styles.messageWrapper}>
        {showDate && (
          <View style={styles.dateSeparator}>
            <Text style={styles.dateSeparatorText}>{formatDate(message.created_at)}</Text>
          </View>
        )}
        <View style={[styles.messageRow, isMine ? styles.myMessageRow : styles.otherMessageRow]}>
          <TouchableWithoutFeedback onLongPress={() => {}}>
            <View style={[
              styles.messageBubble,
              isMine ? styles.myMessageBubble : styles.otherMessageBubble,
              isGroupEnd && (isMine ? styles.myBubbleTail : styles.otherBubbleTail),
            ]}>
              {message.message_type === 'image' ? (
                <TouchableOpacity activeOpacity={0.9} onPress={handleImagePress}>
                  <Image source={{ uri: message.message }} style={styles.messageImage} resizeMode="cover" />
                </TouchableOpacity>
              ) : (
                <Text style={[styles.messageText, isMine ? styles.myMessageText : styles.otherMessageText]}>
                  {message.message}
                </Text>
              )}
              <View style={styles.messageFooter}>
                <Text style={[styles.messageTime, isMine ? { color: '#666' } : { color: Colors.neutral[500] }]}>
                  {formatTime(message.created_at)}
                </Text>
                {isMine && message.status === 'sending' && <ActivityIndicator size={12} color="#999" style={{ marginLeft: 6 }} />}
                {isMine && message.status === 'sent' && <Ionicons name="checkmark" size={16} color="#999" style={{ marginLeft: 6 }} />}
                {isMine && message.status === 'read' && <Ionicons name="checkmark-done" size={16} color={Colors.primary[500]} style={{ marginLeft: 6 }} />}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </View>
    )
  })

  const renderMessage = useCallback(({ item, index }: { item: Message; index: number }) => {
    const prev = sortedMessages[index - 1]
    const next = sortedMessages[index + 1]
    const isMine = isMyMessage(item)
    const showDate = !prev || formatDate(item.created_at) !== formatDate(prev.created_at)
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
  }, [sortedMessages, participantName])

  const keyExtractor = useCallback((item: Message) => item.id, [])

  if (isLoading || loading) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right']}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <View style={styles.loadingHeader}>
          <SkeletonProfile />
        </View>
        <SkeletonList count={4} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Fixed Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <LinearGradient colors={['#f8f9fc', '#ffffff']} style={StyleSheet.absoluteFill} />
        <TouchableOpacity
          onPress={() => {
            // Prefer going back in history; otherwise fall back to chats list
            // @ts-ignore - canGoBack is available on router in Expo Router
            if (router.canGoBack && router.canGoBack()) {
              router.back()
            } else {
              router.replace('/chats')
            }
          }}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.neutral[800]} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.userInfo}>
          {participantAvatarUrl ? (
            <Image source={{ uri: participantAvatarUrl }} style={styles.avatarImage} />
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
        <FlatList
          ref={flatListRef}
          data={sortedMessages}
          renderItem={renderMessage}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          windowSize={10}
          initialNumToRender={15}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          nestedScrollEnabled={true}
          scrollEventThrottle={16}
          onContentSizeChange={() => {
            // Debounce scroll to prevent lag during keyboard animations
            if (scrollTimeoutRef.current) {
              clearTimeout(scrollTimeoutRef.current)
            }
            scrollTimeoutRef.current = setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true })
            }, 100)
          }}
          onLayout={(e) => {
            // Only scroll on initial layout when content is loaded
            if (sortedMessages.length > 0 && e.nativeEvent.layout.height > 0) {
              // Use requestAnimationFrame to avoid conflicts with keyboard animation
              requestAnimationFrame(() => {
                flatListRef.current?.scrollToEnd({ animated: false })
              })
            }
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="chatbubble-ellipses-outline" size={64} color={Colors.primary[400]} />
              <Text style={styles.emptyTitle}>Say hi to {participantFirstName}</Text>
              <Text style={styles.emptySubtitle}>Start the conversation!</Text>
            </View>
          }
        />

        {/* Input - Animated to stay above keyboard */}
        <Animated.View
          style={[
            styles.inputContainer,
            inputContainerAnimated,
          ]}
        >
          <View style={styles.inputRow}>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.textInput, { height: Math.min(MAX_INPUT_HEIGHT, Math.max(MIN_INPUT_HEIGHT, inputHeight)) }]}
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
            <Image source={{ uri: selectedImageUri }} style={styles.fullImage} resizeMode="contain" />
          )}
        </View>
      </Modal>

      {/* Options Modal */}
      <Modal visible={optionsVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setOptionsVisible(false)}>
          <View style={styles.optionsSheet}>
            <TouchableOpacity style={styles.optionItem} onPress={() => { setOptionsVisible(false); Alert.alert('Delete chat', 'Coming soon') }}>
              <Text style={styles.deleteText}>Delete chat</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionItem} onPress={() => setOptionsVisible(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background?.primary || '#f5f5f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background?.primary || '#fff' },
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
    paddingBottom: 10,
  },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyTitle: { fontSize: 20, fontWeight: '600', marginTop: 16, color: '#333' },
  emptySubtitle: { fontSize: 15, color: '#888', marginTop: 8 },

  messageWrapper: { marginVertical: 2 },
  dateSeparator: { alignItems: 'center', marginVertical: 16 },
  dateSeparatorText: { backgroundColor: 'rgba(0,0,0,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, fontSize: 12, color: '#666' },
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
    backgroundColor: '#d1f7c4',
    borderBottomRightRadius: 6,
  },
  otherMessageBubble: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d4d4d4',
  },
  myBubbleTail: { borderBottomRightRadius: 18 },
  otherBubbleTail: { borderBottomLeftRadius: 18 },

  messageText: { fontSize: 15.5, lineHeight: 21, color: '#000' },
  myMessageText: { color: '#000' },
  otherMessageText: { color: '#000' },
  messageFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 },
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
  closeModal: { position: 'absolute', top: 50, left: 20, zIndex: 1, backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 30 },
  fullImage: { width: '100%', height: '100%' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  optionsSheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 },
  optionItem: { paddingVertical: 16 },
  deleteText: { color: '#ff3b30', fontSize: 17, fontWeight: '600', textAlign: 'center' },
  cancelText: { color: '#333', fontSize: 17, textAlign: 'center' },
})