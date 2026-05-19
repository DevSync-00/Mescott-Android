import type { KeyboardAvoidingViewProps } from 'react-native-keyboard-controller'

export const CHAT_COMPOSER_MIN_HEIGHT = 40
export const CHAT_COMPOSER_MAX_HEIGHT = 120
/** Small scroll inset above the external composer (inverted list uses paddingTop). */
export const CHAT_LIST_EXTRA_PADDING = 8

export type ChatKeyboardLayoutOptions = {
  headerHeight: number
  bottomInset: number
}

/**
 * GiftedChat has its own KeyboardAvoidingView — disabled so the external
 * composer in ChatConversationLayout is the only lift mechanism.
 */
export function getChatKeyboardAvoidingProps(
  _options: ChatKeyboardLayoutOptions,
): KeyboardAvoidingViewProps {
  return { enabled: false }
}
