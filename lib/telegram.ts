import { Platform } from 'react-native'

type TelegramWebApp = {
  initData?: string
  ready: () => void
  expand: () => void
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
  disableVerticalSwipes?: () => void
  themeParams?: Record<string, string | undefined>
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

    webApp.ready()
    webApp.expand()
    webApp.setHeaderColor?.('#371F80')
    webApp.setBackgroundColor?.('#FFFFFF')
    webApp.disableVerticalSwipes?.()

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
  script.src = 'https://telegram.org/js/telegram-web-app.js?59'
  script.addEventListener('load', connect, { once: true })
  document.head.appendChild(script)
}
