/**
 * Global commerce visual — product map asset in a dark intelligence frame.
 */

import { useLandingReveal } from '../../hooks/useLandingReveal'

const LEGEND = [
  { color: '#FF773D', label: 'Exporters' },
  { color: '#60a5fa', label: 'Importers' },
  { color: '#34d399', label: 'Distributors' },
  { color: '#fbbf24', label: 'Opportunities' },
]

export default function WorldTradeMap() {
  const [ref, visible] = useLandingReveal({ threshold: 0.2, rootMargin: '0px 0px -10% 0px' })

  return (
    <div ref={ref} className={`ci-v3-map-visual ${visible ? 'is-visible' : ''}`}>
      <div className="ci-v3-map-canvas">
        <img
          src="/global-commerce-map.png"
          alt="World map showing global trade routes between exporters, importers, and distributors"
          className="ci-v3-map-image"
          width={512}
          height={512}
          loading="lazy"
          decoding="async"
        />
        <ul className="ci-v3-map-legend" aria-label="Trade intelligence legend">
          {LEGEND.map((item) => (
            <li key={item.label} className="ci-v3-map-legend-item">
              <span className="ci-v3-map-legend-dot" style={{ background: item.color }} aria-hidden />
              {item.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
