import { Component } from 'react'
import {
  canAutoRecover,
  clearPwaCachesAndReload,
  isStaleAssetError,
  tryAutoRecover,
} from '../../lib/deployRecovery.js'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, recovering: false }
  }

  static getDerivedStateFromError(error) {
    const message = error?.message || ''
    if (isStaleAssetError(message) && canAutoRecover()) {
      return { error, recovering: true }
    }
    return { error, recovering: false }
  }

  componentDidCatch(error, info) {
    if (tryAutoRecover(error?.message || '')) return
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
    if (this.state.recovering) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#f6f7f9] px-6 text-center">
          <h1 className="text-lg font-semibold text-[#202938]">Updating Connect Intel</h1>
          <p className="mt-2 max-w-md text-sm text-[#536072]">Loading the latest version…</p>
        </div>
      )
    }

    if (this.state.error) {
      const message = this.state.error.message || 'Something went wrong in the app.'
      const staleAssets = isStaleAssetError(message)
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#f6f7f9] px-6 text-center">
          <h1 className="text-lg font-semibold text-[#202938]">Connect Intel could not load</h1>
          <p className="mt-2 max-w-md text-sm text-[#536072]">
            {staleAssets
              ? 'The app was updated. Reload to continue from where you were.'
              : message}
          </p>
          <button
            type="button"
            onClick={() => {
              void clearPwaCachesAndReload()
            }}
            className="mt-5 rounded-xl bg-[#17191c] px-4 py-2.5 text-sm font-semibold text-white"
          >
            Reload
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
