/**
 * "See ConnectIntel in action" — simulated workflow demo (no API).
 */

import { useLandingReveal } from '../../hooks/useLandingReveal'
import { useStepIndex, useTypewriter } from '../../hooks/useLandingMotion'
import { LIVE_DEMO_QUERY, LIVE_DEMO_STEPS } from '../../lib/landingContent'

export default function LandingLiveDemo() {
  const [ref, visible] = useLandingReveal({ threshold: 0.2, rootMargin: '0px 0px -10% 0px' })
  const typed = useTypewriter(LIVE_DEMO_QUERY, { active: visible, speed: 32 })
  const queryDone = typed.length >= LIVE_DEMO_QUERY.length
  const stepIndex = useStepIndex(LIVE_DEMO_STEPS, { active: visible && queryDone, interval: 1100 })

  return (
    <section id="demo" className="ci-v3-section ci-v3-surface px-4 sm:px-6" aria-labelledby="demo-title">
      <div className="max-w-[1000px] mx-auto">
        <header className="text-center max-w-2xl mx-auto mb-10">
          <p className="ci-v3-section-label mb-3">Interactive preview</p>
          <h2 id="demo-title" className="ci-v3-section-heading ci-v3-on-light">
            See Connect Intel in action
          </h2>
          <p className="ci-v3-section-desc ci-v3-desc-light mt-4 mx-auto">
            Watch the workspace research companies, enrich records, and prepare outreach — without leaving CRM.
          </p>
        </header>

        <div ref={ref} className="ci-v3-demo rounded-2xl border border-zinc-200 bg-white shadow-xl overflow-hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-zinc-100 bg-zinc-50 flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">Copilot query</span>
          </div>
          <div className="px-4 sm:px-5 py-4 border-b border-zinc-100 h-[4.5rem] flex items-center">
            <p className="text-sm sm:text-base text-zinc-900 font-medium w-full">
              {typed}
              {!queryDone ? <span className="ci-v3-cursor" aria-hidden /> : null}
            </p>
          </div>
          <ol className="p-4 sm:p-5 space-y-2 h-[280px] overflow-hidden ci-v3-stable-scroll" aria-live="polite">
            {LIVE_DEMO_STEPS.map((step, i) =>
              i <= stepIndex ? (
                <li key={step} className="flex items-center gap-3 text-sm text-zinc-800">
                  <span className="w-6 h-6 rounded-full bg-zinc-100 border border-zinc-200 text-[10px] font-bold flex items-center justify-center text-zinc-700 shrink-0">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ) : null,
            )}
          </ol>
        </div>
      </div>
    </section>
  )
}
