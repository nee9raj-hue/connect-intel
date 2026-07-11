/** CSS/SVG infographic blocks for the public landing page */

export function RevenueLeakInfographic() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wider text-red-600 mb-4">The hidden cost</p>
      <div className="flex flex-col sm:flex-row items-stretch gap-4">
        <div className="flex-1 rounded-xl bg-red-50 border border-red-100 p-4 text-center">
          <div className="text-3xl font-bold text-red-700">68%</div>
          <p className="text-xs text-red-800 mt-1 leading-snug">of B2B deals stall when follow-ups are late or forgotten</p>
        </div>
        <div className="hidden sm:flex items-center text-2xl text-gray-300">→</div>
        <div className="flex-1 rounded-xl bg-[#fff4ee] border border-[#ffd4b8] p-4 text-center">
          <div className="text-3xl font-bold text-[#FF773D]">CI</div>
          <p className="text-xs text-[#64748B] mt-1 leading-snug">One pipeline, timed reminders, full activity trail</p>
        </div>
      </div>
      <p className="text-xs text-gray-600 mt-4 text-center">
        Revenue is rarely lost on the first call—it is lost in the follow-up gap.
      </p>
    </div>
  )
}

export function FollowUpTimeline() {
  const steps = [
    { time: 'Import', label: 'CSV → pipeline', color: 'bg-slate-100 text-slate-800' },
    { time: 'Assign', label: 'Owner + stage', color: 'bg-amber-100 text-amber-900' },
    { time: 'Touch', label: 'Call / WhatsApp', color: 'bg-blue-100 text-blue-900' },
    { time: '−30 min', label: 'Meeting alert', color: 'bg-violet-100 text-violet-900' },
  ]
  return (
    <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-amber-50/40 p-6">
      <p className="text-sm font-semibold text-gray-900 mb-4">A typical week in Connect Intel</p>
      <div className="flex flex-wrap gap-2">
        {steps.map((s, i) => (
          <div key={s.time} className="flex items-center gap-2">
            <div className={`px-3 py-2 rounded-lg text-xs font-semibold ${s.color}`}>
              <div className="text-xs opacity-70">{s.time}</div>
              {s.label}
            </div>
            {i < steps.length - 1 && <span className="text-gray-300 hidden sm:inline">→</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

export function ImportPipelineVisual() {
  return (
    <div className="relative rounded-2xl border border-gray-200 bg-gradient-to-br from-[#1f1d1c] to-[#2d2a28] p-6 overflow-hidden text-white min-h-[240px]">
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF773D]/20 rounded-full blur-3xl" aria-hidden />
      <div className="relative z-10">
        <p className="text-xs font-bold uppercase tracking-wider text-amber-300">Bring what you already have</p>
        <h3 className="text-xl font-bold mt-1">Import leads in minutes—not days</h3>
        <p className="text-sm text-gray-300 mt-2 max-w-md leading-relaxed">
          Upload a CSV from your trade show list, IndiaMART export, or internal sheet. Map columns once; leads land in
          pipeline with stages ready for your team.
        </p>
        <div className="mt-5 grid sm:grid-cols-2 gap-3">
          <div className="rounded-lg bg-white/10 border border-white/15 p-3">
            <p className="text-xs text-gray-400 mb-1">Before</p>
            <p className="text-sm font-medium">Scattered spreadsheets & personal notes</p>
          </div>
          <div className="rounded-lg bg-[#FF773D]/20 border border-[#FF773D]/40 p-3">
            <p className="text-xs text-amber-200 mb-1">After</p>
            <p className="text-sm font-medium">One pipeline with owners & history</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function WorkEmailFlow() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {[
        { icon: '✉️', title: 'Sign up with work email', sub: 'No Gmail permissions on day one' },
        { icon: '🔗', title: 'Connect Gmail later', sub: 'Optional—when you need CRM send/receive' },
        { icon: '📋', title: 'Logged on the lead', sub: 'Every touch stays on the customer record' },
      ].map((step) => (
        <div key={step.title} className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
          <div className="text-2xl mb-2">{step.icon}</div>
          <p className="text-sm font-semibold text-gray-900">{step.title}</p>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">{step.sub}</p>
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
        <h3 className="font-bold text-gray-900">WhatsApp with full lead context</h3>
        <p className="text-sm text-gray-700 mt-1 leading-relaxed">
          Open WhatsApp from any lead record—company name, last note, and next step on screen. Works on desktop and
          phone; log the conversation back to CRM.
        </p>
        <p className="text-xs font-semibold text-[#64748B] mt-2">
          Built for teams where WhatsApp is the real sales channel
        </p>
      </div>
      <div className="w-full md:w-48 rounded-xl bg-white border border-gray-200 p-3 text-xs shadow-sm">
        <p className="text-gray-500 mb-1">Priya Sharma · Rajasthan Handicrafts</p>
        <p className="text-gray-800 leading-snug">Last: pricing sent · Next: follow-up call 4pm</p>
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
        <span className="text-sm font-semibold text-gray-900">Team dashboard</span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-semibold">Live</span>
      </div>
      <div className="p-4 grid grid-cols-3 gap-3 border-b bg-white">
        {[
          { label: 'Open pipeline', value: '128' },
          { label: 'Touched this week', value: '89%' },
          { label: 'Calls today', value: '7' },
        ].map((m) => (
          <div key={m.label} className="text-center p-2 rounded-lg bg-gray-50">
            <div className="text-lg font-bold text-gray-900">{m.value}</div>
            <div className="text-xs text-gray-600">{m.label}</div>
          </div>
        ))}
      </div>
      <div className="divide-y divide-gray-100">
        {team.map((m) => (
          <div key={m.name} className="px-4 py-3 flex flex-wrap items-center gap-3 text-xs">
            <span className="font-semibold text-gray-900 w-16">{m.name}</span>
            <span className="text-gray-600">{m.leads} leads</span>
            <span className="text-blue-600">{m.contacted} touched</span>
            <span className="text-[#FF773D]">{m.won} won</span>
            <span
              className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                m.needs === 'On track' ? 'bg-slate-100 text-[#64748B]' : 'bg-[#fff4ee] text-[#475569]'
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
    { name: 'Won', count: 3, color: 'border-[#cbd5e1]' },
  ]
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold text-gray-600 mb-3">Pipeline · shared by your team</p>
      <div className="grid grid-cols-4 gap-2">
        {cols.map((c) => (
          <div key={c.name} className={`rounded-lg border-2 ${c.color} bg-gray-50/80 p-2 min-h-[72px]`}>
            <p className="text-xs font-bold text-gray-700">{c.name}</p>
            <p className="text-lg font-bold text-gray-900 mt-1">{c.count}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function BeforeAfterCompare() {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <div className="rounded-xl border border-red-100 bg-red-50/50 p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-red-700 mb-3">Without a CRM</p>
        <ul className="space-y-2 text-sm text-gray-800">
          {['Leads in 3 different sheets', 'WhatsApp chats with no owner', 'Managers ask “did you call them?”', 'Deals die in silence'].map(
            (t) => (
              <li key={t} className="flex gap-2">
                <span className="text-red-500 shrink-0">✕</span>
                {t}
              </li>
            )
          )}
        </ul>
      </div>
      <div className="rounded-xl border border-[#FF773D]/30 bg-[#fff9f5] p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-[#c2410c] mb-3">With Connect Intel</p>
        <ul className="space-y-2 text-sm text-gray-800">
          {['One pipeline per company', 'Owner + stage on every lead', 'Activity log managers can trust', 'Reminders before every meeting'].map(
            (t) => (
              <li key={t} className="flex gap-2">
                <span className="text-[#FF773D] shrink-0">✓</span>
                {t}
              </li>
            )
          )}
        </ul>
      </div>
    </div>
  )
}

export function AiCopilotPreview() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-[#0f1117] text-white shadow-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between text-xs">
        <span className="font-semibold text-white/90">AI Copilot</span>
        <span className="px-2 py-0.5 rounded-full bg-[#FF773D]/20 text-[#ffb899] font-medium">Grounded on CRM</span>
      </div>
      <div className="p-5 space-y-4 text-sm">
        <div className="rounded-lg bg-white/5 border border-white/10 p-3">
          <p className="text-white/50 text-xs mb-1">You asked</p>
          <p className="text-white/95">Draft a follow-up for Rajasthan Handicrafts — pricing sent last week.</p>
        </div>
        <div className="rounded-lg bg-[#FF773D]/10 border border-[#FF773D]/30 p-3">
          <p className="text-amber-200/80 text-xs mb-1">Copilot</p>
          <p className="text-white/90 leading-relaxed text-[13px]">
            Subject: Quick check-in on export pricing · Body references last quote and proposes a 15-min call…
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          {['Open lead', 'Log call', 'Schedule task'].map((a) => (
            <span key={a} className="px-2.5 py-1 rounded-md bg-white/10 text-white/80 border border-white/10">
              {a}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export function DealsPreview() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-lg p-5">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Opportunities</p>
      <div className="space-y-2">
        {[
          { deal: 'FOB Mumbai — Q3 container', amount: '₹18.4L', stage: 'Negotiation' },
          { deal: 'EU distributor trial', amount: '₹6.2L', stage: 'Proposal' },
          { deal: 'Repeat order — spices', amount: '₹2.1L', stage: 'Won' },
        ].map((row) => (
          <div key={row.deal} className="flex items-center justify-between gap-3 py-2 border-b border-gray-50 last:border-0 text-xs">
            <span className="font-medium text-gray-900 truncate">{row.deal}</span>
            <span className="text-gray-600 shrink-0">{row.amount}</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold shrink-0">{row.stage}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AutomationPreview() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Workflow</p>
      <div className="flex flex-col gap-2 text-xs">
        {[
          { node: 'Trigger: Stage → Follow up', color: 'bg-violet-100 text-violet-900' },
          { node: 'Action: Create task — Call in 2 days', color: 'bg-blue-100 text-blue-900' },
          { node: 'Log: workflow_runs · completed', color: 'bg-emerald-100 text-emerald-900' },
        ].map((n, i) => (
          <div key={n.node} className="flex items-center gap-2">
            {i > 0 ? <span className="text-gray-300 ml-3">↓</span> : null}
            <div className={`px-3 py-2 rounded-lg font-medium ${n.color}`}>{n.node}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ExtensionEmailFlow() {
  return (
    <div className="grid sm:grid-cols-3 gap-3">
      {[
        { title: 'Install extension', sub: 'Same Chrome profile as your workspace login' },
        { title: 'Match in Gmail', sub: 'Participants mapped to pipeline leads (RBAC-scoped)' },
        { title: 'Send & log', sub: 'Trail sync and inbound reply routing to CRM' },
      ].map((step) => (
        <div key={step.title} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-[#fff4ee] border border-[#ffd4b8] flex items-center justify-center mb-3">
            <span className="text-[#FF773D] text-xs font-bold">CI</span>
          </div>
          <p className="text-sm font-semibold text-gray-900">{step.title}</p>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">{step.sub}</p>
        </div>
      ))}
    </div>
  )
}
