import { useCallback, useState } from 'react'

export default function TeamSettingsSection({
  id,
  icon: Icon,
  title,
  description,
  badge = null,
  defaultOpen = true,
  children,
  className = '',
}) {
  const storageKey = `ci_team_section_${id}`
  const [open, setOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored === '0') return false
      if (stored === '1') return true
    } catch {
      // ignore
    }
    return defaultOpen
  })

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev
      try {
        localStorage.setItem(storageKey, next ? '1' : '0')
      } catch {
        // ignore
      }
      return next
    })
  }, [storageKey])

  return (
    <section
      className={`bg-white rounded-xl border border-gray-200/90 shadow-sm overflow-hidden ${className}`}
    >
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50/90 transition-colors"
        aria-expanded={open}
      >
        <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-gray-900 text-[#FF773D] shrink-0 shadow-sm">
          {Icon ? <Icon className="w-[18px] h-[18px]" /> : null}
        </span>
        <span className="flex-1 min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">{title}</span>
            {badge}
          </span>
          {description ? (
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed pr-2">{description}</p>
          ) : null}
        </span>
        <ChevronDown className={`w-5 h-5 text-gray-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? <div className="px-4 pb-4 border-t border-gray-100">{children}</div> : null}
    </section>
  )
}

function ChevronDown({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )
}

export function TeamStatCard({ icon: Icon, label, value, hint, accent = 'gray' }) {
  const accents = {
    gray: 'bg-gray-50 border-gray-200/80 text-gray-900',
    amber: 'bg-[#fff4ee] border-[#ffd4b8]/80 text-[#FF773D]',
    green: 'bg-slate-100 border-slate-200/80 text-[#64748B]',
    blue: 'bg-blue-50 border-blue-200/80 text-blue-900',
  }
  return (
    <div className={`rounded-xl border p-3.5 ${accents[accent] || accents.gray}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
          <p className="text-xl font-bold mt-0.5 tabular-nums">{value}</p>
          {hint ? <p className="text-xs mt-1 opacity-80 leading-snug">{hint}</p> : null}
        </div>
        {Icon ? (
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/70 border border-black/5 shrink-0">
            <Icon className="w-4 h-4 opacity-70" />
          </span>
        ) : null}
      </div>
    </div>
  )
}

export function TeamQuickLink({ icon: Icon, title, description, onClick, accent = 'white' }) {
  const styles =
    accent === 'teal'
      ? 'border-teal-200/80 bg-gradient-to-br from-teal-50 to-white hover:border-teal-300'
      : accent === 'whatsapp'
        ? 'border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white hover:border-emerald-300'
        : 'border-gray-200/80 bg-white hover:border-gray-300 hover:shadow-sm'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${styles}`}
    >
      <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-gray-900 text-[#FF773D] shrink-0">
        <Icon className="w-4 h-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-xs font-semibold text-gray-900 block">{title}</span>
        <span className="text-xs text-gray-500 mt-0.5 block leading-snug">{description}</span>
      </span>
      <ArrowRight className="w-4 h-4 text-gray-300 shrink-0 mt-0.5" />
    </button>
  )
}

function ArrowRight({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}
