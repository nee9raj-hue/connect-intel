const DEFAULT_MS = 25_000

export async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Request timed out. Please refresh the page or try again in a moment.')
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

export function withTimeout(promise, timeoutMs = DEFAULT_MS, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(
        () =>
          reject(
            new Error(message || 'Request timed out. Please refresh the page or try again in a moment.')
          ),
        timeoutMs
      )
    }),
  ])
}
