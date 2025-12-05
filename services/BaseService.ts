export type RetryOptions = {
  retries?: number
  delayMs?: number
  backoffFactor?: number
}

export class BaseService {
  private static dedupeMap = new Map<string, Promise<any>>()

  protected static async withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
    const retries = opts.retries ?? 2
    const delayMs = opts.delayMs ?? 250
    const backoff = opts.backoffFactor ?? 2

    let attempt = 0
    let lastError: any

    while (attempt <= retries) {
      try {
        return await fn()
      } catch (err) {
        lastError = err
        if (attempt === retries) break
        const wait = delayMs * Math.pow(backoff, attempt)
        await new Promise((r) => setTimeout(r, wait))
        attempt += 1
      }
    }

    throw lastError
  }

  protected static async dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
    if (this.dedupeMap.has(key)) {
      return this.dedupeMap.get(key) as Promise<T>
    }
    const promise = fn()
    this.dedupeMap.set(key, promise)
    try {
      const result = await promise
      return result
    } finally {
      this.dedupeMap.delete(key)
    }
  }

  protected static normalizeError(error: any): Error {
    if (error instanceof Error) return error
    if (typeof error === 'string') return new Error(error)
    if (error?.message) return new Error(error.message)
    return new Error('Unknown error')
  }
}
