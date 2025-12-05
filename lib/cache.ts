import { getJSON, removeItem, setJSON } from './storage'

type CachedPayload<T> = {
  v: string // version
  t: number // timestamp
  ttl?: number // ms
  data: T
}

// Bump CACHE_VERSION when cache shapes change to invalidate old data
const CACHE_VERSION = 'v1'

const makeKey = (key: string) => `${CACHE_VERSION}:${key}`

export async function getCache<T>(key: string): Promise<T | null> {
  const payload = await getJSON<CachedPayload<T>>(makeKey(key))
  if (!payload) return null

  // Version mismatch or expired TTL
  if (payload.v !== CACHE_VERSION) {
    await removeItem(makeKey(key))
    return null
  }
  if (payload.ttl && Date.now() - payload.t > payload.ttl) {
    await removeItem(makeKey(key))
    return null
  }

  return payload.data
}

export async function setCache<T>(key: string, data: T, ttlMs?: number) {
  const payload: CachedPayload<T> = {
    v: CACHE_VERSION,
    t: Date.now(),
    ttl: ttlMs,
    data,
  }
  await setJSON(makeKey(key), payload)
}

export async function clearCache(key: string) {
  await removeItem(makeKey(key))
}
