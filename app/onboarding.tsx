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
import Svg, {
  G,
  Path,
  Rect,
  Circle,
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  ClipPath,
  Ellipse,
  Line,
  Text as SvgText,
} from 'react-native-svg'

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

// ─────────────────────────────────────────────
// Slide 1 – Inline SVG Illustration
// viewBox 0 0 400 360, 5 layered groups
// ─────────────────────────────────────────────
function Slide1Illustration() {
  return (
    <Svg
      width="100%"
      height={300}
      viewBox="0 0 400 360"
      preserveAspectRatio="xMidYMid meet"
    >
      <Defs>
        {/* Ambient radial gradient */}
        <RadialGradient id="ambientGrad" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#7B42F6" stopOpacity="0.12" />
          <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </RadialGradient>
        {/* Phone screen clip */}
        <ClipPath id="screenClip">
          <Rect x={157} y={73} width={96} height={178} rx={12} />
        </ClipPath>
        {/* Purple card gradient */}
        <LinearGradient id="purpleCard" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#8B5CF6" />
          <Stop offset="100%" stopColor="#7B42F6" />
        </LinearGradient>
        {/* Green card gradient */}
        <LinearGradient id="greenCard" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#22C55E" />
          <Stop offset="100%" stopColor="#16A34A" />
        </LinearGradient>
        {/* Drop shadow for phone */}
        <LinearGradient id="shadowGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#7B42F6" stopOpacity="0.15" />
          <Stop offset="100%" stopColor="#7B42F6" stopOpacity="0" />
        </LinearGradient>
        {/* Tech vest gradient */}
        <LinearGradient id="techVest" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#0EA5E9" />
          <Stop offset="100%" stopColor="#0284C7" />
        </LinearGradient>
        {/* Casual shirt gradient */}
        <LinearGradient id="casualShirt" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#7B42F6" />
          <Stop offset="100%" stopColor="#5B21B6" />
        </LinearGradient>
      </Defs>

      {/* ── LAYER 1: Background ambient & isometric grid ── */}
      <G>
        {/* Ambient radial glow */}
        <Circle cx={200} cy={180} r={180} fill="url(#ambientGrad)" />
        {/* Isometric grid lines — horizontal family */}
        {[-20, 0, 20, 40, 60, 80, 100, 120, 140].map((offset, i) => (
          <Line
            key={`hg-${i}`}
            x1={0}
            y1={180 + offset}
            x2={400}
            y2={180 + offset}
            stroke="#7B42F6"
            strokeWidth={0.5}
            opacity={0.08}
          />
        ))}
        {/* Isometric grid lines — diagonal left family */}
        {[0, 60, 120, 180, 240, 300, 360].map((offset, i) => (
          <Line
            key={`dl-${i}`}
            x1={offset}
            y1={0}
            x2={offset - 200}
            y2={360}
            stroke="#7B42F6"
            strokeWidth={0.5}
            opacity={0.06}
          />
        ))}
        {/* Isometric grid lines — diagonal right family */}
        {[0, 60, 120, 180, 240, 300, 360].map((offset, i) => (
          <Line
            key={`dr-${i}`}
            x1={offset}
            y1={0}
            x2={offset + 200}
            y2={360}
            stroke="#24A1DE"
            strokeWidth={0.5}
            opacity={0.05}
          />
        ))}
        {/* Corner accent circles */}
        <Circle cx={40} cy={60} r={28} stroke="#7B42F6" strokeWidth={1} fill="none" opacity={0.1} />
        <Circle cx={360} cy={300} r={22} stroke="#24A1DE" strokeWidth={1} fill="none" opacity={0.1} />
      </G>

      {/* ── LAYER 2: Technician (rear-left, crouched, arms extending to phone) ── */}
      <G>
        {/* Body/torso — tech vest */}
        <Path
          d="M75 188 Q88 182 101 188 L105 228 Q88 234 71 228 Z"
          fill="url(#techVest)"
        />
        {/* Vest pocket detail */}
        <Rect x={84} y={196} width={10} height={7} rx={1.5} fill="#075985" opacity={0.5} />
        {/* Tech pants */}
        <Path
          d="M71 228 L73 262 L84 262 L88 238 L92 262 L103 262 L105 228 Q88 234 71 228Z"
          fill="#1E3A5F"
        />
        {/* Boots */}
        <Ellipse cx={78} cy={264} rx={8} ry={4} fill="#0F172A" />
        <Ellipse cx={98} cy={264} rx={8} ry={4} fill="#0F172A" />
        {/* Neck */}
        <Rect x={84} y={172} width={10} height={10} rx={5} fill="#F5B8A8" />
        {/* Head */}
        <Circle cx={89} cy={162} r={16} fill="#F5B8A8" />
        {/* Hair */}
        <Path
          d="M73 160 Q76 145 89 143 Q102 145 105 160 Q102 152 89 150 Q76 152 73 160Z"
          fill="#2D1B69"
        />
        {/* Eye left */}
        <Circle cx={84} cy={162} r={2} fill="#1F2937" />
        {/* Eye right */}
        <Circle cx={94} cy={162} r={2} fill="#1F2937" />
        {/* Mouth — focused expression */}
        <Path d="M85 169 Q89 167 93 169" stroke="#C97B6B" strokeWidth={1.5} fill="none" strokeLinecap="round" />
        {/* Left arm (down, relaxed) */}
        <Path
          d="M75 194 Q64 208 60 222"
          stroke="#F5B8A8"
          strokeWidth={9}
          strokeLinecap="round"
          fill="none"
        />
        {/* Right arm extending toward phone with stylus */}
        <Path
          d="M101 194 Q118 184 134 172"
          stroke="#F5B8A8"
          strokeWidth={9}
          strokeLinecap="round"
          fill="none"
        />
        {/* Stylus/tool in right hand */}
        <Path
          d="M134 172 L148 163"
          stroke="#0EA5E9"
          strokeWidth={4}
          strokeLinecap="round"
        />
        <Circle cx={148} cy={162} r={3} fill="#0EA5E9" />
        {/* Floating energy nodes from stylus */}
        <Circle cx={151} cy={152} r={4} fill="#24A1DE" opacity={0.7} />
        <Circle cx={157} cy={145} r={2.5} fill="#24A1DE" opacity={0.5} />
        <Circle cx={145} cy={143} r={2} fill="#38BDF8" opacity={0.4} />
        <Circle cx={154} cy={137} r={3} fill="#24A1DE" opacity={0.3} />
        {/* Tool belt */}
        <Rect x={71} y={224} width={34} height={6} rx={3} fill="#075985" />
        <Rect x={78} y={222} width={8} height={8} rx={2} fill="#0EA5E9" />
        <Circle cx={95} cy={226} r={3} fill="#0F172A" />
      </G>

      {/* ── LAYER 3: Central Smartphone & App UI ── */}
      <G>
        {/* Phone shadow */}
        <Ellipse cx={205} cy={282} rx={58} ry={10} fill="url(#shadowGrad)" />
        {/* Phone outer frame */}
        <Rect
          x={150}
          y={58}
          width={110}
          height={218}
          rx={24}
          fill="#2D0D6B"
        />
        {/* Camera notch */}
        <Rect x={189} y={65} width={32} height={5} rx={2.5} fill="#1A0050" />
        <Circle cx={205} cy={67} r={2.5} fill="#0F0028" />
        {/* Side button */}
        <Rect x={259} y={115} width={4} height={22} rx={2} fill="#1A0050" />
        {/* Screen background — white */}
        <Rect
          x={157}
          y={73}
          width={96}
          height={178}
          rx={12}
          fill="#FFFFFF"
          clipPath="url(#screenClip)"
        />

        {/* ── App UI Content (clipped to screen) ── */}
        <G clipPath="url(#screenClip)">
          {/* Status bar strip */}
          <Rect x={157} y={73} width={96} height={8} fill="#F8F7FF" />

          {/* Header bar */}
          <Rect x={157} y={81} width={96} height={18} fill="#FFFFFF" />
          {/* Brand — MESCO text */}
          <SvgText
            x={168}
            y={94}
            fontSize={9}
            fontWeight="900"
            fill="#3D0F95"
            letterSpacing={0.5}
          >
            MESCO
          </SvgText>
          {/* "tt" logo — two interlocked circles with crossbar (simplified path) */}
          <G>
            {/* First "t" loop */}
            <Circle cx={210} cy={91} r={5} stroke="#7B42F6" strokeWidth={1.8} fill="none" />
            {/* Second "t" loop — offset, overlapping */}
            <Circle cx={215} cy={91} r={5} stroke="#7B42F6" strokeWidth={1.8} fill="none" />
            {/* Shared crossbar */}
            <Line x1={205} y1={91} x2={220} y2={91} stroke="#7B42F6" strokeWidth={1.8} />
          </G>
          {/* Header divider */}
          <Line x1={157} y1={99} x2={253} y2={99} stroke="#F0EDFF" strokeWidth={0.8} />

          {/* Search bar */}
          <Rect x={161} y={102} width={88} height={12} rx={6} fill="#F8F7FF" />
          <Circle cx={168} cy={108} r={3} stroke="#8E8E93" strokeWidth={1} fill="none" />
          <Line x1={170} y1={110} x2={172} y2={112} stroke="#8E8E93" strokeWidth={1} strokeLinecap="round" />
          <SvgText x={175} y={112} fontSize={6} fill="#AAAAAA">
            Search services...
          </SvgText>

          {/* Section label */}
          <SvgText x={162} y={124} fontSize={6} fontWeight="700" fill="#8E8E93" letterSpacing={0.3}>
            QUICK ACTIONS
          </SvgText>

          {/* Post a Task card — purple */}
          <Rect x={161} y={127} width={40} height={38} rx={7} fill="url(#purpleCard)" />
          {/* Plus icon */}
          <Line x1={181} y1={138} x2={181} y2={148} stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" />
          <Line x1={176} y1={143} x2={186} y2={143} stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" />
          <SvgText x={163} y={160} fontSize={5} fontWeight="700" fill="#FFFFFF">
            Post Task
          </SvgText>

          {/* Find Work card — green */}
          <Rect x={205} y={127} width={44} height={38} rx={7} fill="url(#greenCard)" />
          {/* Briefcase icon */}
          <Rect x={218} y={140} width={14} height={10} rx={2} fill="#FFFFFF" opacity={0.9} />
          <Path d="M221 140 L221 137 Q227 135 227 137 L227 140" stroke="#FFFFFF" strokeWidth={1.5} fill="none" strokeLinecap="round" />
          <Line x1={222} y1={145} x2={236} y2={145} stroke="#16A34A" strokeWidth={1} />
          <SvgText x={206} y={160} fontSize={5} fontWeight="700" fill="#FFFFFF">
            Find Work
          </SvgText>

          {/* Featured Tasks label */}
          <SvgText x={162} y={173} fontSize={6} fontWeight="700" fill="#8E8E93" letterSpacing={0.3}>
            NEARBY TASKS
          </SvgText>
          {/* Task item 1 */}
          <Rect x={161} y={176} width={88} height={14} rx={4} fill="#F8F7FF" />
          <Circle cx={169} cy={183} r={4} fill="#E9E3FF" />
          <Rect x={177} y={179} width={40} height={3} rx={1.5} fill="#C4B5FD" />
          <Rect x={177} y={185} width={26} height={3} rx={1.5} fill="#E5E7EB" />
          <SvgText x={226} y={185} fontSize={5.5} fontWeight="700" fill="#22C55E">850 ETB</SvgText>

          {/* Task item 2 */}
          <Rect x={161} y={193} width={88} height={14} rx={4} fill="#F8F7FF" />
          <Circle cx={169} cy={200} r={4} fill="#DCFCE7" />
          <Rect x={177} y={196} width={34} height={3} rx={1.5} fill="#86EFAC" />
          <Rect x={177} y={202} width={20} height={3} rx={1.5} fill="#E5E7EB" />
          <SvgText x={226} y={202} fontSize={5.5} fontWeight="700" fill="#7B42F6">1.2K ETB</SvgText>

          {/* Bottom nav strip */}
          <Rect x={157} y={239} width={96} height={12} fill="#FAFBFF" />
          <Circle cx={178} cy={245} r={3} fill="#7B42F6" opacity={0.8} />
          <Circle cx={196} cy={245} r={3} fill="#E5E7EB" />
          <Circle cx={214} cy={245} r={3} fill="#E5E7EB" />
          <Circle cx={232} cy={245} r={3} fill="#E5E7EB" />
        </G>

        {/* Phone bottom home indicator */}
        <Rect x={192} y={270} width={26} height={4} rx={2} fill="#FFFFFF" opacity={0.3} />
      </G>

      {/* ── LAYER 4: Handyman (sitting on upper bezel) ── */}
      <G>
        {/* Hard hat brim */}
        <Ellipse cx={205} cy={43} rx={20} ry={6} fill="#FCD34D" />
        {/* Hard hat dome */}
        <Path d="M185 43 Q185 26 205 24 Q225 26 225 43 Z" fill="#FBBF24" />
        {/* Hard hat stripe */}
        <Path d="M185 43 Q205 39 225 43" stroke="#F59E0B" strokeWidth={1.5} fill="none" />
        {/* Head */}
        <Circle cx={205} cy={53} r={14} fill="#FDBCB4" />
        {/* Hair visible under hat */}
        <Path d="M191 50 Q192 45 205 44 Q218 45 219 50" fill="#1A0050" />
        {/* Left eye */}
        <Circle cx={200} cy={53} r={2} fill="#1F2937" />
        {/* Right eye */}
        <Circle cx={210} cy={53} r={2} fill="#1F2937" />
        {/* Smile */}
        <Path d="M200 59 Q205 62 210 59" stroke="#C97B6B" strokeWidth={1.5} fill="none" strokeLinecap="round" />
        {/* Denim overalls — bib part */}
        <Path d="M193 67 Q205 63 217 67 L221 90 Q205 95 189 90 Z" fill="#1D4ED8" />
        {/* Overall straps */}
        <Rect x={197} y={65} width={5} height={18} rx={2.5} fill="#1E40AF" />
        <Rect x={208} y={65} width={5} height={18} rx={2.5} fill="#1E40AF" />
        {/* Overall bib pocket */}
        <Rect x={201} y={72} width={9} height={7} rx={2} fill="#1E40AF" opacity={0.7} />
        {/* Left leg draped over left side of phone */}
        <Path d="M193 90 Q186 100 180 110 Q175 118 174 128" stroke="#1D4ED8" strokeWidth={12} strokeLinecap="round" fill="none" />
        {/* Left foot/boot */}
        <Ellipse cx={173} cy={132} rx={9} ry={5} fill="#0F172A" />
        {/* Right leg draped over right side of phone */}
        <Path d="M217 90 Q224 100 230 110 Q235 118 236 128" stroke="#1D4ED8" strokeWidth={12} strokeLinecap="round" fill="none" />
        {/* Right foot/boot */}
        <Ellipse cx={237} cy={132} rx={9} ry={5} fill="#0F172A" />
        {/* Left arm — resting on phone frame left */}
        <Path d="M193 78 Q180 82 170 88" stroke="#FDBCB4" strokeWidth={9} strokeLinecap="round" fill="none" />
        {/* Right arm — holding wrench */}
        <Path d="M217 78 Q228 76 240 72" stroke="#FDBCB4" strokeWidth={9} strokeLinecap="round" fill="none" />
        {/* Wrench body */}
        <Rect x={240} y={65} width={22} height={7} rx={3.5} fill="#6B7280" transform="rotate(-20, 251, 68)" />
        {/* Wrench head open end */}
        <Path d="M256 62 Q262 58 264 65 Q262 72 256 70 Z" fill="#4B5563" />
        {/* Wrench handle end */}
        <Circle cx={243} cy={73} r={4} fill="#374151" />
        {/* Tool belt */}
        <Path d="M189 90 Q205 95 221 90" stroke="#92400E" strokeWidth={5} strokeLinecap="round" fill="none" />
        <Circle cx={196} cy={93} r={3} fill="#B45309" />
        <Rect x={202} y={91} width={6} height={5} rx={1} fill="#92400E" />
        <Circle cx={214} cy={92} r={2.5} fill="#B45309" />
      </G>

      {/* ── LAYER 5: Foreground User/Tasker (front-right, arm raised, finger pointing) ── */}
      <G>
        {/* Shadow under feet */}
        <Ellipse cx={305} cy={330} rx={22} ry={6} fill="#7B42F6" opacity={0.08} />
        {/* Legs */}
        <Path d="M295 288 L291 328 L299 328 L305 304 L311 328 L319 328 L315 288 Z" fill="#1E3A5F" />
        {/* Shoes */}
        <Ellipse cx={295} cy={330} rx={9} ry={4} fill="#0F172A" />
        <Ellipse cx={315} cy={330} rx={9} ry={4} fill="#0F172A" />
        {/* Body — casual shirt */}
        <Path d="M291 250 Q305 244 319 250 L323 290 Q305 296 287 290 Z" fill="url(#casualShirt)" />
        {/* Shirt detail — collar */}
        <Path d="M300 250 L305 258 L310 250" stroke="#5B21B6" strokeWidth={1.5} fill="none" />
        {/* Right arm hanging down */}
        <Path d="M319 256 Q330 270 333 288" stroke="#FDBCB4" strokeWidth={10} strokeLinecap="round" fill="none" />
        {/* Right hand */}
        <Circle cx={334} cy={291} r={6} fill="#FDBCB4" />
        {/* LEFT ARM — raised, extended toward phone screen, pointing finger */}
        <Path d="M291 256 Q270 234 245 205" stroke="#FDBCB4" strokeWidth={10} strokeLinecap="round" fill="none" />
        {/* Left hand + extended index finger */}
        <Circle cx={243} cy={203} r={6} fill="#FDBCB4" />
        {/* Index finger pointing at phone */}
        <Path d="M240 200 L228 190" stroke="#FDBCB4" strokeWidth={5} strokeLinecap="round" />
        {/* Finger tip glow touching "Post Task" */}
        <Circle cx={226} cy={189} r={4} fill="#7B42F6" opacity={0.3} />
        <Circle cx={226} cy={189} r={2} fill="#7B42F6" opacity={0.8} />
        {/* Tap pulse ring */}
        <Circle cx={226} cy={189} r={7} stroke="#7B42F6" strokeWidth={1} fill="none" opacity={0.4} />
        {/* Neck */}
        <Rect x={300} y={232} width={10} height={12} rx={5} fill="#FDBCB4" />
        {/* Head */}
        <Circle cx={305} cy={222} r={16} fill="#FDBCB4" />
        {/* Hair — modern casual */}
        <Path d="M289 218 Q290 204 305 202 Q320 204 321 218 Q318 210 305 208 Q292 210 289 218Z" fill="#1A0050" />
        {/* Side hair */}
        <Path d="M289 218 Q287 224 290 228" stroke="#1A0050" strokeWidth={3} fill="none" strokeLinecap="round" />
        {/* Left eye */}
        <Circle cx={299} cy={222} r={2.2} fill="#1F2937" />
        {/* Right eye */}
        <Circle cx={311} cy={222} r={2.2} fill="#1F2937" />
        {/* Raised brow (focused, reaching expression) */}
        <Path d="M296 217 Q299 215 302 217" stroke="#1A0050" strokeWidth={1.2} fill="none" strokeLinecap="round" />
        {/* Slight open mouth (engaging/excited) */}
        <Path d="M301 229 Q305 232 309 229" stroke="#C97B6B" strokeWidth={1.5} fill="none" strokeLinecap="round" />
        {/* Shirt collar back detail */}
        <Path d="M295 250 L305 244 L315 250" stroke="#5B21B6" strokeWidth={1} fill="none" />
        {/* Phone in right hand (partial) — the character has their right hand free, holding mini phone */}
        <Rect x={336} y={285} width={16} height={26} rx={4} fill="#374151" opacity={0.7} />
        <Rect x={338} y={288} width={12} height={20} rx={2} fill="#1D4ED8" opacity={0.5} />
      </G>
    </Svg>
  )
}

export default function Onboarding() {
  const router = useRouter()
  const scrollX = useRef(new Animated.Value(0)).current
  const scrollViewRef = useRef<ScrollView>(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  // Continuous floating for slide 1 SVG
  const floatAnim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -8,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start()
  }, [floatAnim])

  // Spring pulse for brand logo
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

  // Slide 2 entrance
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

  // Slide 3 entrance
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

  // Coin animation for Slide 3
  const coinAnim = useRef(new Animated.Value(-15)).current
  const coinOpacity = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(coinAnim, { toValue: 12, duration: 1200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(coinOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        ]),
        Animated.timing(coinOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
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

      {/* Subtle background depth vectors */}
      <View style={styles.bgContainer} pointerEvents="none">
        <View style={styles.bgCircle1} />
        <View style={styles.bgCircle2} />
        <View style={[styles.bgHLine, { top: height * 0.22 }]} />
        <View style={[styles.bgHLine, { top: height * 0.54 }]} />
      </View>

      {/* Skip link */}
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
            outputRange: [0.88, 1, 0.88],
            extrapolate: 'clamp',
          })

          return (
            <View style={styles.slide} key={index}>
              {/* ── Graphic zone ── */}
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
                  <Slide1Illustration />
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

              {/* ── Text zone ── */}
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
            const segW = scrollX.interpolate({
              inputRange: [(index - 1) * width, index * width, (index + 1) * width],
              outputRange: [12, 28, 12],
              extrapolate: 'clamp',
            })
            const segC = scrollX.interpolate({
              inputRange: [(index - 1) * width, index * width, (index + 1) * width],
              outputRange: ['#E0E0E0', '#24A1DE', '#E0E0E0'],
              extrapolate: 'clamp',
            })
            return (
              <Animated.View
                key={index}
                style={[styles.indicator, { width: segW, backgroundColor: segC }]}
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
