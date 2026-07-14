import { useState } from 'react'
import { useApp } from '../context/AppContext'
import LandingLiveDemo from '../components/landing/LandingLiveDemo'
import {
  AnalyticsSection,
  CompanyIntelSection,
  CopilotSection,
  EnterpriseArchSection,
  FinalCtaSection,
  HeroSection,
  MarketIntelSection,
  PipelineSection,
  ProductStorySection,
  SecuritySection,
  SuccessMetricsSection,
} from '../components/landing/LandingStory'
import {
  BRAND_LOGO_HERO,
  BRAND_LOGO_ICON_CLASS,
} from '../lib/brandAssets'
import { BUSINESS_PLAN, FREE_PLAN, GROWTH_PLAN, STARTER_PLAN } from '../lib/crmPlanLimits'
import { DEMO_MAILTO, FAQ_ITEMS, INDUSTRIES } from '../lib/landingContent'
import '../styles/landing-v3.css'

const NAV_LINKS = [
  { href: '#platform', label: 'Platform' },
  { href: '#copilot', label: 'AI Copilot' },
  { href: '#crm', label: 'CRM' },
  { href: '#market', label: 'Market Intelligence' },
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
          <nav className="hidden lg:flex items-center gap-5 text-sm font-medium text-zinc-600" aria-label="Primary">
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
        <ProductStorySection />
        <LandingLiveDemo />
        <CopilotSection />
        <MarketIntelSection />
        <PipelineSection />
        <CompanyIntelSection />
        <AnalyticsSection />
        <EnterpriseArchSection />
        <SecuritySection />

        <section className="py-12 px-4 sm:px-6 ci-v3-surface border-y border-zinc-100">
          <div className="max-w-[1000px] mx-auto text-center">
            <p className="ci-v3-section-label mb-3">Industries</p>
            <h2 className="ci-v3-section-heading ci-v3-on-light text-center mb-3">Built for global B2B commerce</h2>
            <p className="ci-v3-section-desc ci-v3-desc-light text-center mx-auto mb-6 max-w-lg">
              Exporters, manufacturers, distributors, and trading teams selling across borders.
            </p>
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

        <section id="pricing" className="py-16 px-4 sm:px-6">
          <div className="max-w-[1100px] mx-auto text-center">
            <h2 className="ci-v3-section-heading ci-v3-on-light mb-3">Start free. Scale when pipeline grows.</h2>
            <p className="ci-v3-section-desc text-center mb-3">
              No card at signup. Flat workspace pricing — not billed per seat.
            </p>
            <p className="text-sm text-zinc-600 mb-10 max-w-2xl mx-auto leading-relaxed">
              Priced below typical Zoho, HubSpot, and Salesforce per-user plans for the same team size.
              Confirm any upgrade in Workspace; payment is collected separately.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 text-left">
              <PricingCard
                tier="Free"
                price={FREE_PLAN.priceDisplay}
                sub="1 user · try the CRM"
                features={[
                  `${FREE_PLAN.maxSeats} seat`,
                  `${FREE_PLAN.maxLeads} pipeline leads`,
                  'Full CRM workspace',
                  'CSV import & Chrome extension',
                ]}
              />
              <PricingCard
                tier={STARTER_PLAN.label}
                price={STARTER_PLAN.priceDisplay}
                sub="small sales pod"
                period="/month"
                features={[
                  `Up to ${STARTER_PLAN.maxSeats} seats`,
                  `Up to ${STARTER_PLAN.maxLeads.toLocaleString('en-IN')} leads`,
                  'Team invites & roles',
                  'Admin-confirmed upgrade',
                ]}
              />
              <PricingCard
                tier={GROWTH_PLAN.label}
                price={GROWTH_PLAN.priceDisplay}
                sub="most teams"
                period="/month"
                highlight
                badge="Popular"
                features={[
                  `Up to ${GROWTH_PLAN.maxSeats} seats`,
                  `Up to ${GROWTH_PLAN.maxLeads.toLocaleString('en-IN')} leads`,
                  'Pipeline + team intelligence',
                  'Amount shown before payment',
                ]}
              />
              <PricingCard
                tier={BUSINESS_PLAN.label}
                price={BUSINESS_PLAN.priceDisplay}
                sub="larger orgs"
                period="/month"
                features={[
                  `Up to ${BUSINESS_PLAN.maxSeats} seats`,
                  `Up to ${BUSINESS_PLAN.maxLeads.toLocaleString('en-IN')} leads`,
                  'Highest published capacity',
                  'Same CRM features, more room',
                ]}
              />
            </div>
          </div>
        </section>

        <section id="faq" className="py-16 px-4 sm:px-6 ci-v3-surface">
          <div className="max-w-[720px] mx-auto">
            <h2 className="ci-v3-section-heading ci-v3-on-light text-center mb-8">Evaluation questions</h2>
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
              Enterprise AI sales intelligence — CRM, copilot, and market intelligence in one workspace.
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

function PricingCard({ tier, price, sub, period, features, highlight, badge }) {
  return (
    <div className={`rounded-2xl p-6 relative ${highlight ? 'border-2 border-[#FF773D]/40 bg-white shadow-sm' : 'border border-zinc-200 bg-white'}`}>
      {badge ? (
        <span className="absolute -top-2.5 right-4 px-2 py-0.5 rounded-full bg-[#FF773D] text-white text-[10px] font-bold uppercase tracking-wide">
          {badge}
        </span>
      ) : null}
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
    <a href="/" className="flex items-center shrink-0 py-1" aria-label="Connect Intel home">
      <img
        src={BRAND_LOGO_HERO}
        alt=""
        width={56}
        height={56}
        className={`h-12 w-12 sm:h-14 sm:w-14 rounded-xl ${BRAND_LOGO_ICON_CLASS}`}
      />
    </a>
  )
}
