import React, { useEffect, useImperativeHandle, forwardRef, useCallback, useState } from 'react'
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  ScrollView,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated'
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler'
import { Colors } from '../constants/Colors'

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window')

export interface BottomSheetRef {
  expandToFull: () => void
  collapseFromFull: () => void
}

interface BottomSheetProps {
  visible: boolean
  onClose: () => void
  children: React.ReactNode
  snapPoints?: number[] // Array of percentages (0-1) for snap points
  initialSnapPoint?: number // Initial snap point index
  useInternalScroll?: boolean // Wrap children in an internal ScrollView
}

const BottomSheet = forwardRef<BottomSheetRef, BottomSheetProps>(
  (
    {
      visible,
      onClose,
      children,
      snapPoints = [0.25, 0.9, 1.0], // Default: 25%, 90%, and 100% (full screen)
      initialSnapPoint = 1, // Start at expanded (90%)
      useInternalScroll = true,
    },
    ref,
  ) => {
    const insets = useSafeAreaInsets()
    const translateY = useSharedValue(0)
    const currentSnapIndex = useSharedValue(initialSnapPoint)
    const context = useSharedValue({ y: 0 })
    const backdropOpacity = useSharedValue(0)
    const [isRendered, setIsRendered] = useState(visible)

    // Store insets in shared values for use in gesture handlers
    const topInset = useSharedValue(insets.top)
    const bottomInset = useSharedValue(insets.bottom)

    // Update shared values when insets change
    useEffect(() => {
      topInset.value = insets.top
      bottomInset.value = insets.bottom
    }, [insets.top, insets.bottom])

    // Calculate snap positions based on full screen height (safe area handled via padding/SafeAreaView)
    const getSnapPosition = useCallback((snapPoint: number) => {
      if (snapPoint >= 1.0) {
        // Full screen: translate the full screen height
        return -SCREEN_HEIGHT
      }
      // Other snap points: use percentage of full screen height
      return -(SCREEN_HEIGHT * snapPoint)
    }, [])

    // Expose methods to expand/collapse programmatically
    useImperativeHandle(ref, () => ({
      expandToFull: () => {
        const fullScreenIndex = snapPoints.length - 1 // Last snap point should be full screen
        const targetY = getSnapPosition(snapPoints[fullScreenIndex])
        translateY.value = withSpring(targetY, {
          damping: 25,
          stiffness: 300,
          mass: 0.8,
          velocity: 0,
        })
        currentSnapIndex.value = fullScreenIndex
      },
      collapseFromFull: () => {
        // Collapse to the second-to-last snap point (usually 90%)
        const collapseIndex = Math.max(0, snapPoints.length - 2)
        const targetY = getSnapPosition(snapPoints[collapseIndex])
        translateY.value = withSpring(targetY, {
          damping: 25,
          stiffness: 300,
          mass: 0.8,
          velocity: 0,
        })
        currentSnapIndex.value = collapseIndex
      },
    }))

    useEffect(() => {
      if (visible) {
        // Ensure modal is rendered before animating in
        if (!isRendered) {
          setIsRendered(true)
        }
        // Start from fully hidden position
        translateY.value = SCREEN_HEIGHT
        // Animate to initial snap point with smoother spring animation
        const initialY = getSnapPosition(snapPoints[initialSnapPoint])
        translateY.value = withSpring(initialY, {
          damping: 25,
          stiffness: 300,
          mass: 0.8,
          velocity: 0,
        })
        backdropOpacity.value = withTiming(0.5, { duration: 250 })
        currentSnapIndex.value = initialSnapPoint
      } else if (isRendered) {
        // Animate out then unmount to allow smooth fade/slide
        backdropOpacity.value = withTiming(0, { duration: 250 })
        translateY.value = withSpring(
          SCREEN_HEIGHT,
          {
            damping: 30,
            stiffness: 300,
            mass: 0.8,
          },
          () => {
            runOnJS(setIsRendered)(false)
          },
        )
      }
      // Only animate on visibility change to prevent double pop from prop identity changes
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible])

    const panGesture = Gesture.Pan()
      .onStart(() => {
        context.value = { y: translateY.value }
      })
      .onUpdate((event) => {
        // Only allow pan gesture if not at full screen, or if dragging down from full screen
        const isAtFullScreen =
          currentSnapIndex.value === snapPoints.length - 1 &&
          snapPoints[snapPoints.length - 1] >= 1.0

        // If at full screen and dragging up, ignore (let scroll view handle it)
        if (isAtFullScreen && event.translationY < 0) {
          return
        }

        const newY = context.value.y + event.translationY
        // Allow dragging up to the highest snap point (capped at full screen)
        const maxSnapPoint = Math.max(...snapPoints)
        const clampedMax = Math.min(maxSnapPoint, 1.0)
        const maxY = -(SCREEN_HEIGHT * clampedMax)
        const minY = SCREEN_HEIGHT // Fully hidden below screen
        translateY.value = Math.max(maxY, Math.min(minY, newY))
      })
      .onEnd((event) => {
        const velocity = event.velocityY
        const currentY = translateY.value

        // Calculate which snap point is closest
        let targetIndex = currentSnapIndex.value
        let minDistance = Infinity

        snapPoints.forEach((point, index) => {
          const snapY = point >= 1.0 ? -SCREEN_HEIGHT : -(SCREEN_HEIGHT * point)
          const distance = Math.abs(currentY - snapY)
          if (distance < minDistance) {
            minDistance = distance
            targetIndex = index
          }
        })

        // If velocity is high, move to next/previous snap point
        if (Math.abs(velocity) > 500) {
          if (velocity > 0) {
            // Dragging down
            if (targetIndex > 0) {
              targetIndex = targetIndex - 1
            } else {
              // Dismiss if at first snap point and dragging down
              runOnJS(onClose)()
              return
            }
          } else {
            // Dragging up
            if (targetIndex < snapPoints.length - 1) {
              targetIndex = targetIndex + 1
            }
          }
        }

        // If dragged down past 50% of screen, dismiss
        if (currentY > SCREEN_HEIGHT * 0.5) {
          runOnJS(onClose)()
          return
        }

        // Snap to target position with smooth spring animation
        const targetPoint = snapPoints[targetIndex]
        const targetY = targetPoint >= 1.0 ? -SCREEN_HEIGHT : -(SCREEN_HEIGHT * targetPoint)
        translateY.value = withSpring(targetY, {
          damping: 25,
          stiffness: 300,
          mass: 0.8,
          velocity: velocity * 0.1, // Use velocity for more natural feel
        })
        currentSnapIndex.value = targetIndex
      })

    const animatedStyle = useAnimatedStyle(() => {
      return {
        transform: [{ translateY: translateY.value }],
      }
    })

    const backdropStyle = useAnimatedStyle(() => {
      return {
        opacity: backdropOpacity.value,
      }
    }, [])

    if (!isRendered) return null

    return (
      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={onClose}
        statusBarTranslucent
      >
        <GestureHandlerRootView style={styles.container}>
          <StatusBar barStyle="light-content" />

          {/* Backdrop */}
          <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents={'auto'}>
            <TouchableOpacity
              style={styles.backdropTouchable}
              activeOpacity={1}
              onPress={onClose}
            />
          </Animated.View>

          {/* Bottom Sheet */}
          <Animated.View
            style={[
              styles.bottomSheet,
              { paddingBottom: insets.bottom, height: SCREEN_HEIGHT },
              animatedStyle,
            ]}
          >
            <SafeAreaView edges={['top']} style={styles.safeArea}>
              {/* Drag Handle - only this area is draggable */}
              <GestureDetector gesture={panGesture}>
                <View style={styles.dragHandleContainer}>
                  <View style={styles.dragHandle} />
                </View>
              </GestureDetector>

              {/* Content - scrollable, not draggable */}
              {useInternalScroll ? (
                <ScrollView
                  style={styles.content}
                  contentContainerStyle={{ paddingBottom: insets.bottom + 20, flexGrow: 1 }}
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled={true}
                  keyboardShouldPersistTaps="handled"
                  bounces={true}
                  alwaysBounceVertical={true}
                >
                  {children}
                </ScrollView>
              ) : (
                <View style={styles.content}>{children}</View>
              )}
            </SafeAreaView>
          </Animated.View>
        </GestureHandlerRootView>
      </Modal>
    )
  },
)

BottomSheet.displayName = 'BottomSheet'

export default React.memo(BottomSheet)

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  backdropTouchable: {
    ...StyleSheet.absoluteFillObject,
  },
  bottomSheet: {
    position: 'absolute',
    top: SCREEN_HEIGHT,
    left: 0,
    right: 0,
    width: SCREEN_WIDTH,
    backgroundColor: Colors.background.primary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
    // Height will be set inline to handle safe area and translations
  },
  safeArea: {
    flex: 1,
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.neutral[300],
    borderRadius: 2,
    marginBottom: 4,
  },
  content: {
    flex: 1,
  },
})
