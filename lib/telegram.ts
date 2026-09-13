import { Platform } from 'react-native'

type TelegramWebApp = {
  initData?: string
  ready: () => void
  expand: () => void
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
  setBottomBarColor?: (color: string) => void
  disableVerticalSwipes?: () => void
  requestFullscreen?: () => void
  lockOrientation?: () => void
  isVersionAtLeast?: (version: string) => boolean
  onEvent?: (event: string, callback: () => void) => void
  offEvent?: (event: string, callback: () => void) => void
  BackButton?: {
    show: () => void
    hide: () => void
    onClick: (callback: () => void) => void
    offClick: (callback: () => void) => void
  }
  safeAreaInset?: TelegramInsets
  contentSafeAreaInset?: TelegramInsets
  themeParams?: Record<string, string | undefined>
}

type TelegramInsets = { top?: number; bottom?: number; left?: number; right?: number }

export function isTelegramMiniAppLaunch() {
  if (Platform.OS !== 'web') return false
  return Boolean(window.Telegram?.WebApp?.initData || getTelegramMiniAppInitData())
}

export function configureTelegramBackButton(visible: boolean, onPress: () => void) {
  if (Platform.OS !== 'web') return () => {}
  const backButton = window.Telegram?.WebApp?.BackButton
  if (!backButton) return () => {}
  if (visible) {
    backButton.show()
    backButton.onClick(onPress)
  } else {
    backButton.hide()
  }
  return () => backButton.offClick(onPress)
}

export function getTelegramMiniAppInitData() {
  if (Platform.OS !== 'web') return ''
  const sdkData = window.Telegram?.WebApp?.initData
  if (sdkData) return sdkData
  const launchParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return launchParams.get('tgWebAppData') || ''
}

export async function waitForTelegramMiniAppInitData(timeoutMs = 1800) {
  if (Platform.OS !== 'web') return ''
  initializeTelegramMiniApp()
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const initData = getTelegramMiniAppInitData()
    if (initData) return initData
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  return ''
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

export function initializeTelegramMiniApp() {
  if (Platform.OS !== 'web') return

  document.documentElement.style.overscrollBehavior = 'none'
  document.body.style.backgroundColor = 'var(--tg-theme-bg-color, #ffffff)'

  const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
  viewport?.setAttribute(
    'content',
    'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover',
  )

  const connect = () => {
    const webApp = window.Telegram?.WebApp
    if (!webApp) return

    const applyInsets = () => {
      const insets = webApp.contentSafeAreaInset || webApp.safeAreaInset || {}
      const root = document.documentElement
      root.style.setProperty('--mescott-tg-safe-top', `${insets.top || 0}px`)
      root.style.setProperty('--mescott-tg-safe-bottom', `${insets.bottom || 0}px`)
      root.style.setProperty('--mescott-tg-safe-left', `${insets.left || 0}px`)
      root.style.setProperty('--mescott-tg-safe-right', `${insets.right || 0}px`)
    }

    webApp.ready()
    webApp.expand()
    webApp.setHeaderColor?.('#371F80')
    webApp.setBackgroundColor?.('#FFFFFF')
    webApp.setBottomBarColor?.('#FFFFFF')
    webApp.disableVerticalSwipes?.()
    if (webApp.isVersionAtLeast?.('8.0')) {
      try {
        webApp.requestFullscreen?.()
        webApp.lockOrientation?.()
      } catch {
        // Older Telegram clients may expose a method before supporting the call.
      }
    }
    applyInsets()
    webApp.onEvent?.('safeAreaChanged', applyInsets)
    webApp.onEvent?.('contentSafeAreaChanged', applyInsets)

    const root = document.documentElement
    for (const [name, value] of Object.entries(webApp.themeParams || {})) {
      if (value) root.style.setProperty(`--tg-theme-${name.replaceAll('_', '-')}`, value)
    }
    root.dataset.telegramMiniApp = 'true'
  }

  if (window.Telegram?.WebApp) {
    connect()
    return
  }

  const existing = document.querySelector<HTMLScriptElement>('#telegram-web-app-sdk')
  if (existing) {
    existing.addEventListener('load', connect, { once: true })
    return
  }

  const script = document.createElement('script')
  script.id = 'telegram-web-app-sdk'
  script.src = 'https://telegram.org/js/telegram-web-app.js?63'
  script.addEventListener('load', connect, { once: true })
  document.head.appendChild(script)
}
