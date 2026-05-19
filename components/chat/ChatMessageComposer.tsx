import React, {
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useState,
} from 'react'
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  type LayoutChangeEvent,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '../../constants/Colors'
import {
  CHAT_COMPOSER_MAX_HEIGHT,
  CHAT_COMPOSER_MIN_HEIGHT,
} from '../../lib/chat/keyboardLayout'

export type ChatMessageComposerHandle = {
  clear: () => void
  focus: () => void
}

export type ChatMessageComposerProps = {
  onSendMessage: (text: string) => void
  onTextChange?: (text: string) => void
  onOpenAttachMenu: () => void
  sending?: boolean
  uploadingAttachment?: boolean
  placeholder?: string
  onLayout?: (event: LayoutChangeEvent) => void
}

const ChatMessageComposerComponent = forwardRef<
  ChatMessageComposerHandle,
  ChatMessageComposerProps
>(function ChatMessageComposerComponent(
  {
    onSendMessage,
    onTextChange,
    onOpenAttachMenu,
    sending = false,
    uploadingAttachment = false,
    placeholder = 'Message...',
    onLayout,
  },
  ref,
) {
  const [text, setText] = useState('')
  const inputRef = React.useRef<TextInput>(null)

  useImperativeHandle(ref, () => ({
    clear: () => setText(''),
    focus: () => inputRef.current?.focus(),
  }))

  const canSend = text.trim().length > 0 && !sending && !uploadingAttachment

  const handleChangeText = useCallback(
    (value: string) => {
      setText(value)
      onTextChange?.(value)
    },
    [onTextChange],
  )

  const handleSendPress = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed || sending || uploadingAttachment) return
    onSendMessage(trimmed)
    setText('')
    onTextChange?.('')
  }, [text, sending, uploadingAttachment, onSendMessage, onTextChange])

  return (
    <View style={styles.wrapper} onLayout={onLayout}>
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onOpenAttachMenu}
          disabled={uploadingAttachment || sending}
          accessibilityRole="button"
          accessibilityLabel="Attach file or photo"
        >
          {uploadingAttachment ? (
            <ActivityIndicator size="small" color={Colors.primary[500]} />
          ) : (
            <Ionicons name="add-circle" size={28} color={Colors.primary[600]} />
          )}
        </TouchableOpacity>

        <TextInput
          ref={inputRef}
          style={styles.input}
          value={text}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.neutral[400]}
          multiline
          maxLength={4000}
          editable={!sending && !uploadingAttachment}
          blurOnSubmit={false}
          enablesReturnKeyAutomatically
          keyboardAppearance="light"
          underlineColorAndroid="transparent"
        />

        <TouchableOpacity
          style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
          onPress={handleSendPress}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Send message"
        >
          {sending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name="send" size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 6,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  input: {
    flex: 1,
    minHeight: CHAT_COMPOSER_MIN_HEIGHT,
    maxHeight: CHAT_COMPOSER_MAX_HEIGHT,
    backgroundColor: Colors.neutral[100],
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
    color: Colors.neutral[900],
    textAlignVertical: 'center',
  },
  sendButton: {
    backgroundColor: Colors.primary[500],
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendButtonDisabled: {
    backgroundColor: Colors.neutral[300],
  },
})

export default memo(ChatMessageComposerComponent)
