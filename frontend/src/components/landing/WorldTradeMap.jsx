/**
 * Animated world trade map — global business intelligence visual.
 * SVG continents + animated routes (CSS-driven, reduced-motion safe).
 */

import { useLandingReveal } from '../../hooks/useLandingReveal'

const HUBS = [
  { id: 'india', label: 'India', x: 702, y: 208, color: '#FF773D' },
  { id: 'eu', label: 'EU', x: 518, y: 148, color: '#60a5fa' },
  { id: 'us', label: 'US', x: 268, y: 168, color: '#34d399' },
  { id: 'uae', label: 'UAE', x: 648, y: 198, color: '#fbbf24' },
]

const ROUTES = [
  { from: 'india', to: 'eu', color: '#FF773D' },
  { from: 'india', to: 'us', color: '#60a5fa' },
  { from: 'india', to: 'uae', color: '#fbbf24' },
  { from: 'uae', to: 'eu', color: '#34d399', dashed: true },
]

function hubById(id) {
  return HUBS.find((h) => h.id === id)
}

function routePath(from, to) {
  const a = hubById(from)
  const b = hubById(to)
  if (!a || !b) return ''
  const mx = (a.x + b.x) / 2
  const my = Math.min(a.y, b.y) - 55
  return `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`
}

export default function WorldTradeMap() {
  const [ref, visible] = useLandingReveal({ threshold: 0.2 })

  return (
    <div
      ref={ref}
      className={`ci-v3-worldmap rounded-2xl overflow-hidden border border-zinc-700/50 shadow-2xl ${visible ? 'is-visible' : ''}`}
      role="img"
      aria-label="Animated world map showing trade routes between India, EU, US, and UAE"
    >
      <svg viewBox="0 0 1000 450" className="w-full h-auto block" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="ci-ocean" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0b1220" />
            <stop offset="50%" stopColor="#111827" />
            <stop offset="100%" stopColor="#0c1526" />
          </linearGradient>
          <radialGradient id="ci-glow-india" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FF773D" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#FF773D" stopOpacity="0" />
          </radialGradient>
          <filter id="ci-map-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect width="1000" height="450" fill="url(#ci-ocean)" />

        {/* Graticule */}
        <g stroke="#1e293b" strokeWidth="0.5" opacity="0.6">
          {[125, 250, 375, 500, 625, 750, 875].map((x) => (
            <line key={`v${x}`} x1={x} y1="0" x2={x} y2="450" />
          ))}
          {[90, 180, 270, 360].map((y) => (
            <line key={`h${y}`} x1="0" y1={y} x2="1000" y2={y} />
          ))}
        </g>

        {/* Continents — simplified Natural Earth–style silhouettes */}
        <g className="ci-v3-continents" fill="#334155" stroke="#475569" strokeWidth="0.6">
          {/* North America */}
          <path d="M 98 95 L 118 72 155 68 198 82 228 108 245 145 238 185 220 220 195 255 168 278 145 295 128 320 115 350 95 365 78 340 72 300 68 260 62 220 58 180 55 140 68 110 Z" />
          {/* South America */}
          <path d="M 195 295 L 215 285 235 300 248 330 252 365 245 400 228 420 210 405 198 375 188 340 185 315 Z" />
          {/* Europe */}
          <path d="M 468 108 L 495 95 520 98 545 108 558 125 552 148 535 162 512 168 488 162 472 148 465 128 Z" />
          {/* Africa */}
          <path d="M 488 168 L 515 162 540 175 555 200 562 240 558 285 545 325 525 355 505 375 488 365 478 335 472 295 468 255 465 215 472 185 Z" />
          {/* Asia */}
          <path d="M 558 108 L 600 95 650 88 710 92 760 105 800 125 830 148 845 175 838 205 815 228 780 242 740 248 700 245 665 235 635 218 610 195 585 175 565 155 552 135 Z" />
          {/* Southeast Asia / Indonesia */}
          <path d="M 720 248 L 745 242 768 252 778 268 770 282 752 288 732 280 718 265 Z" />
          {/* Australia */}
          <path d="M 785 315 L 820 308 855 315 875 332 868 352 845 362 818 358 795 342 782 325 Z" />
        </g>

        {/* India glow */}
        <ellipse cx="702" cy="208" rx="48" ry="36" fill="url(#ci-glow-india)" className="ci-v3-hub-glow" />

        {/* Trade routes */}
        <g fill="none" filter="url(#ci-map-glow)">
          {ROUTES.map((route, i) => {
            const d = routePath(route.from, route.to)
            return (
              <path
                key={`${route.from}-${route.to}`}
                d={d}
                stroke={route.color}
                strokeWidth="2.5"
                strokeLinecap="round"
                className="ci-v3-world-route"
                style={{ animationDelay: `${i * 0.35}s` }}
                strokeDasharray={route.dashed ? '6 5' : undefined}
                opacity="0.9"
              />
            )
          })}
        </g>

        {/* Hub markers */}
        {HUBS.map((hub) => (
          <g key={hub.id} className="ci-v3-world-hub">
            <circle cx={hub.x} cy={hub.y} r="14" fill={hub.color} opacity="0.18" className="ci-v3-hub-ring" />
            <circle cx={hub.x} cy={hub.y} r="5" fill={hub.color} stroke="#fff" strokeWidth="1.5" />
            <text
              x={hub.x}
              y={hub.y + 22}
              fill="#f4f4f5"
              fontSize="11"
              fontWeight="600"
              textAnchor="middle"
              className="ci-v3-map-label"
            >
              {hub.label}
            </text>
          </g>
        ))}
      </svg>

      <div className="ci-v3-worldmap-legend">
        {[
          { label: 'Exporters', color: '#FF773D' },
          { label: 'Importers', color: '#60a5fa' },
          { label: 'Distributors', color: '#34d399' },
          { label: 'Opportunities', color: '#fbbf24' },
        ].map((item) => (
          <span key={item.label} className="inline-flex items-center gap-1.5">
            <span className="ci-v3-legend-dot" style={{ background: item.color }} aria-hidden />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  )
}
