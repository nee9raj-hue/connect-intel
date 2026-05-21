import { useApp } from '../context/AppContext'
import GoogleSignIn, { GoogleSignInCompact } from '../components/auth/GoogleSignIn'

const STATS = [
  { value: '2.4M+', label: 'Searchable contacts' },
  { value: '94%', label: 'Email accuracy' },
  { value: '25', label: 'Free searches / mo' },
]

const FEATURES = [
  {
    title: 'People search',
    desc: 'Filter by title, location, industry, and company size. Build lists in seconds.',
  },
  {
    title: 'AI lead scoring',
    desc: 'AI ranks prospects so your team focuses on the highest-intent leads first.',
  },
  {
    title: 'Contact enrichment',
    desc: 'Verified emails, direct dials, and company data — export to CSV anytime.',
  },
  {
    title: 'Pipeline & lists',
    desc: 'Save prospects, track outreach, and sync to your CRM when integrations go live.',
  },
]

export default function LandingPage() {
  const { setScreen } = useApp()

  return (
    <div className="min-h-screen bg-white">
      <nav className="fixed top-0 inset-x-0 z-50 h-[60px] border-b border-gray-200/80 bg-white">
        <div className="max-w-[1200px] mx-auto h-full px-6 flex items-center justify-between">
          <Logo />
          <div className="hidden md:flex items-center gap-7 text-[13px] font-medium text-gray-600">
            <a href="#product" className="hover:text-gray-900 transition-colors">
              Product
            </a>
            <a href="#features" className="hover:text-gray-900 transition-colors">
              Features
            </a>
            <a href="#pricing" className="hover:text-gray-900 transition-colors">
              Pricing
            </a>
          </div>
          <div className="flex items-center gap-2">
            <GoogleSignInCompact />
            <button
              onClick={() => setScreen('auth')}
              className="hidden sm:inline-flex px-4 py-2 text-[13px] font-semibold text-gray-700 hover:text-gray-900"
            >
              Log in
            </button>
            <button
              onClick={() => setScreen('auth')}
              className="px-4 py-2 text-[13px] font-bold bg-ci-yellow text-ci-dark rounded-md hover:bg-ci-yellow-hover transition-colors"
            >
              Get started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-[100px] pb-20 px-6 overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[#fafafa]" aria-hidden />
        <div
          className="absolute inset-0 -z-10 opacity-[0.35]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, #d4d4d4 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
          aria-hidden
        />
        <div
          className="absolute top-16 left-1/2 -translate-x-1/2 w-[min(100%,720px)] h-[380px] -z-10 rounded-full bg-[#ffcb2b]/12 blur-[90px]"
          aria-hidden
        />
        <div className="max-w-[800px] mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-gray-200 shadow-sm mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[12px] font-semibold text-gray-600">
              AI prospecting · India & global B2B
            </span>
          </div>

          <h1 className="font-display text-[2.5rem] sm:text-[3rem] md:text-[3.5rem] font-bold text-[#0f0f0f] tracking-[-0.03em] leading-[1.1] mb-6">
            Find the right leads.
            <br />
            Close deals <span className="text-[#b8860b]">faster</span>.
          </h1>

          <p className="text-lg md:text-xl text-gray-600 leading-relaxed mb-4 max-w-[580px] mx-auto">
            Connect Intel is the workspace where marketing and sales teams search prospects,
            score opportunities with AI, and grow pipeline—without juggling multiple tools.
          </p>
          <p className="text-sm text-gray-500 mb-10 max-w-[500px] mx-auto leading-relaxed">
            Filter by role, industry, and state. Save lists and export in one click.
            Enterprise data partners and CRM sync when you scale.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-5">
            <button
              type="button"
              onClick={() => setScreen('auth')}
              className="w-full sm:w-auto px-8 py-3.5 bg-[#0f0f0f] text-white text-[15px] font-semibold rounded-lg hover:bg-[#2a2a2a] transition-colors shadow-lg shadow-black/10"
            >
              Start free — 25 searches
            </button>
            <a
              href="#product"
              className="w-full sm:w-auto px-8 py-3.5 bg-white text-[#0f0f0f] text-[15px] font-semibold rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              See how it works
            </a>
          </div>

          <div className="max-w-[400px] mx-auto">
            <GoogleSignIn text="signup_with" theme="outline" />
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Sign in with Google · No credit card · Live in 2 minutes
          </p>
        </div>

        {/* Stats */}
        <div className="max-w-[900px] mx-auto mt-16 grid grid-cols-3 gap-4 md:gap-6">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="text-center py-5 px-4 rounded-xl bg-white/90 border border-gray-100 shadow-sm"
            >
              <div className="text-2xl md:text-3xl font-bold text-[#0f0f0f] tracking-tight">{s.value}</div>
              <div className="text-xs text-gray-500 mt-1.5 font-medium">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Product preview */}
        <div id="product" className="max-w-[1100px] mx-auto mt-16">
          <ProductPreview />
        </div>
      </section>

      {/* Logos strip */}
      <section className="py-10 border-y border-gray-100 bg-white">
        <p className="text-center text-[11px] font-semibold text-gray-400 uppercase tracking-[0.2em] mb-6">
          Integrates with your go-to-market stack
        </p>
        <div className="flex flex-wrap justify-center items-center gap-x-10 gap-y-4 px-6 max-w-4xl mx-auto opacity-70">
          {['Salesforce', 'HubSpot', 'Google', 'Microsoft', 'LinkedIn', 'Slack'].map((name) => (
            <span key={name} className="text-sm font-bold text-gray-400 tracking-tight">
              {name}
            </span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-[1100px] mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-ci-dark mb-3">
            Everything to prospect and connect
          </h2>
          <p className="text-center text-gray-600 mb-12 max-w-lg mx-auto text-[15px]">
            Professional search, filters, and list tools built for teams who live in their pipeline.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className="p-6 rounded-lg border border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="w-8 h-8 rounded-md bg-ci-yellow/30 flex items-center justify-center text-sm font-bold text-ci-dark mb-4">
                  {i + 1}
                </div>
                <h3 className="font-semibold text-ci-dark mb-2 text-[15px]">{f.title}</h3>
                <p className="text-[13px] text-gray-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="pricing" className="py-20 px-6 bg-ci-nav text-white">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Start free today</h2>
          <p className="text-gray-400 mb-8 text-[15px]">25 searches per month on the free plan. Upgrade when you scale.</p>
          <div className="max-w-[320px] mx-auto">
            <GoogleSignIn text="signup_with" theme="filled_blue" />
          </div>
        </div>
      </section>

      <footer className="py-8 px-6 border-t border-gray-200 text-center text-[13px] text-gray-500">
        © {new Date().getFullYear()} Connect Intel
      </footer>
    </div>
  )
}

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-md bg-ci-nav flex items-center justify-center">
        <span className="text-ci-yellow font-bold text-xs">CI</span>
      </div>
      <span className="font-display font-bold text-ci-dark text-[15px]">Connect Intel</span>
    </div>
  )
}

function ProductPreview() {
  const rows = [
    { name: 'Sarah Chen', title: 'VP Marketing', company: 'TechFlow', email: 'verified', score: 92 },
    { name: 'Marcus Webb', title: 'Head of Growth', company: 'ScaleUp Labs', email: 'verified', score: 88 },
    { name: 'Priya Sharma', title: 'Director of Sales', company: 'CloudNine', email: 'likely', score: 85 },
    { name: 'James Okonkwo', title: 'CMO', company: 'BrightPath', email: 'verified', score: 79 },
  ]

  return (
    <div className="rounded-lg border border-gray-200 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] overflow-hidden bg-white">
      {/* App chrome */}
      <div className="flex h-[420px]">
        {/* Sidebar */}
        <div className="w-[52px] md:w-[200px] bg-ci-sidebar shrink-0 flex flex-col">
          <div className="p-3 border-b border-white/10 hidden md:block">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-ci-yellow flex items-center justify-center text-[10px] font-bold text-ci-dark">
                CI
              </div>
              <span className="text-white text-xs font-bold">Connect Intel</span>
            </div>
          </div>
          <div className="p-2 space-y-0.5 flex-1">
            {['Overview', 'People', 'Saved', 'Integrations'].map((item, i) => (
              <div
                key={item}
                className={`px-2 py-1.5 rounded text-[11px] font-medium hidden md:block ${
                  i === 1 ? 'bg-white/15 text-white' : 'text-gray-500'
                }`}
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0 bg-ci-surface">
          <div className="h-11 bg-white border-b border-gray-200 flex items-center px-4 gap-3">
            <span className="text-sm font-semibold text-ci-dark">People</span>
            <span className="text-xs text-gray-400">· 2,847 total</span>
            <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded bg-ci-yellow/40 text-ci-dark">
              Net new 2,410
            </span>
          </div>

          <div className="flex flex-1 min-h-0">
            {/* Filters */}
            <div className="w-[140px] md:w-[180px] bg-white border-r border-gray-200 p-3 hidden sm:block shrink-0">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                Filters
              </div>
              {['VP Marketing', 'San Francisco', 'Software', '51-200'].map((f) => (
                <div
                  key={f}
                  className="text-[10px] px-2 py-1 mb-1 rounded bg-gray-100 text-gray-700 font-medium truncate"
                >
                  {f}
                </div>
              ))}
              <div className="mt-3 py-1.5 bg-ci-yellow rounded text-[10px] font-bold text-center text-ci-dark">
                Search
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 bg-white overflow-hidden">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80 text-gray-500 font-semibold uppercase tracking-wide">
                    <th className="py-2 pl-3 w-6" />
                    <th className="py-2 pr-2">Name</th>
                    <th className="py-2 pr-2 hidden md:table-cell">Title</th>
                    <th className="py-2 pr-2">Company</th>
                    <th className="py-2 pr-3 text-right">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.name} className="border-b border-gray-50 hover:bg-amber-50/30">
                      <td className="py-2.5 pl-3">
                        <div className="w-3.5 h-3.5 border border-gray-300 rounded" />
                      </td>
                      <td className="py-2.5 pr-2 font-medium text-gray-900">{r.name}</td>
                      <td className="py-2.5 pr-2 text-gray-600 hidden md:table-cell">{r.title}</td>
                      <td className="py-2.5 pr-2 text-gray-600">{r.company}</td>
                      <td className="py-2.5 pr-3 text-right">
                        <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-green-100 text-green-800 font-bold text-[10px]">
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
    </div>
  )
}
