import React, { useCallback, useRef, useState, useEffect } from 'react'
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Text,
  Dimensions,
  StatusBar,
  ActivityIndicator,
} from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { GestureDetector, Gesture } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as ScreenOrientation from 'expo-screen-orientation'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

interface FullScreenImageViewerProps {
  visible: boolean
  images: string[]
  initialIndex?: number
  onClose: () => void
}

const MIN_SCALE = 1
const MAX_SCALE = 4

export default function FullScreenImageViewer({
  visible,
  images,
  initialIndex = 0,
  onClose,
}: FullScreenImageViewerProps) {
  const insets = useSafeAreaInsets()
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [imageLoading, setImageLoading] = useState(true)
  const [screenDimensions, setScreenDimensions] = useState({
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  })
  const originalOrientationLockRef = useRef<ScreenOrientation.OrientationLock | null>(null)

  // Shared values for each image
  const scale = useSharedValue(1)
  const savedScale = useSharedValue(1)
  const translateX = useSharedValue(0)
  const savedTranslateX = useSharedValue(0)
  const translateY = useSharedValue(0)
  const savedTranslateY = useSharedValue(0)

  // Reset transform when image changes
  const resetTransform = useCallback(() => {
    scale.value = withSpring(1)
    savedScale.value = 1
    translateX.value = withSpring(0)
    savedTranslateX.value = 0
    translateY.value = withSpring(0)
    savedTranslateY.value = 0
  }, [savedScale, savedTranslateX, savedTranslateY, scale, translateX, translateY])

  // Handle screen orientation and dimensions
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenDimensions({ width: window.width, height: window.height })
    })

    return () => subscription?.remove()
  }, [])

  // Lock/unlock screen orientation when viewer opens/closes
  useEffect(() => {
    if (visible) {
      // Save current orientation lock
      ScreenOrientation.getOrientationLockAsync().then((lock) => {
        originalOrientationLockRef.current = lock
      })

      // Allow all orientations for image viewing
      ScreenOrientation.unlockAsync()
    } else {
      // Restore original orientation lock when closing
      if (originalOrientationLockRef.current !== null) {
        ScreenOrientation.lockAsync(originalOrientationLockRef.current).catch(() => {
          // If restoring fails, just unlock (default behavior)
          ScreenOrientation.unlockAsync()
        })
        originalOrientationLockRef.current = null
      }
    }
  }, [visible])

  // Update current index when initialIndex changes
  React.useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex)
      resetTransform()
      setImageLoading(true)
    }
  }, [visible, initialIndex, resetTransform])

  // Pan gesture
  const panGesture = Gesture.Pan()
    .enabled(true)
    .onUpdate((e) => {
      if (scale.value > MIN_SCALE) {
        translateX.value = savedTranslateX.value + e.translationX
        translateY.value = savedTranslateY.value + e.translationY
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value
      savedTranslateY.value = translateY.value
    })

  // Pinch gesture
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      const newScale = savedScale.value * e.scale
      scale.value = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale))
    })
    .onEnd(() => {
      savedScale.value = scale.value
      if (scale.value < MIN_SCALE) {
        scale.value = withSpring(MIN_SCALE)
        savedScale.value = MIN_SCALE
      } else if (scale.value > MAX_SCALE) {
        scale.value = withSpring(MAX_SCALE)
        savedScale.value = MAX_SCALE
      }
    })

  // Double tap gesture
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      if (scale.value > MIN_SCALE) {
        // Zoom out
        scale.value = withSpring(MIN_SCALE)
        savedScale.value = MIN_SCALE
        translateX.value = withSpring(0)
        savedTranslateX.value = 0
        translateY.value = withSpring(0)
        savedTranslateY.value = 0
      } else {
        // Zoom in
        const newScale = 2.5
        scale.value = withSpring(newScale)
        savedScale.value = newScale
      }
    })

  // Single tap to close (only when not zoomed)
  const singleTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      if (scale.value <= MIN_SCALE) {
        runOnJS(onClose)()
      }
    })

  // Compose gestures
  const composedGesture = Gesture.Simultaneous(
    Gesture.Race(singleTapGesture, doubleTapGesture),
    Gesture.Simultaneous(pinchGesture, panGesture),
  )

  // Animated style for image
  const animatedImageStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    }
  })

  // Handle horizontal swipe to change images
  const handleSwipeLeft = useCallback(() => {
    if (currentIndex < images.length - 1 && scale.value <= MIN_SCALE) {
      setCurrentIndex(currentIndex + 1)
      resetTransform()
      setImageLoading(true)
    }
  }, [currentIndex, images.length, scale.value, resetTransform])

  const handleSwipeRight = useCallback(() => {
    if (currentIndex > 0 && scale.value <= MIN_SCALE) {
      setCurrentIndex(currentIndex - 1)
      resetTransform()
      setImageLoading(true)
    }
  }, [currentIndex, scale.value, resetTransform])

  // Horizontal pan gesture for image navigation
  const horizontalPanGesture = Gesture.Pan()
    .enabled(true)
    .onEnd((e) => {
      if (scale.value <= MIN_SCALE) {
        if (e.translationX < -50) {
          runOnJS(handleSwipeLeft)()
        } else if (e.translationX > 50) {
          runOnJS(handleSwipeRight)()
        }
      }
    })

  const finalGesture = Gesture.Simultaneous(composedGesture, horizontalPanGesture)

  if (!visible || images.length === 0) return null

  const currentImage = images[currentIndex]

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar backgroundColor="transparent" barStyle="light-content" translucent />
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {images.length > 1 && (
            <View style={styles.counterContainer}>
              <Text style={styles.counterText}>
                {currentIndex + 1} / {images.length}
              </Text>
            </View>
          )}
          <View style={styles.placeholder} />
        </View>

        {/* Image Container */}
        <View style={styles.imageContainer}>
          <GestureDetector gesture={finalGesture}>
            <Animated.View
              style={[
                styles.imageWrapper,
                animatedImageStyle,
                { width: screenDimensions.width, height: screenDimensions.height },
              ]}
            >
              <Image
                source={{ uri: currentImage }}
                style={[styles.image, { width: screenDimensions.width, height: screenDimensions.height }]}
                contentFit="contain"
                transition={200}
                placeholder={{ blurhash: 'LGF5]+Yk^6#M@-5c,1J5@[or[Q6.' }}
                placeholderContentFit="contain"
                cachePolicy="memory-disk"
                onLoadStart={() => setImageLoading(true)}
                onLoadEnd={() => setImageLoading(false)}
              />
              {imageLoading && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#fff" />
                </View>
              )}
            </Animated.View>
          </GestureDetector>
        </View>

        {/* Navigation Arrows (only show when multiple images and not zoomed) */}
        {images.length > 1 && (
          <>
            {currentIndex > 0 && (
              <TouchableOpacity
                style={[styles.navButton, styles.navButtonLeft]}
                onPress={handleSwipeRight}
              >
                <Ionicons name="chevron-back" size={32} color="#fff" />
              </TouchableOpacity>
            )}
            {currentIndex < images.length - 1 && (
              <TouchableOpacity
                style={[styles.navButton, styles.navButtonRight]}
                onPress={handleSwipeLeft}
              >
                <Ionicons name="chevron-forward" size={32} color="#fff" />
              </TouchableOpacity>
            )}
          </>
        )}

        {/* Bottom Indicator Dots */}
        {images.length > 1 && images.length <= 10 && (
          <View style={[styles.dotsContainer, { paddingBottom: insets.bottom + 20 }]}>
            {images.map((_, index) => (
              <View
                key={index}
                style={[styles.dot, index === currentIndex && styles.dotActive]}
              />
            ))}
          </View>
        )}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
    zIndex: 10,
  },
  closeButton: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterContainer: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  counterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -25,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  navButtonLeft: {
    left: 20,
  },
  navButtonRight: {
    right: 20,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: {
    width: 24,
    backgroundColor: '#fff',
  },
})
