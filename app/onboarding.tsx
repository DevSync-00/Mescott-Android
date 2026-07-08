import React, { useRef, useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
  Easing,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Ionicons, FontAwesome6, MaterialIcons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg'

const { width, height } = Dimensions.get('window')
const svgWidth = width + 120

const slides = [
  {
    title: 'On-Demand Service Hub',
    description:
      'Your neighborhood companion for daily tasks. Get elite services and specialized home maintenance right when you need it.',
  },
  {
    title: 'Find Vetted Providers',
    description:
      'Browse trusted local professional ratings, view verified badges, and communicate directly to book services securely.',
  },
  {
    title: 'Secure Fast Earnings',
    description:
      'List your services, manage working schedules, access live local job postings, and withdraw earnings straight to your wallet.',
  },
]

export default function Onboarding() {
  const router = useRouter()
  const scrollX = useRef(new Animated.Value(0)).current
  const scrollViewRef = useRef<ScrollView>(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  // Gentle floating animation for illustration container
  const floatAnim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -8,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start()
  }, [floatAnim])

  // Slide 2 card slide animation
  const slide2Anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (currentIndex === 1) {
      slide2Anim.setValue(0)
      Animated.timing(slide2Anim, {
        toValue: 1,
        duration: 480,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start()
    }
  }, [currentIndex, slide2Anim])

  // Slide 3 card slide animation
  const slide3Anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (currentIndex === 2) {
      slide3Anim.setValue(0)
      Animated.timing(slide3Anim, {
        toValue: 1,
        duration: 480,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start()
    }
  }, [currentIndex, slide3Anim])

  // Coin fall animation for Slide 3
  const coinAnim = useRef(new Animated.Value(-15)).current
  const coinOpacity = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(coinAnim, {
            toValue: 12,
            duration: 1200,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(coinOpacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(coinOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.delay(300),
      ])
    ).start()
  }, [coinAnim, coinOpacity])

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
    } catch {
      router.replace('/auth')
    }
  }

  // Header, Taglines, and CTA opacity/translation transitions
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

  // Taglines cross-fading based on horizontal scroll
  const tagline1Opacity = scrollX.interpolate({
    inputRange: [0, width * 0.5, width],
    outputRange: [1, 0, 0],
    extrapolate: 'clamp',
  })
  const tagline2Opacity = scrollX.interpolate({
    inputRange: [0, width, width * 2],
    outputRange: [0, 1, 0],
    extrapolate: 'clamp',
  })
  const tagline3Opacity = scrollX.interpolate({
    inputRange: [width, width * 1.5, width * 2],
    outputRange: [0, 0, 1],
    extrapolate: 'clamp',
  })

  // Parallax horizontal movement of the Svg background curves
  const waveTranslateX = scrollX.interpolate({
    inputRange: [0, width, width * 2],
    outputRange: [0, -60, -120],
    extrapolate: 'clamp',
  })

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ─────────────────────────────────────────────
          Unified Curved Header Wave Background (Parallax Dynamic Curves)
          ───────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.waveHeaderWrapper,
          {
            transform: [{ translateX: waveTranslateX }],
          },
        ]}
      >
        <Svg width={svgWidth} height={210} viewBox={`0 0 ${svgWidth} 210`} preserveAspectRatio="none" style={StyleSheet.absoluteFillObject}>
          <Defs>
            <LinearGradient id="headerGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#7B42F6" />
              <Stop offset="100%" stopColor="#24A1DE" />
            </LinearGradient>
          </Defs>
          <Path d={`M0 0 L0 150 Q${svgWidth * 0.5} 220, ${svgWidth} 150 L${svgWidth} 0 Z`} fill="url(#headerGrad)" />
        </Svg>
      </Animated.View>

      {/* ─────────────────────────────────────────────
          Static Branding Overlay Content (Logo on Left, Tagline Transitions)
          ───────────────────────────────────────────── */}
      <View style={styles.staticHeaderContainer} pointerEvents="none">
        <SafeAreaView style={styles.staticHeaderContent} edges={['top']}>
          <View style={styles.headerRow}>
            {/* Logo on top-left, clean and separate from Skip button */}
            <Image
              source={require('../assets/images/adaptive-icon.png')}
              style={styles.headerLogo}
              contentFit="contain"
            />
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerBrand}>Mescott</Text>
              <View style={styles.taglineWrapper}>
                <Animated.Text style={[styles.headerTagline, { opacity: tagline1Opacity }]}>
                  Everyday services at your fingertips
                </Animated.Text>
                <Animated.Text style={[styles.headerTagline, { opacity: tagline2Opacity, position: 'absolute', left: 0, right: 0 }]}>
                  Vetted neighborhood experts
                </Animated.Text>
                <Animated.Text style={[styles.headerTagline, { opacity: tagline3Opacity, position: 'absolute', left: 0, right: 0 }]}>
                  Grow your local business
                </Animated.Text>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </View>

      {/* Skip button pinned at top-right, completely separate from Logo */}
      <Animated.View
        style={[styles.headerContainer, { opacity: skipOpacity }]}
        pointerEvents={currentIndex === 2 ? 'none' : 'auto'}
      >
        <TouchableOpacity onPress={completeOnboarding} activeOpacity={0.7}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Carousel */}
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
          const slideOpacity = scrollX.interpolate({
            inputRange: [(index - 1) * width, index * width, (index + 1) * width],
            outputRange: [0, 1, 0],
            extrapolate: 'clamp',
          })
          const slideScale = scrollX.interpolate({
            inputRange: [(index - 1) * width, index * width, (index + 1) * width],
            outputRange: [0.9, 1, 0.9],
            extrapolate: 'clamp',
          })

          return (
            <View style={styles.slide} key={index}>
              <View style={styles.slideBody}>
                {/* Graphic/Illustration Area */}
                {index === 0 && (
                  <Animated.View
                    style={[
                      styles.graphicBlock,
                      {
                        opacity: slideOpacity,
                        transform: [{ scale: slideScale }, { translateY: floatAnim }],
                      },
                    ]}
                  >
                    <Image
                      source={require('../assets/images/onboarding_hub.png')}
                      style={styles.onboardingImage}
                      contentFit="contain"
                    />
                  </Animated.View>
                )}

                {index === 1 && (
                  <Animated.View
                    style={[
                      styles.graphicBlock,
                      {
                        opacity: slide2Anim,
                        transform: [
                          {
                            translateY: slide2Anim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [24, 0],
                            }),
                          },
                          {
                            scale: slide2Anim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.94, 1],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <View style={styles.slide2Wrapper}>
                      <View style={styles.sparkle1}>
                        <Ionicons name="bulb-outline" size={24} color="#FBBF24" />
                      </View>
                      <View style={styles.sparkle2}>
                        <Ionicons name="shield-checkmark-outline" size={28} color="#24A1DE" />
                      </View>
                      <View style={styles.profileCard}>
                        <View style={styles.profileHeader}>
                          <View style={styles.avatar}>
                            <Text style={styles.avatarText}>SK</Text>
                            <View style={styles.verifiedBadge}>
                              <MaterialIcons name="verified" size={14} color="#24A1DE" />
                            </View>
                          </View>
                          <View>
                            <Text style={styles.profileName}>Solomon K.</Text>
                            <Text style={styles.profileTitle}>Pro Electrician</Text>
                          </View>
                        </View>
                        <View style={styles.ratingRow}>
                          <Ionicons name="star" size={16} color="#FBBF24" />
                          <Text style={styles.ratingText}>4.9 (42 tasks completed)</Text>
                        </View>
                        <View style={styles.statusRow}>
                          <View style={styles.greenDot} />
                          <Text style={styles.statusText}>Available Today</Text>
                        </View>
                      </View>
                    </View>
                  </Animated.View>
                )}

                {index === 2 && (
                  <Animated.View
                    style={[
                      styles.graphicBlock,
                      {
                        opacity: slide3Anim,
                        transform: [
                          {
                            translateY: slide3Anim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [24, 0],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <View style={styles.slide3Wrapper}>
                      <View style={styles.bookingCard}>
                        <Text style={styles.bookingTitle}>Incoming Bookings</Text>
                        <View style={styles.bookingItem}>
                          <Ionicons name="calendar-outline" size={14} color="#7B42F6" />
                          <Text style={styles.bookingDesc}>Fix Kitchen Sink – 1,200 ETB</Text>
                        </View>
                        <View style={styles.bookingItem}>
                          <Ionicons name="calendar-outline" size={14} color="#7B42F6" />
                          <Text style={styles.bookingDesc}>Mount TV Bracket – 800 ETB</Text>
                        </View>
                      </View>
                      <View style={styles.walletCard}>
                        <View style={styles.walletHeader}>
                          <Ionicons name="wallet-outline" size={18} color="#7B42F6" />
                          <Text style={styles.walletTitle}>Earnings Balance</Text>
                        </View>
                        <Text style={styles.walletAmount}>3,850 ETB</Text>
                        <View style={styles.walletGrowth}>
                          <Ionicons name="trending-up" size={12} color="#22C55E" />
                          <Text style={styles.growthText}>+1,200 today</Text>
                        </View>
                        <Animated.View
                          style={[
                            styles.coinIcon,
                            { opacity: coinOpacity, transform: [{ translateY: coinAnim }] },
                          ]}
                        >
                          <FontAwesome6 name="coins" size={16} color="#FBBF24" />
                        </Animated.View>
                      </View>
                    </View>
                  </Animated.View>
                )}

                {/* Text Block */}
                <View style={styles.textBlock}>
                  <Text style={styles.title}>{slide.title}</Text>
                  <Text style={styles.description}>{slide.description}</Text>
                </View>
              </View>
            </View>
          )
        })}
      </ScrollView>

      {/* Footer controls */}
      <View style={styles.footer}>
        <Animated.View
          style={[styles.indicatorContainer, { opacity: indicatorsOpacity }]}
          pointerEvents={currentIndex === 2 ? 'none' : 'auto'}
        >
          {slides.map((_, index) => {
            const isActive = currentIndex === index
            return (
              <View
                key={index}
                style={[
                  styles.indicator,
                  {
                    width: isActive ? 28 : 12,
                    backgroundColor: isActive ? '#24A1DE' : '#E0E0E0',
                  },
                ]}
              />
            )
          })}
        </Animated.View>

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
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  // Wave Background styling (Parallax translation)
  waveHeaderWrapper: {
    width: svgWidth,
    height: 210,
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1,
  },

  // Static Branding overlay on top of wave
  staticHeaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  staticHeaderContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingTop: 8,
  },
  headerLogo: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 22,
    padding: 6,
    marginRight: 14,
  },
  headerTextContainer: {
    flex: 1,
    height: 44,
    justifyContent: 'center',
  },
  headerBrand: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  taglineWrapper: {
    height: 18,
    marginTop: 2,
    position: 'relative',
  },
  headerTagline: {
    fontSize: 13,
    color: '#F3F0FF',
    fontWeight: '500',
    opacity: 0.9,
  },

  // Skip button layout
  headerContainer: {
    position: 'absolute',
    top: StatusBar.currentHeight ? StatusBar.currentHeight + 12 : 44,
    right: 20,
    zIndex: 99,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
  },

  carousel: { flex: 1 },

  slide: {
    width,
    height: height,
    backgroundColor: '#FFFFFF',
  },
  slideBody: {
    flex: 1,
    paddingTop: 210, // Push body content down past the absolute wave header
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 140, // Space for the bottom footer controls
  },
  graphicBlock: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  onboardingImage: {
    width: width * 0.78,
    height: '100%',
    maxHeight: 250,
  },
  textBlock: {
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  description: {
    fontSize: 15,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 23,
    fontWeight: '400',
    paddingHorizontal: 8,
  },

  // Footer navigation layout
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 24,
    backgroundColor: '#FFFFFF',
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  indicator: {
    height: 6,
    borderRadius: 3,
    marginHorizontal: 4,
  },
  actionButtonContainer: {
    width: '100%',
    paddingHorizontal: 8,
  },
  actionButton: {
    backgroundColor: '#7B42F6',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
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

  /* Slide 2 Wrapper & Cards */
  slide2Wrapper: {
    width: width * 0.78,
    height: 190,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sparkle1: { position: 'absolute', top: 4, right: 12 },
  sparkle2: { position: 'absolute', bottom: 8, left: 8 },
  profileCard: {
    width: 255,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F0FF',
    shadowColor: '#7B42F6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E9E3FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: { color: '#7B42F6', fontWeight: '700', fontSize: 14 },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
  },
  profileName: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  profileTitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  ratingText: { fontSize: 12, color: '#4B5563', marginLeft: 6, fontWeight: '500' },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  greenDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E', marginRight: 6 },
  statusText: { fontSize: 11, color: '#22C55E', fontWeight: '600' },

  /* Slide 3 Wrapper & Cards */
  slide3Wrapper: {
    width: width * 0.78,
    height: 210,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookingCard: {
    width: 225,
    backgroundColor: '#FAFBFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E8EAED',
    position: 'absolute',
    top: 5,
    left: 10,
    zIndex: 1,
  },
  bookingTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E8E93',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  bookingItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  bookingDesc: { fontSize: 11, color: '#4B5563', marginLeft: 6 },
  walletCard: {
    width: 195,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F0FF',
    position: 'absolute',
    bottom: 5,
    right: 10,
    zIndex: 2,
    shadowColor: '#7B42F6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  walletHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  walletTitle: { fontSize: 11, fontWeight: '600', color: '#6B7280', marginLeft: 6 },
  walletAmount: { fontSize: 20, fontWeight: '800', color: '#1F2937' },
  walletGrowth: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  growthText: { fontSize: 10, color: '#22C55E', fontWeight: '600', marginLeft: 4 },
  coinIcon: { position: 'absolute', right: 16, top: 16 },
})
