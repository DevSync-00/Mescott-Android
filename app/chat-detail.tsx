import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, StyleSheet, TouchableOpacity, StatusBar, ActivityIndicator, Linking, Text } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { GiftedChat, Bubble, InputToolbar, Send, Actions, Day, MessageImage } from 'react-native-gifted-chat'
import { useAuth } from '../contexts/SimpleAuthContext'
import { useToast } from '../contexts/ToastContext'
import { ChatService, Chat } from '../services/ChatService'
import { RealtimeChatService } from '../services/RealtimeChatService'
import { Colors } from '../constants/Colors'
import TextureBackground from '../components/TextureBackground'
import * as ImagePicker from 'expo-image-picker'
import { ImageService } from '../services/ImageService'
import { FileService } from '../services/FileService'
import { Image } from 'expo-image'

type GiftedMessage = {
  _id: string
  text: string
  createdAt: Date
  user: { _id: string; name?: string; avatar?: string | null }
  image?: string
  fileUrl?: string
  status?: 'sending' | 'sent' | 'read'
}

export default function ChatDetail() {
  const { user, isAuthenticated, loading: isAuthLoading } = useAuth()
  const { showError, showSuccess } = useToast()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { chatId, taskId, otherUserName } = useLocalSearchParams<{
    chatId: string
    taskId: string
    taskTitle: string
    otherUserName: string
  }>()

  const [chat, setChat] = useState<Chat | null>(null)
  const [messages, setMessages] = useState<GiftedMessage[]>([])
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

  useFocusEffect(
    useCallback(() => {
      if (!isAuthLoading && !isAuthenticated) {
        router.replace('/auth')
      }
    }, [isAuthenticated, isAuthLoading, router]),
  )

  useEffect(() => {
    loadChat()
  }, [chatId, user?.id])

  const loadChat = async () => {
    if (!user?.id) return
    userIdRef.current = user.id
    try {
      setLoading(true)
      const targetChat = chatId
        ? await ChatService.getChatById(chatId)
        : taskId
          ? await ChatService.getOrCreateChat(taskId, user.id, 'temp-tasker-id')
          : null
      if (!targetChat) throw new Error('Chat not found')

      setChat(targetChat)

      const other =
        user.id === targetChat.customer_id ? targetChat.tasker : targetChat.customer
      setParticipantName(other?.full_name || otherUserName || '...')
      setParticipantAvatarUrl(other?.avatar_url || null)
      ChatService.cacheParticipant(targetChat.id, other?.full_name || '', other?.avatar_url || null)
      chatIdRef.current = targetChat.id

      const messagesResult = await ChatService.getChatMessagesFast(targetChat.id, 50)
      const fresh = messagesResult?.fresh ? await messagesResult.fresh : []
      setMessages(fresh.map(mapToGifted))

      await ChatService.markMessagesAsRead(targetChat.id, user.id)
      subscribe(targetChat.id)
    } catch (error) {
      console.error('Load chat failed', error)
      showError('Failed to load chat')
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
            const mapped = mapToGifted(message)
            const idx = prev.findIndex((m) => m._id === message.id)
            if (idx >= 0) {
              const copy = [...prev]
              copy[idx] = { ...copy[idx], ...mapped }
              return GiftedChat.sortMessages(copy)
            }
            const next = [...prev, mapped]
            return GiftedChat.sortMessages(next)
          })
          if (message.sender_id !== user?.id) {
            ChatService.markMessagesAsRead(id, user!.id)
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
    }
  }

  const mapToGifted = (msg: any): GiftedMessage => ({
    _id: msg.id,
    text:
      msg.message_type === 'file'
        ? '📎 ' + (msg.message?.split('/').pop() || 'File')
        : msg.message_type === 'image'
          ? ''
          : msg.message || '',
    createdAt: new Date(msg.created_at),
    user: {
      _id: msg.sender_id,
      name: msg.sender?.full_name || participantName || 'User',
      avatar: msg.sender?.avatar_url || null,
    },
    image: msg.message_type === 'image' ? msg.message : undefined,
    fileUrl: msg.message_type === 'file' ? msg.message : undefined,
    status: msg.is_read ? 'read' : 'sent',
  })

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      if (remoteTypingTimeoutRef.current) clearTimeout(remoteTypingTimeoutRef.current)
      if (typingBroadcastTimeoutRef.current) clearTimeout(typingBroadcastTimeoutRef.current)
    }
  }, [])

  const handleSend = async (outMessages: GiftedMessage[] = []) => {
    if (!user?.id || !chat?.id) return
    const outgoing = outMessages[0]
    setSending(true)
    setMessages((prev) => GiftedChat.append(prev, { ...outgoing, status: 'sending' }))
    try {
      const messageType = outgoing.image ? 'image' : outgoing.fileUrl ? 'file' : 'text'
      const content = outgoing.image || outgoing.fileUrl || outgoing.text
      const result = await ChatService.sendMessage(chat.id, user.id, content, messageType as any)
      if (!result) throw new Error('send failed')
      // reload statuses
      const { fresh } = await ChatService.getChatMessagesFast(chat.id)
      const latest = fresh ? await fresh : []
      setMessages(GiftedChat.sortMessages(latest.map(mapToGifted)))
    } catch (error) {
      console.error('Send failed', error)
      setMessages((prev) => prev.filter((m) => m._id !== outgoing._id))
      showError('Message failed to send')
    } finally {
      setSending(false)
    }
  }

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
          const draft: GiftedMessage = {
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
          const draft: GiftedMessage = {
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

  const renderActions = (props: any) => (
    <Actions
      {...props}
      onPressActionButton={pickImage}
      icon={() => (
        uploadingAttachment ? (
          <ActivityIndicator size="small" color={Colors.primary[500]} />
        ) : (
          <Ionicons name="attach" size={24} color={Colors.primary[600]} />
        )
      )}
      containerStyle={{ marginLeft: 4, marginBottom: 2 }}
    />
  )

  const renderSend = (props: any) => (
    <Send {...props} disabled={sending}>
      <View style={styles.sendButton}>
        {sending ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Ionicons name="send" size={18} color="#fff" />
        )}
      </View>
    </Send>
  )

  const renderBubble = (props: any) => {
    const status = props.currentMessage?.status
    const fileUrl = props.currentMessage?.fileUrl
    return (
      <View>
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
              backgroundColor: Colors.primary[500],
              borderRadius: 16,
              paddingHorizontal: 2,
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
            {status === 'sent' && <Ionicons name="checkmark" size={14} color="#fff" />}
            {status === 'read' && <Ionicons name="checkmark-done" size={14} color="#C7F0FF" />}
          </View>
        )}
      </View>
    )
  }

  const renderInputToolbar = (props: any) => (
    <InputToolbar
      {...props}
      containerStyle={styles.inputToolbar}
      primaryStyle={{ alignItems: 'center' }}
    />
  )

  const renderMessageImage = (props: any) => (
    <MessageImage
      {...props}
      imageStyle={{ borderRadius: 14, margin: 0 }}
    />
  )

  const renderScrollToBottom = () => (
    <View style={styles.scrollToBottom}>
      <Ionicons name="chevron-down" size={20} color="#fff" />
    </View>
  )

  const renderChatFooter = () => {
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
          <Text style={styles.footerText}>Typing...</Text>
        </View>
      )
    }
    return null
  }

  const renderAvatar = (props: any) => {
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
  }

  if (isAuthLoading || loading) {
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
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <View style={[styles.header, { paddingTop: 8 + insets.top }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/chats')}>
            <Ionicons name="arrow-back" size={24} color={Colors.neutral[800]} />
          </TouchableOpacity>
          <View style={styles.userInfo}>
            <Text style={styles.name} numberOfLines={1}>
              {participantName}
            </Text>
          </View>
          <View style={styles.headerAvatarContainer}>
            {participantAvatarUrl ? (
              <Image
                source={{ uri: participantAvatarUrl }}
                style={styles.headerAvatar}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={120}
              />
            ) : (
              <View style={[styles.headerAvatar, { backgroundColor: Colors.primary[100] }]}>
                <Text style={styles.avatarText}>
                  {participantName?.[0]?.toUpperCase() || '•'}
                </Text>
              </View>
            )}
          </View>
        </View>

        <GiftedChat
          messages={messages}
          onSend={(msgs) => handleSend(msgs as any)}
          user={{ _id: user!.id, name: user!.full_name || 'Me', avatar: user?.avatar_url }}
          renderBubble={renderBubble}
          renderSend={renderSend}
          renderActions={renderActions}
          renderInputToolbar={renderInputToolbar}
          renderMessageImage={renderMessageImage}
          renderAvatar={renderAvatar}
          renderChatFooter={renderChatFooter}
          renderScrollToBottom={renderScrollToBottom}
          alwaysShowSend
          scrollToBottom
          scrollToBottomComponent={renderScrollToBottom}
          showUserAvatar
          renderDay={(props) => <Day {...props} textStyle={{ color: Colors.neutral[500] }} />}
          onPressActionButton={pickFile}
          onInputTextChanged={(text: string) => {
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
          }}
          placeholder="Message..."
          timeTextStyle={{
            left: { color: Colors.neutral[500] },
            right: { color: '#E5ECFF' },
          }}
          messagesContainerStyle={{ backgroundColor: '#F8FAFF' }}
          bottomOffset={insets.bottom + 12}
          listViewProps={{ keyboardShouldPersistTaps: 'handled' }}
        />
      </SafeAreaView>
    </TextureBackground>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.neutral[200],
  },
  backButton: { padding: 8 },
  userInfo: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerAvatarContainer: { width: 40, height: 40, marginLeft: 8 },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary[500],
  },
  avatarText: { color: Colors.primary[600], fontWeight: '700' },
  name: { fontSize: 16, fontWeight: '700', color: Colors.neutral[900] },
  inputToolbar: {
    borderTopColor: Colors.neutral[200],
    paddingVertical: 6,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  sendButton: {
    backgroundColor: Colors.primary[500],
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    marginRight: 4,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingRight: 6,
    marginTop: 2,
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
