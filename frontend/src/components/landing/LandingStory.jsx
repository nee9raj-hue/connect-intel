/**
 * Website 3.0 — product story sections (presentation-first, no chapter labels).
 */

import { useLandingReveal } from '../../hooks/useLandingReveal'
import { useCountUp, useStepCycle } from '../../hooks/useLandingMotion'
import {
  AI_INSIGHT_COPY,
  ANALYTICS_COUNTERS,
  COPILOT_CONVERSATION,
  ENTERPRISE_ARCH,
  PIPELINE_SEQUENCE,
  PRODUCT_STORY,
  SECURITY_PILLARS,
  STORY_HERO,
  SUCCESS_METRICS,
} from '../../lib/landingContent'
import LandingProductUI from './LandingProductUI'
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

function SectionHeader({ label, title, desc, align = 'left', light = false }) {
  const centered = align === 'center'
  return (
    <header className={centered ? 'text-center mx-auto max-w-3xl' : 'max-w-xl'}>
      {label ? <p className="ci-v3-section-label mb-3">{label}</p> : null}
      <h2 className={`ci-v3-section-heading ${light ? 'ci-v3-on-light' : ''}`}>{title}</h2>
      {desc ? <p className={`ci-v3-section-desc mt-4 ${centered ? 'mx-auto' : ''}`}>{desc}</p> : null}
    </header>
  )
}

export function HeroSection({ onLaunch, onSignIn }) {
  return (
    <section className="ci-v3-hero ci-v3-hero-mesh relative pt-24 pb-16 lg:pb-24 px-4 sm:px-6 overflow-hidden" aria-label="Hero">
      <div className="max-w-[1200px] mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <div>
          <Reveal>
            <p className="ci-v3-section-label mb-6">Enterprise AI Sales Intelligence</p>
            <h1 className="space-y-1 mb-6">
              {STORY_HERO.lines.map((line) => (
                <span key={line} className="block ci-v3-hero-line">
                  {line}
                </span>
              ))}
            </h1>
            <p className="ci-v3-hero-tagline">{STORY_HERO.tagline}</p>
          </Reveal>
          <Reveal delay={1} className="mt-8 flex flex-col sm:flex-row gap-3">
            <button type="button" onClick={onLaunch} className="ci-btn-primary px-7 py-3.5 text-sm min-h-[48px]">
              Launch your workspace
            </button>
            <a href="#demo" className="ci-btn-secondary px-7 py-3.5 text-sm min-h-[48px] inline-flex items-center justify-center">
              See it in action
            </a>
          </Reveal>
          <Reveal delay={2} className="mt-4">
            <button type="button" onClick={onSignIn} className="text-sm font-semibold text-zinc-600 hover:text-zinc-900">
              Sign in to existing workspace →
            </button>
          </Reveal>
        </div>
        <Reveal delay={1}>
          <LandingProductUI />
        </Reveal>
      </div>
    </section>
  )
}

export function ProductStorySection() {
  return (
    <section id="platform" className="ci-v3-section ci-v3-surface px-4 sm:px-6">
      <div className="max-w-[1100px] mx-auto">
        <Reveal className="mb-12 text-center">
          <SectionHeader
            align="center"
            label="How it works"
            title="One story — from discovery to closed deal"
            desc="Not a feature list. The workflow your sales team runs every day."
          />
        </Reveal>
        <ol className="space-y-4">
          {PRODUCT_STORY.map((step, i) => (
            <Reveal key={step.title} delay={(i % 3) + 1}>
              <li className="ci-v3-story-step flex gap-4 lg:gap-6 items-start">
                <span className="ci-v3-story-num shrink-0">{i + 1}</span>
                <div className="flex-1 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
                  <h3 className="font-bold text-zinc-900 mb-1">{step.title}</h3>
                  <p className="text-sm text-zinc-600 leading-relaxed">{step.desc}</p>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  )
}

export function CopilotSection() {
  const [ref, visible] = useLandingReveal({ threshold: 0.2 })
  const { visibleSteps } = useStepCycle(COPILOT_CONVERSATION, { active: visible, interval: 1300 })

  return (
    <section id="copilot" className="ci-v3-section ci-v3-panel-dark px-4 sm:px-6" aria-labelledby="copilot-title">
      <div className="max-w-[1100px] mx-auto grid lg:grid-cols-2 gap-12 items-start">
        <Reveal>
          <SectionHeader
            label="AI Copilot"
            title="Your AI sales partner — not a chatbot"
            desc="Watch Copilot search CRM, research companies, find decision makers, and draft outreach in one thread."
          />
        </Reveal>

        <div ref={ref} className="ci-v3-conversation rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6 min-h-[360px]">
          <div className="space-y-3" id="copilot-title">
            {visibleSteps.map((msg, i) => (
              <div
                key={`${msg.role}-${i}`}
                className={`ci-v3-bubble ${msg.role === 'user' ? 'ci-v3-bubble-user' : 'ci-v3-bubble-ai'}`}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide mb-1 opacity-70">
                  {msg.role === 'user' ? 'You' : 'Connect Copilot'}
                </p>
                <p className="text-sm leading-relaxed">{msg.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export function PipelineSection() {
  const [ref, visible] = useLandingReveal()
  const { index } = useStepCycle(PIPELINE_SEQUENCE, { active: visible, interval: 1500 })

  return (
    <section id="crm" className="ci-v3-section px-4 sm:px-6">
      <div className="max-w-[1100px] mx-auto grid lg:grid-cols-2 gap-12 items-center">
        <Reveal>
          <SectionHeader
            label="CRM Intelligence"
            title="Pipeline that moves while your team sells"
            desc="Leads progress, owners assign, emails log, meetings book — visible in real CRM UI."
          />
        </Reveal>
        <div ref={ref}>
          <LandingProductUI autoTab="pipeline" className="mb-6" />
          <ol className="space-y-2">
            {PIPELINE_SEQUENCE.map((step, i) => (
              <li
                key={step}
                className={`ci-v3-pipe-step text-sm flex items-center gap-3 ${i <= index ? 'is-done' : ''}`}
              >
                <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold shrink-0">
                  {i <= index ? '✓' : i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

export function CompanyIntelSection() {
  return (
    <section className="ci-v3-section ci-v3-surface px-4 sm:px-6">
      <div className="max-w-[1100px] mx-auto grid lg:grid-cols-2 gap-12 items-center">
        <Reveal>
          <SectionHeader
            label="Company intelligence"
            title="Every record enriched — not empty fields"
            desc="Website, markets, decision makers, and CRM status on one lead workspace."
          />
        </Reveal>
        <Reveal delay={1}>
          <LandingProductUI autoTab="company" />
        </Reveal>
      </div>
    </section>
  )
}

export function MarketIntelSection() {
  return (
    <section id="market" className="ci-v3-section px-4 sm:px-6">
      <div className="max-w-[1100px] mx-auto">
        <Reveal className="mb-10 text-center">
          <SectionHeader
            align="center"
            label="Market Intelligence"
            title="Global commerce — visualized"
            desc="Hover trade hubs to see exporters, importers, and AI-ranked opportunities."
          />
        </Reveal>
        <Reveal delay={1}>
          <WorldTradeMap />
        </Reveal>
      </div>
    </section>
  )
}

export function AnalyticsSection() {
  const [ref, visible] = useLandingReveal({ threshold: 0.1 })
  const bars = [28, 42, 38, 55, 48, 72, 65, 80]

  return (
    <section id="analytics" ref={ref} className={`ci-v3-section ci-v3-surface px-4 sm:px-6 ${visible ? 'is-visible' : ''}`}>
      <div className="max-w-[1100px] mx-auto grid lg:grid-cols-2 gap-12 items-start">
        <div>
          <Reveal className="mb-8">
            <SectionHeader
              light
              label="Sales Analytics"
              title="Dashboards that feel alive"
              desc="Counters climb, bars grow, and AI surfaces what changed — not static marketing numbers."
            />
          </Reveal>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {ANALYTICS_COUNTERS.map((m) => (
              <AnalyticsCounter key={m.label} metric={m} active={visible} />
            ))}
          </div>
          <Reveal>
            <p className="ci-v3-ai-chip text-sm">{AI_INSIGHT_COPY}</p>
          </Reveal>
        </div>
        <div>
          <LandingProductUI autoTab="analytics" className="mb-4" />
          <div className="ci-v3-analytics-live rounded-xl border border-zinc-200 bg-white p-5">
            <p className="text-xs text-zinc-500 mb-3">Pipeline velocity · animated</p>
            <div className="flex items-end gap-2 h-28">
              {bars.map((h, i) => (
                <div key={i} className="flex-1 flex flex-col justify-end h-full">
                  <div
                    className="ci-v3-bar-live w-full rounded-t bg-zinc-800"
                    style={{ height: `${h}%`, animationDelay: `${i * 0.07}s` }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function AnalyticsCounter({ metric, active }) {
  const val = useCountUp(metric.end, { active, duration: 2000, decimals: metric.decimals })
  const display = `${metric.prefix}${metric.decimals ? Number(val).toFixed(metric.decimals) : val}${metric.suffix}`
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 text-center shadow-sm">
      <p className="text-2xl font-bold text-zinc-900 tabular-nums">{display}</p>
      <p className="text-xs text-zinc-500 mt-1">{metric.label}</p>
    </div>
  )
}

export function EnterpriseArchSection() {
  return (
    <section id="enterprise" className="ci-v3-section px-4 sm:px-6">
      <div className="max-w-[1100px] mx-auto">
        <Reveal className="mb-12 text-center">
          <SectionHeader
            align="center"
            label="Enterprise"
            title="Architecture built for security review"
            desc="Multi-tenant isolation, RBAC, audit, and scale — without a separate enterprise SKU."
          />
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {ENTERPRISE_ARCH.map((tile, i) => (
            <Reveal key={tile.title} delay={(i % 4) + 1}>
              <div className="ci-v3-arch-tile rounded-xl border border-zinc-200 bg-white p-5 h-full shadow-sm">
                <h3 className="font-semibold text-zinc-900 text-sm mb-1">{tile.title}</h3>
                <p className="text-xs text-zinc-600 leading-relaxed">{tile.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

export function SecuritySection() {
  const [ref, visible] = useLandingReveal()

  return (
    <section className="ci-v3-section ci-v3-security-light px-4 sm:px-6" aria-labelledby="security-title">
      <div className="max-w-[1000px] mx-auto">
        <Reveal className="mb-10 text-center">
          <SectionHeader
            align="center"
            light
            label="Enterprise Security"
            title="Clarity — not just darkness"
            desc="Encryption, isolation, permissions, and audit — presented for evaluation teams."
          />
        </Reveal>
        <div ref={ref} className={`grid sm:grid-cols-2 lg:grid-cols-3 gap-4 ${visible ? 'is-visible' : ''}`} id="security-title">
          {SECURITY_PILLARS.map((item, i) => (
            <div key={item.title} className="ci-v3-glass-card p-5" style={{ animationDelay: `${i * 0.08}s` }}>
              <span className="text-base" aria-hidden>
                🔒
              </span>
              <h3 className="font-semibold text-zinc-900 text-sm mt-3 mb-1">{item.title}</h3>
              <p className="text-xs text-zinc-600 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function SuccessMetricsSection() {
  return (
    <section id="metrics" className="ci-v3-section border-y border-zinc-100 px-4 sm:px-6">
      <div className="max-w-[1000px] mx-auto text-center">
        <Reveal className="mb-10">
          <SectionHeader
            align="center"
            light
            label="Production proof"
            title="Real metrics — not marketing claims"
            desc="Gates and architecture signals from the live platform."
          />
        </Reveal>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {SUCCESS_METRICS.map((m, i) => (
            <Reveal key={m.label} delay={i + 1}>
              <div className="rounded-xl border border-zinc-200 bg-white py-6 px-4 shadow-sm">
                <p className="text-2xl font-bold text-zinc-950">{m.value}</p>
                <p className="text-xs text-zinc-500 mt-2 font-medium leading-snug">{m.label}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

export function FinalCtaSection({ onLaunch, demoHref }) {
  return (
    <section id="start" className="ci-v3-section px-4 sm:px-6">
      <div className="max-w-xl mx-auto text-center">
        <Reveal>
          <h2 className="ci-v3-section-heading ci-v3-on-light text-center mb-4">Start your AI sales platform</h2>
          <p className="ci-v3-section-desc text-center mb-8">
            Launch a secure workspace in minutes — or book an enterprise demo for your evaluation team.
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
