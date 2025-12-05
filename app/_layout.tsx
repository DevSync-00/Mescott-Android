import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, Image, StatusBar } from 'react-native'
import { Tabs, usePathname, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { setStatusBarBackgroundColor, setStatusBarStyle } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import { AuthProvider, useAuth } from '../contexts/SimpleAuthContext'
import { LanguageProvider } from '../contexts/LanguageContext'
import { NotificationProvider, useNotifications } from '../contexts/NotificationContext'
import { ToastProvider } from '../contexts/ToastContext'
import NotificationBadge from '../components/NotificationBadge'
import { ErrorBoundary } from '../components/ErrorBoundary'
import {
  initConnectivityListener,
  cleanupConnectivityListener,
  onConnectivityChange,
} from '../lib/connectivity'
import { useAppStore } from '../state/store'
import { ChatService } from '../services/ChatService'
import { TaskService } from '../services/TaskService'
import Colors from '../constants/Colors'

// Keep the native splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync()

// Set the animation options for a smooth fade transition
// Note: setOptions is only available in development builds, not Expo Go
try {
  SplashScreen.setOptions({
    duration: 1000,
    fade: true,
  })
} catch (error) {
  // Ignore error - setOptions is not available in Expo Go
}

function TabNavigator() {
  const { user, isAuthenticated } = useAuth()
  const { unreadCount } = useNotifications()
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
  const isOnline = useAppStore((state: { isOnline: boolean }) => state.isOnline)

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
        // eslint-disable-next-line import/no-unresolved, @typescript-eslint/ban-ts-comment
        // @ts-expect-error - Optional dynamic import
        const NavBar = await import('expo-navigation-bar')
        if ((NavBar as any)?.setBackgroundColorAsync) {
          await (NavBar as any).setBackgroundColorAsync('#000000')
          if ((NavBar as any).setButtonStyleAsync) {
            await (NavBar as any).setButtonStyleAsync('light')
          }
        }
      } catch (error) {
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
          'chat:send': (payload: {
            chatId: string
            senderId: string
            content: string
            messageType?: 'text' | 'image' | 'file'
          }) => ChatService.processQueuedMessage(payload),
          'task:apply': (payload: {
            taskId: string
            taskerId: string
            proposedPrice: number
            message: string
            availabilityDate: string
            userId: string
          }) => TaskService.processQueuedTaskApplication(payload),
        })
      }
    })

    return () => {
      cleanupConnectivityListener()
      unsubscribe?.()
    }
  }, [])

  // Hide native splash screen when app is ready
  useEffect(() => {
    async function prepare() {
      try {
        // Wait for auth to finish loading
        if (!isLoading) {
          // Small delay to ensure everything is ready
          await new Promise((resolve) => setTimeout(resolve, 500))
          setAppIsReady(true)
        }
      } catch (e) {
        console.warn(e)
      } finally {
        // Hide the native splash screen with fade animation
        SplashScreen.hide()
      }
    }

    prepare()
  }, [isLoading])

  const onLayoutRootView = useCallback(async () => {
    // This callback is called when the root view is laid out
  }, [])

  // Handle initial navigation based on auth state after loading completes
  useEffect(() => {
    if (!isLoading) {
      // Only redirect if we're on the auth page and user is authenticated
      if (pathname === '/auth' && isAuthenticated) {
        router.replace('/')
      }
      // If not authenticated and not on auth page, redirect to auth
      else if (!isAuthenticated && pathname !== '/auth') {
        router.replace('/auth')
      }
    }
  }, [isLoading, isAuthenticated, pathname])

  if (!appIsReady) {
    return null // Native splash screen is showing
  }

  return (
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
      <TabNavigator />
    </SafeAreaView>
  )
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <KeyboardProvider>
          <LanguageProvider>
            <AuthProvider>
              <NotificationProvider>
                <ToastProvider>
                  <AppContent />
                </ToastProvider>
              </NotificationProvider>
            </AuthProvider>
          </LanguageProvider>
        </KeyboardProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  )
}
