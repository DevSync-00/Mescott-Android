import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { RealtimeChatService, RealtimeMessage } from '../services/RealtimeChatService'
import { useAuth } from '../contexts/SimpleAuthContext'
import { Colors } from '../constants/Colors'

interface ChatComponentProps {
  chatId: string
  onClose: () => void
}

export default function ChatComponent({ chatId, onClose }: ChatComponentProps) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<RealtimeMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [chatInfo, setChatInfo] = useState<any>(null)
  const flatListRef = useRef<FlatList>(null)

  useEffect(() => {
    loadChatData()
    subscribeToChat()

    return () => {
      RealtimeChatService.unsubscribeFromChat(chatId)
    }
  }, [chatId])

  const loadChatData = async () => {
    try {
      setLoading(true)

      // Load chat info and messages
      const [chat, chatMessages] = await Promise.all([
        RealtimeChatService.getChatById(chatId),
        RealtimeChatService.getChatMessages(chatId, 50, 0),
      ])

      setChatInfo(chat)
      setMessages(chatMessages)

      // Mark messages as read
      if (user?.id) {
        await RealtimeChatService.markMessagesAsRead(chatId, user.id)
      }
    } catch (error) {
      console.error('Error loading chat data:', error)
      Alert.alert('Error', 'Failed to load chat')
    } finally {
      setLoading(false)
    }
  }

  const subscribeToChat = () => {
    RealtimeChatService.subscribeToChat(chatId, {
      onMessage: (message) => {
        setMessages((prev) => [...prev, message])
        // Auto-scroll to bottom
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true })
        }, 100)
      },
    })
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !user?.id || sending) return

    try {
      setSending(true)
      const success = await RealtimeChatService.sendMessage(chatId, user.id, newMessage.trim())

      if (success) {
        setNewMessage('')
      } else {
        Alert.alert('Error', 'Failed to send message')
      }
    } catch (error) {
      console.error('Error sending message:', error)
      Alert.alert('Error', 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const renderMessage = ({ item }: { item: RealtimeMessage }) => {
    const isOwn = item.sender_id === user?.user_id
    const senderName = item.sender?.full_name || 'Unknown'

    return (
      <View style={[styles.messageContainer, isOwn && styles.ownMessage]}>
        {!isOwn && (
          <View style={styles.senderInfo}>
            <Text style={styles.senderName}>{senderName}</Text>
          </View>
        )}
        <View style={[styles.messageBubble, isOwn && styles.ownMessageBubble]}>
          <Text style={[styles.messageText, isOwn && styles.ownMessageText]}>{item.message}</Text>
          <Text style={[styles.messageTime, isOwn && styles.ownMessageTime]}>
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    )
  }

  const getOtherParticipant = () => {
    if (!chatInfo || !user) return null

    if (chatInfo.customer_id === user.id) {
      return chatInfo.tasker
    } else {
      return chatInfo.customer
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary[500]} />
          <Text style={styles.loadingText}>Loading chat...</Text>
        </View>
      </SafeAreaView>
    )
  }

  const otherParticipant = getOtherParticipant()

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.neutral[900]} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{otherParticipant?.full_name || 'Chat'}</Text>
          <Text style={styles.headerSubtitle}>{chatInfo?.task?.title || 'Task Discussion'}</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      {/* Messages */}
      <View style={styles.messagesContainer}>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          bounces={false}
          alwaysBounceVertical={false}
          overScrollMode="never"
        />

        {/* Message Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.messageInput}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Type a message..."
            placeholderTextColor={Colors.neutral[400]}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.sendButton, sending && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={sending || !newMessage.trim()}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: Colors.neutral[600],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.primary,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral[900],
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.neutral[600],
    marginTop: 2,
  },
  placeholder: {
    width: 40,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  messageContainer: {
    marginBottom: 12,
    maxWidth: '80%',
  },
  ownMessage: {
    alignSelf: 'flex-end',
  },
  senderInfo: {
    marginBottom: 4,
  },
  senderName: {
    fontSize: 12,
    color: Colors.neutral[600],
    fontWeight: '500',
  },
  messageBubble: {
    backgroundColor: Colors.background.primary,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border.primary,
  },
  ownMessageBubble: {
    backgroundColor: Colors.primary[500],
    borderColor: Colors.primary[500],
  },
  messageText: {
    fontSize: 16,
    color: Colors.neutral[900],
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#fff',
  },
  messageTime: {
    fontSize: 12,
    color: Colors.neutral[500],
    marginTop: 4,
  },
  ownMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: Colors.background.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border.primary,
  },
  messageInput: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 12,
    fontSize: 16,
    color: Colors.neutral[900],
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: Colors.primary[500],
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: Colors.neutral[300],
  },
})
