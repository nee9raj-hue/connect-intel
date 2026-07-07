import { useEffect, useState } from 'react'
import { api } from '../../lib/api'

function modeLabel(infra) {
  if (infra?.redis && infra?.backgroundEmail) return 'Redis worker + BullMQ (recommended at scale)'
  if (infra?.marketingSqlQueue) return 'Supabase SQL queue (production default)'
  return 'Inline sends only (small batches)'
}

export default function MarketingSendInfraCard() {
  const [infra, setInfra] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    api
      .getPublicConfig()
      .then((cfg) => {
        if (!cancelled) setInfra(cfg?.infra || null)
      })
      .catch((e) => {
        if (!cancelled) setError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) return null
  if (!infra) {
    return (
      <section className="mhub-v3-card mhub-v3-domain-section">
        <h3>Send infrastructure</h3>
        <p className="text-xs text-[#516f90]">Loading queue mode…</p>
      </section>
    )
  }

  const sqlOn = Boolean(infra.marketingSqlQueue)
  const redisOn = Boolean(infra.redis)

  return (
    <section className="mhub-v3-card mhub-v3-domain-section">
      <h3>Send infrastructure</h3>
      <p className="text-sm text-[#516f90] leading-relaxed mb-3">
        Large campaigns (&gt;10 recipients) use a background queue so you can close the tab. CRM
        Pipeline bulk email uses the same dual-mode path.
      </p>
      <p className={`mhub-v3-status-dot${sqlOn || redisOn ? ' is-ok' : ''}`} style={{ marginBottom: 8 }}>
        Active mode: {modeLabel(infra)}
      </p>
      <ul className="text-xs text-[#516f90] space-y-1 list-disc pl-4">
        <li>Marketing SQL queue: {sqlOn ? 'on' : 'off'}</li>
        <li>Redis / BullMQ worker: {redisOn ? 'on' : 'off'}</li>
      </ul>
      {!redisOn && (
        <p className="text-xs text-[#516f90] mt-3 leading-relaxed">
          For high volume (500+ recipients routinely), ops can enable{' '}
          <code className="text-[11px]">REDIS_URL</code> and Railway workers — see{' '}
          <code className="text-[11px]">docs/RAILWAY_WORKER.md</code>.
        </p>
      )}
    </section>
  )
}
