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
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg'

const { width, height } = Dimensions.get('window')

const slides = [
  {
    title: 'Welcome to Mescott',
    description:
      'Your neighborhood on-demand service hub. Bringing elite professionals and everyday task tracking right to your fingertips.',
  },
  {
    title: 'Find Reliable Help Instantly',
    description:
      'From expert handymen to technical professionals. Post your task in seconds, browse vetted provider ratings, and settle bookings securely.',
  },
  {
    title: 'Grow Your Business & Earnings',
    description:
      'Looking for work? Access thousands of localized live job listings, control your working schedules, and secure fast payouts directly to your digital wallet.',
  },
]

export default function Onboarding() {
  const router = useRouter()
  const scrollX = useRef(new Animated.Value(0)).current
  const scrollViewRef = useRef<ScrollView>(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  // Gentle float animation for Slide 1 graphic block
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

  // Snappy elastic spring pulse animation for the branding logo
  const logoPulseAnim = useRef(new Animated.Value(1)).current
  useEffect(() => {
    logoPulseAnim.setValue(1)
    Animated.spring(logoPulseAnim, {
      toValue: 1.12,
      friction: 4,
      tension: 38,
      useNativeDriver: true,
    }).start(() => {
      Animated.spring(logoPulseAnim, {
        toValue: 1,
        friction: 4,
        tension: 38,
        useNativeDriver: true,
      }).start()
    })
  }, [currentIndex, logoPulseAnim])

  // Slide 2 card entrance
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

  // Slide 3 cards entrance
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

  // Floating coin loop animation for Slide 3
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

  // Interlocked scroll transitions
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

      {/* Background depth vectors */}
      <View style={styles.bgContainer} pointerEvents="none">
        <View style={styles.bgCircle1} />
        <View style={styles.bgCircle2} />
        <View style={[styles.bgHLine, { top: height * 0.22 }]} />
        <View style={[styles.bgHLine, { top: height * 0.54 }]} />
      </View>

      {/* Skip button */}
      <Animated.View
        style={[styles.headerContainer, { opacity: skipOpacity }]}
        pointerEvents={currentIndex === 2 ? 'none' : 'auto'}
      >
        <TouchableOpacity onPress={completeOnboarding} activeOpacity={0.7}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Swipeable Carousel */}
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
            outputRange: [0.88, 1, 0.88],
            extrapolate: 'clamp',
          })

          return (
            <View style={styles.slide} key={index}>
              {/* Graphic Zone */}
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
                  <View style={styles.slide1ImageContainer}>
                    {/* SVG background radial gradient and simple floating circles */}
                    <Svg style={StyleSheet.absoluteFillObject} viewBox="0 0 320 300">
                      <Defs>
                        <RadialGradient id="bgGlow" cx="50%" cy="50%" r="50%">
                          <Stop offset="0%" stopColor="#7B42F6" stopOpacity="0.08" />
                          <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                        </RadialGradient>
                      </Defs>
                      <Circle cx={160} cy={150} r={130} fill="url(#bgGlow)" />
                      {/* Simple decorative vectors to frame the isometric image */}
                      <Circle cx={35} cy={60} r={5} fill="#7B42F6" opacity={0.15} />
                      <Circle cx={285} cy={45} r={8} fill="#24A1DE" opacity={0.12} />
                      <Circle cx={55} cy={225} r={6} fill="#24A1DE" opacity={0.1} />
                      <Circle cx={275} cy={210} r={4} fill="#7B42F6" opacity={0.2} />
                    </Svg>

                    {/* Vetted Isometric Mockup Asset */}
                    <Image
                      source={require('../assets/images/onboarding_hub.png')}
                      style={styles.onboardingImage}
                      contentFit="contain"
                    />
                  </View>
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

              {/* Text Zone */}
              <View style={styles.textBlock}>
                {index === 0 ? (
                  <View style={styles.logoTitleRow}>
                    <Text style={styles.welcomeText}>Welcome to </Text>
                    <Text style={styles.logoTextInline}>MESCO</Text>
                    <Animated.Image
                      source={require('../assets/images/adaptive-icon.png')}
                      style={[
                        styles.inlineLogoImage,
                        { transform: [{ scale: logoPulseAnim }] },
                      ]}
                      resizeMode="contain"
                    />
                  </View>
                ) : (
                  <Text style={styles.title}>{slide.title}</Text>
                )}
                <Text style={styles.description}>{slide.description}</Text>
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
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  bgContainer: { ...StyleSheet.absoluteFillObject, zIndex: 0 },
  bgCircle1: {
    position: 'absolute', top: height * 0.06, left: -55,
    width: 230, height: 230, borderRadius: 115,
    borderWidth: 1.5, borderColor: '#7B42F6', opacity: 0.05,
  },
  bgCircle2: {
    position: 'absolute', bottom: height * 0.22, right: -65,
    width: 270, height: 270, borderRadius: 135,
    borderWidth: 1.5, borderColor: '#24A1DE', opacity: 0.05,
  },
  bgHLine: {
    position: 'absolute', width: '100%', height: 1,
    backgroundColor: '#7B42F6', opacity: 0.04,
  },

  headerContainer: {
    flexDirection: 'row', justifyContent: 'flex-end',
    paddingHorizontal: 24, paddingTop: 12, height: 48,
    alignItems: 'center', zIndex: 10,
  },
  skipText: { fontSize: 16, fontWeight: '600', color: '#8E8E93', padding: 4 },

  carousel: { flex: 1 },

  slide: {
    width,
    height: height * 0.71,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 4,
  },
  graphicBlock: {
    width: '100%',
    height: height * 0.37,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slide1ImageContainer: {
    width: 320,
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  onboardingImage: {
    width: 290,
    height: 270,
  },
  textBlock: { width: '100%', alignItems: 'center', paddingBottom: 16 },

  logoTitleRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', marginBottom: 14,
  },
  welcomeText: { fontSize: 22, fontWeight: '800', color: '#7B42F6', letterSpacing: 0.2 },
  logoTextInline: { fontSize: 22, fontWeight: '900', color: '#3D0F95', letterSpacing: 0.8 },
  inlineLogoImage: { width: 56, height: 56, marginLeft: -12, marginTop: -2 },
  title: {
    fontSize: 23, fontWeight: '800', color: '#7B42F6',
    textAlign: 'center', marginBottom: 14, letterSpacing: 0.3,
  },
  description: {
    fontSize: 15, color: '#4B5563',
    textAlign: 'center', lineHeight: 23, fontWeight: '400',
  },

  footer: {
    height: 120, justifyContent: 'center',
    alignItems: 'center', paddingHorizontal: 24, paddingBottom: 16,
  },
  indicatorContainer: {
    flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', position: 'absolute',
  },
  indicator: { height: 6, borderRadius: 3, marginHorizontal: 4 },
  actionButtonContainer: { width: '100%', paddingHorizontal: 8, position: 'absolute' },
  actionButton: {
    backgroundColor: '#7B42F6', borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', shadowColor: '#7B42F6',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15,
    shadowRadius: 8, elevation: 3,
  },
  actionButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },

  /* Slide 2 */
  slide2Wrapper: { width: width * 0.78, height: 190, justifyContent: 'center', alignItems: 'center' },
  sparkle1: { position: 'absolute', top: 4, right: 12 },
  sparkle2: { position: 'absolute', bottom: 8, left: 8 },
  profileCard: {
    width: 255, backgroundColor: '#FFFFFF', borderRadius: 20,
    padding: 16, borderWidth: 1, borderColor: '#F3F0FF',
    shadowColor: '#7B42F6', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#E9E3FF', justifyContent: 'center',
    alignItems: 'center', marginRight: 10,
  },
  avatarText: { color: '#7B42F6', fontWeight: '700', fontSize: 14 },
  verifiedBadge: { position: 'absolute', bottom: -2, right: -2, backgroundColor: '#FFFFFF', borderRadius: 7 },
  profileName: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  profileTitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  ratingText: { fontSize: 12, color: '#4B5563', marginLeft: 6, fontWeight: '500' },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  greenDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E', marginRight: 6 },
  statusText: { fontSize: 11, color: '#22C55E', fontWeight: '600' },

  /* Slide 3 */
  slide3Wrapper: { width: width * 0.78, height: 210, justifyContent: 'center', alignItems: 'center' },
  bookingCard: {
    width: 225, backgroundColor: '#FAFBFC', borderRadius: 14,
    padding: 12, borderWidth: 1, borderColor: '#E8EAED',
    position: 'absolute', top: 5, left: 10, zIndex: 1,
  },
  bookingTitle: { fontSize: 11, fontWeight: '700', color: '#8E8E93', marginBottom: 8, textTransform: 'uppercase' },
  bookingItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  bookingDesc: { fontSize: 11, color: '#4B5563', marginLeft: 6 },
  walletCard: {
    width: 195, backgroundColor: '#FFFFFF', borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: '#F3F0FF',
    position: 'absolute', bottom: 5, right: 10, zIndex: 2,
    shadowColor: '#7B42F6', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1, shadowRadius: 10, elevation: 5,
  },
  walletHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  walletTitle: { fontSize: 11, fontWeight: '600', color: '#6B7280', marginLeft: 6 },
  walletAmount: { fontSize: 20, fontWeight: '800', color: '#1F2937' },
  walletGrowth: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  growthText: { fontSize: 10, color: '#22C55E', fontWeight: '600', marginLeft: 4 },
  coinIcon: { position: 'absolute', right: 16, top: 16 },
})
