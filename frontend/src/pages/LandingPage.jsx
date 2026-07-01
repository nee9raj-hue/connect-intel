import { useState } from 'react'
import { useApp } from '../context/AppContext'
import HeroAuthCta from '../components/landing/HeroAuthCta'
import {
  BeforeAfterCompare,
  CrmPipelineMini,
  FollowUpTimeline,
  ImportPipelineVisual,
  ManagerDashboardPreview,
  RevenueLeakInfographic,
  WhatsAppOneClick,
  WorkEmailFlow,
} from '../components/landing/LandingVisuals'
import {
  BRAND_LOGO_ICON,
  BRAND_LOGO_ICON_CLASS,
  BRAND_LOGO_HERO,
  BRAND_LOGO_HERO_MARK,
  BRAND_LOGO_MARK_CLASS,
} from '../lib/brandAssets'
import { FREE_PLAN, GROWTH_PLAN } from '../lib/crmPlanLimits'
import {
  CRM_WINS,
  FAQ_ITEMS,
  GETTING_STARTED,
  LANDING_HERO,
  MANAGER_BULLETS,
  PAIN_POINTS,
  PILLARS,
  TRUST_SIGNALS,
  WHO_ITS_FOR,
  WORKFLOW_STEPS,
} from '../lib/landingContent'

const NAV_LINKS = [
  { href: '#audience', label: 'Who it’s for' },
  { href: '#problem', label: 'Why CRM' },
  { href: '#product', label: 'Product' },
  { href: '#workflow', label: 'How it works' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
]

export default function LandingPage() {
  const { setScreen } = useApp()

  return (
    <div className="min-h-screen bg-white">
      <nav className="fixed top-0 inset-x-0 z-50 h-[60px] border-b border-gray-200/80 bg-white/95 backdrop-blur-sm">
        <div className="max-w-[1200px] mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4">
          <Logo />
          <div className="hidden lg:flex items-center gap-5 text-sm font-medium text-gray-700">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="hover:text-gray-900 transition-colors">
                {link.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setScreen('auth')}
              className="hidden sm:inline-flex px-3 py-2 text-sm font-semibold text-gray-700 hover:text-gray-900"
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => setScreen('auth')}
              className="px-4 py-2 text-sm font-bold bg-ci-yellow text-ci-dark rounded-md hover:bg-ci-yellow-hover transition-colors"
            >
              Start free
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-[100px] pb-16 px-6 overflow-x-hidden">
        <HeroBackground />
        <div className="max-w-[900px] mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-gray-200 shadow-sm mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF773D]/50 opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF773D]" />
            </span>
            <span className="text-xs font-semibold text-gray-800">{LANDING_HERO.badge}</span>
          </div>

          <div className="flex justify-center mb-5 sm:mb-6 px-2">
            <img
              src={BRAND_LOGO_HERO_MARK}
              alt="Connect Intel — Intelligence Connected"
              width={280}
              height={56}
              decoding="async"
              className={`h-9 sm:h-10 md:h-11 w-auto max-w-[min(100%,17.5rem)] ${BRAND_LOGO_MARK_CLASS}`}
            />
          </div>

          <h1 className="font-display text-[2.1rem] sm:text-[2.85rem] md:text-[3.2rem] font-bold text-[#0f0f0f] tracking-[-0.03em] leading-[1.1] mb-5">
            Never lose a prospect in the <span className="text-[#FF773D]">follow-up gap</span>
          </h1>

          <p className="text-lg md:text-xl text-gray-800 leading-relaxed mb-6 max-w-[680px] mx-auto">
            {LANDING_HERO.subhead}
          </p>

          <ul className="text-sm text-gray-700 mb-10 max-w-[520px] mx-auto space-y-2 text-left sm:text-center sm:space-y-0 sm:flex sm:flex-wrap sm:justify-center sm:gap-x-4 sm:gap-y-2">
            {LANDING_HERO.bullets.map((b) => (
              <li key={b} className="flex sm:inline-flex items-center gap-1.5 justify-center">
                <span className="text-[#FF773D] font-bold">✓</span>
                {b}
              </li>
            ))}
          </ul>

          <HeroAuthCta />

          <p className="mt-5 text-sm text-gray-600">
            Already have a workspace?{' '}
            <button type="button" onClick={() => setScreen('auth')} className="font-semibold text-gray-900 underline-offset-2 hover:underline">
              Log in with your work email
            </button>
          </p>
        </div>

        <div className="max-w-[1000px] mx-auto mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {TRUST_SIGNALS.map((s) => (
            <StatCard key={s.label} value={s.label} label={s.detail} />
          ))}
        </div>
      </section>

      {/* Who it's for */}
      <section id="audience" className="py-16 px-6 bg-white border-y border-gray-100">
        <div className="max-w-[1100px] mx-auto">
          <SectionHeader
            eyebrow="Built for real sales teams"
            title="Who Connect Intel is for"
            desc="Whether you are a founder doing outbound or a manager running five reps—start free and grow into a shared company workspace."
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {WHO_ITS_FOR.map((persona) => (
              <article
                key={persona.id}
                className="p-5 rounded-xl border border-gray-200 bg-gray-50/50 hover:border-[#FF773D]/40 hover:bg-white transition-all"
              >
                <span className="text-2xl" aria-hidden>
                  {persona.icon}
                </span>
                <h3 className="font-semibold text-gray-900 mt-3 mb-1.5 text-[15px]">{persona.title}</h3>
                <p className="text-sm text-gray-700 leading-relaxed">{persona.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Problem */}
      <section id="problem" className="py-16 px-6 bg-gray-50">
        <div className="max-w-[1100px] mx-auto grid lg:grid-cols-2 gap-10 items-start">
          <div>
            <SectionHeader
              align="left"
              eyebrow="The follow-up gap"
              title="Revenue walks out when nobody owns the next step"
              desc="Indian B2B teams rarely fail on the first pitch. They fail when follow-ups live in personal inboxes, WhatsApp threads, and sheets nobody updates."
            />
            <div className="grid sm:grid-cols-2 gap-6 mt-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-red-600 mb-3">Sound familiar?</p>
                <ul className="space-y-2.5 text-sm text-gray-800">
                  {PAIN_POINTS.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="text-red-500 shrink-0">✕</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#FF773D] mb-3">What changes</p>
                <ul className="space-y-2.5 text-sm text-gray-800">
                  {CRM_WINS.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="text-[#FF773D] shrink-0">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <RevenueLeakInfographic />
            <BeforeAfterCompare />
          </div>
        </div>
      </section>

      {/* Product preview */}
      <section id="product" className="py-20 px-6">
        <div className="max-w-[1100px] mx-auto">
          <SectionHeader
            title="Your team pipeline—visible, assignable, actionable"
            desc="Open any lead to see stage, owner, notes, tasks, and meeting history. Admins see the company view; reps focus on what is assigned to them."
          />
          <div className="grid lg:grid-cols-5 gap-6 items-start mt-10">
            <div className="lg:col-span-3">
              <ProductPreview />
            </div>
            <div className="lg:col-span-2 space-y-4">
              <CrmPipelineMini />
              <FollowUpTimeline />
            </div>
          </div>
        </div>
      </section>

      {/* Import workflow */}
      <section className="py-16 px-6 bg-[#fafafa]">
        <div className="max-w-[1100px] mx-auto grid lg:grid-cols-2 gap-8 items-center">
          <ImportPipelineVisual />
          <div>
            <SectionHeader
              align="left"
              eyebrow="Start with your list"
              title="You do not need a new lead source on day one"
              desc="Most teams already have prospects—in Excel, from events, or partner referrals. Connect Intel is where that list becomes a managed pipeline."
            />
            <div className="mt-6 space-y-4">
              {WORKFLOW_STEPS.slice(0, 2).map((step) => (
                <WorkflowCard key={step.title} {...step} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Email optional */}
      <section className="py-16 px-6">
        <div className="max-w-[1100px] mx-auto">
          <SectionHeader
            title="Email when you are ready—not before"
            desc="Sign up with work email and password. Link work Gmail from settings later if you want send, receive, and logging inside the CRM."
          />
          <div className="mt-10">
            <WorkEmailFlow />
          </div>
        </div>
      </section>

      {/* WhatsApp */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-[1100px] mx-auto">
          <WhatsAppOneClick />
        </div>
      </section>

      {/* Features grid */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-[1100px] mx-auto">
          <SectionHeader
            title="Everything in your free workspace"
            desc="Core CRM capabilities included—no credits, no AI add-ons required to run pipeline and follow-ups."
          />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
            {PILLARS.map((f) => (
              <article
                key={f.id}
                className="p-6 rounded-xl border border-gray-200 bg-white hover:border-[#FF773D]/50 hover:shadow-md transition-all"
              >
                <span className="text-xs font-bold uppercase tracking-wider text-[#b8860b]">{f.tag}</span>
                <h3 className="font-semibold text-gray-900 mt-2 mb-2 text-[15px]">{f.title}</h3>
                <p className="text-sm text-gray-700 leading-relaxed">{f.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Managers */}
      <section id="managers" className="py-20 px-6 bg-[#0f0f0f] text-white">
        <div className="max-w-[1100px] mx-auto grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-300 mb-3">For managers & admins</p>
            <h2 className="font-display text-2xl md:text-3xl font-bold mb-4 text-white">
              Coach from data—not “did anyone call them?”
            </h2>
            <p className="text-gray-300 leading-relaxed mb-6">
              See pipeline by stage, who touched which lead, and which reps have overdue follow-ups. Assign leads,
              review activity, and keep one workspace per company domain.
            </p>
            <ul className="space-y-2 text-sm text-gray-200">
              {MANAGER_BULLETS.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-ci-yellow">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <ManagerDashboardPreview />
        </div>
      </section>

      {/* How it works */}
      <section id="workflow" className="py-16 px-6">
        <div className="max-w-[1000px] mx-auto">
          <SectionHeader title="Go live in an afternoon" desc="Four steps most new teams complete on day one." />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
            {GETTING_STARTED.map((s) => (
              <div key={s.step} className="text-left p-5 rounded-xl bg-gray-50 border border-gray-100">
                <div className="w-10 h-10 rounded-full bg-ci-yellow text-ci-dark font-bold flex items-center justify-center mb-3">
                  {s.step}
                </div>
                <p className="font-semibold text-sm text-gray-900">{s.title}</p>
                <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">{s.sub}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 grid md:grid-cols-2 gap-4">
            {WORKFLOW_STEPS.slice(2).map((step) => (
              <WorkflowCard key={step.title} {...step} />
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-16 px-6 bg-white border-y border-gray-100">
        <div className="max-w-[900px] mx-auto">
          <SectionHeader
            title="Start free. Upgrade when you grow."
            desc="No card at signup. When your team or pipeline outgrows the free tier, your admin confirms the upgrade and sees the monthly amount before payment is collected."
          />
          <div className="grid md:grid-cols-2 gap-6 mt-10">
            <PricingCard
              tier="Free CRM"
              price={FREE_PLAN.priceDisplay}
              sub="forever for small teams"
              features={[
                `Up to ${FREE_PLAN.maxSeats} team seats`,
                `Up to ${FREE_PLAN.maxLeads} pipeline leads`,
                'CSV import & manual entry',
                'Calendar reminders & team roles',
              ]}
            />
            <PricingCard
              tier="Team CRM"
              price={GROWTH_PLAN.priceDisplay}
              sub="when you need more capacity"
              period="/month"
              highlight
              features={[
                `Up to ${GROWTH_PLAN.maxSeats} team seats`,
                `Up to ${GROWTH_PLAN.maxLeads.toLocaleString('en-IN')} pipeline leads`,
                'Admin confirms upgrade in workspace settings',
                'Amount shown before payment is due',
              ]}
            />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-16 px-6 bg-gray-50">
        <div className="max-w-[720px] mx-auto">
          <SectionHeader title="Questions new teams ask" />
          <div className="mt-8 space-y-3">
            {FAQ_ITEMS.map((item) => (
              <FaqItem key={item.q} question={item.q} answer={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="start" className="py-20 px-6 bg-gradient-to-b from-amber-50 to-white border-t border-amber-100">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-gray-900 mb-3">
            Put your pipeline in one place this week
          </h2>
          <p className="text-gray-800 mb-8 leading-relaxed">
            Create a free workspace with your work email. Import leads, invite a teammate, and start following up on
            time—Gmail connect can wait until you need it.
          </p>
          <div className="max-w-[420px] mx-auto space-y-3">
            <button
              type="button"
              onClick={() => setScreen('auth')}
              className="w-full min-h-[48px] py-3.5 bg-[#0f0f0f] text-white font-semibold rounded-lg hover:bg-[#2a2a2a]"
            >
              Create free account
            </button>
            <button
              type="button"
              onClick={() => setScreen('auth')}
              className="w-full min-h-[44px] py-3 text-gray-800 font-semibold rounded-lg border border-gray-300 hover:bg-white"
            >
              Log in to existing workspace
            </button>
            <p className="text-xs text-gray-600">
              {FREE_PLAN.maxSeats} seats · {FREE_PLAN.maxLeads} leads · No card required
            </p>
          </div>
        </div>
      </section>

      <footer className="py-12 px-6 border-t border-gray-200 bg-white">
        <div className="max-w-[1100px] mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 mb-8">
            <div>
              <Logo />
              <p className="text-sm text-gray-600 mt-3 max-w-xs leading-relaxed">
                B2B CRM for Indian sales teams—pipeline, follow-ups, and team visibility in one workspace.
              </p>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-4 text-sm text-gray-700">
              <div>
                <p className="font-semibold text-gray-900 mb-2">Product</p>
                <ul className="space-y-1.5">
                  {NAV_LINKS.slice(0, 4).map((l) => (
                    <li key={l.href}>
                      <a href={l.href} className="hover:text-gray-900">
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-semibold text-gray-900 mb-2">Account</p>
                <ul className="space-y-1.5">
                  <li>
                    <button type="button" onClick={() => setScreen('auth')} className="hover:text-gray-900">
                      Sign up free
                    </button>
                  </li>
                  <li>
                    <button type="button" onClick={() => setScreen('auth')} className="hover:text-gray-900">
                      Log in
                    </button>
                  </li>
                  <li>
                    <a href="#pricing" className="hover:text-gray-900">
                      Pricing
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div className="pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-500">
            <p>© {new Date().getFullYear()} Connect Intel · B2B CRM for India</p>
            <a href="https://connectintel.net/privacy.html" className="hover:text-gray-800">
              Privacy
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

function SectionHeader({ eyebrow, title, desc, align = 'center' }) {
  const centered = align === 'center'
  return (
    <div className={centered ? 'text-center' : ''}>
      {eyebrow ? (
        <p className={`text-xs font-bold uppercase tracking-wider text-[#FF773D] mb-2 ${centered ? '' : ''}`}>
          {eyebrow}
        </p>
      ) : null}
      <h2 className={`font-display text-2xl md:text-3xl font-bold text-gray-900 mb-3 ${centered ? '' : ''}`}>
        {title}
      </h2>
      {desc ? (
        <p className={`text-gray-700 leading-relaxed max-w-2xl ${centered ? 'mx-auto' : ''}`}>{desc}</p>
      ) : null}
    </div>
  )
}

function WorkflowCard({ tag, title, desc }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <span className="text-[10px] font-bold uppercase tracking-wide text-[#FF773D]">{tag}</span>
      <p className="font-semibold text-gray-900 mt-1 text-sm">{title}</p>
      <p className="text-xs text-gray-600 mt-1 leading-relaxed">{desc}</p>
    </div>
  )
}

function PricingCard({ tier, price, sub, period, features, highlight }) {
  return (
    <div
      className={`rounded-2xl p-6 ${
        highlight
          ? 'border-2 border-[#FF773D]/40 bg-white shadow-sm'
          : 'border border-gray-200 bg-gray-50'
      }`}
    >
      <p className={`text-xs font-bold uppercase tracking-wide mb-2 ${highlight ? 'text-[#FF773D]' : 'text-gray-500'}`}>
        {tier}
      </p>
      <p className="text-3xl font-bold text-gray-900 mb-1">
        {price}
        {period ? <span className="text-base font-medium text-gray-600">{period}</span> : null}
      </p>
      <p className="text-sm text-gray-700 mb-5">{sub}</p>
      <ul className="space-y-2 text-sm text-gray-800">
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
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold text-gray-900 hover:bg-gray-50"
        aria-expanded={open}
      >
        {question}
        <span className="text-gray-400 text-lg shrink-0" aria-hidden>
          {open ? '−' : '+'}
        </span>
      </button>
      {open ? (
        <div className="px-5 pb-4 text-sm text-gray-700 leading-relaxed border-t border-gray-100 pt-3">{answer}</div>
      ) : null}
    </div>
  )
}

function HeroBackground() {
  return (
    <>
      <div className="absolute inset-0 -z-10 bg-[#fafafa] overflow-hidden pointer-events-none" aria-hidden />
      <div
        className="absolute inset-0 -z-10 opacity-[0.35] overflow-hidden pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, #d4d4d4 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }}
        aria-hidden
      />
      <div
        className="absolute top-16 left-1/2 -translate-x-1/2 w-[min(100%,720px)] h-[380px] -z-10 rounded-full bg-[#FF773D]/12 blur-[90px]"
        aria-hidden
      />
    </>
  )
}

function StatCard({ value, label }) {
  return (
    <div className="text-center py-4 px-3 rounded-xl bg-white border border-gray-100 shadow-sm">
      <div className="text-sm md:text-base font-bold text-[#0f0f0f] tracking-tight leading-snug">{value}</div>
      <div className="text-xs text-gray-600 mt-1 font-medium leading-snug">{label}</div>
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
    <div className="rounded-xl border border-gray-200 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.12)] overflow-hidden bg-white">
      <div className="flex h-[380px]">
        <div className="w-[52px] md:w-[168px] bg-ci-sidebar shrink-0 flex flex-col">
          <div className="p-3 border-b border-white/10 hidden md:block">
            <div className="flex items-center gap-2">
              <img src={BRAND_LOGO_ICON} alt="" className={`w-7 h-7 shrink-0 ${BRAND_LOGO_ICON_CLASS}`} />
              <span className="text-white text-xs font-bold">Connect Intel</span>
            </div>
          </div>
          <div className="p-2 space-y-0.5 flex-1 hidden md:block">
            {['Pipeline', 'Calendar', 'Team', 'Contacts'].map((item, i) => (
              <div
                key={item}
                className={`px-2 py-1.5 rounded text-xs font-medium ${
                  i === 0 ? 'bg-white/15 text-white' : 'text-gray-400'
                }`}
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0 bg-ci-surface">
          <div className="h-11 bg-white border-b border-gray-200 flex items-center px-4 gap-2">
            <span className="text-sm font-semibold text-ci-dark">Pipeline</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#fff4ee] text-[#FF773D] font-semibold border border-[#ffd4b8]">
              Follow-up in 28 min
            </span>
          </div>
          <div className="flex-1 bg-white overflow-hidden p-2">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-gray-600 font-semibold uppercase text-[10px]">
                  <th className="py-1 pl-1">Lead</th>
                  <th className="py-1 hidden sm:table-cell">Company</th>
                  <th className="py-1 text-right">Stage</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name} className="border-t border-gray-50">
                    <td className="py-2 pl-1 font-medium text-gray-900">{r.name}</td>
                    <td className="py-2 text-gray-600 hidden sm:table-cell">{r.company}</td>
                    <td className="py-2 text-right">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${stageStyle[r.stage]}`}
                      >
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
