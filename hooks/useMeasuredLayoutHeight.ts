import { useCallback, useState } from 'react'
import type { LayoutChangeEvent } from 'react-native'

/**
 * Tracks the height of a view via onLayout.
 * Used for dynamic keyboard offsets instead of hard-coded magic numbers.
 */
export function useMeasuredLayoutHeight(initialHeight = 0) {
  const [height, setHeight] = useState(initialHeight)

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const measured = event.nativeEvent.layout.height
    if (measured > 0) {
      setHeight((previous) => (previous !== measured ? measured : previous))
    }
  }, [])

  return { height, onLayout }
}
