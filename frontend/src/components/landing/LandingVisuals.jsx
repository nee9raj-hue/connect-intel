/** CSS/SVG infographic blocks for the public landing page */

export function RevenueLeakInfographic() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-wider text-red-600 mb-4">The hidden cost</p>
      <div className="flex flex-col sm:flex-row items-stretch gap-4">
        <div className="flex-1 rounded-xl bg-red-50 border border-red-100 p-4 text-center">
          <div className="text-3xl font-bold text-red-700">68%</div>
          <p className="text-xs text-red-800 mt-1 leading-snug">of deals slip when follow-ups are late or forgotten</p>
        </div>
        <div className="hidden sm:flex items-center text-2xl text-gray-300">→</div>
        <div className="flex-1 rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-center">
          <div className="text-3xl font-bold text-emerald-700">CI</div>
          <p className="text-xs text-emerald-800 mt-1 leading-snug">Connect Intel logs every touch & reminds you 30 min before</p>
        </div>
      </div>
      <p className="text-[11px] text-gray-500 mt-4 text-center">
        Companies lose revenue simply by losing a prospect in the follow-up gap.
      </p>
    </div>
  )
}

export function FollowUpTimeline() {
  const steps = [
    { time: 'Day 1', label: 'AI finds lead', color: 'bg-amber-100 text-amber-900' },
    { time: 'Day 2', label: 'Email + WhatsApp', color: 'bg-blue-100 text-blue-900' },
    { time: 'Day 5', label: 'Auto reminder', color: 'bg-violet-100 text-violet-900' },
    { time: '−30 min', label: 'Alert before call', color: 'bg-emerald-100 text-emerald-900' },
  ]
  return (
    <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-amber-50/40 p-6">
      <p className="text-sm font-semibold text-gray-900 mb-4">Never miss a follow-up again</p>
      <div className="flex flex-wrap gap-2">
        {steps.map((s, i) => (
          <div key={s.time} className="flex items-center gap-2">
            <div className={`px-3 py-2 rounded-lg text-xs font-semibold ${s.color}`}>
              <div className="text-[10px] opacity-70">{s.time}</div>
              {s.label}
            </div>
            {i < steps.length - 1 && <span className="text-gray-300 hidden sm:inline">→</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

export function IndiaLeadMapVisual() {
  return (
    <div className="relative rounded-2xl border border-gray-200 bg-[#0f172a] p-6 overflow-hidden text-white min-h-[220px]">
      <div className="absolute inset-0 opacity-20" aria-hidden>
        <svg viewBox="0 0 400 280" className="w-full h-full" fill="none">
          <ellipse cx="200" cy="140" rx="160" ry="120" stroke="#ffcb2b" strokeWidth="1" strokeDasharray="4 4" />
          {[
            [120, 80],
            [200, 60],
            [280, 90],
            [160, 150],
            [240, 170],
            [190, 200],
          ].map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r="6" fill="#ffcb2b" opacity="0.9" />
              <circle cx={x} cy={y} r="12" fill="#ffcb2b" opacity="0.2" />
            </g>
          ))}
        </svg>
      </div>
      <div className="relative z-10">
        <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300">AI lead discovery</p>
        <h3 className="text-xl font-bold mt-1">High-quality B2B leads across India</h3>
        <p className="text-sm text-gray-300 mt-2 max-w-xs">
          Filter by state, industry, role, and exporter profile. Perplexity & Gemini rank the best fits.
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          {['Rajasthan', 'Gujarat', 'Tamil Nadu', 'Maharashtra'].map((s) => (
            <span key={s} className="text-[10px] px-2 py-1 rounded-full bg-white/10 border border-white/20">
              {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export function EmailCrmFlow() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {[
        { icon: '✨', title: 'AI writes', sub: 'Agenda-driven drafts in your voice' },
        { icon: '📧', title: 'Official email', sub: 'Send from your company domain' },
        { icon: '📋', title: 'CRM records', sub: 'Every email logged automatically' },
      ].map((step) => (
        <div key={step.title} className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
          <div className="text-2xl mb-2">{step.icon}</div>
          <p className="text-sm font-semibold text-gray-900">{step.title}</p>
          <p className="text-[11px] text-gray-500 mt-1">{step.sub}</p>
        </div>
      ))}
    </div>
  )
}

export function WhatsAppOneClick() {
  return (
    <div className="rounded-2xl border-2 border-[#25D366]/30 bg-[#f0fdf4] p-6 flex flex-col md:flex-row gap-6 items-center">
      <div className="w-16 h-16 rounded-2xl bg-[#25D366] flex items-center justify-center text-3xl shrink-0">
        💬
      </div>
      <div className="flex-1">
        <h3 className="font-bold text-gray-900">WhatsApp from desktop or phone</h3>
        <p className="text-sm text-gray-600 mt-1 leading-relaxed">
          AI drafts your follow-up in one click. Proofread, tap send from your number — activity saved in CRM.
        </p>
        <p className="text-xs font-semibold text-emerald-800 mt-2">
          Sharper follow-ups can lift reply rates significantly*
        </p>
      </div>
      <div className="w-full md:w-48 rounded-xl bg-white border border-gray-200 p-3 text-[11px] shadow-sm font-mono">
        <p className="text-gray-400 mb-1">Draft ready</p>
        <p className="text-gray-800 leading-snug">Hi Priya, following up on our export discussion…</p>
        <button type="button" className="mt-2 w-full py-1.5 rounded bg-[#25D366] text-white font-semibold text-xs">
          Open WhatsApp
        </button>
      </div>
    </div>
  )
}

export function ManagerDashboardPreview() {
  const team = [
    { name: 'Anita', leads: 42, contacted: 38, won: 6, needs: 'Follow-up on 3 deals' },
    { name: 'Rahul', leads: 35, contacted: 22, won: 4, needs: '2 calls overdue' },
    { name: 'Sneha', leads: 51, contacted: 49, won: 9, needs: 'On track' },
  ]
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-lg overflow-hidden">
      <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-900">Manager dashboard</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-semibold">Live</span>
      </div>
      <div className="p-4 grid grid-cols-3 gap-3 border-b bg-white">
        {[
          { label: 'Team pipeline', value: '128' },
          { label: 'Contacted this week', value: '89%' },
          { label: 'Meetings today', value: '7' },
        ].map((m) => (
          <div key={m.label} className="text-center p-2 rounded-lg bg-gray-50">
            <div className="text-lg font-bold text-gray-900">{m.value}</div>
            <div className="text-[10px] text-gray-500">{m.label}</div>
          </div>
        ))}
      </div>
      <div className="divide-y divide-gray-100">
        {team.map((m) => (
          <div key={m.name} className="px-4 py-3 flex flex-wrap items-center gap-3 text-xs">
            <span className="font-semibold text-gray-900 w-16">{m.name}</span>
            <span className="text-gray-500">{m.leads} leads</span>
            <span className="text-blue-600">{m.contacted} touched</span>
            <span className="text-green-600">{m.won} won</span>
            <span
              className={`ml-auto text-[10px] px-2 py-0.5 rounded-full ${
                m.needs === 'On track' ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-900'
              }`}
            >
              {m.needs}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function CrmPipelineMini() {
  const cols = [
    { name: 'New', count: 12, color: 'border-slate-200' },
    { name: 'Contacted', count: 8, color: 'border-blue-200' },
    { name: 'Follow up', count: 5, color: 'border-amber-200' },
    { name: 'Won', count: 3, color: 'border-green-200' },
  ]
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold text-gray-500 mb-3">Pipeline · Team CRM</p>
      <div className="grid grid-cols-4 gap-2">
        {cols.map((c) => (
          <div key={c.name} className={`rounded-lg border-2 ${c.color} bg-gray-50/80 p-2 min-h-[72px]`}>
            <p className="text-[10px] font-bold text-gray-700">{c.name}</p>
            <p className="text-lg font-bold text-gray-900 mt-1">{c.count}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
