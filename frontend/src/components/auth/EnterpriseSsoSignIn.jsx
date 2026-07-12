import { useEffect, useState } from 'react'
import {
  ENTERPRISE_SSO_LABELS,
  getConfiguredEnterpriseProviders,
  resolvePublicAuthConfig,
} from '../../lib/enterpriseAuthConfig'

/**
 * Enterprise SSO buttons — only rendered when IdP env is configured on the server.
 * Production stays unchanged until AZURE_AD_* / OKTA_* (or SAML) vars are set.
 */
export default function EnterpriseSsoSignIn({ layout = 'block', dividerBefore = false }) {
  const [providers, setProviders] = useState([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    resolvePublicAuthConfig().then((auth) => {
      if (cancelled) return
      setProviders(getConfiguredEnterpriseProviders(auth))
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!ready || !providers.length) return null

  return (
    <>
      {dividerBefore ? <OrDivider /> : null}
      <div className={layout === 'block' ? 'w-full space-y-2' : 'inline-flex flex-wrap gap-2'}>
      {providers.map((provider) => (
        <a
          key={provider.id}
          href={provider.startUrl}
          className="w-full flex items-center justify-center gap-2.5 min-h-[44px] py-3 px-4 bg-white border border-zinc-300 rounded-xl text-sm font-semibold text-zinc-900 hover:bg-zinc-50 hover:border-zinc-400 transition-colors shadow-sm"
        >
          <EnterpriseIcon id={provider.id} />
          {ENTERPRISE_SSO_LABELS[provider.id] || 'Enterprise sign-in'}
        </a>
      ))}
      </div>
    </>
  )
}

function OrDivider() {
  return (
    <div className="flex items-center gap-3 my-6">
      <div className="flex-1 h-px bg-zinc-200" />
      <span className="text-xs text-zinc-500 font-medium">or</span>
      <div className="flex-1 h-px bg-zinc-200" />
    </div>
  )
}

function EnterpriseIcon({ id }) {
  if (id === 'azure-ad') {
    return (
      <svg width={20} height={20} viewBox="0 0 23 23" aria-hidden className="shrink-0">
        <path fill="#f35325" d="M1 1h10v10H1z" />
        <path fill="#81bc06" d="M12 1h10v10H12z" />
        <path fill="#05a6f0" d="M1 12h10v10H1z" />
        <path fill="#ffba08" d="M12 12h10v10H12z" />
      </svg>
    )
  }
  if (id === 'okta') {
    return (
      <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden className="shrink-0">
        <circle cx="12" cy="12" r="10" fill="#007DC1" />
        <circle cx="12" cy="12" r="4" fill="#fff" />
      </svg>
    )
  }
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0 text-zinc-600">
      <path
        d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}
