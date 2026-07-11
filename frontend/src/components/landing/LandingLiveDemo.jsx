/**
 * "See ConnectIntel in action" — simulated workflow demo (no API).
 */

import { useLandingReveal } from '../../hooks/useLandingReveal'
import { useStepCycle, useTypewriter } from '../../hooks/useLandingMotion'
import { LIVE_DEMO_QUERY, LIVE_DEMO_STEPS } from '../../lib/landingContent'

export default function LandingLiveDemo() {
  const [ref, visible] = useLandingReveal({ threshold: 0.15 })
  const typed = useTypewriter(LIVE_DEMO_QUERY, { active: visible, speed: 32 })
  const { visibleSteps } = useStepCycle(LIVE_DEMO_STEPS, { active: visible && typed.length === LIVE_DEMO_QUERY.length, interval: 1100 })

  return (
    <section id="demo" className="ci-v3-section ci-v3-surface px-4 sm:px-6" aria-labelledby="demo-title">
      <div className="max-w-[1000px] mx-auto">
        <header className="text-center max-w-2xl mx-auto mb-10">
          <p className="ci-v3-section-label mb-3">Interactive preview</p>
          <h2 id="demo-title" className="ci-v3-section-heading">
            See Connect Intel in action
          </h2>
          <p className="ci-v3-section-desc mt-4">
            Watch the workspace research companies, enrich records, and prepare outreach — without leaving CRM.
          </p>
        </header>

        <div ref={ref} className="ci-v3-demo rounded-2xl border border-zinc-200 bg-white shadow-xl overflow-hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-zinc-100 bg-zinc-50 flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Copilot query</span>
          </div>
          <div className="px-4 sm:px-5 py-4 border-b border-zinc-100">
            <p className="text-sm sm:text-base text-zinc-800 font-medium min-h-[1.5em]">
              {typed}
              <span className="ci-v3-cursor" aria-hidden />
            </p>
          </div>
          <ol className="p-4 sm:p-5 space-y-2 min-h-[220px]" aria-live="polite">
            {visibleSteps.map((step, i) => (
              <li
                key={step}
                className="ci-v3-demo-step flex items-center gap-3 text-sm text-zinc-700"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <span className="w-6 h-6 rounded-full bg-zinc-100 border border-zinc-200 text-[10px] font-bold flex items-center justify-center text-zinc-600 shrink-0">
                  {i + 1}
                </span>
                <span>{step}</span>
                {i === visibleSteps.length - 1 && visibleSteps.length < LIVE_DEMO_STEPS.length ? (
                  <span className="ci-v3-pulse-dot w-1.5 h-1.5 rounded-full bg-[#FF773D] ml-1" />
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
