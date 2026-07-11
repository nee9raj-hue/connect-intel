/**
 * Website 3.0 — animated story sections (CSS motion + Intersection Observer).
 * CRM-only product surface; honest metrics; no fake testimonials.
 */

import { useLandingReveal, useHeroScrollPhase } from '../../hooks/useLandingReveal'
import {
  AUTOMATION_FLOW,
  CHAOS_TOOLS,
  COPILOT_THINKING,
  DAY_WITH_CI,
  ENTERPRISE_ARCH,
  SECURITY_PILLARS,
  STORY_HERO,
  SUCCESS_METRICS,
} from '../../lib/landingContent'
import { BRAND_LOGO_ICON, BRAND_LOGO_ICON_CLASS } from '../../lib/brandAssets'
import WorldTradeMap from './WorldTradeMap'

function Reveal({ children, className = '', delay = 0 }) {
  const [ref, visible] = useLandingReveal()
  const delayCls = delay ? `ci-v3-reveal-delay-${delay}` : ''
  return (
    <div ref={ref} className={`ci-v3-reveal ${delayCls} ${visible ? 'is-visible' : ''} ${className}`.trim()}>
      {children}
    </div>
  )
}

function ChapterHeader({ eyebrow, title, desc, dark = false, align = 'left' }) {
  const centered = align === 'center'
  return (
    <header className={centered ? 'text-center mx-auto max-w-3xl' : 'max-w-xl'}>
      {eyebrow ? (
        <p className={`ci-v3-eyebrow mb-3 ${dark ? 'text-amber-300' : ''}`}>{eyebrow}</p>
      ) : null}
      <h2
        className={`ci-v3-chapter-heading font-display text-[clamp(1.75rem,4vw,2.75rem)] font-bold tracking-[-0.03em] leading-tight mb-4 ${
          dark ? '' : 'text-zinc-950'
        }`}
      >
        {title}
      </h2>
      {desc ? (
        <p
          className={`ci-v3-chapter-desc text-base leading-relaxed ${dark ? '' : 'text-zinc-600'} ${centered ? 'mx-auto' : ''}`}
        >
          {desc}
        </p>
      ) : null}
    </header>
  )
}

export function HeroSection({ onLaunch, onSignIn }) {
  const phase = useHeroScrollPhase()

  return (
    <section className="ci-v3-hero relative pt-24 pb-12 lg:pb-20 px-4 sm:px-6 overflow-hidden" aria-label="Hero">
      <div className="max-w-[1200px] mx-auto">
        <Reveal>
          <p className="ci-v3-eyebrow mb-5 text-center lg:text-left">Enterprise AI Sales Intelligence</p>
          <h1 className="ci-v3-headline text-center lg:text-left max-w-4xl">
            {STORY_HERO.line1}
            <br />
            <span className="text-zinc-800">{STORY_HERO.line2}</span>
          </h1>
          <p className="ci-v3-subline mt-5 text-center lg:text-left">{STORY_HERO.tagline}</p>
        </Reveal>

        <Reveal delay={1} className="mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
          <button type="button" onClick={onLaunch} className="ci-btn-primary px-7 py-3.5 text-sm min-h-[48px]">
            Launch your workspace
          </button>
          <button type="button" onClick={onSignIn} className="ci-btn-secondary px-7 py-3.5 text-sm min-h-[48px]">
            Sign in
          </button>
        </Reveal>

        <Reveal delay={2} className="mt-12 lg:mt-16">
          <HeroLiveDashboard phase={phase} />
        </Reveal>
      </div>
    </section>
  )
}

function HeroLiveDashboard({ phase }) {
  const panels = ['pipeline', 'copilot', 'analytics', 'intel']
  const active = panels[phase] || 'pipeline'

  return (
    <div className="ci-v3-live-shell relative" data-phase={phase} style={{ minHeight: 'clamp(320px, 52vw, 440px)' }}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-100 bg-zinc-50/80">
        <img src={BRAND_LOGO_ICON} alt="" className={`w-6 h-6 ${BRAND_LOGO_ICON_CLASS}`} />
        <span className="text-xs font-semibold text-zinc-800">Connect Intel</span>
        <div className="ml-auto flex gap-1.5">
          {panels.map((p) => (
            <span
              key={p}
              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize ${
                active === p ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-500 border border-zinc-200'
              }`}
            >
              {p}
            </span>
          ))}
        </div>
      </div>

      <div className="relative p-4 sm:p-5" style={{ minHeight: '280px' }}>
        <div className={`ci-v3-live-panel ${active === 'pipeline' ? 'is-active' : ''}`}>
          <PipelinePanelMini />
        </div>
        <div className={`ci-v3-live-panel ${active === 'copilot' ? 'is-active' : ''}`}>
          <CopilotPanelMini />
        </div>
        <div className={`ci-v3-live-panel ${active === 'analytics' ? 'is-active' : ''}`}>
          <AnalyticsPanelMini />
        </div>
        <div className={`ci-v3-live-panel ${active === 'intel' ? 'is-active' : ''}`}>
          <IntelPanelMini />
        </div>
      </div>
    </div>
  )
}

function PipelinePanelMini() {
  const rows = [
    { name: 'Rajasthan Handicrafts', stage: 'Follow up', hot: true },
    { name: 'Gujarat Textiles', stage: 'Contacted', hot: false },
    { name: 'Chennai Spices Co', stage: 'New', hot: false },
    { name: 'Mumbai Organics', stage: 'Won', hot: false },
  ]
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div>
        <p className="text-xs font-semibold text-zinc-500 mb-2">Pipeline · live</p>
        <table className="w-full text-xs">
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-t border-zinc-50">
                <td className="py-2 font-medium text-zinc-900">
                  {r.hot ? <span className="ci-v3-pulse-dot inline-block w-1.5 h-1.5 rounded-full bg-[#FF773D] mr-1.5" /> : null}
                  {r.name}
                </td>
                <td className="py-2 text-right text-zinc-600">{r.stage}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded-xl bg-zinc-50 border border-zinc-100 p-3 text-xs">
        <p className="font-semibold text-zinc-800 mb-2">Activity</p>
        <p className="text-zinc-600">Email logged · Task due 4pm · Owner: Anita</p>
      </div>
    </div>
  )
}

function CopilotPanelMini() {
  return (
    <div className="rounded-xl bg-zinc-950 text-white p-4 text-sm">
      <p className="text-[10px] uppercase tracking-wider text-amber-300/80 mb-2">Connect Copilot</p>
      <p className="text-white/90 mb-3">Draft follow-up for EU distributor — pricing sent Tuesday.</p>
      <div className="rounded-lg bg-white/5 border border-white/10 p-3 text-[13px] text-white/80 leading-relaxed">
        Subject: Re: FOB Mumbai trial order · proposes 15-min call with export terms attached…
      </div>
    </div>
  )
}

function AnalyticsPanelMini() {
  const bars = [42, 68, 55, 82, 61]
  return (
    <div>
      <p className="text-xs font-semibold text-zinc-500 mb-3">Pipeline health</p>
      <div className="flex items-end gap-2 h-28">
        {bars.map((h, i) => (
          <div key={i} className="flex-1 flex flex-col justify-end">
            <div className="ci-v3-bar w-full rounded-t bg-[#FF773D]/80" style={{ height: `${h}%`, animation: 'ci-v3-bar-grow 0.8s ease forwards' }} />
          </div>
        ))}
      </div>
    </div>
  )
}

function IntelPanelMini() {
  return (
    <div className="grid sm:grid-cols-2 gap-3 text-xs">
      <div className="rounded-lg border border-zinc-100 p-3">
        <p className="font-semibold text-zinc-900">Export markets</p>
        <p className="text-zinc-600 mt-1">EU · UK · UAE</p>
      </div>
      <div className="rounded-lg border border-zinc-100 p-3">
        <p className="font-semibold text-zinc-900">Decision makers</p>
        <p className="text-zinc-600 mt-1">3 contacts · VP Procurement</p>
      </div>
    </div>
  )
}

export function RealitySection() {
  const [ref, visible] = useLandingReveal()

  return (
    <section id="story" className="ci-v3-chapter px-4 sm:px-6 bg-zinc-50 border-y border-zinc-100" aria-labelledby="reality-title">
      <div className="max-w-[1100px] mx-auto grid lg:grid-cols-2 gap-12 items-center">
        <Reveal>
          <ChapterHeader
            eyebrow="Chapter 01"
            title="The reality of sales today"
            desc="Your team juggles a dozen tools. Context lives everywhere except the CRM."
          />
        </Reveal>

        <div ref={ref} className={`relative ${visible ? 'is-visible' : ''}`}>
          <div className="ci-v3-chaos-grid mx-auto lg:ml-auto">
            {CHAOS_TOOLS.map((tool) => (
              <div key={tool} className="ci-v3-chaos-tab text-zinc-700">
                {tool}
              </div>
            ))}
          </div>
          <p className="text-center lg:text-right text-xs text-zinc-500 mt-4">Controlled chaos — until now.</p>
        </div>
      </div>

      <Reveal className="max-w-[900px] mx-auto mt-16 text-center">
        <p id="reality-title" className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3">
          Then Connect Intel
        </p>
        <p className="font-display text-3xl sm:text-4xl font-bold text-zinc-950 tracking-tight">
          One platform. Everything connected.
        </p>
        <p className="text-zinc-600 mt-4 max-w-lg mx-auto leading-relaxed">
          Pipeline, AI copilot, team intelligence, and email sync — in a workspace your security team can evaluate.
        </p>
      </Reveal>
    </section>
  )
}

export function CopilotSection() {
  const [ref, visible] = useLandingReveal()

  return (
    <section id="copilot" className="ci-v3-chapter ci-v3-dark px-4 sm:px-6" aria-labelledby="copilot-title">
      <div className="max-w-[1100px] mx-auto grid lg:grid-cols-2 gap-12 items-start">
        <Reveal>
          <ChapterHeader
            eyebrow="Chapter 02"
            dark
            title="Meet Connect Copilot"
            desc="Not a chatbot — an AI sales partner that reasons over your CRM, drafts outreach, and recommends next actions."
          />
        </Reveal>

        <div ref={ref} className={`ci-v3-copilot rounded-2xl border border-white/15 bg-white/[0.07] p-5 sm:p-6 ${visible ? 'is-visible' : ''}`}>
          <p className="ci-v3-accent-label text-xs font-semibold mb-4">Reasoning trace</p>
          <ol className="space-y-3" aria-label="AI reasoning steps">
            {COPILOT_THINKING.map((step) => (
              <li key={step} className="ci-v3-think-step flex gap-3 text-sm text-zinc-200">
                <span className="w-5 h-5 rounded-full bg-[#FF773D]/25 text-[#fdba74] text-[10px] font-bold flex items-center justify-center shrink-0">
                  →
                </span>
                {step}
              </li>
            ))}
          </ol>
          <div className="mt-6 rounded-xl bg-black/40 border border-white/15 p-4">
            <p className="ci-v3-muted-label text-[10px] font-semibold uppercase tracking-wide mb-1">Draft ready</p>
            <p className="text-sm text-zinc-100 leading-relaxed" id="copilot-title">
              Personalized email referencing last quote, export MOQ, and proposed call slot — grounded on lead record.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

export function PipelineSection() {
  const [ref, visible] = useLandingReveal()
  const cols = [
    { name: 'New', cards: ['Spice Exports Ltd', 'Kerala Cashews'] },
    { name: 'Contacted', cards: ['Delhi Pharma'] },
    { name: 'Follow up', cards: ['Rajasthan HC', 'Gujarat Textiles'] },
    { name: 'Won', cards: ['Mumbai Organics'] },
  ]

  return (
    <section id="pipeline" className="ci-v3-chapter px-4 sm:px-6" aria-labelledby="pipeline-title">
      <div className="max-w-[1100px] mx-auto">
        <Reveal className="mb-12">
          <ChapterHeader
            eyebrow="Chapter 03"
            title="Pipeline that moves with your team"
            desc="Deals progress. Owners assign. Emails log. Tasks complete — without leaving the record."
          />
        </Reveal>

        <div ref={ref} className={`ci-v3-pipeline grid grid-cols-2 lg:grid-cols-4 gap-3 ${visible ? 'is-visible' : ''}`}>
          {cols.map((col) => (
            <div key={col.name} className="rounded-xl bg-zinc-50 border border-zinc-100 p-3 min-h-[200px]">
              <p className="text-xs font-bold text-zinc-600 mb-2">{col.name}</p>
              <div className="space-y-2">
                {col.cards.map((card, i) => (
                  <div
                    key={card}
                    className={`ci-v3-kanban-card rounded-lg bg-white border border-zinc-200 px-2 py-2 text-[11px] font-medium text-zinc-800 shadow-sm ${
                      col.name === 'Follow up' && i === 0 ? 'ci-v3-kanban-move' : ''
                    }`}
                  >
                    {card}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p id="pipeline-title" className="sr-only">
          Interactive pipeline preview
        </p>
      </div>
    </section>
  )
}

export function CompanyIntelSection() {
  const [ref, visible] = useLandingReveal()
  const rows = [
    { label: 'Website & products', value: 'Handicrafts · Home décor · MOQ 500 units' },
    { label: 'Export markets', value: 'Germany · France · UK' },
    { label: 'Import sources', value: 'Raw silk · Packaging from Gujarat' },
    { label: 'Decision makers', value: 'Priya Sharma · VP Export · LinkedIn verified' },
    { label: 'News', value: 'Expanded EU distributor network — Q2' },
    { label: 'CRM status', value: 'Stage: Follow up · Owner: Anita · 2 deals open' },
  ]

  return (
    <section className="ci-v3-chapter px-4 sm:px-6 bg-zinc-50" aria-labelledby="intel-title">
      <div className="max-w-[900px] mx-auto">
        <Reveal className="mb-10 text-center">
          <ChapterHeader
            align="center"
            eyebrow="Chapter 04"
            title="Company intelligence on every record"
            desc="Enrichment appears progressively — website, markets, people, news, and CRM status unified."
          />
        </Reveal>

        <div ref={ref} className={`ci-v3-intel rounded-2xl bg-white border border-zinc-200 p-5 sm:p-6 shadow-sm ${visible ? 'is-visible' : ''}`}>
          <p className="text-sm font-bold text-zinc-900 mb-4" id="intel-title">
            Rajasthan Handicrafts Export Co.
          </p>
          <dl className="space-y-3">
            {rows.map((row) => (
              <div key={row.label} className="ci-v3-intel-row flex flex-col sm:flex-row sm:gap-4 text-sm border-b border-zinc-50 pb-3 last:border-0">
                <dt className="font-semibold text-zinc-700 sm:w-40 shrink-0">{row.label}</dt>
                <dd className="text-zinc-600">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  )
}

export function MarketIntelSection() {
  return (
    <section className="ci-v3-chapter px-4 sm:px-6" aria-labelledby="market-title">
      <div className="max-w-[1100px] mx-auto grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
        <Reveal>
          <ChapterHeader
            eyebrow="Chapter 05"
            title="Global business intelligence"
            desc="Trade routes, importers, exporters, and opportunities — commerce without borders."
          />
        </Reveal>

        <div id="market-title">
          <WorldTradeMap />
        </div>
      </div>
    </section>
  )
}

export function AutomationSection() {
  const [ref, visible] = useLandingReveal()

  return (
    <section id="automation" className="ci-v3-chapter px-4 sm:px-6 bg-zinc-50" aria-labelledby="automation-title">
      <div className="max-w-[720px] mx-auto">
        <Reveal className="mb-10 text-center">
          <ChapterHeader
            align="center"
            eyebrow="Chapter 06"
            title="Automation that runs while you sell"
            desc="Visual workflow — from lead entry to deal won. No manual handoffs."
          />
        </Reveal>

        <div ref={ref} className={`ci-v3-flow flex flex-col items-center gap-2 ${visible ? 'is-visible' : ''}`} id="automation-title">
          {AUTOMATION_FLOW.map((node, i) => (
            <div key={node} className="ci-v3-flow-node w-full max-w-md">
              {i > 0 ? <div className="text-center text-zinc-300 text-sm py-0.5" aria-hidden>↓</div> : null}
              <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-800 text-center shadow-sm">
                {node}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function EnterpriseArchSection() {
  return (
    <section id="enterprise" className="ci-v3-chapter px-4 sm:px-6" aria-labelledby="arch-title">
      <div className="max-w-[1100px] mx-auto">
        <Reveal className="mb-12 text-center">
          <ChapterHeader
            align="center"
            eyebrow="Chapter 07"
            title="Enterprise architecture"
            desc="Built for security review — multi-tenant isolation, RBAC, audit, and scale."
          />
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {ENTERPRISE_ARCH.map((tile, i) => (
            <Reveal key={tile.title} delay={(i % 4) + 1}>
              <div className="ci-v3-arch-tile rounded-xl border border-zinc-200 bg-white p-5 h-full">
                <h3 className="font-semibold text-zinc-900 text-sm mb-1">{tile.title}</h3>
                <p className="text-xs text-zinc-600 leading-relaxed">{tile.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <p id="arch-title" className="sr-only">
          Enterprise architecture tiles
        </p>
      </div>
    </section>
  )
}

export function AnalyticsSection() {
  const [ref, visible] = useLandingReveal()
  const metrics = [
    { label: 'Open pipeline', value: '₹2.4Cr' },
    { label: 'Forecast', value: '₹86L' },
    { label: 'Win rate', value: '24%' },
    { label: 'Team touched', value: '89%' },
  ]

  return (
    <section className="ci-v3-chapter ci-v3-dark px-4 sm:px-6" aria-labelledby="analytics-title">
      <div className="max-w-[1000px] mx-auto">
        <Reveal className="mb-10">
          <ChapterHeader dark eyebrow="Chapter 08" title="Analytics that drive decisions" desc="Revenue, forecast, pipeline health, and team performance — with AI recommendations." />
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {metrics.map((m) => (
            <Reveal key={m.label}>
              <div className="rounded-xl border border-white/15 bg-white/[0.07] p-4 text-center">
                <p className="ci-v3-stat-value text-2xl font-bold">{m.value}</p>
                <p className="ci-v3-stat-label text-xs mt-1">{m.label}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <div ref={ref} className={`ci-v3-analytics rounded-2xl border border-white/15 bg-white/[0.07] p-6 ${visible ? 'is-visible' : ''}`}>
          <p className="ci-v3-muted-label text-xs mb-4" id="analytics-title">
            Pipeline trend · last 30 days
          </p>
          <div className="flex items-end gap-3 h-32">
            {[35, 52, 48, 70, 65, 88, 76].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col justify-end h-full">
                <div className="ci-v3-bar w-full rounded-t bg-[#FF773D]" style={{ height: `${h}%` }} />
              </div>
            ))}
          </div>
          <p className="ci-v3-ai-insight text-xs mt-4 font-medium">AI: 3 deals at risk — recommend manager review on Follow up stage.</p>
        </div>
      </div>
    </section>
  )
}

export function DayWithCiSection() {
  const [ref, visible] = useLandingReveal()

  return (
    <section className="ci-v3-chapter px-4 sm:px-6 bg-gradient-to-b from-white to-zinc-50" aria-labelledby="day-title">
      <div className="max-w-[1100px] mx-auto">
        <Reveal className="mb-12 text-center">
          <ChapterHeader
            align="center"
            eyebrow="Chapter 09"
            title="A day with Connect Intel"
            desc="Imagine your sales team operating from one intelligent workspace — morning to evening."
          />
        </Reveal>

        <div ref={ref} className={`ci-v3-day grid sm:grid-cols-2 lg:grid-cols-4 gap-4 ${visible ? 'is-visible' : ''}`} id="day-title">
          {DAY_WITH_CI.map((block) => (
            <article key={block.period} className="ci-v3-day-block rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#FF773D] mb-2">{block.period}</p>
              <h3 className="font-bold text-zinc-900 mb-3">{block.title}</h3>
              <ul className="space-y-2 text-sm text-zinc-600">
                {block.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-[#FF773D]" aria-hidden>
                      ·
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export function SuccessMetricsSection() {
  return (
    <section id="metrics" className="ci-v3-chapter px-4 sm:px-6 border-y border-zinc-100" aria-labelledby="metrics-title">
      <div className="max-w-[1000px] mx-auto text-center">
        <Reveal className="mb-10">
          <ChapterHeader
            align="center"
            eyebrow="Chapter 10"
            title="Production metrics — not marketing claims"
            desc="Real gates and architecture signals from the live platform."
          />
        </Reveal>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {SUCCESS_METRICS.map((m, i) => (
            <Reveal key={m.label} delay={i + 1}>
              <div className="rounded-xl border border-zinc-200 bg-white py-6 px-4">
                <p className="text-2xl font-bold text-zinc-950">{m.value}</p>
                <p className="text-xs text-zinc-500 mt-2 font-medium leading-snug">{m.label}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <p id="metrics-title" className="sr-only">
          Customer success metrics
        </p>
      </div>
    </section>
  )
}

export function SecuritySection() {
  const [ref, visible] = useLandingReveal()

  return (
    <section className="ci-v3-chapter ci-v3-dark px-4 sm:px-6" aria-labelledby="security-title">
      <div className="max-w-[1000px] mx-auto">
        <Reveal className="mb-10 text-center">
          <ChapterHeader
            align="center"
            dark
            eyebrow="Chapter 11"
            title="Enterprise security"
            desc="Encryption, isolation, permissions, and audit — designed for trust."
          />
        </Reveal>

        <div ref={ref} className={`ci-v3-security grid sm:grid-cols-2 lg:grid-cols-3 gap-4 ${visible ? 'is-visible' : ''}`} id="security-title">
          {SECURITY_PILLARS.map((item) => (
            <div key={item.title} className="ci-v3-shield rounded-xl border border-white/15 bg-white/[0.08] p-5">
              <h3 className="ci-v3-card-title font-semibold text-sm mb-1.5">{item.title}</h3>
              <p className="ci-v3-card-desc text-xs leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function FinalCtaSection({ onLaunch, demoHref }) {
  return (
    <section id="start" className="ci-v3-chapter px-4 sm:px-6">
      <div className="max-w-xl mx-auto text-center">
        <Reveal>
          <h2 className="font-display text-3xl font-bold text-zinc-950 mb-4">Start your AI sales platform</h2>
          <p className="text-zinc-600 mb-8 leading-relaxed">
            Launch a secure workspace in minutes. Book an enterprise demo when your team is ready to evaluate at scale.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button type="button" onClick={onLaunch} className="ci-btn-primary px-7 py-3.5 text-sm">
              Launch your workspace
            </button>
            <a href={demoHref} className="ci-btn-secondary px-7 py-3.5 text-sm inline-flex items-center justify-center">
              Book enterprise demo
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
