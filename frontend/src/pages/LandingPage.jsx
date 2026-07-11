import { useState } from 'react'
import { useApp } from '../context/AppContext'
import {
  AnalyticsSection,
  AutomationSection,
  CompanyIntelSection,
  CopilotSection,
  DayWithCiSection,
  EnterpriseArchSection,
  FinalCtaSection,
  HeroSection,
  MarketIntelSection,
  PipelineSection,
  RealitySection,
  SecuritySection,
  SuccessMetricsSection,
} from '../components/landing/LandingStory'
import {
  BRAND_LOGO_HERO,
  BRAND_LOGO_ICON_CLASS,
} from '../lib/brandAssets'
import { FREE_PLAN, GROWTH_PLAN } from '../lib/crmPlanLimits'
import { DEMO_MAILTO, FAQ_ITEMS, INDUSTRIES } from '../lib/landingContent'
import '../styles/landing-v3.css'

const NAV_LINKS = [
  { href: '#story', label: 'Story' },
  { href: '#copilot', label: 'Copilot' },
  { href: '#pipeline', label: 'Pipeline' },
  { href: '#enterprise', label: 'Enterprise' },
  { href: '#pricing', label: 'Pricing' },
]

export default function LandingPage() {
  const { setScreen } = useApp()
  const launch = () => setScreen('auth')
  const signIn = () => setScreen('auth')

  return (
    <div className="ci-v3 min-h-screen bg-white text-[#0a0a0b]">
      <header className="ci-v3-nav fixed top-0 inset-x-0 z-50">
        <div className="max-w-[1200px] mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-3">
          <Logo />
          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-zinc-600" aria-label="Primary">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="hover:text-zinc-900 transition-colors">
                {link.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={signIn} className="hidden sm:inline-flex px-3 py-2 text-sm font-semibold text-zinc-700 hover:text-zinc-900">
              Sign in
            </button>
            <a href={DEMO_MAILTO} className="hidden md:inline-flex px-3 py-2 text-sm font-semibold text-zinc-700 hover:text-zinc-900">
              Book demo
            </a>
            <button type="button" onClick={launch} className="ci-btn-accent px-4 py-2 text-sm">
              Launch workspace
            </button>
          </div>
        </div>
      </header>

      <main>
        <HeroSection onLaunch={launch} onSignIn={signIn} />
        <RealitySection />
        <CopilotSection />
        <PipelineSection />
        <CompanyIntelSection />
        <MarketIntelSection />
        <AutomationSection />
        <EnterpriseArchSection />
        <AnalyticsSection />
        <DayWithCiSection />

        <section className="py-12 px-4 sm:px-6 border-y border-zinc-100 bg-zinc-50">
          <div className="max-w-[1000px] mx-auto text-center">
            <p className="text-xs font-bold uppercase tracking-wider text-[#FF773D] mb-3">Industries</p>
            <h2 className="font-display text-2xl font-bold text-zinc-950 mb-6">Built for global B2B commerce</h2>
            <div className="flex flex-wrap justify-center gap-2">
              {INDUSTRIES.map((name) => (
                <span key={name} className="px-3 py-1.5 rounded-full border border-zinc-200 bg-white text-sm font-medium text-zinc-700">
                  {name}
                </span>
              ))}
            </div>
          </div>
        </section>

        <SuccessMetricsSection />
        <SecuritySection />

        <section id="pricing" className="py-16 px-4 sm:px-6">
          <div className="max-w-[900px] mx-auto text-center">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-zinc-900 mb-3">Start free. Scale when pipeline grows.</h2>
            <p className="text-zinc-600 mb-10">No card at signup. Transparent upgrade when your admin confirms capacity.</p>
            <div className="grid md:grid-cols-2 gap-6 text-left">
              <PricingCard
                tier="Free workspace"
                price={FREE_PLAN.priceDisplay}
                sub="for early teams"
                features={[`Up to ${FREE_PLAN.maxSeats} seats`, `Up to ${FREE_PLAN.maxLeads} pipeline leads`, 'Full CRM + AI copilot', 'Chrome extension email sync']}
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

        <section id="faq" className="py-16 px-4 sm:px-6 bg-zinc-50">
          <div className="max-w-[720px] mx-auto">
            <h2 className="font-display text-2xl font-bold text-center text-zinc-900 mb-8">Evaluation questions</h2>
            <div className="space-y-3">
              {FAQ_ITEMS.map((item) => (
                <FaqItem key={item.q} question={item.q} answer={item.a} />
              ))}
            </div>
          </div>
        </section>

        <FinalCtaSection onLaunch={launch} demoHref={DEMO_MAILTO} />
      </main>

      <footer className="py-12 px-4 sm:px-6 border-t border-zinc-200">
        <div className="max-w-[1100px] mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div>
            <Logo />
            <p className="text-sm text-zinc-500 mt-3 max-w-sm leading-relaxed">
              Enterprise AI sales intelligence — not another CRM template.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-4 text-sm text-zinc-600">
            <button type="button" onClick={signIn} className="hover:text-zinc-900 font-medium">
              Sign in
            </button>
            <a href={DEMO_MAILTO} className="hover:text-zinc-900 font-medium">
              Book enterprise demo
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

function PricingCard({ tier, price, sub, period, features, highlight }) {
  return (
    <div className={`rounded-2xl p-6 ${highlight ? 'border-2 border-[#FF773D]/40 bg-white shadow-sm' : 'border border-zinc-200 bg-white'}`}>
      <p className={`text-xs font-bold uppercase tracking-wide mb-2 ${highlight ? 'text-[#FF773D]' : 'text-zinc-500'}`}>{tier}</p>
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
    <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
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
      {open ? <div className="px-5 pb-4 text-sm text-zinc-600 leading-relaxed border-t border-zinc-100 pt-3">{answer}</div> : null}
    </div>
  )
}

function Logo() {
  return (
    <a href="/" className="flex items-center shrink-0" aria-label="Connect Intel home">
      <img src={BRAND_LOGO_HERO} alt="" width={48} height={48} className={`h-10 w-10 sm:h-11 sm:w-11 rounded-lg ${BRAND_LOGO_ICON_CLASS}`} />
    </a>
  )
}
