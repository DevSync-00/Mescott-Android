import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Linking,
  Text,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { GiftedChat, Bubble, Day, MessageImage, SystemMessage } from 'react-native-gifted-chat'
import { useAuth } from '../contexts/SimpleAuthContext'
import { useToast } from '../contexts/ToastContext'
import { useChatUnread } from '../contexts/ChatUnreadContext'
import { emitChatRead } from '../lib/chat/chatEvents'
import { ChatService, Chat } from '../services/ChatService'
import { RealtimeChatService } from '../services/RealtimeChatService'
import { Colors } from '../constants/Colors'
import TextureBackground from '../components/TextureBackground'
import ChatDetailHeader from '../components/chat/ChatDetailHeader'
import ChatConversationLayout from '../components/chat/ChatConversationLayout'
import { useMeasuredLayoutHeight } from '../hooks/useMeasuredLayoutHeight'
import {
  CHAT_LIST_EXTRA_PADDING,
  getChatKeyboardAvoidingProps,
} from '../lib/chat/keyboardLayout'
import * as ImagePicker from 'expo-image-picker'
import { ImageService } from '../services/ImageService'
import { FileService } from '../services/FileService'
import { Image } from 'expo-image'
import FullScreenImageViewer from '../components/FullScreenImageViewer'
import {
  mapMessageToGifted,
  giftedFromOutgoingDraft,
  type GiftedChatMessage,
} from '../lib/chat/messageMapper'
import {
  mergeGiftedWithLocal,
  replaceOptimisticMessage,
  sortGiftedMessagesNewestFirst,
} from '../lib/chat/mergeGiftedMessages'
import type { Message } from '../services/ChatService'

export default function ChatDetail() {
  const { user, isAuthenticated, loading: isAuthLoading } = useAuth()
  const { showError } = useToast()
  const { setActiveChatId, refreshTotalUnread } = useChatUnread()
  const router = useRouter()
  const { height: headerHeight, onLayout: onHeaderLayout } = useMeasuredLayoutHeight()
  const { chatId, taskId, otherUserName } = useLocalSearchParams<{
    chatId: string
    taskId: string
    taskTitle: string
    otherUserName: string
  }>()

  const [chat, setChat] = useState<Chat | null>(null)
  const [messages, setMessages] = useState<GiftedChatMessage[]>([])
  const [participantName, setParticipantName] = useState<string>(otherUserName || '...')
  const [participantAvatarUrl, setParticipantAvatarUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [remoteTyping, setRemoteTyping] = useState(false)
  const remoteTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const typingBroadcastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const chatIdRef = useRef<string | null>(null)
  const userIdRef = useRef<string | null>(null)
  const [imageViewerVisible, setImageViewerVisible] = useState(false)
  const [viewerImages, setViewerImages] = useState<string[]>([])
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0)
  useFocusEffect(
    useCallback(() => {
      if (!isAuthLoading && !isAuthenticated) {
        router.replace('/auth')
      }
    }, [isAuthenticated, isAuthLoading, router]),
  )

  useFocusEffect(
    useCallback(() => {
      const id = (typeof chatId === 'string' ? chatId : null) || chatIdRef.current
      if (id) setActiveChatId(id)
      return () => setActiveChatId(null)
    }, [chatId, setActiveChatId]),
  )

  useEffect(() => {
    loadChat()
  }, [chatId, user?.id])

  const mapServerMessages = useCallback(
    (serverMessages: Message[], nameOverride?: string) =>
      sortGiftedMessagesNewestFirst(
        serverMessages.map((msg) =>
          mapMessageToGifted(msg, {
            userId: user!.id,
            participantName: nameOverride ?? participantName,
          }),
        ),
      ),
    [user, participantName],
  )

  const loadChat = async () => {
    if (!user?.id) return
    userIdRef.current = user.id

    const resolvedChatId = typeof chatId === 'string' ? chatId : null
    let messagesPromise: Promise<Message[]> | null = null
    let showedCachedMessages = false

    if (resolvedChatId) {
      const cachedParticipant = ChatService.getCachedParticipant(resolvedChatId)
      if (cachedParticipant) {
        setParticipantName(cachedParticipant.participantName)
        setParticipantAvatarUrl(cachedParticipant.participantAvatarUrl)
      }

      const { cached, fresh } = await ChatService.getChatMessagesFast(resolvedChatId, 50)
      messagesPromise = fresh

      if (cached.length > 0) {
        setMessages(mapServerMessages(cached, cachedParticipant?.participantName))
        setLoading(false)
        showedCachedMessages = true
      } else {
        setLoading(true)
      }

      chatIdRef.current = resolvedChatId
    } else {
      setLoading(true)
    }

    try {
      const targetChat = resolvedChatId
        ? await ChatService.getChatById(resolvedChatId)
        : taskId
          ? await ChatService.getOrCreateChat(taskId, user.id, 'temp-tasker-id')
          : null
      if (!targetChat) throw new Error('Chat not found')

      setChat(targetChat)

      const other =
        user.id === targetChat.customer_id ? targetChat.tasker : targetChat.customer
      const displayName = other?.full_name || otherUserName || '...'
      setParticipantName(displayName)
      setParticipantAvatarUrl(other?.avatar_url || null)
      ChatService.cacheParticipant(targetChat.id, displayName, other?.avatar_url || null)
      chatIdRef.current = targetChat.id

      if (!messagesPromise || targetChat.id !== resolvedChatId) {
        const fast = await ChatService.getChatMessagesFast(targetChat.id, 50)
        messagesPromise = fast.fresh
        if (!showedCachedMessages) {
          const { cached } = fast
          if (cached.length > 0) {
            setMessages(mapServerMessages(cached, displayName))
            setLoading(false)
            showedCachedMessages = true
          }
        }
      }

      await subscribe(targetChat.id)

      const freshMessages = await messagesPromise
      setMessages((prev) =>
        mergeGiftedWithLocal(mapServerMessages(freshMessages, displayName), prev),
      )

      await ChatService.markMessagesAsRead(targetChat.id, user.id)
      emitChatRead(targetChat.id)
      refreshTotalUnread().catch(() => {})
    } catch (error) {
      console.error('Load chat failed', error)
      if (!showedCachedMessages) {
        showError('Failed to load chat')
      }
    } finally {
      setLoading(false)
    }
  }

  const subscribe = async (id: string) => {
    if (isSubscribed) return
    try {
      await RealtimeChatService.subscribeToChat(id, {
        onMessage: (message) => {
          setMessages((prev) => {
            const mapped = mapMessageToGifted(message as Message, {
              userId: user!.id,
              participantName,
            })
            const existingIndex = prev.findIndex((m) => String(m._id) === String(mapped._id))
            if (existingIndex >= 0) {
              const updated = [...prev]
              updated[existingIndex] = { ...updated[existingIndex], ...mapped }
              return sortGiftedMessagesNewestFirst(updated)
            }
            return sortGiftedMessagesNewestFirst([mapped, ...prev])
          })
          // Mark as read if message is from other user
          if (message.sender_id !== user?.id && user?.id) {
            ChatService.markMessagesAsRead(id, user.id)
              .then((ok) => {
                if (ok) {
                  emitChatRead(id)
                  refreshTotalUnread().catch(() => {})
                }
              })
              .catch((err: unknown) => {
                console.error('Failed to mark message as read:', err)
              })
          }
        },
        onTyping: (senderId, typing) => {
          if (senderId === user?.id) return
          if (remoteTypingTimeoutRef.current) clearTimeout(remoteTypingTimeoutRef.current)
          setRemoteTyping(typing)
          if (typing) {
            remoteTypingTimeoutRef.current = setTimeout(() => setRemoteTyping(false), 2000)
          }
        },
      })
      setIsSubscribed(true)
    } catch (error) {
      console.error('Subscribe failed', error)
      showError('Failed to connect to chat')
    }
  }

  // Cleanup subscriptions and timers on unmount
  useEffect(() => {
    return () => {
      // Clear all timers
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      if (remoteTypingTimeoutRef.current) clearTimeout(remoteTypingTimeoutRef.current)
      if (typingBroadcastTimeoutRef.current) clearTimeout(typingBroadcastTimeoutRef.current)
      // Unsubscribe from real-time updates
      if (chatIdRef.current && isSubscribed) {
        try {
          RealtimeChatService.unsubscribeFromChat(chatIdRef.current)
        } catch (err) {
          console.error('Failed to unsubscribe:', err)
        }
        setIsSubscribed(false)
      }
    }
  }, [isSubscribed])

  const handleSend = useCallback(
    async (outMessages: GiftedChatMessage[] = []) => {
      if (!user?.id || !chat?.id || sending) return
      const outgoing = outMessages[0]
      if (!outgoing) return

      const messageType = outgoing.image ? 'image' : outgoing.fileUrl ? 'file' : 'text'
      const content = outgoing.image || outgoing.fileUrl || outgoing.text
      if (!content) return

      setSending(true)
      const tempId = String(outgoing._id || `temp-${Date.now()}`)
      const optimisticMessage = giftedFromOutgoingDraft(
        {
          ...outgoing,
          _id: tempId,
          user: {
            _id: user.id,
            name: user.full_name || 'Me',
            avatar: user.avatar_url,
          },
        },
        'sending',
      )

      setMessages((prev) => sortGiftedMessagesNewestFirst([optimisticMessage, ...prev]))

      try {
        const result = await ChatService.sendMessage(chat.id, user.id, content, messageType)
        if (!result) throw new Error('send failed')

        const confirmed = mapMessageToGifted(result, {
          userId: user.id,
          participantName,
          statusOverride: String(result.id).startsWith('offline-') ? 'pending' : 'sent',
        })

        setMessages((prev) => replaceOptimisticMessage(prev, tempId, confirmed))
      } catch (error) {
        console.error('Send failed', error)
        setMessages((prev) =>
          prev.map((m) =>
            String(m._id) === tempId ? { ...m, status: 'failed' as const } : m,
          ),
        )
        showError('Message failed to send. Tap the message to retry.')
      } finally {
        setSending(false)
      }
    },
    [user, chat?.id, sending, participantName, showError],
  )

  const retryFailedMessage = useCallback(
    (failed: GiftedChatMessage) => {
      if (!failed.pendingPayload || sending) return
      setMessages((prev) => prev.filter((m) => String(m._id) !== String(failed._id)))

      const { text, image, fileUrl } = failed.pendingPayload
      const draft: GiftedChatMessage = {
        _id: `temp-${Date.now()}`,
        text: text || '',
        createdAt: new Date(),
        user: {
          _id: user!.id,
          name: user!.full_name || 'Me',
          avatar: user?.avatar_url,
        },
        image,
        fileUrl,
      }
      handleSend([draft])
    },
    [handleSend, sending, user],
  )

  const pickImage = async () => {
    try {
      setUploadingAttachment(true)
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (perm.status !== 'granted') {
        showError('Permission required to access photos')
        return
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      })
      if (!result.canceled && result.assets[0]) {
        const upload = await ImageService.uploadImage(result.assets[0].uri, 'chat-images')
        if (upload.success && upload.url) {
          const draft: GiftedChatMessage = {
            _id: `temp-${Date.now()}`,
            text: '',
            createdAt: new Date(),
            user: { _id: user!.id, name: user!.full_name || 'Me' },
            image: upload.url,
          }
          handleSend([draft])
        } else {
          showError(upload.error || 'Upload failed')
        }
      }
    } catch (error) {
      console.error('Pick image failed', error)
      showError('Failed to send image')
    } finally {
      setUploadingAttachment(false)
    }
  }

  const pickFile = async () => {
    try {
      setUploadingAttachment(true)
      const res = await FileService.pickDocument({ type: ['*/*'], copyToCacheDirectory: true })
      if (!res.canceled && 'uri' in res) {
        const upload = await FileService.uploadFile((res as any).uri, 'chat-attachments')
        if (upload.success && upload.url) {
          const draft: GiftedChatMessage = {
            _id: `temp-${Date.now()}`,
            text: '📎 ' + ((upload.url.split('/').pop() as string) || 'File'),
            createdAt: new Date(),
            user: { _id: user!.id, name: user!.full_name || 'Me' },
            fileUrl: upload.url,
          }
          handleSend([draft])
        } else {
          showError(upload.error || 'Upload failed')
        }
      }
    } catch (error) {
      console.error('Pick file failed', error)
      showError('Failed to send file')
    } finally {
      setUploadingAttachment(false)
    }
  }

  const renderBubble = useCallback(
    (props: any) => {
      const current = props.currentMessage as GiftedChatMessage | undefined
      const status = current?.status
      const fileUrl = current?.fileUrl
      const isFailed = status === 'failed'
      const isPending = status === 'pending'

      const bubble = (
        <Bubble
          {...props}
          wrapperStyle={{
            left: {
              backgroundColor: '#ffffff',
              borderWidth: 1,
              borderColor: Colors.neutral[200],
              borderRadius: 16,
              paddingHorizontal: 2,
            },
            right: {
              backgroundColor: isFailed ? Colors.error[500] : Colors.primary[500],
              borderRadius: 16,
              paddingHorizontal: 2,
              opacity: isPending ? 0.85 : 1,
            },
          }}
          textStyle={{
            left: { color: Colors.neutral[900], fontWeight: '500' },
            right: { color: '#fff', fontWeight: '500' },
          }}
          containerStyle={{
            left: { marginBottom: 6 },
            right: { marginBottom: 6 },
          }}
        />
      )

      return (
        <View>
          {isFailed ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => current && retryFailedMessage(current)}
              accessibilityRole="button"
              accessibilityLabel="Retry sending message"
            >
              {bubble}
            </TouchableOpacity>
          ) : (
            bubble
          )}
          {fileUrl && (
            <TouchableOpacity style={styles.fileRow} onPress={() => Linking.openURL(fileUrl)}>
              <Ionicons name="document" size={16} color={Colors.primary[600]} />
              <Text style={styles.fileText} numberOfLines={1}>
                {fileUrl.split('/').pop() || 'File'}
              </Text>
            </TouchableOpacity>
          )}
          {status && props.position === 'right' && (
            <View style={styles.statusRow}>
              {status === 'sending' && <ActivityIndicator size={12} color="#fff" />}
              {status === 'pending' && (
                <>
                  <Ionicons name="time-outline" size={14} color="#fff" />
                  <Text style={styles.statusHint}>Pending</Text>
                </>
              )}
              {status === 'failed' && (
                <>
                  <Ionicons name="alert-circle" size={14} color="#fff" />
                  <Text style={styles.statusHint}>Tap to retry</Text>
                </>
              )}
              {status === 'sent' && <Ionicons name="checkmark" size={14} color="#fff" />}
              {status === 'read' && <Ionicons name="checkmark-done" size={14} color="#C7F0FF" />}
            </View>
          )}
        </View>
      )
    },
    [retryFailedMessage],
  )

  const keyboardAvoidingViewProps = useMemo(
    () => getChatKeyboardAvoidingProps({ headerHeight, bottomInset: 0 }),
    [headerHeight],
  )

  const listContentInset = useMemo(
    () => ({ paddingTop: CHAT_LIST_EXTRA_PADDING }),
    [],
  )

  const handleComposerTextChange = useCallback(
    (text: string) => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      setIsTyping(!!text)
      typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 1200)
      if (chat?.id && user?.id) {
        RealtimeChatService.sendTyping(chat.id, user.id, true).catch(() => {})
        if (typingBroadcastTimeoutRef.current) clearTimeout(typingBroadcastTimeoutRef.current)
        typingBroadcastTimeoutRef.current = setTimeout(() => {
          RealtimeChatService.sendTyping(chat.id!, user.id!, false).catch(() => {})
        }, 1200)
      }
    },
    [chat?.id, user?.id],
  )

  const handleComposerSendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || !user?.id) return

      const draft: GiftedChatMessage = {
        _id: `temp-${Date.now()}`,
        text: trimmed,
        createdAt: new Date(),
        user: { _id: user.id, name: user.full_name || 'Me', avatar: user?.avatar_url ?? null },
      }
      handleSend([draft])
    },
    [user, handleSend],
  )

  /** Stable reference — prevents GiftedChat from remounting the toolbar on each keystroke. */
  const renderNullInputToolbar = useCallback(() => null, [])

  const composerProps = useMemo(
    () => ({
      onSendMessage: handleComposerSendMessage,
      onTextChange: handleComposerTextChange,
      onPickImage: pickImage,
      onPickFile: pickFile,
      sending,
      uploadingAttachment,
    }),
    [
      handleComposerSendMessage,
      handleComposerTextChange,
      pickImage,
      pickFile,
      sending,
      uploadingAttachment,
    ],
  )

  const handleBack = useCallback(() => {
    router.replace('/chats')
  }, [router])

  const handleTaskPress = useCallback(() => {
    if (!chat?.task_id) return
    router.push({ pathname: '/task-detail', params: { taskId: chat.task_id } })
  }, [chat?.task_id, router])

  const renderSystemMessage = useCallback((props: any) => {
    return (
      <View style={styles.systemMessageWrap}>
        <SystemMessage
          {...props}
          textStyle={styles.systemMessageText}
          containerStyle={styles.systemMessageContainer}
        />
      </View>
    )
  }, [])

  const renderMessageImage = useCallback((props: any) => {
    const imageUri = props.currentMessage?.image
    if (!imageUri) return null

    // Collect all image messages for gallery view
    const imageMessages = messages.filter((m) => m.image).map((m) => m.image!)
    const currentImageIndex = imageMessages.findIndex((uri) => uri === imageUri)

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => {
          if (imageMessages.length > 0) {
            setViewerImages(imageMessages)
            setViewerInitialIndex(currentImageIndex >= 0 ? currentImageIndex : 0)
            setImageViewerVisible(true)
          }
        }}
      >
        <MessageImage
          {...props}
          imageStyle={{ borderRadius: 14, margin: 0 }}
        />
      </TouchableOpacity>
    )
  }, [messages])

  const renderScrollToBottom = useCallback(() => (
    <View style={styles.scrollToBottom}>
      <Ionicons name="chevron-down" size={20} color="#fff" />
    </View>
  ), [])

  const renderChatFooter = useCallback(() => {
    if (uploadingAttachment) {
      return (
        <View style={styles.footerRow}>
          <ActivityIndicator size="small" color={Colors.primary[500]} />
          <Text style={styles.footerText}>Uploading attachment...</Text>
        </View>
      )
    }
    if (remoteTyping) {
      return (
        <View style={styles.footerRow}>
          <View style={styles.typingDot} />
          <View style={styles.typingDot} />
          <View style={styles.typingDot} />
          <Text style={styles.footerText}>{participantName} is typing...</Text>
        </View>
      )
    }
    return null
  }, [uploadingAttachment, remoteTyping, participantName])

  const renderAvatar = useCallback((props: any) => {
    const uri = props.currentMessage?.user?.avatar || participantAvatarUrl
    const fallback = props.currentMessage?.user?.name?.[0]?.toUpperCase() || '•'
    return (
      <View style={styles.avatarWrapper}>
        <View style={styles.avatarRing} />
        {uri ? (
          <Image
            source={{ uri }}
            style={styles.avatarImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={120}
          />
        ) : (
          <View style={[styles.avatarImagePlaceholder, { backgroundColor: Colors.primary[100] }]}>
            <Text style={[styles.avatarFallback, { color: Colors.primary[600] }]}>{fallback}</Text>
          </View>
        )}
      </View>
    )
  }, [participantAvatarUrl])

  if (isAuthLoading || (loading && messages.length === 0)) {
    return (
      <TextureBackground>
        <SafeAreaView style={styles.loadingContainer} edges={['left', 'right']}>
          <StatusBar barStyle="dark-content" translucent />
          <ActivityIndicator size="large" color={Colors.primary[500]} />
        </SafeAreaView>
      </TextureBackground>
    )
  }

  if (!isAuthenticated) return null

  return (
    <TextureBackground>
      <SafeAreaView style={styles.container} edges={['left', 'right']}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <ChatDetailHeader
          participantName={participantName}
          participantAvatarUrl={participantAvatarUrl}
          taskTitle={chat?.task?.title}
          onBack={handleBack}
          onTaskPress={chat?.task_id ? handleTaskPress : undefined}
          onLayout={onHeaderLayout}
        />

        <ChatConversationLayout composerProps={composerProps}>
          <GiftedChat
            messages={messages as any}
            onSend={(msgs) => handleSend(msgs as any)}
            user={{ _id: user!.id, name: user!.full_name || 'Me', avatar: user?.avatar_url }}
            renderBubble={renderBubble}
            renderSystemMessage={renderSystemMessage}
            renderInputToolbar={renderNullInputToolbar}
            renderMessageImage={renderMessageImage}
            renderAvatar={renderAvatar}
            renderChatFooter={renderChatFooter}
            scrollToBottom
            scrollToBottomComponent={renderScrollToBottom}
            showUserAvatar
            keyboardAvoidingViewProps={keyboardAvoidingViewProps}
            renderDay={(props) => <Day {...props} textStyle={{ color: Colors.neutral[500] }} />}
            timeTextStyle={{
              left: { color: Colors.neutral[500] },
              right: { color: '#E5ECFF' },
            }}
            messagesContainerStyle={styles.messagesContainer}
            listViewProps={{
              keyboardShouldPersistTaps: 'handled',
              keyboardDismissMode: 'on-drag',
              contentContainerStyle: listContentInset,
              removeClippedSubviews: Platform.OS === 'android',
              maxToRenderPerBatch: 10,
              updateCellsBatchingPeriod: 50,
              initialNumToRender: 15,
              windowSize: 10,
            }}
          />
        </ChatConversationLayout>

        {/* Full Screen Image Viewer for Chat Images */}
        <FullScreenImageViewer
          visible={imageViewerVisible}
          images={viewerImages}
          initialIndex={viewerInitialIndex}
          onClose={() => setImageViewerVisible(false)}
        />
      </SafeAreaView>
    </TextureBackground>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  messagesContainer: { backgroundColor: '#F8FAFF' },
  systemMessageWrap: {
    alignItems: 'center',
    marginVertical: 8,
    paddingHorizontal: 24,
  },
  systemMessageContainer: {
    backgroundColor: Colors.neutral[100],
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.neutral[200],
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: '92%',
  },
  systemMessageText: {
    fontSize: 13,
    color: Colors.neutral[600],
    textAlign: 'center',
    fontWeight: '500',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingRight: 6,
    marginTop: 2,
    gap: 4,
  },
  statusHint: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 6,
    marginTop: 6,
    gap: 6,
  },
  fileText: { color: Colors.primary[700], maxWidth: 220 },
  scrollToBottom: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  footerText: { marginLeft: 8, color: Colors.neutral[600], fontSize: 13, fontWeight: '500' },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary[400],
    marginRight: 4,
    opacity: 0.7,
  },
  avatarWrapper: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRing: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.primary[200],
  },
  avatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary[200],
  },
  avatarImagePlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallback: { fontWeight: '700', fontSize: 14 },
})
