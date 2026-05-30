import { useEffect, useMemo, useState } from 'react'
import { pickLoadingQuote } from '../../lib/loadingQuotes'

export function LoadingBar({ active = true, className = '' }) {
  if (!active) return null
  return (
    <div
      className={`h-0.5 w-full overflow-hidden bg-gray-200/80 ${className}`}
      role="progressbar"
      aria-valuetext="Loading"
    >
      <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-gray-900 to-transparent animate-loading-bar" />
    </div>
  )
}

export default function LoadingExperience({
  message = 'Loading…',
  subtitle,
  showQuote = true,
  compact = false,
  fill = true,
  className = '',
}) {
  const quote = useMemo(() => pickLoadingQuote(), [])

  return (
    <div
      className={`relative flex flex-col bg-[#fafafa] ${fill ? 'flex-1 min-h-[200px]' : ''} ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <LoadingBar active />
      <div
        className={`flex flex-1 flex-col items-center justify-center px-6 text-center ${
          compact ? 'py-8' : 'py-12'
        }`}
      >
        <div
          className={`rounded-full border-2 border-gray-200 border-t-gray-900 animate-spin ${
            compact ? 'w-8 h-8 mb-3' : 'w-10 h-10 mb-4'
          }`}
          aria-hidden
        />
        <p className={`font-medium text-gray-900 ${compact ? 'text-xs' : 'text-sm'}`}>{message}</p>
        {subtitle && <p className="text-xs text-gray-500 mt-1 max-w-sm">{subtitle}</p>}
        {showQuote && !subtitle && (
          <p className="text-xs text-gray-500 mt-2 max-w-md italic">&ldquo;{quote}&rdquo;</p>
        )}
        <p className="text-xs text-gray-400 mt-4">Please wait — no need to click again</p>
      </div>
    </div>
  )
}

export function useDelayedLoading(active, delayMs = 300) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!active) {
      setShow(false)
      return undefined
    }
    const t = setTimeout(() => setShow(true), delayMs)
    return () => clearTimeout(t)
  }, [active, delayMs])

  return active && show
}
