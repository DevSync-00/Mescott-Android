import { create } from 'zustand'
import uuid from 'react-native-uuid'
import { getIsOnline } from '../lib/connectivity'
import { getJSON, setJSON } from '../lib/storage'

type OfflineActionType = 'chat:send' | 'task:apply'

export type OfflineAction = {
  id: string
  type: OfflineActionType
  payload: any
}

type AppState = {
  isOnline: boolean
  lastStatusChange: number
  offlineActions: OfflineAction[]
  setOnline: (online: boolean) => void
  enqueueOfflineAction: (action: Omit<OfflineAction, 'id'> & { id?: string }) => OfflineAction
  dequeueOfflineAction: (id: string) => void
  hydrateOfflineQueue: () => Promise<void>
  processOfflineQueue: (
    handlers: Record<OfflineActionType, (payload: any) => Promise<void>>,
  ) => Promise<void>
}

const OFFLINE_QUEUE_KEY = 'offline:actions'

const persistQueue = async (actions: OfflineAction[]) => {
  try {
    await setJSON(OFFLINE_QUEUE_KEY, actions)
  } catch (error) {
    console.warn('Failed to persist offline queue:', error)
  }
}

const loadQueue = async (): Promise<OfflineAction[]> => {
  try {
    return (await getJSON<OfflineAction[]>(OFFLINE_QUEUE_KEY)) || []
  } catch (error) {
    console.warn('Failed to load offline queue:', error)
    return []
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  isOnline: getIsOnline(),
  lastStatusChange: Date.now(),
  offlineActions: [],
  setOnline: (online: boolean) => set({ isOnline: online, lastStatusChange: Date.now() }),

  enqueueOfflineAction: (action) => {
    const finalAction: OfflineAction = {
      id: action.id || String(uuid.v4()),
      type: action.type,
      payload: action.payload,
    }
    const next = [...get().offlineActions, finalAction]
    set({ offlineActions: next })
    persistQueue(next).catch(() => {}) // Fire and forget
    return finalAction
  },

  dequeueOfflineAction: (id: string) => {
    const next = get().offlineActions.filter((a) => a.id !== id)
    set({ offlineActions: next })
    persistQueue(next).catch(() => {}) // Fire and forget
  },

  hydrateOfflineQueue: async () => {
    const saved = await loadQueue()
    if (saved.length) {
      set({ offlineActions: saved })
    }
  },

  processOfflineQueue: async (handlers) => {
    const actions = [...get().offlineActions]
    for (const action of actions) {
      const handler = handlers[action.type]
      if (!handler) continue
      try {
        await handler(action.payload)
        get().dequeueOfflineAction(action.id)
      } catch (err) {
        // Stop processing to avoid tight retry loops; will retry on next reconnect
        console.warn('Offline action failed to process', action.type, err)
        break
      }
    }
  },
}))
