import * as Network from 'expo-network'
import mitt from 'mitt'

type ConnectivityEvents = {
  change: boolean
}

const emitter = mitt<ConnectivityEvents>()
let isOnlineValue = true
let unsubscribe: (() => void) | null = null

export const getIsOnline = () => isOnlineValue

export const onConnectivityChange = (handler: (online: boolean) => void) => {
  emitter.on('change', handler)
  return () => emitter.off('change', handler)
}

const handleChange = (online: boolean) => {
  if (isOnlineValue === online) return
  isOnlineValue = online
  emitter.emit('change', online)
}

export async function initConnectivityListener() {
  // Initial state
  try {
    const state = await Network.getNetworkStateAsync()
    handleChange(!!state.isConnected && !!state.isInternetReachable)
  } catch {
    // Default stays true to avoid blocking; will update on next event
  }

  // Subscribe to changes
  try {
    // @ts-expect-error expo-network supports addNetworkStateListener in SDK 54
    unsubscribe =
      Network.addNetworkStateListener?.(({ isConnected, isInternetReachable }) => {
        handleChange(!!isConnected && !!isInternetReachable)
      }) || null
  } catch {
    // Ignore; app can fallback to manual checks if needed
  }
}

export function cleanupConnectivityListener() {
  if (unsubscribe) {
    unsubscribe()
    unsubscribe = null
  }
}
