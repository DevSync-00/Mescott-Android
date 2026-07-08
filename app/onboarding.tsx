import React, { useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'

const { width, height } = Dimensions.get('window')

interface SlideData {
  title: string;
  description: string;
}

const slides: SlideData[] = [
  {
    title: 'Welcome to Mescott',
    description: 'Your neighborhood on-demand service hub. Bringing elite professionals and everyday task tracking right to your fingertips.',
  },
  {
    title: 'Find Reliable Help Instantly',
    description: 'From expert handymen to technical professionals. Post your task in seconds, browse vetted provider ratings, and settle bookings securely.',
  },
  {
    title: 'Grow Your Business & Earnings',
    description: 'Looking for work? Access thousands of localized live job listings, control your working schedules, and secure fast payouts directly to your digital wallet.',
  },
]

export default function Onboarding() {
  const router = useRouter()
  const scrollX = useRef(new Animated.Value(0)).current
  const scrollViewRef = useRef<ScrollView>(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    {
      useNativeDriver: false,
      listener: (event: any) => {
        const offset = event.nativeEvent.contentOffset.x
        const index = Math.round(offset / width)
        if (index !== currentIndex && index >= 0 && index < slides.length) {
          setCurrentIndex(index)
        }
      },
    }
  )

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem('has_completed_onboarding', 'true')
      router.replace('/auth')
    } catch (error) {
      console.error('Error saving onboarding state:', error)
      router.replace('/auth')
    }
  }

  // Interpolations for dynamic, finger-tracked transitions
  const skipOpacity = scrollX.interpolate({
    inputRange: [width, width * 1.5, width * 2],
    outputRange: [1, 0, 0],
    extrapolate: 'clamp',
  })

  const getStartedOpacity = scrollX.interpolate({
    inputRange: [width, width * 1.6, width * 2],
    outputRange: [0, 0, 1],
    extrapolate: 'clamp',
  })

  const getStartedTranslateY = scrollX.interpolate({
    inputRange: [width, width * 1.6, width * 2],
    outputRange: [15, 8, 0],
    extrapolate: 'clamp',
  })

  const indicatorsOpacity = scrollX.interpolate({
    inputRange: [width, width * 1.6, width * 2],
    outputRange: [1, 0.4, 0],
    extrapolate: 'clamp',
  })

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />

      {/* Persistent Skip Button (Fades out on Slide 3) */}
      <Animated.View 
        style={[styles.headerContainer, { opacity: skipOpacity }]}
        pointerEvents={currentIndex === 2 ? 'none' : 'auto'}
      >
        <TouchableOpacity onPress={completeOnboarding} activeOpacity={0.7}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Main horizontal swiping carousel */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        bounces={false}
        style={styles.carousel}
      >
        {slides.map((slide, index) => {
          // Slide specific progressive translations driven by scrollX
          const opacity = scrollX.interpolate({
            inputRange: [(index - 1) * width, index * width, (index + 1) * width],
            outputRange: [0, 1, 0],
            extrapolate: 'clamp',
          })

          const translateY = scrollX.interpolate({
            inputRange: [(index - 1) * width, index * width, (index + 1) * width],
            outputRange: [20, 0, -20],
            extrapolate: 'clamp',
          })

          return (
            <View style={styles.slide} key={index}>
              <Animated.View style={[styles.contentCard, { opacity, transform: [{ translateY }] }]}>
                <Text style={styles.title}>{slide.title}</Text>
                <Text style={styles.description}>{slide.description}</Text>
              </Animated.View>
            </View>
          )
        })}
      </ScrollView>

      {/* Bottom Control Container */}
      <View style={styles.footer}>
        {/* Progress Indicators (Slide 1 & 2) */}
        <Animated.View style={[styles.indicatorContainer, { opacity: indicatorsOpacity }]} pointerEvents={currentIndex === 2 ? 'none' : 'auto'}>
          {slides.map((_, index) => {
            const segmentWidth = scrollX.interpolate({
              inputRange: [(index - 1) * width, index * width, (index + 1) * width],
              outputRange: [12, 28, 12],
              extrapolate: 'clamp',
            })

            const segmentColor = scrollX.interpolate({
              inputRange: [(index - 1) * width, index * width, (index + 1) * width],
              outputRange: ['#E0E0E0', '#24A1DE', '#E0E0E0'],
              extrapolate: 'clamp',
            })

            return (
              <Animated.View
                key={index}
                style={[
                  styles.indicator,
                  { width: segmentWidth, backgroundColor: segmentColor },
                ]}
              />
            )
          })}
        </Animated.View>

        {/* Primary Action Button (Slide 3) */}
        <Animated.View
          style={[
            styles.actionButtonContainer,
            {
              opacity: getStartedOpacity,
              transform: [{ translateY: getStartedTranslateY }],
            },
          ]}
          pointerEvents={currentIndex === 2 ? 'auto' : 'none'}
        >
          <TouchableOpacity
            style={styles.actionButton}
            onPress={completeOnboarding}
            activeOpacity={0.85}
          >
            <Text style={styles.actionButtonText}>Get Started</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingTop: 12,
    height: 48,
    alignItems: 'center',
    zIndex: 10,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
    padding: 4,
  },
  carousel: {
    flex: 1,
  },
  slide: {
    width: width,
    height: height * 0.65,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 36,
  },
  contentCard: {
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#7B42F6',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 0.3,
  },
  description: {
    fontSize: 16,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 25,
    fontWeight: '400',
  },
  footer: {
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
  },
  indicator: {
    height: 6,
    borderRadius: 3,
    marginHorizontal: 4,
  },
  actionButtonContainer: {
    width: '100%',
    paddingHorizontal: 8,
    position: 'absolute',
  },
  actionButton: {
    backgroundColor: '#7B42F6',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7B42F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
})
