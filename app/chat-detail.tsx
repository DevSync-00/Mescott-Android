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
  ScrollView,
} from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router'
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming, runOnJS, FadeIn, FadeOut } from 'react-native-reanimated'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
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
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import { ImageService } from '../services/ImageService'
import { FileService } from '../services/FileService'
import { Linking, Share } from 'react-native'

const { width: screenWidth, height: screenHeight } = Dimensions.get('window')

// Image Zoom Viewer Component (Telegram/WhatsApp Style)
const ImageZoomViewer = ({ imageUri, onTap, fullHeight }: { imageUri: string; onTap: () => void; fullHeight: number }) => {
  const scale = useSharedValue(1)
  const savedScale = useSharedValue(1)
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)
  const savedTranslateX = useSharedValue(0)
  const savedTranslateY = useSharedValue(0)

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale
    })
    .onEnd(() => {
      savedScale.value = scale.value
      if (scale.value < 1) {
        scale.value = withSpring(1)
        savedScale.value = 1
        translateX.value = withSpring(0)
        translateY.value = withSpring(0)
        savedTranslateX.value = 0
        savedTranslateY.value = 0
      } else if (scale.value > 3) {
        scale.value = withSpring(3)
        savedScale.value = 3
      }
    })

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1) {
        translateX.value = savedTranslateX.value + e.translationX
        translateY.value = savedTranslateY.value + e.translationY
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value
      savedTranslateY.value = translateY.value
    })

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withSpring(1)
        savedScale.value = 1
        translateX.value = withSpring(0)
        translateY.value = withSpring(0)
        savedTranslateX.value = 0
        savedTranslateY.value = 0
      } else {
        scale.value = withSpring(2)
        savedScale.value = 2
      }
    })

  const tapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      runOnJS(onTap)()
    })

  const composedGesture = Gesture.Simultaneous(
    Gesture.Race(doubleTapGesture, tapGesture),
    Gesture.Simultaneous(pinchGesture, panGesture),
  )

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    }
  })

  return (
    <View style={[styles.imageZoomContainer, { height: fullHeight }]}>
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={animatedStyle}>
          <Image
            source={{ uri: imageUri }}
            style={styles.fullImage}
            contentFit="contain"
            cachePolicy="memory-disk"
          />
        </Animated.View>
      </GestureDetector>
    </View>
  )
}
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
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true) // Start as true to load participant data first
  const [initialLoad, setInitialLoad] = useState(true) // Track if we've done initial load
  const [sending, setSending] = useState(false)
  const [participantName, setParticipantName] = useState<string>(otherUserName || '...')
  const [participantAvatarUrl, setParticipantAvatarUrl] = useState<string | null>(null)
  const [participantDataLoaded, setParticipantDataLoaded] = useState(false)
  const participantFirstName = useMemo(() => {
    if (!participantName) return 'there'
    const [first] = participantName.trim().split(' ')
    return first || 'there'
  }, [participantName])
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [imageModalVisible, setImageModalVisible] = useState(false)
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [showImageHeader, setShowImageHeader] = useState(true)
  const imageScrollX = useSharedValue(0)
  const savedScrollOffset = useRef<number | null>(null)
  const currentScrollOffset = useRef<number>(0)
  const isRestoringScroll = useRef<boolean>(false)
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const [showAttachmentOptions, setShowAttachmentOptions] = useState(false)
  const [selectedImageForEdit, setSelectedImageForEdit] = useState<string | null>(null)
  const [showImageEditor, setShowImageEditor] = useState(false)
  const [filePreviewVisible, setFilePreviewVisible] = useState(false)
  const [previewFileUrl, setPreviewFileUrl] = useState<string | null>(null)
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
    // Reset state when chatId changes
    setMessages([])
    setChat(null)
    setInitialLoad(true)
    setLoading(true)
    setParticipantDataLoaded(false)

    if (chatId && user?.id) {
      // INSTANT LOADING: Try to get cached participant data first (Telegram-style)
      const cachedParticipant = ChatService.getCachedParticipant(chatId)
      if (cachedParticipant) {
        // Set participant info INSTANTLY from cache
        setParticipantName(cachedParticipant.participantName)
        setParticipantAvatarUrl(cachedParticipant.participantAvatarUrl)
        setParticipantDataLoaded(true)
        setLoading(false)
      } else {
        // Fallback to otherUserName or empty
        setParticipantName(otherUserName || '...')
        setParticipantAvatarUrl(null)
      }

      // Load chat data to get/refresh participant info
      loadChatData()
      
      // Load cached messages synchronously if available
      const cached = ChatService['messageCache'].get(chatId)
      if (cached && cached.length > 0) {
        setMessages(cached)
      }
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

      // PRIORITY 1: Load chat data FIRST to get participant info immediately
      const chatDataResult = targetChatId
        ? await ChatService.getChatById(targetChatId)
        : taskId
          ? await ChatService.getOrCreateChat(taskId, user.id, 'temp-tasker-id')
          : null

      if (!chatDataResult) throw new Error('Chat not found')

      // IMMEDIATELY update participant info (before messages) - prevents "Unknown" flash
      if (chatDataResult.customer && chatDataResult.tasker) {
        const isCustomer = user.id === chatDataResult.customer_id
        const otherParticipant = isCustomer ? chatDataResult.tasker : chatDataResult.customer
        
        const participantName = otherParticipant?.full_name || otherUserName || '...'
        const participantAvatar = otherParticipant?.avatar_url || null
        
        // Set participant info ASAP
        setParticipantName(participantName)
        setParticipantAvatarUrl(participantAvatar)
        setParticipantDataLoaded(true)
        
        // Cache participant data for instant loading next time (Telegram-style)
        ChatService.cacheParticipant(chatDataResult.id, participantName, participantAvatar)
      } else {
        setParticipantName(otherUserName || '...')
        setParticipantAvatarUrl(null)
        setParticipantDataLoaded(true)
      }

      setChat(chatDataResult)

      // PRIORITY 2: Load messages after participant info is set
      const messagesResult = targetChatId
        ? await ChatService.getChatMessagesFast(targetChatId, 30)
        : null

      // Get fresh messages
      const freshMessages = messagesResult?.fresh ? await messagesResult.fresh : []

      // Update messages with fresh data
      // Also update message status based on is_read: single tick when sent, double tick when read
      if (freshMessages && freshMessages.length > 0) {
        const messagesWithStatus = freshMessages.map((msg: any) => {
          let messageStatus: 'sending' | 'sent' | 'delivered' | 'read' = 'sent'
          if (msg.sender_id === user.id) {
            // For our messages: sent = single tick, read = double tick
            messageStatus = msg.is_read ? 'read' : 'sent'
          }
          return {
            ...msg,
            status: messageStatus,
          }
        })
        setMessages(messagesWithStatus)
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
      setParticipantDataLoaded(true) // Set to true even on error to prevent infinite loading
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
            // Determine message status: single tick when sent, double tick when read
            let messageStatus: 'sending' | 'sent' | 'delivered' | 'read' = 'sent'
            if (message.sender_id === user?.id) {
              // For our messages: sent = single tick, read = double tick
              messageStatus = message.is_read ? 'read' : 'sent'
            }
            
            const existingIndex = prev.findIndex((m) => m.id === message.id)
            const updatedMessage: Message = {
              id: message.id,
              message: message.message,
              sender_id: message.sender_id,
              created_at: message.created_at,
              sender_name: message.sender?.full_name || 'Unknown',
              message_type: message.message_type || 'text',
              is_read: message.is_read,
              status: messageStatus,
            }

            if (existingIndex !== -1) {
              // Update existing message (for real-time read status updates)
              const updated = [...prev]
              updated[existingIndex] = { ...updated[existingIndex], ...updatedMessage }
              return updated
            } else {
              // Add new message
              return [...prev, updatedMessage].sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
              )
            }
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

  const sendMessage = async (attachmentUrl?: string, attachmentType: 'text' | 'image' | 'file' = 'text') => {
    const messageText = newMessage.trim()
    const hasAttachment = !!attachmentUrl
    const hasText = !!messageText
    
    if ((!hasText && !hasAttachment) || sending || !user?.id) return
    
    const content = hasAttachment ? attachmentUrl! : messageText
    const messageType = hasAttachment ? attachmentType : 'text'
    
    setNewMessage('')

    const tempId = `temp_${Date.now()}`
    const tempMsg: Message = {
      id: tempId,
      message: content,
      sender_id: user.id,
      created_at: new Date().toISOString(),
      status: 'sending',
      message_type: messageType,
    }

    // Add message - sorting will be handled by sortedMessages memo
    setMessages((prev) => [...prev, tempMsg])

    try {
      setSending(true)
      let success = false
      if (chat?.id) {
        const result = await ChatService.sendMessage(chat.id, user.id, content, messageType)
        success = result !== null
      } else if (chatId) {
        const result = await ChatService.sendMessage(chatId, user.id, content, messageType)
        success = result !== null
      }

      if (success) {
        // Update status to 'sent' (single tick) - will update to 'read' (double tick) when recipient reads it
        setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: 'sent', is_read: false } : m)))
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

  const handlePickImage = async () => {
    try {
      setShowAttachmentOptions(false)

      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        showInfoAlert('Permission Required', 'Please grant photo library permissions to send images.')
        return
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      })

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0]
        // Show preview/edit screen (optional editing)
        setSelectedImageForEdit(asset.uri)
        setShowImageEditor(true)
      }
    } catch (error) {
      console.error('Error picking image:', error)
      showError('Failed to pick image')
    }
  }

  const handleTakePhoto = async () => {
    try {
      setShowAttachmentOptions(false)

      // Request camera permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync()
      if (status !== 'granted') {
        showInfoAlert('Permission Required', 'Please grant camera permissions to take photos.')
        return
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      })

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0]
        // Show preview/edit screen (optional editing)
        setSelectedImageForEdit(asset.uri)
        setShowImageEditor(true)
      }
    } catch (error) {
      console.error('Error taking photo:', error)
      showError('Failed to take photo')
    }
  }

  const handleSendImage = async (imageUri: string) => {
    try {
      setShowImageEditor(false)
      setUploadingAttachment(true)

      // Upload image
      const uploadResult = await ImageService.uploadImage(imageUri, 'chat-images')
      
      if (uploadResult.success && uploadResult.url) {
        await sendMessage(uploadResult.url, 'image')
      } else {
        showError(uploadResult.error || 'Failed to upload image')
      }
    } catch (error) {
      console.error('Error sending image:', error)
      showError('Failed to send image')
    } finally {
      setUploadingAttachment(false)
      setSelectedImageForEdit(null)
    }
  }

  const handleEditImage = async () => {
    if (!selectedImageForEdit) return
    try {
      // Launch image editor
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: false,
      })

      if (!result.canceled && result.assets[0]) {
        setSelectedImageForEdit(result.assets[0].uri)
      }
    } catch (error) {
      console.error('Error editing image:', error)
      showError('Failed to edit image')
    }
  }

  const handlePickFile = async () => {
    try {
      setShowAttachmentOptions(false)
      setUploadingAttachment(true)

      // Pick document
      const result = await FileService.pickDocument({
        type: ['*/*'],
        copyToCacheDirectory: true,
      })

      if (!result.canceled && 'uri' in result) {
        const fileUri = (result as any).uri as string
        if (fileUri) {
          // Upload file
          const uploadResult = await FileService.uploadFile(fileUri, 'chat-attachments')

          if (uploadResult.success && uploadResult.url) {
            await sendMessage(uploadResult.url, 'file')
          } else {
            showError(uploadResult.error || 'Failed to upload file')
          }
        }
      }
    } catch (error) {
      console.error('Error picking file:', error)
      showError('Failed to pick file')
    } finally {
      setUploadingAttachment(false)
    }
  }

  const [downloadingFile, setDownloadingFile] = useState<string | null>(null)
  const [fileDownloadProgress, setFileDownloadProgress] = useState(0)

  const handleFilePress = (fileUrl: string) => {
    setPreviewFileUrl(fileUrl)
    setFilePreviewVisible(true)
  }

  const handleDownloadFile = async (fileUrl: string) => {
    try {
      setDownloadingFile(fileUrl)

      // Get file name from URL
      const fileName = fileUrl.split('/').pop() || 'file'
      
      // Create download directory if it doesn't exist
      // Use cache directory for downloads (available on both iOS and Android)
      // @ts-ignore - cacheDirectory exists at runtime but may not be in types
      const cacheDir = FileSystem.cacheDirectory || ''
      const downloadDir = `${cacheDir}downloads/`
      const dirInfo = await FileSystem.getInfoAsync(downloadDir)
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(downloadDir, { intermediates: true })
      }

      // Download file
      const fileUri = `${downloadDir}${fileName}`
      const downloadResult = await FileSystem.downloadAsync(fileUrl, fileUri)

      if (downloadResult.status === 200) {
        showSuccess('File downloaded successfully!')
        // Try to open the file, if that fails, share it
        try {
          await Linking.openURL(downloadResult.uri)
        } catch {
          // If opening fails, share the file
          await Share.share({ url: downloadResult.uri })
        }
      } else {
        showError('Failed to download file')
      }
    } catch (error) {
      console.error('Error downloading file:', error)
      showError('Failed to download file. Please try again.')
    } finally {
      setDownloadingFile(null)
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

  // Extract file type from URL for file attachments
  const getFileTypeFromUrl = useCallback((url: string): string => {
    try {
      const extension = url.split('.').pop()?.toLowerCase() || ''
      const mimeTypes: Record<string, string> = {
        pdf: 'application/pdf',
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        xls: 'application/vnd.ms-excel',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ppt: 'application/vnd.ms-powerpoint',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        txt: 'text/plain',
        zip: 'application/zip',
        rar: 'application/x-rar-compressed',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        mp4: 'video/mp4',
        mov: 'video/quicktime',
        mp3: 'audio/mpeg',
        wav: 'audio/wav',
      }
      return mimeTypes[extension] || 'application/octet-stream'
    } catch {
      return 'application/octet-stream'
    }
  }, [])

  const MessageItem = memo(
    ({ message, isMine, showDate, showAvatar, isGroupStart, isGroupEnd }: any) => {
      const handleImagePress = useCallback(() => {
        if (message.message_type === 'image') {
          // Save current scroll position before opening modal
          savedScrollOffset.current = currentScrollOffset.current
          isRestoringScroll.current = true
          
          // Find all image messages and get the index
          const imageMessages = messages.filter((m) => m.message_type === 'image')
          const index = imageMessages.findIndex((m) => m.id === message.id)
          setSelectedImageIndex(index >= 0 ? index : 0)
          setSelectedImageUri(message.message)
          setImageModalVisible(true)
          setShowImageHeader(true)
          imageScrollX.value = index >= 0 ? index * screenWidth : 0
        }
      }, [message.message_type, message.message, messages])

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
                  message.message_type === 'image' && !isMine && styles.imageMessageBubble,
                ]}
              >
                {message.message_type === 'image' ? (
                  <TouchableOpacity activeOpacity={0.95} onPress={handleImagePress}>
                    <View style={[
                      styles.imageMessageContainer,
                      isMine ? styles.myImageContainer : styles.otherImageContainer
                    ]}>
                      {/* Telegram-style image placeholder */}
                      <View style={[
                        styles.imagePlaceholder,
                        isMine ? styles.myImagePlaceholder : styles.otherImagePlaceholder
                      ]}>
                        <Ionicons name="image-outline" size={32} color="rgba(255,255,255,0.6)" />
                      </View>
                      
                      <Image
                        source={{ uri: message.message }}
                        style={[
                          styles.messageImage,
                          message.status === 'sending' && styles.messageImageSending
                        ]}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        transition={150}
                      />
                      {message.status === 'sending' && (
                        <View style={styles.imageOverlay}>
                          <View style={styles.imageLoadingContainer}>
                            <ActivityIndicator size="large" color="#fff" />
                            <Text style={styles.imageLoadingText}>Sending...</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                ) : message.message_type === 'file' ? (
                  <TouchableOpacity
                    style={[
                      styles.fileAttachment,
                      isMine && styles.myFileAttachment,
                    ]}
                    onPress={() => handleFilePress(message.message)}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.fileIconContainer,
                      isMine && styles.myFileIconContainer,
                    ]}>
                      <Ionicons
                        name={FileService.getFileIcon(getFileTypeFromUrl(message.message)) as any}
                        size={24}
                        color={isMine ? '#fff' : Colors.primary[500]}
                      />
                    </View>
                    <View style={styles.fileInfo}>
                      <Text
                        style={[
                          styles.fileName,
                          isMine ? styles.myFileText : styles.otherFileText,
                        ]}
                        numberOfLines={1}
                      >
                        {message.message.split('/').pop() || 'File'}
                      </Text>
                      <Text
                        style={[
                          styles.fileSize,
                          isMine ? styles.myFileText : styles.otherFileText,
                        ]}
                      >
                        Tap to preview
                      </Text>
                    </View>
                    <Ionicons
                      name="download"
                      size={20}
                      color={isMine ? 'rgba(255,255,255,0.7)' : Colors.neutral[500]}
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
                {isMine && (
                  <View style={styles.messageFooter}>
                    <View style={styles.statusIndicator}>
                      {message.status === 'sending' && (
                        <ActivityIndicator size={12} color="rgba(255,255,255,0.8)" />
                      )}
                      {message.status === 'sent' && (
                        <Ionicons name="checkmark" size={16} color="rgba(255,255,255,0.9)" />
                      )}
                      {message.status === 'read' && (
                        <Ionicons name="checkmark-done" size={16} color={Colors.primary[200]} />
                      )}
                    </View>
                  </View>
                )}
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

  // Show loading only if participant data is not yet loaded
  const showLoading = isLoading || (loading && !participantDataLoaded)

  return (
    <TextureBackground>
      <SafeAreaView style={styles.container} edges={['left', 'right']}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Fixed Header */}
      <View style={[styles.header, { paddingTop: 8 + insets.top }]}>
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
        <View style={styles.userInfo}>
          {participantDataLoaded ? (
            <Text style={styles.name}>{participantName || '...'}</Text>
          ) : (
            <View style={styles.nameSkeleton} />
          )}
        </View>
        <View style={styles.headerAvatarContainer}>
          {participantDataLoaded && participantAvatarUrl ? (
            <Image 
              source={{ uri: participantAvatarUrl }} 
              style={styles.headerAvatarImage}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : participantDataLoaded ? (
            <View style={styles.headerAvatar}>
              <Text style={styles.avatarText}>
                {participantName && participantName.length > 0 ? participantName[0]?.toUpperCase() : '•'}
              </Text>
            </View>
          ) : (
            <View style={styles.headerAvatarSkeleton} />
          )}
        </View>
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
            onScroll={(e) => {
              currentScrollOffset.current = e.nativeEvent.contentOffset.y
            }}
            maintainVisibleContentPosition={
              imageModalVisible
                ? undefined
                : {
                    minIndexForVisible: 0,
                    autoscrollToTopThreshold: 10,
                  }
            }
            onContentSizeChange={() => {
              // Only scroll if we have messages and not during initial load or scroll restoration
              if (sortedMessages.length > 0 && !initialLoad && !isRestoringScroll.current) {
                // Use immediate scroll for better performance
                flatListRef.current?.scrollToEnd({ animated: false })
              }
            }}
            onLayout={(e) => {
              // Only scroll on initial layout when content is loaded and not restoring scroll
              if (
                sortedMessages.length > 0 &&
                e.nativeEvent.layout.height > 0 &&
                !loading &&
                !initialLoad &&
                !isRestoringScroll.current
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
            <TouchableOpacity
              style={styles.attachButton}
              onPress={() => setShowAttachmentOptions(true)}
              disabled={uploadingAttachment || sending}
            >
              {uploadingAttachment ? (
                <ActivityIndicator color={Colors.primary[500]} size="small" />
              ) : (
                <Ionicons name="attach" size={24} color={Colors.primary[500]} />
              )}
            </TouchableOpacity>
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
              style={[
                styles.sendButton,
                (!newMessage.trim() && !uploadingAttachment) && styles.sendButtonDisabled,
                sending && styles.sendButtonSending,
              ]}
              onPress={() => sendMessage()}
              disabled={(!newMessage.trim() && !uploadingAttachment) || sending}
              activeOpacity={0.7}
            >
              {sending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="send" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Attachment Options Modal */}
        <Modal visible={showAttachmentOptions} transparent animationType="fade">
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowAttachmentOptions(false)}
          >
            <View style={styles.attachmentSheet}>
              <View style={styles.attachmentHeader}>
                <Text style={styles.attachmentTitle}>Send Attachment</Text>
                <TouchableOpacity onPress={() => setShowAttachmentOptions(false)}>
                  <Ionicons name="close" size={24} color={Colors.neutral[600]} />
                </TouchableOpacity>
              </View>
              <View style={styles.attachmentOptions}>
                <TouchableOpacity style={styles.attachmentOption} onPress={handleTakePhoto}>
                  <View style={[styles.attachmentIcon, { backgroundColor: Colors.primary[100] }]}>
                    <Ionicons name="camera" size={28} color={Colors.primary[600]} />
                  </View>
                  <Text style={styles.attachmentLabel}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.attachmentOption} onPress={handlePickImage}>
                  <View style={[styles.attachmentIcon, { backgroundColor: Colors.primary[100] }]}>
                    <Ionicons name="image" size={28} color={Colors.primary[600]} />
                  </View>
                  <Text style={styles.attachmentLabel}>Photo Library</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.attachmentOption} onPress={handlePickFile}>
                  <View style={[styles.attachmentIcon, { backgroundColor: Colors.primary[100] }]}>
                    <Ionicons name="document" size={28} color={Colors.primary[600]} />
                  </View>
                  <Text style={styles.attachmentLabel}>Document</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>

      {/* Image Preview Modal - Fullscreen with Smooth Animations */}
      <Modal 
        visible={imageModalVisible} 
        transparent={true}
        animationType="fade" 
        presentationStyle="fullScreen"
        onRequestClose={() => {
          setImageModalVisible(false)
          setSelectedImageUri(null)
          // Restore scroll position after modal closes
          if (savedScrollOffset.current !== null && flatListRef.current) {
            isRestoringScroll.current = true
            setTimeout(() => {
              flatListRef.current?.scrollToOffset({
                offset: savedScrollOffset.current!,
                animated: false,
              })
              // Reset flag after restoration
              setTimeout(() => {
                isRestoringScroll.current = false
              }, 200)
            }, 150)
          }
        }}
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View style={[styles.imageModal]}>
            <StatusBar barStyle="light-content" backgroundColor="#000" translucent={false} />
            
            {/* Header with image count - Telegram style */}
            {showImageHeader && (
              <View style={styles.imageModalHeader}>
                <SafeAreaView edges={['top']} style={styles.imageModalHeaderSafeArea}>
                  <View style={styles.imageModalHeaderContent}>
                    <TouchableOpacity
                      style={styles.imageModalCloseButton}
                      onPress={() => {
                        setImageModalVisible(false)
                        setSelectedImageUri(null)
                        // Restore scroll position after modal closes
                        if (savedScrollOffset.current !== null && flatListRef.current) {
                          isRestoringScroll.current = true
                          setTimeout(() => {
                            flatListRef.current?.scrollToOffset({
                              offset: savedScrollOffset.current!,
                              animated: false,
                            })
                            // Reset flag after restoration
                            setTimeout(() => {
                              isRestoringScroll.current = false
                            }, 200)
                          }, 150)
                        }
                      }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="close" size={28} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.imageModalCount}>
                      {(() => {
                        const imageMessages = messages.filter((m) => m.message_type === 'image')
                        return imageMessages.length > 0
                          ? `${selectedImageIndex + 1} of ${imageMessages.length}`
                          : '1 of 1'
                      })()}
                    </Text>
                    <View style={styles.imageModalPlaceholder} />
                  </View>
                </SafeAreaView>
              </View>
            )}

            {/* Swipeable Image Container - Fullscreen */}
            {(() => {
              const imageMessages = messages.filter((m) => m.message_type === 'image')
              if (imageMessages.length === 0) return null

              return (
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  decelerationRate="fast"
                  snapToInterval={screenWidth}
                  snapToAlignment="center"
                  style={styles.imageScrollView}
                  onScroll={(e) => {
                    const offsetX = e.nativeEvent.contentOffset.x
                    imageScrollX.value = offsetX
                    const newIndex = Math.round(offsetX / screenWidth)
                    if (newIndex !== selectedImageIndex && newIndex >= 0 && newIndex < imageMessages.length) {
                      setSelectedImageIndex(newIndex)
                      setSelectedImageUri(imageMessages[newIndex].message)
                    }
                  }}
                  scrollEventThrottle={16}
                  contentOffset={{ x: selectedImageIndex * screenWidth, y: 0 }}
                >
                  {imageMessages.map((msg, index) => (
                    <ImageZoomViewer
                      key={msg.id}
                      imageUri={msg.message}
                      fullHeight={screenHeight + insets.top + insets.bottom}
                      onTap={() => setShowImageHeader((prev) => !prev)}
                    />
                  ))}
                </ScrollView>
              )
            })()}
          </View>
        </GestureHandlerRootView>
      </Modal>

      {/* Image Editor Modal (Optional Editing Before Sending) */}
      <Modal visible={showImageEditor} transparent animationType="slide">
        <View style={styles.imageEditorModal}>
          <View style={styles.imageEditorHeader}>
            <TouchableOpacity
              style={styles.imageEditorButton}
              onPress={() => {
                setShowImageEditor(false)
                setSelectedImageForEdit(null)
              }}
            >
              <Ionicons name="close" size={24} color={Colors.neutral[800]} />
            </TouchableOpacity>
            <Text style={styles.imageEditorTitle}>Preview Image</Text>
            <TouchableOpacity
              style={styles.imageEditorButton}
              onPress={handleEditImage}
            >
              <Ionicons name="create-outline" size={24} color={Colors.primary[600]} />
            </TouchableOpacity>
          </View>
          {selectedImageForEdit && (
            <View style={styles.imageEditorContent}>
              <Image
                source={{ uri: selectedImageForEdit }}
                style={styles.editorImage}
                contentFit="contain"
                cachePolicy="memory-disk"
              />
            </View>
          )}
          <View style={styles.imageEditorFooter}>
            <TouchableOpacity
              style={[styles.imageEditorActionButton, styles.cancelButton]}
              onPress={() => {
                setShowImageEditor(false)
                setSelectedImageForEdit(null)
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.imageEditorActionButton, styles.imageEditorSendButton]}
              onPress={() => selectedImageForEdit && handleSendImage(selectedImageForEdit)}
              disabled={uploadingAttachment}
            >
              {uploadingAttachment ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="send" size={18} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={styles.imageEditorSendButtonText}>Send</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* File Preview Modal */}
      <Modal visible={filePreviewVisible} animationType="slide" presentationStyle="fullScreen">
        <View style={styles.filePreviewModal}>
          <SafeAreaView style={styles.filePreviewSafeArea} edges={['top']}>
            <View style={styles.filePreviewHeader}>
              <TouchableOpacity
                style={styles.filePreviewCloseButton}
                onPress={() => {
                  setFilePreviewVisible(false)
                  setPreviewFileUrl(null)
                }}
              >
                <Ionicons name="close" size={24} color={Colors.neutral[800]} />
              </TouchableOpacity>
              <Text style={styles.filePreviewTitle}>File</Text>
              <View style={{ width: 40 }} />
            </View>
          </SafeAreaView>
          {previewFileUrl && (
            <View style={styles.filePreviewContent}>
              <View style={styles.filePreviewIconContainer}>
                <Ionicons
                  name={FileService.getFileIcon(getFileTypeFromUrl(previewFileUrl)) as any}
                  size={140}
                  color={Colors.primary[500]}
                />
              </View>
              <Text style={styles.filePreviewName} numberOfLines={3}>
                {previewFileUrl.split('/').pop() || 'File'}
              </Text>
              <Text style={styles.filePreviewSubtext}>
                {getFileTypeFromUrl(previewFileUrl).split('/')[1]?.toUpperCase() || 'FILE'}
              </Text>
            </View>
          )}
          <SafeAreaView style={styles.filePreviewFooterSafeArea} edges={['bottom']}>
            <View style={styles.filePreviewFooter}>
              <TouchableOpacity
                style={[styles.filePreviewActionButton, styles.shareButton]}
                onPress={async () => {
                  if (previewFileUrl) {
                    try {
                      await Share.share({ url: previewFileUrl, message: previewFileUrl.split('/').pop() })
                    } catch (error) {
                      showError('Failed to share file')
                    }
                  }
                }}
              >
                <Ionicons name="share-outline" size={20} color={Colors.primary[600]} />
                <Text style={styles.shareButtonText}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filePreviewActionButton, styles.downloadButton]}
                onPress={() => previewFileUrl && handleDownloadFile(previewFileUrl)}
                disabled={downloadingFile === previewFileUrl}
              >
                {downloadingFile === previewFileUrl ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="download-outline" size={20} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.downloadButtonText}>Download</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filePreviewActionButton, styles.openButton]}
                onPress={() => previewFileUrl && Linking.openURL(previewFileUrl)}
              >
                <Ionicons name="open-outline" size={20} color="#fff" />
                <Text style={styles.openButtonText}>Open</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
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
  userInfo: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerAvatarContainer: {
    width: 40,
    height: 40,
    marginLeft: 8,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  headerAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerAvatarSkeleton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.neutral[200],
  },
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
  avatarSkeleton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.neutral[200],
    marginRight: 12,
  },
  nameSkeleton: {
    width: 110,
    height: 14,
    borderRadius: 8,
    backgroundColor: Colors.neutral[200],
    alignSelf: 'center',
  },
  name: { fontSize: 16, fontWeight: '600', color: '#000', textAlign: 'center' },
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
    maxWidth: screenWidth * 0.75,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 20,
    marginHorizontal: 8,
  },
  myMessageBubble: {
    backgroundColor: Colors.primary[500],
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  imageMessageBubble: {
    borderWidth: 0.5,
    borderColor: Colors.neutral[200],
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  myBubbleTail: { borderBottomRightRadius: 18 },
  otherBubbleTail: { borderBottomLeftRadius: 18 },

  messageText: { fontSize: 15.5, lineHeight: 22 },
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
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
    minWidth: 18,
    height: 18,
  },
  imageMessageContainer: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 12,
    marginBottom: 2,
    maxWidth: screenWidth * 0.55,
    width: screenWidth * 0.55,
    height: screenWidth * 0.55,
  },
  myImageContainer: {
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  otherImageContainer: {
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  imagePlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 0,
    borderRadius: 12,
  },
  myImagePlaceholder: {
    backgroundColor: Colors.primary[400],
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  otherImagePlaceholder: {
    backgroundColor: Colors.neutral[300],
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  messageImage: { 
    width: '100%',
    height: '100%',
    borderRadius: 12,
    zIndex: 1,
  },
  messageImageSending: {
    opacity: 0.65,
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    zIndex: 2,
  },
  imageLoadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageLoadingText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    letterSpacing: 0.3,
  },

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
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
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
    width: 44,
    height: 44,
    borderRadius: 20,
    backgroundColor: Colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary[500],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  sendButtonDisabled: {
    backgroundColor: Colors.neutral[300],
    shadowOpacity: 0,
    elevation: 0,
  },
  sendButtonSending: {
    opacity: 0.8,
  },
  fileAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    backgroundColor: Colors.neutral[50],
    borderWidth: 1,
    borderColor: Colors.neutral[200],
    minWidth: 220,
    maxWidth: screenWidth * 0.75,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  myFileAttachment: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
  },
  fileIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  myFileIconContainer: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  fileInfo: {
    flex: 1,
    marginRight: 8,
  },
  fileName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
    lineHeight: 20,
  },
  fileSize: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
  myFileText: {
    color: '#fff',
  },
  otherFileText: {
    color: Colors.neutral[800],
  },
  attachmentSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
  },
  attachmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.neutral[200],
  },
  attachmentTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral[900],
  },
  attachmentOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
  },
  attachmentOption: {
    alignItems: 'center',
    flex: 1,
  },
  attachmentIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  attachmentLabel: {
    fontSize: 13,
    color: Colors.neutral[700],
    marginTop: 4,
  },
  // Image Editor Modal Styles
  imageEditorModal: {
    flex: 1,
    backgroundColor: '#fff',
  },
  imageEditorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.neutral[200],
  },
  imageEditorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral[900],
  },
  imageEditorButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageEditorContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  editorImage: {
    width: '100%',
    height: '100%',
  },
  imageEditorFooter: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.neutral[200],
    gap: 12,
  },
  imageEditorActionButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  cancelButton: {
    backgroundColor: Colors.neutral[100],
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral[700],
  },
  imageEditorSendButton: {
    backgroundColor: Colors.primary[500],
  },
  imageEditorSendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // File Preview Modal Styles
  filePreviewModal: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    width: '100%',
    height: '100%',
  },
  filePreviewSafeArea: {
    backgroundColor: Colors.background.primary,
  },
  filePreviewFooterSafeArea: {
    backgroundColor: Colors.background.primary,
  },
  filePreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[200],
  },
  filePreviewTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.neutral[900],
  },
  filePreviewCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  filePreviewContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    width: '100%',
    backgroundColor: Colors.background.primary,
  },
  filePreviewIconContainer: {
    width: 240,
    height: 240,
    borderRadius: 50,
    backgroundColor: Colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    borderWidth: 4,
    borderColor: Colors.primary[100],
    shadowColor: Colors.primary[500],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  filePreviewName: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.neutral[900],
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 36,
    paddingHorizontal: 24,
  },
  filePreviewSubtext: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary[600],
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  filePreviewFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral[200],
    gap: 10,
  },
  filePreviewActionButton: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  shareButton: {
    backgroundColor: Colors.primary[50],
    borderWidth: 1,
    borderColor: Colors.primary[200],
  },
  shareButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary[600],
  },
  downloadButton: {
    backgroundColor: Colors.primary[500],
    shadowColor: Colors.primary[500],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  downloadButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  openButton: {
    backgroundColor: Colors.primary[600],
    shadowColor: Colors.primary[600],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  openButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },

  imageModal: {
    flex: 1,
    backgroundColor: '#000',
    width: '100%',
    height: '100%',
  },
  imageModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  imageModalHeaderSafeArea: {
    backgroundColor: 'transparent',
  },
  imageModalHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  imageModalCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalCount: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  imageModalPlaceholder: {
    width: 44,
    height: 44,
  },
  imageScrollView: {
    flex: 1,
    backgroundColor: '#000',
  },
  imageZoomContainer: {
    width: screenWidth,
    minHeight: screenHeight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: screenWidth,
    height: '100%',
  },

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
