import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#f6f7f9] px-6 text-center">
          <h1 className="text-lg font-semibold text-[#202938]">Connect Intel could not load</h1>
          <p className="mt-2 max-w-md text-sm text-[#536072]">
            {this.state.error.message || 'Something went wrong in the app.'}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-xl bg-[#17191c] px-4 py-2.5 text-sm font-semibold text-white"
          >
            Refresh page
          </button>
          <p className="mt-3 text-xs text-[#7a8696]">
            If this keeps happening, try a hard refresh (Ctrl+Shift+R or Cmd+Shift+R).
          </p>
        </div>
      )
    }

    return this.props.children
  }
}
