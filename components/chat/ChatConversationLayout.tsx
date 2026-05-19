import React, { memo } from 'react'
import { View, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useChatKeyboardPadding } from '../../hooks/useChatKeyboardPadding'
import { Colors } from '../../constants/Colors'
import ChatMessageComposer, { type ChatMessageComposerProps } from './ChatMessageComposer'

export type ChatConversationLayoutProps = {
  children: React.ReactNode
  composerProps: Omit<
    ChatMessageComposerProps,
    'onTextChange' | 'onSendMessage'
  > & {
    onSendMessage: (text: string) => void
    onTextChange?: (text: string) => void
  }
}

/**
 * Messages fill remaining space; composer is pinned to the bottom of the column.
 * When the keyboard opens, marginBottom on the composer lifts it by the measured height.
 * No transforms (avoids ghost layout boxes) and no remounting on each keystroke.
 */
function ChatConversationLayoutComponent({
  children,
  composerProps,
}: ChatConversationLayoutProps) {
  const insets = useSafeAreaInsets()
  const keyboardPadding = useChatKeyboardPadding()

  const { onSendMessage, onTextChange, ...restComposer } = composerProps

  return (
    <View style={styles.column}>
      <View style={styles.messagesPane}>{children}</View>

      <View
        style={[
          styles.composerBar,
          {
            marginBottom: keyboardPadding,
            paddingBottom: keyboardPadding > 0 ? 0 : insets.bottom,
          },
        ]}
      >
        <ChatMessageComposer
          {...restComposer}
          onTextChange={onTextChange}
          onSendMessage={onSendMessage}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  column: {
    flex: 1,
    minHeight: 0,
  },
  messagesPane: {
    flex: 1,
    minHeight: 0,
  },
  composerBar: {
    backgroundColor: Colors.background.primary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.neutral[200],
  },
})

export default memo(ChatConversationLayoutComponent)
