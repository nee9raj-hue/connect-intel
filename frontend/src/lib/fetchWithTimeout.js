const DEFAULT_MS = 25_000

export async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_MS) {
  const controller = new AbortController()
  const external = options.signal
  const onExternalAbort = () => controller.abort()
  if (external) {
    if (external.aborted) {
      controller.abort()
    } else {
      external.addEventListener('abort', onExternalAbort)
    }
  }

  const { signal: _ignored, ...rest } = options
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...rest, signal: controller.signal })
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Request timed out. Please refresh the page or try again in a moment.')
    }
    throw error
  } finally {
    clearTimeout(timer)
    if (external) external.removeEventListener('abort', onExternalAbort)
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
