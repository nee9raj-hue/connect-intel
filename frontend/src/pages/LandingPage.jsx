import { useState } from 'react'
import { useApp } from '../context/AppContext'
import HeroAuthCta from '../components/landing/HeroAuthCta'
import {
  AiCopilotPreview,
  AutomationPreview,
  BeforeAfterCompare,
  CrmPipelineMini,
  DealsPreview,
  ExtensionEmailFlow,
  FollowUpTimeline,
  ImportPipelineVisual,
  ManagerDashboardPreview,
  RevenueLeakInfographic,
} from '../components/landing/LandingVisuals'
import { ENTERPRISE_ICON_MAP } from '../components/landing/LandingIcons'
import {
  BRAND_LOGO_HERO,
  BRAND_LOGO_HERO_MARK,
  BRAND_LOGO_ICON,
  BRAND_LOGO_ICON_CLASS,
  BRAND_LOGO_MARK_CLASS,
} from '../lib/brandAssets'
import { FREE_PLAN, GROWTH_PLAN } from '../lib/crmPlanLimits'
import {
  AI_COPILOT_CAPABILITIES,
  DEMO_MAILTO,
  ENTERPRISE_FEATURES,
  FAQ_ITEMS,
  HERO_OUTCOMES,
  INDUSTRIES,
  LANDING_HERO,
  MANAGER_BULLETS,
  PILLARS,
  PRODUCT_METRICS,
  PRODUCT_SHOWCASE,
  WHO_ITS_FOR,
  WORKFLOW_STEPS,
  CRM_WINS,
  PAIN_POINTS,
} from '../lib/landingContent'
import '../styles/landing-enterprise.css'

const NAV_LINKS = [
  { href: '#platform', label: 'Platform' },
  { href: '#copilot', label: 'AI Copilot' },
  { href: '#enterprise', label: 'Enterprise' },
  { href: '#industries', label: 'Industries' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
]

const SHOWCASE_VISUAL = {
  pipeline: () => <ProductPreview />,
  deals: () => <DealsPreview />,
  dashboard: () => <ManagerDashboardPreview />,
  copilot: () => <AiCopilotPreview />,
  automation: () => <AutomationPreview />,
  email: () => <ExtensionEmailFlow />,
}

export default function LandingPage() {
  const { setScreen } = useApp()

  return (
    <div className="ci-landing min-h-screen bg-white text-[#0a0a0b]">
      <header className="ci-landing-nav fixed top-0 inset-x-0 z-50">
        <div className="max-w-[1200px] mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4">
          <Logo />
          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-zinc-600" aria-label="Primary">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="hover:text-zinc-900 transition-colors">
                {link.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setScreen('auth')}
              className="hidden sm:inline-flex px-3 py-2 text-sm font-semibold text-zinc-700 hover:text-zinc-900"
            >
              Sign in
            </button>
            <a
              href={DEMO_MAILTO}
              className="hidden md:inline-flex px-3 py-2 text-sm font-semibold text-zinc-700 hover:text-zinc-900 border border-transparent hover:border-zinc-200 rounded-lg"
            >
              Book demo
            </a>
            <button
              type="button"
              onClick={() => setScreen('auth')}
              className="ci-btn-accent px-4 py-2 text-sm"
            >
              Start free workspace
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="ci-landing-hero relative pt-24 pb-16 lg:pt-28 lg:pb-20 px-4 sm:px-6">
        <div className="max-w-[1200px] mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-200 bg-white text-xs font-semibold text-zinc-700 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF773D]" aria-hidden />
              {LANDING_HERO.badge}
            </p>
            <img
              src={BRAND_LOGO_HERO_MARK}
              alt=""
              width={240}
              height={48}
              decoding="async"
              className={`h-9 w-auto mb-6 ${BRAND_LOGO_MARK_CLASS}`}
            />
            <h1 className="font-display text-[2rem] sm:text-[2.75rem] lg:text-[3rem] font-bold tracking-[-0.03em] leading-[1.08] text-zinc-950 mb-5">
              {LANDING_HERO.headline}
            </h1>
            <p className="text-lg text-zinc-600 leading-relaxed mb-6 max-w-xl">{LANDING_HERO.subhead}</p>
            <ul className="grid sm:grid-cols-2 gap-2 text-sm text-zinc-700 mb-8">
              {HERO_OUTCOMES.map((item) => (
                <li key={item} className="flex gap-2 items-start">
                  <span className="text-[#FF773D] font-bold mt-0.5" aria-hidden>
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <HeroAuthCta />
            <p className="mt-4 text-sm text-zinc-500">
              Already have a workspace?{' '}
              <button
                type="button"
                onClick={() => setScreen('auth')}
                className="font-semibold text-zinc-800 underline-offset-2 hover:underline"
              >
                Sign in
              </button>
            </p>
          </div>
          <div className="relative">
            <ProductPreview />
          </div>
        </div>
        <div className="max-w-[1200px] mx-auto mt-14 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {PRODUCT_METRICS.map((m) => (
            <StatCard key={m.label} value={m.value} label={m.label} />
          ))}
        </div>
      </section>

      {/* Platform showcase */}
      <section id="platform" className="py-20 px-4 sm:px-6 border-t border-zinc-100">
        <div className="max-w-[1100px] mx-auto">
          <SectionHeader
            eyebrow="Product"
            title="Show the work—not slide decks"
            desc="Real UI patterns from Connect Intel: pipeline, deals, dashboards, AI copilot, and automation. Built for daily sales operations."
          />
          <div className="mt-14 space-y-20">
            {PRODUCT_SHOWCASE.map((block, index) => {
              const Visual = SHOWCASE_VISUAL[block.visual]
              const flip = index % 2 === 1
              return (
                <article
                  key={block.id}
                  className={`grid lg:grid-cols-2 gap-10 items-center ${flip ? 'lg:[direction:rtl]' : ''}`}
                >
                  <div className={flip ? 'lg:[direction:ltr]' : ''}>
                    <h3 className="text-xl font-bold text-zinc-900 mb-2">{block.title}</h3>
                    <p className="text-zinc-600 leading-relaxed">{block.benefit}</p>
                  </div>
                  <div className={flip ? 'lg:[direction:ltr]' : ''}>{Visual ? <Visual /> : null}</div>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      {/* AI Copilot */}
      <section id="copilot" className="py-20 px-4 sm:px-6 bg-zinc-950 text-white">
        <div className="max-w-[1100px] mx-auto grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <SectionHeader
              align="left"
              eyebrow="AI Sales Copilot"
              title="Intelligence inside the CRM—not bolted on"
              desc="Grounded answers, email drafts, and workspace search tied to your pipeline data and permissions."
              dark
            />
            <ul className="mt-8 grid sm:grid-cols-2 gap-4">
              {AI_COPILOT_CAPABILITIES.map((cap) => (
                <li key={cap.title} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="font-semibold text-sm text-white mb-1">{cap.title}</p>
                  <p className="text-xs text-zinc-400 leading-relaxed">{cap.desc}</p>
                </li>
              ))}
            </ul>
          </div>
          <AiCopilotPreview />
        </div>
      </section>

      {/* Enterprise */}
      <section id="enterprise" className="py-20 px-4 sm:px-6">
        <div className="max-w-[1100px] mx-auto">
          <SectionHeader
            eyebrow="Enterprise ready"
            title="Architecture your security team can evaluate"
            desc="Multi-tenant isolation, RBAC, audit trails, and production performance gates—without a separate “enterprise edition.”"
          />
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {ENTERPRISE_FEATURES.map((f) => {
              const Icon = ENTERPRISE_ICON_MAP[f.title]
              return (
                <div key={f.title} className="ci-landing-card p-5">
                  {Icon ? (
                    <Icon className="text-[#FF773D] mb-3" />
                  ) : (
                    <span className="w-5 h-5 block mb-3 rounded bg-[#fff4ee]" aria-hidden />
                  )}
                  <h3 className="font-semibold text-sm text-zinc-900 mb-1.5">{f.title}</h3>
                  <p className="text-xs text-zinc-600 leading-relaxed">{f.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Industries + audience */}
      <section id="industries" className="py-16 px-4 sm:px-6 bg-zinc-50 border-y border-zinc-100">
        <div className="max-w-[1100px] mx-auto">
          <SectionHeader
            title="Built for global B2B commerce"
            desc="Exporters, manufacturers, distributors, and trading teams selling across borders."
          />
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {INDUSTRIES.map((name) => (
              <span
                key={name}
                className="px-3 py-1.5 rounded-full border border-zinc-200 bg-white text-sm font-medium text-zinc-700"
              >
                {name}
              </span>
            ))}
          </div>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {WHO_ITS_FOR.map((persona) => (
              <article key={persona.id} className="ci-landing-card p-5">
                <h3 className="font-semibold text-zinc-900 text-[15px] mb-1.5">{persona.title}</h3>
                <p className="text-sm text-zinc-600 leading-relaxed">{persona.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Problem / proof */}
      <section className="py-16 px-4 sm:px-6">
        <div className="max-w-[1100px] mx-auto grid lg:grid-cols-2 gap-10 items-start">
          <div>
            <SectionHeader
              align="left"
              eyebrow="Why teams switch"
              title="Serious revenue needs serious pipeline discipline"
              desc="Indian B2B teams lose deals in the follow-up gap—not on the first pitch."
            />
            <div className="grid sm:grid-cols-2 gap-6 mt-6">
              <ul className="space-y-2 text-sm text-zinc-700">
                {PAIN_POINTS.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-red-500 shrink-0">✕</span>
                    {item}
                  </li>
                ))}
              </ul>
              <ul className="space-y-2 text-sm text-zinc-700">
                {CRM_WINS.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-[#FF773D] shrink-0">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="space-y-4">
            <RevenueLeakInfographic />
            <BeforeAfterCompare />
          </div>
        </div>
      </section>

      {/* Managers */}
      <section className="py-20 px-4 sm:px-6 ci-landing-dark">
        <div className="max-w-[1100px] mx-auto grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-300 mb-3">Team intelligence</p>
            <h2 className="font-display text-2xl md:text-3xl font-bold mb-4">Coach from CRM activity—not anecdotes</h2>
            <p className="text-zinc-400 leading-relaxed mb-6">
              Rep review, period filters, and last CRM touch per rep. Dashboard paths optimized for sub-second load in
              production.
            </p>
            <ul className="space-y-2 text-sm text-zinc-300">
              {MANAGER_BULLETS.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-[#FF773D]">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <ManagerDashboardPreview />
        </div>
      </section>

      {/* Workflow */}
      <section className="py-16 px-4 sm:px-6 bg-zinc-50">
        <div className="max-w-[1000px] mx-auto">
          <SectionHeader title="Launch your workspace in one afternoon" desc="Four steps enterprise teams complete on day one." />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
            {WORKFLOW_STEPS.map((s) => (
              <div key={s.title} className="ci-landing-card p-5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#FF773D] mb-2">{s.tag}</p>
                <p className="font-semibold text-sm text-zinc-900">{s.title}</p>
                <p className="text-xs text-zinc-600 mt-1.5 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 grid lg:grid-cols-2 gap-6">
            <ImportPipelineVisual />
            <div className="space-y-4">
              <CrmPipelineMini />
              <FollowUpTimeline />
            </div>
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="py-16 px-4 sm:px-6">
        <div className="max-w-[1100px] mx-auto">
          <SectionHeader title="Core platform capabilities" desc="Included in your workspace—CRM depth without module sprawl." />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-10">
            {PILLARS.map((f) => (
              <article key={f.id} className="ci-landing-card p-6">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#b45309]">{f.tag}</span>
                <h3 className="font-semibold text-zinc-900 mt-2 mb-2 text-[15px]">{f.title}</h3>
                <p className="text-sm text-zinc-600 leading-relaxed">{f.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-16 px-4 sm:px-6 border-y border-zinc-100 bg-white">
        <div className="max-w-[900px] mx-auto">
          <SectionHeader
            title="Start free. Scale when pipeline grows."
            desc="No card at signup. Transparent upgrade when your admin confirms capacity."
          />
          <div className="grid md:grid-cols-2 gap-6 mt-10">
            <PricingCard
              tier="Free workspace"
              price={FREE_PLAN.priceDisplay}
              sub="for early teams"
              features={[
                `Up to ${FREE_PLAN.maxSeats} seats`,
                `Up to ${FREE_PLAN.maxLeads} pipeline leads`,
                'Full CRM + AI copilot in workspace',
                'Chrome extension email sync',
              ]}
            />
            <PricingCard
              tier="Team CRM"
              price={GROWTH_PLAN.priceDisplay}
              sub="when you need more capacity"
              period="/month"
              highlight
              features={[
                `Up to ${GROWTH_PLAN.maxSeats} seats`,
                `Up to ${GROWTH_PLAN.maxLeads.toLocaleString('en-IN')} leads`,
                'Admin-confirmed upgrade',
                'Amount shown before payment',
              ]}
            />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-16 px-4 sm:px-6 bg-zinc-50">
        <div className="max-w-[720px] mx-auto">
          <SectionHeader title="Questions from evaluation teams" />
          <div className="mt-8 space-y-3">
            {FAQ_ITEMS.map((item) => (
              <FaqItem key={item.q} question={item.q} answer={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="start" className="py-20 px-4 sm:px-6 border-t border-zinc-100">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-zinc-900 mb-3">
            Launch your enterprise sales workspace
          </h2>
          <p className="text-zinc-600 mb-8 leading-relaxed">
            Create an organization with your work email. Import pipeline, invite your team, and operate from one
            auditable platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button type="button" onClick={() => setScreen('auth')} className="ci-btn-primary px-6 py-3.5 text-sm">
              Start free workspace
            </button>
            <a href={DEMO_MAILTO} className="ci-btn-secondary px-6 py-3.5 text-sm inline-flex items-center justify-center">
              Talk to sales
            </a>
          </div>
          <p className="text-xs text-zinc-500 mt-4">
            {FREE_PLAN.maxSeats} seats · {FREE_PLAN.maxLeads} leads · Secure sessions · No card required
          </p>
        </div>
      </section>

      <footer className="py-12 px-4 sm:px-6 border-t border-zinc-200 bg-white">
        <div className="max-w-[1100px] mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div>
            <Logo />
            <p className="text-sm text-zinc-500 mt-3 max-w-sm leading-relaxed">
              Enterprise AI sales intelligence — CRM, automation, and team visibility for modern B2B teams.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-4 text-sm text-zinc-600">
            <button type="button" onClick={() => setScreen('auth')} className="hover:text-zinc-900 font-medium">
              Sign in
            </button>
            <a href={DEMO_MAILTO} className="hover:text-zinc-900 font-medium">
              Book demo
            </a>
            <a href="https://connectintel.net/privacy.html" className="hover:text-zinc-900">
              Privacy
            </a>
          </div>
        </div>
        <p className="text-center text-xs text-zinc-400 mt-8">© {new Date().getFullYear()} Connect Intel</p>
      </footer>
    </div>
  )
}

function SectionHeader({ eyebrow, title, desc, align = 'center', dark = false }) {
  const centered = align === 'center'
  return (
    <div className={centered ? 'text-center' : ''}>
      {eyebrow ? (
        <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${dark ? 'text-amber-300' : 'text-[#FF773D]'}`}>
          {eyebrow}
        </p>
      ) : null}
      <h2 className={`font-display text-2xl md:text-3xl font-bold mb-3 ${dark ? 'text-white' : 'text-zinc-900'}`}>
        {title}
      </h2>
      {desc ? (
        <p className={`leading-relaxed max-w-2xl ${centered ? 'mx-auto' : ''} ${dark ? 'text-zinc-400' : 'text-zinc-600'}`}>
          {desc}
        </p>
      ) : null}
    </div>
  )
}

function PricingCard({ tier, price, sub, period, features, highlight }) {
  return (
    <div className={`rounded-2xl p-6 ${highlight ? 'border-2 border-[#FF773D]/40 bg-white shadow-sm' : 'ci-landing-card'}`}>
      <p className={`text-xs font-bold uppercase tracking-wide mb-2 ${highlight ? 'text-[#FF773D]' : 'text-zinc-500'}`}>
        {tier}
      </p>
      <p className="text-3xl font-bold text-zinc-900 mb-1">
        {price}
        {period ? <span className="text-base font-medium text-zinc-600">{period}</span> : null}
      </p>
      <p className="text-sm text-zinc-600 mb-5">{sub}</p>
      <ul className="space-y-2 text-sm text-zinc-800">
        {features.map((f) => (
          <li key={f} className="flex gap-2">
            <span className="text-[#FF773D]">✓</span>
            {f}
          </li>
        ))}
      </ul>
    </div>
  )
}

function FaqItem({ question, answer }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="ci-landing-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
        aria-expanded={open}
      >
        {question}
        <span className="text-zinc-400 text-lg shrink-0" aria-hidden>
          {open ? '−' : '+'}
        </span>
      </button>
      {open ? (
        <div className="px-5 pb-4 text-sm text-zinc-600 leading-relaxed border-t border-zinc-100 pt-3">{answer}</div>
      ) : null}
    </div>
  )
}

function StatCard({ value, label }) {
  return (
    <div className="ci-landing-card text-center py-4 px-3">
      <div className="text-lg font-bold text-zinc-900">{value}</div>
      <div className="text-xs text-zinc-500 mt-1 font-medium leading-snug">{label}</div>
    </div>
  )
}

function Logo() {
  return (
    <a href="/" className="flex items-center shrink-0" aria-label="Connect Intel home">
      <img
        src={BRAND_LOGO_HERO}
        alt=""
        width={48}
        height={48}
        className={`h-10 w-10 sm:h-11 sm:w-11 rounded-lg ${BRAND_LOGO_ICON_CLASS}`}
      />
    </a>
  )
}

function ProductPreview() {
  const rows = [
    { name: 'Priya Sharma', company: 'Rajasthan Handicrafts', stage: 'Follow up' },
    { name: 'Amit Patel', company: 'Gujarat Textiles', stage: 'Contacted' },
    { name: 'Lakshmi Iyer', company: 'Chennai Spices Co', stage: 'New' },
    { name: 'Rahul Mehta', company: 'Mumbai Organics', stage: 'Won' },
  ]
  const stageStyle = {
    New: 'bg-slate-100 text-slate-700',
    Contacted: 'bg-blue-50 text-blue-800',
    'Follow up': 'bg-amber-50 text-amber-900',
    Won: 'bg-emerald-50 text-emerald-800',
  }
  return (
    <div className="rounded-xl border border-zinc-200 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.18)] overflow-hidden bg-white">
      <div className="flex h-[360px] sm:h-[400px]">
        <div className="w-[52px] md:w-[168px] bg-ci-sidebar shrink-0 flex flex-col">
          <div className="p-3 border-b border-white/10 hidden md:block">
            <div className="flex items-center gap-2">
              <img src={BRAND_LOGO_ICON} alt="" className={`w-7 h-7 shrink-0 ${BRAND_LOGO_ICON_CLASS}`} />
              <span className="text-white text-xs font-bold">Connect Intel</span>
            </div>
          </div>
          <div className="p-2 space-y-0.5 flex-1 hidden md:block">
            {['Home', 'Pipeline', 'Calendar', 'Team'].map((item, i) => (
              <div
                key={item}
                className={`px-2 py-1.5 rounded text-xs font-medium ${i === 1 ? 'bg-white/15 text-white' : 'text-gray-400'}`}
              >
                {item}
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 flex flex-col min-w-0 bg-ci-surface">
          <div className="h-11 bg-white border-b border-zinc-200 flex items-center px-4 gap-2">
            <span className="text-sm font-semibold text-ci-dark">Pipeline</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#fff4ee] text-[#FF773D] font-semibold border border-[#ffd4b8]">
              ⌘K search
            </span>
          </div>
          <div className="flex-1 bg-white overflow-hidden p-2">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-zinc-500 font-semibold uppercase text-[10px]">
                  <th className="py-1 pl-1">Lead</th>
                  <th className="py-1 hidden sm:table-cell">Company</th>
                  <th className="py-1 text-right">Stage</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name} className="border-t border-zinc-50">
                    <td className="py-2 pl-1 font-medium text-zinc-900">{r.name}</td>
                    <td className="py-2 text-zinc-600 hidden sm:table-cell">{r.company}</td>
                    <td className="py-2 text-right">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${stageStyle[r.stage]}`}>
                        {r.stage}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
