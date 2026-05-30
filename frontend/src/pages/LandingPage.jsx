import { useApp } from '../context/AppContext'
import { GoogleSignInCompact } from '../components/auth/GoogleSignIn'
import HeroAuthCta from '../components/landing/HeroAuthCta'
import GoogleSignIn from '../components/auth/GoogleSignIn'
import {
  CrmPipelineMini,
  EmailCrmFlow,
  FollowUpTimeline,
  IndiaLeadMapVisual,
  ManagerDashboardPreview,
  RevenueLeakInfographic,
  WhatsAppOneClick,
} from '../components/landing/LandingVisuals'
import {
  BRAND_LOGO_ICON,
  BRAND_LOGO_ICON_CLASS,
  BRAND_LOGO_HERO,
  BRAND_LOGO_HERO_MARK,
  BRAND_LOGO_MARK_CLASS,
} from '../lib/brandAssets'

const PILLARS = [
  {
    id: 'leads',
    title: 'AI lead search across India',
    desc: 'Discover verified exporters, manufacturers, and B2B buyers by state, industry, and role. Our AI models surface high-intent prospects—not random lists.',
    tag: 'Discovery',
  },
  {
    id: 'email',
    title: 'AI email that sounds like you',
    desc: 'Tell Connect Intel your agenda; AI drafts convincing outreach in your company voice. Connect your official email so every send is logged in CRM automatically.',
    tag: 'Outreach',
  },
  {
    id: 'followup',
    title: 'Never miss a follow-up',
    desc: 'Reminders 30 minutes before every meeting or call. Browser alerts keep reps on time—managers see the full activity trail.',
    tag: 'Reminders',
  },
  {
    id: 'whatsapp',
    title: 'WhatsApp in one click',
    desc: 'AI drafts follow-ups; open WhatsApp from desktop or phone with pre-filled text. Log every touch so nothing falls through the cracks.',
    tag: 'WhatsApp',
  },
  {
    id: 'team',
    title: 'Team & customer records',
    desc: 'Import your pipeline, add leads manually, assign owners, and run productive sales calls with full context on screen.',
    tag: 'CRM',
  },
  {
    id: 'managers',
    title: 'Dashboards for managers',
    desc: 'See how each rep is performing, who needs coaching, and where deals stall—so leadership helps the team win customers.',
    tag: 'Admin',
  },
]

export default function LandingPage() {
  const { setScreen } = useApp()

  return (
    <div className="min-h-screen bg-white">
      <nav className="fixed top-0 inset-x-0 z-50 h-[60px] border-b border-gray-200/80 bg-white/95 backdrop-blur-sm">
        <div className="max-w-[1200px] mx-auto h-full px-6 flex items-center justify-between">
          <Logo />
          <div className="hidden lg:flex items-center gap-6 text-sm font-medium text-gray-600">
            <a href="#problem" className="hover:text-gray-900 transition-colors">
              Why CRM
            </a>
            <a href="#product" className="hover:text-gray-900 transition-colors">
              Product
            </a>
            <a href="#features" className="hover:text-gray-900 transition-colors">
              Features
            </a>
            <a href="#managers" className="hover:text-gray-900 transition-colors">
              For managers
            </a>
            <a href="#start" className="hover:text-gray-900 transition-colors">
              Get started
            </a>
          </div>
          <div className="flex items-center gap-2">
            <GoogleSignInCompact />
            <button
              type="button"
              onClick={() => setScreen('auth')}
              className="hidden sm:inline-flex px-4 py-2 text-sm font-semibold text-gray-700 hover:text-gray-900"
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
        <div className="max-w-[880px] mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-gray-200 shadow-sm mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF773D]/50 opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF773D]" />
            </span>
            <span className="text-xs font-semibold text-gray-600">
              CRM + AI prospecting built for Indian B2B teams
            </span>
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

          <h1 className="font-display text-[2.25rem] sm:text-[3rem] md:text-[3.35rem] font-bold text-[#0f0f0f] tracking-[-0.03em] leading-[1.08] mb-6">
            Never lose a prospect
            <br />
            in the <span className="text-[#FF773D]">follow-up gap</span>
          </h1>

          <p className="text-lg md:text-xl text-gray-600 leading-relaxed mb-4 max-w-[640px] mx-auto">
            Companies lose revenue when potential buyers go quiet—not because the product failed, but because
            nobody followed up on time. Connect Intel keeps your team, customers, and pipeline in one place so
            every call and message moves deals forward.
          </p>
          <p className="text-sm text-gray-500 mb-10 max-w-[560px] mx-auto leading-relaxed">
            Search high-quality leads across India with AI · Write emails from your official inbox · WhatsApp
            follow-ups in one click · Reminders 30 minutes before every meeting.
          </p>

          <HeroAuthCta />
        </div>

        <div className="max-w-[1000px] mx-auto mt-14 grid md:grid-cols-3 gap-4">
          <StatCard value="30 min" label="Reminder before every meeting & call" />
          <StatCard value="1-click" label="WhatsApp with AI-drafted follow-ups" />
          <StatCard value="100%" label="Outreach logged when email is connected" />
        </div>
      </section>

      {/* Problem */}
      <section id="problem" className="py-16 px-6 bg-gray-50 border-y border-gray-100">
        <div className="max-w-[1100px] mx-auto grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-gray-900 mb-4">
              Revenue walks out when follow-ups slip
            </h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Your team finds great prospects—but spreadsheets, personal inboxes, and scattered WhatsApp chats
              mean managers cannot see who was contacted, who replied, or who needs help today.
            </p>
            <ul className="space-y-3 text-sm text-gray-700">
              {[
                'Missed callbacks and forgotten meeting prep',
                'No single record of team ↔ customer conversations',
                'Reps rewriting the same emails from scratch',
                'Leadership blind to pipeline health until month-end',
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-red-500 shrink-0">✕</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <RevenueLeakInfographic />
        </div>
      </section>

      {/* Product preview */}
      <section id="product" className="py-20 px-6">
        <div className="max-w-[1100px] mx-auto">
          <div className="text-center mb-10">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-gray-900 mb-3">
              One workspace: search, CRM, outreach
            </h2>
            <p className="text-gray-600 max-w-xl mx-auto">
              From AI lead discovery to closed-won—your official email and WhatsApp stay connected to every deal.
            </p>
          </div>
          <div className="grid lg:grid-cols-5 gap-6 items-start">
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

      {/* India leads */}
      <section className="py-16 px-6 bg-[#fafafa]">
        <div className="max-w-[1100px] mx-auto grid lg:grid-cols-2 gap-8 items-center">
          <IndiaLeadMapVisual />
          <div>
            <h2 className="font-display text-2xl font-bold text-gray-900 mb-3">
              Use our AI to find high-quality leads across India
            </h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Connect Intel combines your imported data with AI discovery to surface
              exporters, buyers, and decision-makers with email and phone when available.
            </p>
            <p className="text-sm text-gray-500">
              Filter by keywords, state, city, and industry—then save to pipeline, assign to reps, and start
              outreach without exporting to five different tools.
            </p>
          </div>
        </div>
      </section>

      {/* Email + CRM */}
      <section className="py-16 px-6">
        <div className="max-w-[1100px] mx-auto">
          <div className="text-center mb-10">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-gray-900 mb-3">
              Convincing emails, written by AI—sent from you
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Your team describes the agenda; Connect Intel drafts professional outreach in your company name.
              Connect official email domains to CRM and enjoy a complete record of every message.
            </p>
          </div>
          <EmailCrmFlow />
        </div>
      </section>

      {/* WhatsApp */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-[1100px] mx-auto">
          <WhatsAppOneClick />
          <p className="text-xs text-gray-400 text-center mt-4 max-w-lg mx-auto">
            *Results vary by team discipline; structured follow-ups and timed reminders improve reply and meeting
            rates for most B2B sales teams.
          </p>
        </div>
      </section>

      {/* Features grid */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-[1100px] mx-auto">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-center text-ci-dark mb-3">
            Everything your revenue team needs
          </h2>
          <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
            Built for exporters, manufacturers, and B2B sellers who live on follow-ups—not just lead lists.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {PILLARS.map((f) => (
              <article
                key={f.id}
                id={f.id}
                className="p-6 rounded-xl border border-gray-200 bg-white hover:border-[#FF773D]/50 hover:shadow-md transition-all"
              >
                <span className="text-xs font-bold uppercase tracking-wider text-[#b8860b]">{f.tag}</span>
                <h3 className="font-semibold text-gray-900 mt-2 mb-2 text-[15px]">{f.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{f.desc}</p>
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
            <h2 className="font-display text-2xl md:text-3xl font-bold mb-4">
              See how your team is working—and where to help them win
            </h2>
            <p className="text-gray-400 leading-relaxed mb-6">
              Complete visibility: pipeline by stage, activity log across leads, calendar of upcoming calls, and
              who has not followed up. Transfer leads, assign tasks, and coach with data—not guesswork.
            </p>
            <ul className="space-y-2 text-sm text-gray-300">
              {[
                'Company-wide pipeline & role-based columns',
                'Bulk email with AI per lead',
                'Import CSV or add leads one-by-one',
                'Outbound email DNS setup from the panel',
              ].map((item) => (
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
      <section className="py-16 px-6">
        <div className="max-w-[900px] mx-auto">
          <h2 className="font-display text-2xl font-bold text-center mb-10">How teams get started</h2>
          <div className="grid sm:grid-cols-4 gap-4">
            {[
              { step: '1', title: 'Sign up', sub: 'Company or solo workspace' },
              { step: '2', title: 'Import pipeline', sub: 'CSV or manual add' },
              { step: '3', title: 'Connect email', sub: 'Official domain sending' },
              { step: '4', title: 'Follow up', sub: 'Email, WhatsApp, reminders' },
            ].map((s) => (
              <div key={s.step} className="text-center p-4 rounded-xl bg-gray-50 border border-gray-100">
                <div className="w-10 h-10 mx-auto rounded-full bg-ci-yellow text-ci-dark font-bold flex items-center justify-center mb-2">
                  {s.step}
                </div>
                <p className="font-semibold text-sm">{s.title}</p>
                <p className="text-xs text-gray-500 mt-1">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="start" className="py-20 px-6 bg-gradient-to-b from-amber-50 to-white border-t border-amber-100">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-gray-900 mb-3">
            Stop losing prospects. Start following up on time.
          </h2>
          <p className="text-gray-600 mb-8">
            Join teams using Connect Intel to search India B2B leads, run CRM, and close with AI-powered outreach.
          </p>
          <div className="max-w-[420px] mx-auto">
            <button
              type="button"
              onClick={() => setScreen('auth')}
              className="w-full min-h-[48px] py-3.5 mb-4 bg-[#0f0f0f] text-white font-semibold rounded-lg hover:bg-[#2a2a2a]"
            >
              Create free account
            </button>
            <GoogleSignIn text="signup_with" theme="outline" layout="block" />
          </div>
        </div>
      </section>

      <footer className="py-10 px-6 border-t border-gray-200 bg-white">
        <div className="max-w-[1100px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <Logo />
          <p>© {new Date().getFullYear()} Connect Intel · B2B CRM & AI prospecting for India</p>
          <a href="https://connectintel.net/privacy.html" className="hover:text-gray-800">
            Privacy
          </a>
        </div>
      </footer>
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
    <div className="text-center py-5 px-4 rounded-xl bg-white border border-gray-100 shadow-sm">
      <div className="text-2xl md:text-3xl font-bold text-[#0f0f0f] tracking-tight">{value}</div>
      <div className="text-xs text-gray-500 mt-1.5 font-medium leading-snug">{label}</div>
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
    { name: 'Priya Sharma', title: 'Export Director', company: 'Rajasthan Handicrafts', score: 94 },
    { name: 'Amit Patel', title: 'VP Sales', company: 'Gujarat Textiles', score: 91 },
    { name: 'Lakshmi Iyer', title: 'Procurement', company: 'Chennai Spices Co', score: 88 },
    { name: 'Rahul Mehta', title: 'Founder', company: 'Mumbai Organics', score: 85 },
  ]

  return (
    <div className="rounded-xl border border-gray-200 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.12)] overflow-hidden bg-white">
      <div className="flex h-[380px]">
        <div className="w-[52px] md:w-[168px] bg-ci-sidebar shrink-0 flex flex-col">
          <div className="p-3 border-b border-white/10 hidden md:block">
            <div className="flex items-center gap-2">
              <img
                src={BRAND_LOGO_ICON}
                alt=""
                className={`w-7 h-7 shrink-0 ${BRAND_LOGO_ICON_CLASS}`}
              />
              <span className="text-white text-xs font-bold">Connect Intel</span>
            </div>
          </div>
          <div className="p-2 space-y-0.5 flex-1 hidden md:block">
            {['Pipeline', 'People search', 'Activity log', 'Calendar', 'Team'].map((item, i) => (
              <div
                key={item}
                className={`px-2 py-1.5 rounded text-xs font-medium ${
                  i === 0 ? 'bg-white/15 text-white' : 'text-gray-500'
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
                <tr className="text-gray-500 font-semibold uppercase text-xs">
                  <th className="py-1 pl-1">Lead</th>
                  <th className="py-1 hidden sm:table-cell">Company</th>
                  <th className="py-1 text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name} className="border-t border-gray-50">
                    <td className="py-2 pl-1 font-medium text-gray-900">{r.name}</td>
                    <td className="py-2 text-gray-600 hidden sm:table-cell">{r.company}</td>
                    <td className="py-2 text-right">
                      <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-[#fff4ee] text-[#FF773D] font-bold text-xs">
                        {r.score}
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
