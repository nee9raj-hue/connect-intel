/**
 * Product-faithful CRM UI shells for landing (matches in-app sidebar, pipeline, copilot).
 */

import { useState } from 'react'
import {
  BRAND_LOGO_ICON,
  BRAND_LOGO_ICON_CLASS,
} from '../../lib/brandAssets'

const TABS = [
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'copilot', label: 'Copilot' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'company', label: 'Company' },
  { id: 'email', label: 'Email' },
]

const PIPELINE_ROWS = [
  { name: 'Rajasthan Handicrafts', company: 'Export · Textiles', stage: 'Follow up', owner: 'Anita', hot: true },
  { name: 'Gujarat Textiles Ltd', company: 'Manufacturer', stage: 'Contacted', owner: 'Rahul', hot: false },
  { name: 'Chennai Spices Co', company: 'FMCG Export', stage: 'New', owner: 'Sneha', hot: false },
  { name: 'Mumbai Organics', company: 'D2C + B2B', stage: 'Won', owner: 'Anita', hot: false },
]

const STAGE_CLS = {
  New: 'bg-slate-100 text-slate-700',
  Contacted: 'bg-blue-50 text-blue-800',
  'Follow up': 'bg-amber-50 text-amber-900',
  Won: 'bg-emerald-50 text-emerald-800',
}

export default function LandingProductUI({ autoTab = null, className = '' }) {
  const [tab, setTab] = useState('pipeline')
  const active = autoTab || tab

  return (
    <div className={`ci-product-ui rounded-2xl border border-zinc-200/80 shadow-[0_32px_100px_-32px_rgba(0,0,0,0.22)] overflow-hidden bg-white ${className}`}>
      <div className="flex min-h-[380px] sm:min-h-[420px]">
        <aside className="hidden sm:flex w-[168px] bg-ci-sidebar flex-col shrink-0">
          <div className="p-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <img src={BRAND_LOGO_ICON} alt="" className={`w-7 h-7 ${BRAND_LOGO_ICON_CLASS}`} />
              <span className="text-white text-xs font-bold">Connect Intel</span>
            </div>
          </div>
          <nav className="p-2 space-y-0.5 flex-1" aria-label="Product navigation preview">
            {['Home', 'Pipeline', 'Calendar', 'Team', 'Settings'].map((item) => (
              <div
                key={item}
                className={`px-2.5 py-1.5 rounded text-xs font-medium ${
                  item === 'Pipeline' ? 'bg-white/15 text-white' : 'text-gray-400'
                }`}
              >
                {item}
              </div>
            ))}
          </nav>
        </aside>

        <div className="flex-1 flex flex-col min-w-0 bg-[#f5f8fa]">
          <header className="h-11 bg-white border-b border-zinc-200 flex items-center px-3 sm:px-4 gap-2">
            <span className="text-sm font-semibold text-ci-dark capitalize">{active}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 font-semibold border border-zinc-200">
              ⌘K
            </span>
            {!autoTab ? (
              <div className="ml-auto flex gap-1 overflow-x-auto">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${
                      tab === t.id ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-500 border border-zinc-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            ) : null}
          </header>

          <div className="flex-1 p-2 sm:p-3 overflow-hidden">
            {active === 'pipeline' ? <PipelineView /> : null}
            {active === 'copilot' ? <CopilotView /> : null}
            {active === 'analytics' ? <AnalyticsView /> : null}
            {active === 'company' ? <CompanyView /> : null}
            {active === 'email' ? <EmailView /> : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function PipelineView() {
  return (
    <div className="bg-white rounded-lg border border-zinc-200 h-full overflow-hidden">
      <table className="w-full text-left text-[11px] sm:text-xs">
        <thead className="bg-zinc-50 text-zinc-500 uppercase text-[10px]">
          <tr>
            <th className="py-2 pl-3 font-semibold">Lead</th>
            <th className="py-2 hidden md:table-cell font-semibold">Company</th>
            <th className="py-2 hidden sm:table-cell font-semibold">Owner</th>
            <th className="py-2 pr-3 text-right font-semibold">Stage</th>
          </tr>
        </thead>
        <tbody>
          {PIPELINE_ROWS.map((r) => (
            <tr key={r.name} className="border-t border-zinc-50 hover:bg-zinc-50/80">
              <td className="py-2.5 pl-3 font-medium text-zinc-900">
                {r.hot ? <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#FF773D] mr-1.5" /> : null}
                {r.name}
              </td>
              <td className="py-2.5 text-zinc-600 hidden md:table-cell">{r.company}</td>
              <td className="py-2.5 text-zinc-600 hidden sm:table-cell">{r.owner}</td>
              <td className="py-2.5 pr-3 text-right">
                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${STAGE_CLS[r.stage]}`}>
                  {r.stage}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CopilotView() {
  return (
    <div className="rounded-lg bg-[#17191c] text-white p-4 h-full flex flex-col">
      <p className="text-[10px] uppercase tracking-wider text-zinc-400 mb-3">Connect Copilot</p>
      <div className="space-y-3 flex-1 text-[13px]">
        <div className="rounded-lg bg-white/5 border border-white/10 p-3">
          <p className="text-zinc-500 text-[10px] mb-1">You</p>
          <p>Find textile exporters shipping to Germany.</p>
        </div>
        <div className="rounded-lg bg-white/[0.07] border border-white/10 p-3">
          <p className="text-[#FF773D] text-[10px] mb-1 font-semibold">Copilot</p>
          <p className="text-zinc-200 leading-relaxed">
            3 matches in CRM · 42 from web · ranked by export fit · draft outreach ready.
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        {['Open lead', 'Send email', 'Add task'].map((a) => (
          <span key={a} className="text-[10px] px-2 py-1 rounded-md bg-white/10 border border-white/10 text-zinc-300">
            {a}
          </span>
        ))}
      </div>
    </div>
  )
}

function AnalyticsView() {
  const bars = [28, 42, 38, 55, 48, 72, 65]
  return (
    <div className="bg-white rounded-lg border border-zinc-200 p-4 h-full">
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { l: 'Pipeline', v: '₹2.4Cr' },
          { l: 'Forecast', v: '₹86L' },
          { l: 'Win rate', v: '24%' },
        ].map((m) => (
          <div key={m.l} className="rounded-lg bg-zinc-50 border border-zinc-100 p-2 text-center">
            <p className="text-sm font-bold text-zinc-900">{m.v}</p>
            <p className="text-[10px] text-zinc-500">{m.l}</p>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-zinc-500 mb-2">Pipeline trend · 30d</p>
      <div className="flex items-end gap-1.5 h-24">
        {bars.map((h, i) => (
          <div key={i} className="flex-1 bg-[#FF773D]/80 rounded-t" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  )
}

function CompanyView() {
  return (
    <div className="bg-white rounded-lg border border-zinc-200 p-4 h-full text-xs space-y-2">
      <p className="font-bold text-zinc-900 text-sm">Rajasthan Handicrafts Export Co.</p>
      {[
        ['Products', 'Handicrafts · Home décor'],
        ['Export markets', 'Germany · France · UK'],
        ['Decision maker', 'Priya Sharma · VP Export'],
        ['CRM', 'Follow up · 2 open deals'],
      ].map(([k, v]) => (
        <div key={k} className="flex gap-3 border-b border-zinc-50 pb-2">
          <span className="font-semibold text-zinc-700 w-28 shrink-0">{k}</span>
          <span className="text-zinc-600">{v}</span>
        </div>
      ))}
    </div>
  )
}

function EmailView() {
  return (
    <div className="bg-white rounded-lg border border-zinc-200 p-4 h-full text-xs">
      <p className="font-semibold text-zinc-800 mb-2">Compose · logged to lead</p>
      <p className="text-zinc-500 mb-1">To: priya@rajasthanhandicrafts.com</p>
      <p className="font-medium text-zinc-900 mb-3">Re: FOB Mumbai trial order — export terms</p>
      <p className="text-zinc-600 leading-relaxed">
        Hi Priya — following up on our pricing from Tuesday. Happy to align on MOQ and schedule a 15-minute call…
      </p>
      <div className="mt-4 flex gap-2">
        <span className="px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-[10px] font-semibold">Send & log</span>
        <span className="px-3 py-1.5 rounded-lg border border-zinc-200 text-[10px]">Save draft</span>
      </div>
    </div>
  )
}
