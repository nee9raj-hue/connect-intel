import { Component } from 'react'
import { clearPwaCachesAndReload, isStaleAssetError } from '../../lib/deployRecovery.js'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    const payload = {
      message: error?.message || 'React error',
      stack: [error?.stack, info?.componentStack].filter(Boolean).join('\n'),
      url: typeof window !== 'undefined' ? window.location.href : '',
    }
    fetch('/api/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {})
  }

  render() {
    if (this.state.error) {
      const message = this.state.error.message || 'Something went wrong in the app.'
      const staleAssets = isStaleAssetError(message)
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#f6f7f9] px-6 text-center">
          <h1 className="text-lg font-semibold text-[#202938]">Connect Intel could not load</h1>
          <p className="mt-2 max-w-md text-sm text-[#536072]">
            {staleAssets
              ? 'The app was updated but your browser is still using an older cached copy. Clear the cache and reload to continue.'
              : message}
          </p>
          <button
            type="button"
            onClick={() => {
              if (staleAssets) void clearPwaCachesAndReload()
              else window.location.reload()
            }}
            className="mt-5 rounded-xl bg-[#17191c] px-4 py-2.5 text-sm font-semibold text-white"
          >
            {staleAssets ? 'Clear cache & reload' : 'Refresh'}
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
