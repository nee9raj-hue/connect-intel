import { useEffect, useRef, useState } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import { useApp } from '../../context/AppContext'

const CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim().replace(/^["']|["']$/g, '')

function useButtonWidth() {
  const ref = useRef(null)
  const [width, setWidth] = useState(320)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const measure = () => {
      const w = el.getBoundingClientRect().width
      setWidth(Math.min(400, Math.max(240, Math.floor(w))))
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  return [ref, width]
}

/**
 * Google sign-in — full-width on landing/auth when layout="block".
 */
export default function GoogleSignIn({
  size = 'large',
  theme = 'outline',
  text = 'continue_with',
  layout = 'block',
  label,
}) {
  const { login } = useApp()
  const [containerRef, btnWidth] = useButtonWidth()

  const handleSuccess = async (credentialResponse) => {
    try {
      await login({ credential: credentialResponse.credential })
    } catch (error) {
      alert(error.message || 'Could not sign in with Google. Please try again.')
    }
  }

  const displayLabel =
    label ||
    (text === 'signup_with' ? 'Sign up with Google' : text === 'signin_with' ? 'Sign in with Google' : 'Continue with Google')

  if (!CLIENT_ID) {
    return (
      <div ref={containerRef} className="w-full">
        <button
          type="button"
          onClick={() =>
            login({
              demoProfile: {
                name: 'Demo User',
                email: 'demo@gmail.com',
                company: 'Demo Company',
                picture: null,
                plan: 'free',
                searchesLeft: 25,
                authProvider: 'google-demo',
              },
            })
          }
          className="w-full flex items-center justify-center gap-3 min-h-[44px] py-3 px-4 bg-white border border-gray-300 rounded-lg text-sm font-semibold text-gray-800 hover:bg-gray-50 hover:border-gray-400 transition-colors shadow-sm"
        >
          <GoogleIcon />
          {displayLabel}
          <span className="text-[10px] font-normal text-gray-500">(demo)</span>
        </button>
      </div>
    )
  }

  if (layout === 'block') {
    return (
      <div ref={containerRef} className="w-full">
        <div
          className="w-full flex justify-center overflow-visible"
          style={{ minHeight: size === 'large' ? 44 : 40 }}
        >
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={() => alert('Google sign-in failed. Check your connection and try again.')}
            useOneTap={false}
            theme={theme}
            size={size}
            text={text}
            shape="rectangular"
            width={btnWidth}
          />
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="inline-flex justify-center overflow-visible">
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={() => alert('Google sign-in failed. Check your connection and try again.')}
        useOneTap={false}
        theme={theme}
        size={size}
        text={text}
        shape="rectangular"
        width={btnWidth}
      />
    </div>
  )
}

export function GoogleSignInCompact({ onBeforeLogin }) {
  const { login } = useApp()

  const handleSuccess = async (credentialResponse) => {
    onBeforeLogin?.()
    try {
      await login({ credential: credentialResponse.credential })
    } catch (error) {
      alert(error.message || 'Google sign-in failed.')
    }
  }

  if (!CLIENT_ID) {
    return (
      <button
        type="button"
        onClick={() => {
          onBeforeLogin?.()
          login({
            demoProfile: {
              name: 'Demo User',
              email: 'demo@gmail.com',
              company: 'Demo Co',
              picture: null,
              plan: 'free',
              searchesLeft: 25,
              authProvider: 'google-demo',
            },
          })
        }}
        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold text-gray-800 hover:bg-gray-50 shadow-sm"
      >
        <GoogleIcon size={18} />
        Google
      </button>
    )
  }

  return (
    <div className="inline-flex overflow-visible">
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={() => {}}
        theme="outline"
        size="medium"
        text="signin_with"
        shape="rectangular"
      />
    </div>
  )
}

function GoogleIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="shrink-0">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}
