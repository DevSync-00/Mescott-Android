import React, { useEffect, useState, useCallback, useRef } from 'react'
import { View, Text, StatusBar, Animated, Easing } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Tabs, usePathname, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { setStatusBarBackgroundColor, setStatusBarStyle } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { AuthProvider, useAuth } from '../contexts/SimpleAuthContext'
import { LanguageProvider } from '../contexts/LanguageContext'
import { NotificationProvider } from '../contexts/NotificationContext'
import { ChatUnreadProvider, useChatUnread } from '../contexts/ChatUnreadContext'
import { ToastProvider } from '../contexts/ToastContext'
import { ErrorBoundary } from '../components/ErrorBoundary'
import CustomAlert from '../components/CustomAlert'
import { alertService } from '../utils/alert'
import {
  initConnectivityListener,
  cleanupConnectivityListener,
  onConnectivityChange,
} from '../lib/connectivity'
import { useAppStore } from '../state/store'
import { ChatService } from '../services/ChatService'
import { TaskService } from '../services/TaskService'
import { Colors } from '../constants/Colors'

// KeyboardProvider is owned by react-native-gifted-chat on the chat-detail screen.
// Avoid wrapping the entire app to prevent double keyboard inset adjustment.

// Keep the native splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync()

// Set the animation options for a smooth fade transition
// Note: setOptions is only available in development builds, not Expo Go
if (typeof SplashScreen.setOptions === 'function') {
  // Only call setOptions if it exists (not available in Expo Go)
  try {
    SplashScreen.setOptions({
      duration: 1000,
      fade: true,
    })
  } catch {
    // Ignore error - setOptions may not be available
  }
}

function TabNavigator() {
  const { user, isAuthenticated } = useAuth()
  const { totalUnreadCount } = useChatUnread()
  const pathname = usePathname()
  const insets = useSafeAreaInsets()

  // Debug logging for Android safe area
  console.log('🔍 Android Safe Area Debug:', {
    bottom: insets.bottom,
    top: insets.top,
    left: insets.left,
    right: insets.right,
    all: insets,
  })

  // Determine which tabs to show based on user role
  const isTasker = user?.current_mode === 'tasker'

  // Define sub-pages that should hide the bottom tabs
  const subPages = [
    '/chat-detail',
    '/tasker-portfolio',
    '/tasker-profile',
    '/settings',
    '/task-detail',
    '/post-task',
    '/apply-task',
    '/edit-profile',
    '/tasker-application',
    '/review',
    '/reviews',
    '/privacy-security',
    '/work-schedule',
    '/contact-us',
    '/terms-of-service',
    '/privacy-policy',
    '/payment-success',
    '/wallet',
    '/help',
    '/notifications',
    '/task-applications',
  ]

  // Check if current page should hide tabs
  const shouldHideTabs = subPages.some((page) => pathname.startsWith(page))

  // Debug logging
  console.log(
    'TabNavigator render - isTasker:',
    isTasker,
    'current_mode:',
    user?.current_mode,
    'pathname:',
    pathname,
    'shouldHideTabs:',
    shouldHideTabs,
    'isAuthenticated:',
    isAuthenticated,
  )
  console.log('Tab visibility check - tabs should be visible:', isAuthenticated && !shouldHideTabs)

  return (
    <Tabs
      key={user?.current_mode} // Force re-render when mode changes
      initialRouteName={isAuthenticated ? 'index' : 'auth'}
      screenOptions={{
        tabBarActiveTintColor: Colors.primary[500],
        tabBarInactiveTintColor: Colors.neutral[400],
        tabBarStyle:
          isAuthenticated && !shouldHideTabs
            ? {
                backgroundColor: '#fff',
                borderTopWidth: 1,
                borderTopColor: Colors.neutral[200],
                paddingTop: 2,
                height: 56 + insets.bottom,
                paddingBottom: insets.bottom,
              }
            : { display: 'none' }, // Hide tabs during authentication or on sub-pages
        headerShown: false,
      }}
    >
      {/* Auth Tab - Hidden from tabs, only accessible when not authenticated */}
      <Tabs.Screen
        name="auth"
        options={{
          title: 'Auth',
          tabBarIcon: ({ color, size }) => <Ionicons name="log-in" size={size} color={color} />,
          href: null, // Hide from tab bar
        }}
      />

      {/* Home Tab - Always visible */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
          href: '/', // Explicitly set href to ensure it's visible
        }}
      />

      {/* Tasks Tab - Always visible */}
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color, size }) => <Ionicons name="briefcase" size={size} color={color} />,
        }}
      />

      {/* Bookings Tab - Only for Taskers */}
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Bookings',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} />,
          href: isTasker ? undefined : null, // Hide for customers
        }}
      />

      {/* Chat Tab - Always visible */}
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Chat',
          tabBarBadge:
            totalUnreadCount > 0
              ? totalUnreadCount > 99
                ? '99+'
                : totalUnreadCount
              : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles" size={size} color={color} />
          ),
        }}
      />

      {/* Applications Tab - Hidden, accessible from task details */}
      <Tabs.Screen
        name="task-applications"
        options={{
          title: 'Applications',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text" size={size} color={color} />
          ),
          href: null, // Hide from tab bar
        }}
      />

      {/* Hidden Tabs - Not visible in tab bar, accessible via navigation */}
      <Tabs.Screen
        name="notifications"
        options={{
          href: null, // Hide from tab bar
        }}
      />

      {/* Profile Tab - Always visible */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />

      {/* Hidden Tabs - Not visible in tab bar, accessible via navigation */}
      <Tabs.Screen
        name="post-task"
        options={{
          href: null, // Hide from tab bar
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          href: null, // Hide from tab bar
        }}
      />

      <Tabs.Screen
        name="edit-profile"
        options={{
          href: null, // Hide from tab bar
        }}
      />

      <Tabs.Screen
        name="tasker-application"
        options={{
          href: null, // Hide from tab bar
        }}
      />

      <Tabs.Screen
        name="chat-detail"
        options={{
          href: null, // Hide from tab bar
        }}
      />

      <Tabs.Screen
        name="task-detail"
        options={{
          href: null, // Hide from tab bar
        }}
      />

      <Tabs.Screen
        name="apply-task"
        options={{
          href: null, // Hide from tab bar
        }}
      />

      <Tabs.Screen
        name="review"
        options={{
          href: null, // Hide from tab bar
        }}
      />

      <Tabs.Screen
        name="reviews"
        options={{
          href: null, // Hide from tab bar
        }}
      />

      {/* New Settings Screens */}
      <Tabs.Screen
        name="privacy-security"
        options={{
          href: null, // Hide from tab bar
        }}
      />

      <Tabs.Screen
        name="work-schedule"
        options={{
          href: null, // Hide from tab bar
        }}
      />

      <Tabs.Screen
        name="contact-us"
        options={{
          href: null, // Hide from tab bar
        }}
      />

      <Tabs.Screen
        name="terms-of-service"
        options={{
          href: null, // Hide from tab bar
        }}
      />

      <Tabs.Screen
        name="privacy-policy"
        options={{
          href: null, // Hide from tab bar
        }}
      />

      <Tabs.Screen
        name="payment-success"
        options={{
          href: null, // Hide from tab bar
        }}
      />

      <Tabs.Screen
        name="wallet"
        options={{
          href: null, // Hide from tab bar
        }}
      />

      <Tabs.Screen
        name="help"
        options={{
          href: null, // Hide from tab bar
        }}
      />

      <Tabs.Screen
        name="tasker-portfolio"
        options={{
          href: null, // Hide from tab bar
        }}
      />

      <Tabs.Screen
        name="tasker-profile"
        options={{
          href: null, // Hide from tab bar
        }}
      />
    </Tabs>
  )
}

function AppContent() {
  const { isAuthenticated, loading: isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [appIsReady, setAppIsReady] = useState(false)
  const hasHiddenSplashRef = useRef(false)
  const isOnline = useAppStore((state: { isOnline: boolean }) => state.isOnline)
  const [alertState, setAlertState] = useState(alertService.getState())
  const fadeAnim = useRef(new Animated.Value(0)).current
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [showCustomSplash, setShowCustomSplash] = useState(true)
  const splashOpacity = useRef(new Animated.Value(1)).current
  const splashScale = useRef(new Animated.Value(0.92)).current
  const SPLASH_MAX_DURATION = 3000 // ms guardrail so all animation completes within 3s

  // Subscribe to alert service
  useEffect(() => {
    const unsubscribe = alertService.subscribe((state) => {
      setAlertState(state)
    })
    return unsubscribe
  }, [])

  // Set Android navigation bar color
  useEffect(() => {
    // Status bar should be translucent and draw behind content
    StatusBar.setBackgroundColor('transparent', true)
    StatusBar.setBarStyle('dark-content', true)
    setStatusBarBackgroundColor('transparent', true)
    setStatusBarStyle('dark')

    // Try to set Android navigation bar color at runtime
    ;(async () => {
      try {
        // Use expo-navigation-bar if available
        // @ts-ignore - Dynamic import, package may not be installed
        // eslint-disable-next-line import/no-unresolved
        const NavBar = await import('expo-navigation-bar')
        if ((NavBar as any)?.setBackgroundColorAsync) {
          await (NavBar as any).setBackgroundColorAsync('#000000')
          if ((NavBar as any).setButtonStyleAsync) {
            await (NavBar as any).setButtonStyleAsync('light')
          }
        }
      } catch {
        // Navigation bar color setting failed, continue silently
        // This is optional and may not be available in all environments
      }
    })()
  }, [])

  // Connectivity + offline queue
  useEffect(() => {
    useAppStore
      .getState()
      .hydrateOfflineQueue()
      .catch((error) => {
        console.warn('Failed to hydrate offline queue:', error)
      })
    initConnectivityListener()

    const unsubscribe = onConnectivityChange(async (online) => {
      useAppStore.getState().setOnline(online)
      if (online) {
        await useAppStore.getState().processOfflineQueue({
          'chat:send': async (payload: {
            chatId: string
            senderId: string
            content: string
            messageType?: 'text' | 'image' | 'file'
          }) => {
            await ChatService.processQueuedMessage(payload)
          },
          'task:apply': async (payload: {
            taskId: string
            taskerId: string
            proposedPrice: number
            message: string
            availabilityDate: string
            userId: string
          }) => {
            await TaskService.processQueuedTaskApplication(payload)
          },
        })
      }
    })

    return () => {
      cleanupConnectivityListener()
      unsubscribe?.()
    }
  }, [])

  // Hide native splash screen when app is ready with smooth fade-in
  useEffect(() => {
    let isMounted = true

    const prepare = async () => {
      if (isLoading) return

      try {
        // Small delay to let navigation and context settle before revealing UI
        await new Promise((resolve) => setTimeout(resolve, 160))
        if (isMounted) {
          setAppIsReady(true)
          // Fade in the app content smoothly
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }).start()
        }
        if (!hasHiddenSplashRef.current) {
          hasHiddenSplashRef.current = true
          // Hide splash screen with a slight delay to ensure smooth transition
          await new Promise((resolve) => setTimeout(resolve, 60))
          await SplashScreen.hideAsync()
        }
      } catch (e) {
        console.warn('Splash screen hide failed:', e)
      }
    }

    prepare()

    return () => {
      isMounted = false
    }
  }, [isLoading, fadeAnim])

  // Run a custom splash overlay animation to smoothly introduce and remove the brand mark
  useEffect(() => {
    if (!appIsReady || !showCustomSplash) return

    Animated.sequence([
      Animated.parallel([
        Animated.timing(splashOpacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(splashScale, {
          toValue: 1,
          damping: 12,
          mass: 0.7,
          stiffness: 160,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(320),
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 240,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => setShowCustomSplash(false))
  }, [appIsReady, showCustomSplash, splashOpacity, splashScale])

  // Safety: ensure splash never lingers beyond 3 seconds total
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (showCustomSplash) {
        Animated.timing(splashOpacity, {
          toValue: 0,
          duration: 220,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }).start(() => setShowCustomSplash(false))
      }
      if (!hasHiddenSplashRef.current) {
        hasHiddenSplashRef.current = true
        SplashScreen.hideAsync().catch(() => {
          // ignore forced hide errors
        })
      }
    }, SPLASH_MAX_DURATION - 200) // finish fully under 3s budget

    return () => clearTimeout(timeout)
  }, [showCustomSplash, splashOpacity])

  const onLayoutRootView = useCallback(async () => {
    // This callback is called when the root view is laid out
  }, [])

  // Handle initial navigation based on auth state after loading completes with smooth transitions
  // IMPORTANT: gate on appIsReady so TabNavigator is fully mounted before we call replace()
  useEffect(() => {
    if (!appIsReady || isLoading || isTransitioning) return
      // Only redirect if we're on the auth or onboarding page and user is authenticated
      if ((pathname === '/auth' || pathname === '/onboarding') && isAuthenticated) {
        setIsTransitioning(true)
        // Fade out before navigation
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }).start(() => {
          router.replace('/')
          // Fade back in after navigation
          setTimeout(() => {
            Animated.timing(fadeAnim, {
              toValue: 1,
              duration: 180,
              useNativeDriver: true,
            }).start(() => {
              setIsTransitioning(false)
            })
          }, 50)
        })
      }
      // If not authenticated and not on auth page or onboarding page, redirect
      else if (!isAuthenticated && pathname !== '/auth' && pathname !== '/onboarding') {
        setIsTransitioning(true)
        // Fade out before navigation
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }).start(() => {
          AsyncStorage.getItem('has_completed_onboarding')
            .then((completed) => {
              const target = completed === 'true' ? '/auth' : '/onboarding'
              router.replace(target as any)
            })
            .catch(() => {
              router.replace('/auth')
            })
            .finally(() => {
              // Fade back in after navigation
              setTimeout(() => {
                Animated.timing(fadeAnim, {
                  toValue: 1,
                  duration: 180,
                  useNativeDriver: true,
                }).start(() => {
                  setIsTransitioning(false)
                })
              }, 50)
            })
        })
      }
  }, [appIsReady, isLoading, isAuthenticated, pathname, router, isTransitioning, fadeAnim])

  if (!appIsReady) {
    return null // Native splash screen is showing
  }

  // While auth is loading or transitioning, TabNavigator is still mounted below
  // We never short-circuit the return here because that would unmount
  // TabNavigator and cause screen names to be unregistered before replace() fires.

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      <SafeAreaView
        style={{ flex: 1, backgroundColor: '#ffffff' }}
        edges={[]}
        onLayout={onLayoutRootView}
      >
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
        {!isOnline && (
          <View style={{ backgroundColor: '#F59E0B', paddingVertical: 6, paddingHorizontal: 12 }}>
            <Text style={{ color: '#1F2937', fontWeight: '600' }}>
              Offline mode: changes will sync when back online
            </Text>
          </View>
        )}
        <ChatUnreadProvider>
          <TabNavigator />
        </ChatUnreadProvider>
        <CustomAlert
          visible={alertState.visible}
          title={alertState.title}
          message={alertState.message}
          buttons={alertState.buttons}
          type={alertState.type}
          onDismiss={() => alertService.hide()}
        />
      </SafeAreaView>
      {showCustomSplash && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            inset: 0,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#7B42F6',
            opacity: splashOpacity,
          }}
        >
          <Animated.Image
            source={require('../assets/images/splash-icon-light.png')}
            resizeMode="contain"
            style={{
              width: 200,
              height: 200,
              transform: [{ scale: splashScale }],
            }}
          />
        </Animated.View>
      )}
    </Animated.View>
  )
}

export default function RootLayout() {
  const content = (
    <AuthProvider>
      <LanguageProvider>
        <NotificationProvider>
          <ToastProvider>
            <AppContent />
          </ToastProvider>
        </NotificationProvider>
      </LanguageProvider>
    </AuthProvider>
  )

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>{content}</ErrorBoundary>
    </GestureHandlerRootView>
  )
}
