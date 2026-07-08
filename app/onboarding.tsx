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

  // Floating Loop for Slide 1
  const floatAnim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -10,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start()
  }, [floatAnim])

  // Spring Pulse for Brand Logo
  const logoPulseAnim = useRef(new Animated.Value(1)).current
  useEffect(() => {
    logoPulseAnim.setValue(1)
    Animated.spring(logoPulseAnim, {
      toValue: 1.15,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start(() => {
      Animated.spring(logoPulseAnim, {
        toValue: 1,
        friction: 4,
        tension: 30,
        useNativeDriver: true,
      }).start()
    })
  }, [currentIndex, logoPulseAnim])

  // Slide 2 Custom slide-up animation trigger
  const slide2Anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (currentIndex === 1) {
      slide2Anim.setValue(0)
      Animated.timing(slide2Anim, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start()
    }
  }, [currentIndex, slide2Anim])

  // Slide 3 custom entrance trigger
  const slide3Anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (currentIndex === 2) {
      slide3Anim.setValue(0)
      Animated.timing(slide3Anim, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start()
    }
  }, [currentIndex, slide3Anim])

  // Sliding coin animation for Slide 3
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
        Animated.parallel([
          Animated.timing(coinOpacity, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(300),
      ])
    ).start()
  }, [coinAnim, coinOpacity])

  // Tap helper pulse for Slide 1
  const tapPulseAnim = useRef(new Animated.Value(1)).current
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(tapPulseAnim, {
          toValue: 1.5,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(tapPulseAnim, {
          toValue: 1,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start()
  }, [tapPulseAnim])

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

  // Header and controls opacity
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

      {/* Depth Background Vectors (Visible on all slides) */}
      <View style={styles.bgGridContainer} pointerEvents="none">
        <View style={styles.bgCircle1} />
        <View style={styles.bgCircle2} />
        <View style={[styles.bgLine, { top: height * 0.23 }]} />
        <View style={[styles.bgLine, { top: height * 0.53 }]} />
      </View>

      {/* Skip button fades out on final page */}
      <Animated.View 
        style={[styles.headerContainer, { opacity: skipOpacity }]}
        pointerEvents={currentIndex === 2 ? 'none' : 'auto'}
      >
        <TouchableOpacity onPress={completeOnboarding} activeOpacity={0.7}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Main swiper */}
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
            outputRange: [0.85, 1, 0.85],
            extrapolate: 'clamp',
          })

          const slideTranslateX = scrollX.interpolate({
            inputRange: [(index - 1) * width, index * width, (index + 1) * width],
            outputRange: [100, 0, -100],
            extrapolate: 'clamp',
          })

          return (
            <View style={styles.slide} key={index}>
              {/* Center Graphic Block */}
              <Animated.View
                style={[
                  styles.graphicBlock,
                  {
                    opacity: slideOpacity,
                    transform: [
                      { scale: slideScale },
                      { translateX: slideTranslateX },
                    ],
                  },
                ]}
              >
                {index === 0 && (
                  <Animated.View style={[styles.slide1Container, { transform: [{ translateY: floatAnim }] }]}>
                    {/* Circuit panel working area */}
                    <View style={styles.circuitGridPanel} />

                    {/* Smartphone Mockup */}
                    <View style={styles.phoneFrame}>
                      <View style={styles.phoneCamera} />
                      <View style={styles.phoneContent}>
                        {/* Mock Header Row */}
                        <View style={styles.mockHeaderRow}>
                          <Text style={styles.mockLogoText}>MESCO</Text>
                          <Image
                            source={require('../assets/images/adaptive-icon.png')}
                            style={styles.mockLogoImage}
                            contentFit="contain"
                          />
                        </View>
                        {/* Mock Search Bar */}
                        <View style={styles.mockSearchBar}>
                          <Ionicons name="search" size={9} color="#8E8E93" style={{ marginRight: 4 }} />
                          <Text style={styles.mockSearchText}>Search for services...</Text>
                        </View>
                        {/* Mock Quick Actions Grid */}
                        <Text style={styles.mockSectionTitle}>Quick Actions</Text>
                        <View style={styles.mockActionsGrid}>
                          <View style={styles.mockActionCardPurple}>
                            <Ionicons name="add-circle" size={13} color="#7B42F6" />
                            <Text style={styles.mockActionLabelPurple}>Post Task</Text>
                          </View>
                          <View style={styles.mockActionCardGreen}>
                            <Ionicons name="briefcase" size={12} color="#22C55E" />
                            <Text style={styles.mockActionLabelGreen}>Find Work</Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    {/* Character 1: User (Tapping on screen) */}
                    <View style={[styles.characterNode, styles.charCustomer]}>
                      <Ionicons name="person" size={16} color="#7B42F6" />
                      <View style={styles.charBadge}>
                        <Text style={styles.charBadgeText}>User</Text>
                      </View>
                    </View>
                    {/* Visual Finger tapping indicator line and pulse */}
                    <View style={styles.tapConnectorLine} />
                    <View style={styles.tapIndicatorPulseContainer}>
                      <Animated.View style={[styles.tapPulseCircle, { transform: [{ scale: tapPulseAnim }], opacity: tapPulseAnim.interpolate({ inputRange: [1, 1.5], outputRange: [0.6, 0] }) }]} />
                      <View style={styles.tapTargetDot} />
                    </View>

                    {/* Character 2: Handyman (Sitting on top of bezel with Wrench) */}
                    <View style={[styles.characterNode, styles.charHandyman]}>
                      <FontAwesome6 name="wrench" size={14} color="#24A1DE" />
                      <View style={styles.charBadge}>
                        <Text style={styles.charBadgeText}>Helper</Text>
                      </View>
                    </View>

                    {/* Character 3: Tech (Lower rear working on exposed grid) */}
                    <View style={[styles.characterNode, styles.charTech]}>
                      <Ionicons name="construct" size={15} color="#7B42F6" />
                      <View style={styles.charBadge}>
                        <Text style={styles.charBadgeText}>Tech</Text>
                      </View>
                    </View>
                  </Animated.View>
                )}

                {index === 1 && (
                  <Animated.View
                    style={[
                      styles.slide2Container,
                      {
                        opacity: slide2Anim,
                        transform: [
                          {
                            translateY: slide2Anim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [20, 0],
                            }),
                          },
                          {
                            scale: slide2Anim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.95, 1],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    {/* Background floating icons */}
                    <View style={[styles.floatingSparkle, styles.sparkle1]}>
                      <Ionicons name="bulb-outline" size={24} color="#FBBF24" />
                    </View>
                    <View style={[styles.floatingSparkle, styles.sparkle2]}>
                      <Ionicons name="shield-checkmark-outline" size={28} color="#24A1DE" />
                    </View>

                    {/* Striking Profile Card */}
                    <View style={styles.profileCard}>
                      <View style={styles.profileHeader}>
                        <View style={styles.avatar}>
                          <Text style={styles.avatarText}>SK</Text>
                          <View style={styles.verifiedBadge}>
                            <MaterialIcons name="verified" size={14} color="#24A1DE" />
                          </View>
                        </View>
                        <View style={styles.profileMeta}>
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
                  </Animated.View>
                )}

                {index === 2 && (
                  <Animated.View
                    style={[
                      styles.slide3Container,
                      {
                        opacity: slide3Anim,
                        transform: [
                          {
                            translateY: slide3Anim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [20, 0],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    {/* Booking Card */}
                    <View style={styles.bookingCard}>
                      <Text style={styles.bookingTitle}>Incoming Bookings</Text>
                      <View style={styles.bookingItem}>
                        <Ionicons name="calendar-outline" size={14} color="#7B42F6" />
                        <Text style={styles.bookingDesc}>Fix Kitchen Sink - 1,200 ETB</Text>
                      </View>
                      <View style={styles.bookingItem}>
                        <Ionicons name="calendar-outline" size={14} color="#7B42F6" />
                        <Text style={styles.bookingDesc}>Mount TV Bracket - 800 ETB</Text>
                      </View>
                    </View>

                    {/* Wallet Card */}
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

                      {/* Floating coin graphics */}
                      <Animated.View style={[styles.coinIcon, { opacity: coinOpacity, transform: [{ translateY: coinAnim }] }]}>
                        <FontAwesome6 name="coins" size={16} color="#FBBF24" />
                      </Animated.View>
                    </View>
                  </Animated.View>
                )}
              </Animated.View>

              {/* Text content card */}
              <View style={styles.textBlock}>
                {index === 0 ? (
                  <View style={styles.logoTitleRow}>
                    <Text style={styles.welcomeText}>Welcome to </Text>
                    <Text style={styles.logoTextInline}>MESCO</Text>
                    <Animated.Image
                      source={require('../assets/images/adaptive-icon.png')}
                      style={[styles.inlineLogoImage, { transform: [{ scale: logoPulseAnim }] }]}
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

      {/* Bottom controls */}
      <View style={styles.footer}>
        {/* Pagination indicators (Slide 1 & 2) */}
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

        {/* Custom inline footer logo brand row */}
        <View style={styles.footerWrap}>
          <Text style={styles.footerText}>© {new Date().getFullYear()} MESCO</Text>
          <Image
            source={require('../assets/images/adaptive-icon.png')}
            style={styles.footerLogoImage}
            contentFit="contain"
          />
          <Text style={styles.footerText}>. All rights reserved.</Text>
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  bgGridContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  bgCircle1: {
    position: 'absolute',
    top: height * 0.08,
    left: -50,
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1.5,
    borderColor: '#7B42F6',
    opacity: 0.05,
  },
  bgCircle2: {
    position: 'absolute',
    bottom: height * 0.24,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 1.5,
    borderColor: '#24A1DE',
    opacity: 0.05,
  },
  bgLine: {
    position: 'absolute',
    width: '100%',
    height: 1,
    backgroundColor: '#7B42F6',
    opacity: 0.04,
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
    height: height * 0.70,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 36,
    paddingTop: 12,
  },
  graphicBlock: {
    width: '100%',
    height: height * 0.36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textBlock: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#7B42F6',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  logoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#7B42F6',
    letterSpacing: 0.3,
  },
  logoTextInline: {
    fontSize: 24,
    fontWeight: '900',
    color: '#3D0F95',
    letterSpacing: 0.8,
  },
  inlineLogoImage: {
    width: 60,
    height: 60,
    marginLeft: -14,
    marginTop: -2,
  },
  description: {
    fontSize: 15,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 23,
    fontWeight: '400',
  },
  footer: {
    height: 140,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  indicator: {
    height: 6,
    borderRadius: 3,
    marginHorizontal: 4,
  },
  actionButtonContainer: {
    width: '100%',
    paddingHorizontal: 8,
    top: 4,
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
  footerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  footerText: {
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '500',
    textAlign: 'center',
  },
  footerLogoImage: {
    width: 26,
    height: 26,
    marginLeft: -6,
    marginRight: 2,
    marginTop: -1,
  },

  /* Slide 1 - Smartphone Mock & 3 Characters */
  slide1Container: {
    width: 220,
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circuitGridPanel: {
    position: 'absolute',
    width: 90,
    height: 140,
    right: 20,
    top: 40,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    borderColor: 'rgba(123, 66, 246, 0.22)',
    borderRadius: 12,
    zIndex: -1,
  },
  phoneFrame: {
    width: 104,
    height: 174,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#7B42F6',
    backgroundColor: '#FFFFFF',
    padding: 6,
    justifyContent: 'flex-start',
    shadowColor: '#7B42F6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  phoneCamera: {
    width: 26,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E8EAED',
    alignSelf: 'center',
    position: 'absolute',
    top: 4,
  },
  phoneContent: {
    flex: 1,
    paddingTop: 8,
  },
  mockHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 22,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F0FF',
    paddingBottom: 2,
  },
  mockLogoText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#3D0F95',
    letterSpacing: 0.3,
  },
  mockLogoImage: {
    width: 20,
    height: 20,
    marginLeft: -4.5,
    marginTop: -0.5,
  },
  mockSearchBar: {
    height: 16,
    borderRadius: 5,
    backgroundColor: '#FAFBFC',
    borderWidth: 0.5,
    borderColor: '#E8EAED',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginVertical: 6,
  },
  mockSearchText: {
    fontSize: 6,
    color: '#8E8E93',
  },
  mockSectionTitle: {
    fontSize: 6.5,
    fontWeight: '800',
    color: '#8E8E93',
    textTransform: 'uppercase',
    marginBottom: 4,
    marginLeft: 2,
  },
  mockActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  mockActionCardPurple: {
    width: '47%',
    height: 40,
    backgroundColor: '#F3F0FF',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  mockActionLabelPurple: {
    fontSize: 5.5,
    fontWeight: 'bold',
    color: '#7B42F6',
    marginTop: 2,
  },
  mockActionCardGreen: {
    width: '47%',
    height: 40,
    backgroundColor: '#DCFCE7',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  mockActionLabelGreen: {
    fontSize: 5.5,
    fontWeight: 'bold',
    color: '#16A34A',
    marginTop: 2,
  },
  characterNode: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 3,
    zIndex: 5,
  },
  charCustomer: {
    bottom: 12,
    left: 10,
    borderColor: '#7B42F6',
  },
  charHandyman: {
    top: -18,
    left: 45,
    borderColor: '#24A1DE',
  },
  charTech: {
    bottom: 36,
    right: 12,
    borderColor: '#7B42F6',
  },
  charBadge: {
    position: 'absolute',
    bottom: -6,
    backgroundColor: '#FAFBFC',
    borderWidth: 0.5,
    borderColor: '#E8EAED',
    borderRadius: 3,
    paddingHorizontal: 2.5,
    paddingVertical: 0.5,
  },
  charBadgeText: {
    fontSize: 5,
    fontWeight: 'bold',
    color: '#4B5563',
  },
  tapConnectorLine: {
    position: 'absolute',
    left: 42,
    bottom: 40,
    width: 32,
    height: 52,
    borderLeftWidth: 1,
    borderTopWidth: 1,
    borderColor: '#7B42F6',
    borderStyle: 'dotted',
    borderTopLeftRadius: 6,
    opacity: 0.5,
    zIndex: 1,
  },
  tapIndicatorPulseContainer: {
    position: 'absolute',
    left: 70,
    bottom: 88,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 4,
  },
  tapTargetDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#7B42F6',
  },
  tapPulseCircle: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#7B42F6',
  },

  /* Slide 2 - Customer Trust Profile Card */
  slide2Container: {
    width: width * 0.75,
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingSparkle: {
    position: 'absolute',
    zIndex: 5,
  },
  sparkle1: {
    top: 5,
    right: 15,
  },
  sparkle2: {
    bottom: 10,
    left: 10,
  },
  profileCard: {
    width: 250,
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
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E9E3FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: '#7B42F6',
    fontWeight: '700',
    fontSize: 14,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
  },
  profileMeta: {
    justifyContent: 'center',
  },
  profileName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  profileTitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  ratingText: {
    fontSize: 12,
    color: '#4B5563',
    marginLeft: 6,
    fontWeight: '500',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    color: '#22C55E',
    fontWeight: '600',
  },

  /* Slide 3 - Earnings & Wallet Graphics */
  slide3Container: {
    width: width * 0.75,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookingCard: {
    width: 220,
    backgroundColor: '#FAFBFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E8EAED',
    position: 'absolute',
    top: 5,
    left: 20,
    zIndex: 1,
  },
  bookingTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8E8E93',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  bookingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  bookingDesc: {
    fontSize: 11,
    color: '#4B5563',
    marginLeft: 6,
  },
  walletCard: {
    width: 190,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F0FF',
    position: 'absolute',
    bottom: 5,
    right: 20,
    zIndex: 2,
    shadowColor: '#7B42F6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  walletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  walletTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: 6,
  },
  walletAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1F2937',
  },
  walletGrowth: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  growthText: {
    fontSize: 10,
    color: '#22C55E',
    fontWeight: '600',
    marginLeft: 4,
  },
  coinIcon: {
    position: 'absolute',
    right: 16,
    top: 16,
  },
})
