import { MMKV } from 'react-native-mmkv'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Try to initialize MMKV, fallback to AsyncStorage if it fails
let storage: MMKV | null = null
let useAsyncStorage = false

try {
  storage = new MMKV({
    id: 'mescott-storage',
  })
} catch (error) {
  console.warn('MMKV initialization failed, falling back to AsyncStorage:', error)
  useAsyncStorage = true
}

// Helper functions that always return promises for consistency
// When MMKV is available, promises resolve immediately (synchronous behavior)
// When AsyncStorage is used, promises resolve asynchronously

export const setString = async (key: string, value: string): Promise<void> => {
  if (useAsyncStorage || !storage) {
    try {
      await AsyncStorage.setItem(key, value)
    } catch (err) {
      console.warn('Failed to set string:', err)
    }
  } else {
    try {
      storage.set(key, value)
    } catch (err) {
      console.warn('Failed to set string:', err)
    }
  }
}

export const getString = async (key: string): Promise<string | undefined> => {
  if (useAsyncStorage || !storage) {
    try {
      const val = await AsyncStorage.getItem(key)
      return val ?? undefined
    } catch (err) {
      console.warn('Failed to get string:', err)
      return undefined
    }
  } else {
    try {
      return storage.getString(key) ?? undefined
    } catch (err) {
      console.warn('Failed to get string:', err)
      return undefined
    }
  }
}

export const setNumber = async (key: string, value: number): Promise<void> => {
  if (useAsyncStorage || !storage) {
    try {
      await AsyncStorage.setItem(key, String(value))
    } catch (err) {
      console.warn('Failed to set number:', err)
    }
  } else {
    try {
      storage.set(key, value)
    } catch (err) {
      console.warn('Failed to set number:', err)
    }
  }
}

export const getNumber = async (key: string): Promise<number | undefined> => {
  if (useAsyncStorage || !storage) {
    try {
      const val = await AsyncStorage.getItem(key)
      if (val === null) return undefined
      const num = Number(val)
      return isNaN(num) ? undefined : num
    } catch (err) {
      console.warn('Failed to get number:', err)
      return undefined
    }
  } else {
    try {
      const val = storage.getNumber(key)
      return typeof val === 'number' ? val : undefined
    } catch (err) {
      console.warn('Failed to get number:', err)
      return undefined
    }
  }
}

export const removeItem = async (key: string): Promise<void> => {
  if (useAsyncStorage || !storage) {
    try {
      await AsyncStorage.removeItem(key)
    } catch (err) {
      console.warn('Failed to remove item:', err)
    }
  } else {
    try {
      storage.delete(key)
    } catch (err) {
      console.warn('Failed to remove item:', err)
    }
  }
}

export const setJSON = async <T>(key: string, value: T): Promise<void> => {
  const jsonString = JSON.stringify(value)
  if (useAsyncStorage || !storage) {
    try {
      await AsyncStorage.setItem(key, jsonString)
    } catch (err) {
      console.warn('Failed to set JSON:', err)
    }
  } else {
    try {
      storage.set(key, jsonString)
    } catch (err) {
      console.warn('Failed to set JSON:', err)
    }
  }
}

export const getJSON = async <T>(key: string): Promise<T | undefined> => {
  if (useAsyncStorage || !storage) {
    try {
      const raw = await AsyncStorage.getItem(key)
      if (!raw) return undefined
      try {
        return JSON.parse(raw) as T
      } catch {
        return undefined
      }
    } catch (err) {
      console.warn('Failed to get JSON:', err)
      return undefined
    }
  } else {
    try {
      const raw = storage.getString(key)
      if (!raw) return undefined
      try {
        return JSON.parse(raw) as T
      } catch {
        return undefined
      }
    } catch (err) {
      console.warn('Failed to get JSON:', err)
      return undefined
    }
  }
}
