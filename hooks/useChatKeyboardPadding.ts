import { useEffect, useRef, useState, useCallback } from 'react'
import { Dimensions, Keyboard, Platform, type KeyboardEvent } from 'react-native'

const RESIZE_THRESHOLD = 48

function measureKeyboardHeight(event: KeyboardEvent): number {
  const { endCoordinates } = event
  if (endCoordinates.height > 0) {
    return Math.round(endCoordinates.height)
  }
  const windowHeight = Dimensions.get('window').height
  const fromScreenY = windowHeight - endCoordinates.screenY
  return fromScreenY > 0 ? Math.round(fromScreenY) : 0
}

/**
 * Bottom lift for the external composer when the OS does not resize the window.
 * On Android `resize` mode the window height shrinks — adding padding would double-lift.
 * On iOS the keyboard overlays the window — padding is required.
 */
export function useChatKeyboardPadding(): number {
  const [padding, setPadding] = useState(0)
  const windowHeightRef = useRef(Dimensions.get('window').height)

  const applyPadding = useCallback((value: number) => {
    const next = Math.max(0, Math.round(value))
    setPadding((prev) => (prev === next ? prev : next))
  }, [])

  const resolvePadding = useCallback(
    (reportedHeight: number) => {
      if (reportedHeight <= 0) {
        applyPadding(0)
        return
      }

      if (Platform.OS === 'ios') {
        applyPadding(reportedHeight)
        return
      }

      const currentWindowHeight = Dimensions.get('window').height
      const heightDelta = windowHeightRef.current - currentWindowHeight

      if (heightDelta >= RESIZE_THRESHOLD) {
        // Android resize mode — layout already shrank; do not add manual lift.
        applyPadding(0)
      } else {
        // adjustPan / Expo Go — keyboard overlays; lift composer manually.
        applyPadding(reportedHeight)
      }

      windowHeightRef.current = currentWindowHeight
    },
    [applyPadding],
  )

  useEffect(() => {
    windowHeightRef.current = Dimensions.get('window').height

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

    const showSub = Keyboard.addListener(showEvent, (event) => {
      const height = measureKeyboardHeight(event)
      // Let Android finish window resize before deciding manual vs OS lift.
      if (Platform.OS === 'android') {
        requestAnimationFrame(() => resolvePadding(height))
      } else {
        resolvePadding(height)
      }
    })
    const hideSub = Keyboard.addListener(hideEvent, () => {
      windowHeightRef.current = Dimensions.get('window').height
      applyPadding(0)
    })

    let controllerSubs: Array<{ remove: () => void }> = []
    try {
      const { KeyboardEvents } = require('react-native-keyboard-controller')
      controllerSubs = [
        KeyboardEvents.addListener('keyboardDidShow', (e: { height: number }) => {
          if (e.height > 0) resolvePadding(e.height)
        }),
        KeyboardEvents.addListener('keyboardDidHide', () => {
          windowHeightRef.current = Dimensions.get('window').height
          applyPadding(0)
        }),
      ]
    } catch {
      // optional
    }

    return () => {
      showSub.remove()
      hideSub.remove()
      controllerSubs.forEach((s) => s.remove())
    }
  }, [applyPadding, resolvePadding])

  return padding
}
