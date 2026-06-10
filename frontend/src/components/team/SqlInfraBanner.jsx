import { useEffect, useState } from 'react'
import { api } from '../../lib/api'

const SQL_FLAGS = [
  { key: 'pipelineLeadsTable', label: 'Pipeline SQL table' },
  { key: 'pipelineHierarchyRbac', label: 'Team hierarchy RBAC' },
  { key: 'marketingSqlQueue', label: 'Marketing SQL queue' },
]

/** Org admins: warn when production SQL fast paths are off. */
export default function SqlInfraBanner() {
  const [issues, setIssues] = useState(null)

  useEffect(() => {
    let cancelled = false
    api
      .getPublicConfig()
      .then((cfg) => {
        if (cancelled) return
        const infra = cfg?.infra || {}
        const off = SQL_FLAGS.filter((f) => !infra[f.key]).map((f) => f.label)
        setIssues(off.length ? off : [])
      })
      .catch(() => {
        if (!cancelled) setIssues(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!issues?.length) return null

  return (
    <div
      className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
      role="alert"
    >
      <p className="font-semibold">SQL performance mode is partially disabled</p>
      <p className="mt-1 text-amber-900/90">
        Your team may see slower pipeline loads until these are enabled in production:{' '}
        {issues.join(', ')}. Contact your Connect Intel administrator.
      </p>
    </div>
  )
}
