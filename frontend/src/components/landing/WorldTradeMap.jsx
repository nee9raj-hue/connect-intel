/**
 * Premium flat world trade map — SVG equirectangular with animated routes.
 * Fixed layout heights to prevent page jitter.
 */

import { useState } from 'react'
import { useLandingReveal } from '../../hooks/useLandingReveal'

const W = 1000
const H = 500

const HUBS = [
  {
    id: 'india',
    label: 'India',
    x: 698,
    y: 268,
    color: '#FF773D',
    card: {
      company: 'ABC Exports',
      detail: 'Exporting to USA',
      shipments: 12,
      dm: 'Decision maker found',
      confidence: 96,
    },
  },
  {
    id: 'us',
    label: 'USA',
    x: 248,
    y: 218,
    color: '#34d399',
    card: {
      company: 'Pacific Distributors',
      detail: 'Importing textiles',
      shipments: 8,
      dm: 'VP Procurement',
      confidence: 91,
    },
  },
  {
    id: 'eu',
    label: 'Germany',
    x: 512,
    y: 178,
    color: '#60a5fa',
    card: {
      company: 'Rhein Trading GmbH',
      detail: 'EU buyer · handicrafts',
      shipments: 15,
      dm: 'Head of Sourcing',
      confidence: 94,
    },
  },
  {
    id: 'uae',
    label: 'UAE',
    x: 612,
    y: 252,
    color: '#fbbf24',
    card: {
      company: 'Gulf Merchants',
      detail: 'Re-export hub',
      shipments: 6,
      dm: 'Import manager',
      confidence: 88,
    },
  },
  {
    id: 'sg',
    label: 'Singapore',
    x: 768,
    y: 298,
    color: '#a78bfa',
    card: {
      company: 'ASEAN Logistics',
      detail: 'Freight forwarding',
      shipments: 9,
      dm: 'Ops director',
      confidence: 90,
    },
  },
  {
    id: 'au',
    label: 'Australia',
    x: 848,
    y: 368,
    color: '#2dd4bf',
    card: {
      company: 'Southern Imports',
      detail: 'Spices & organics',
      shipments: 4,
      dm: 'Category lead',
      confidence: 87,
    },
  },
]

const ROUTES = [
  { from: 'india', to: 'us', color: '#FF773D' },
  { from: 'india', to: 'eu', color: '#60a5fa' },
  { from: 'india', to: 'uae', color: '#fbbf24' },
  { from: 'uae', to: 'eu', color: '#34d399' },
  { from: 'india', to: 'sg', color: '#a78bfa' },
  { from: 'sg', to: 'au', color: '#2dd4bf' },
]

function hub(id) {
  return HUBS.find((h) => h.id === id)
}

function arcPath(fromId, toId) {
  const a = hub(fromId)
  const b = hub(toId)
  if (!a || !b) return ''
  const mx = (a.x + b.x) / 2
  const my = Math.min(a.y, b.y) - 80
  return `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`
}

export default function WorldTradeMap() {
  const [ref, visible] = useLandingReveal({ threshold: 0.2, rootMargin: '0px 0px -10% 0px' })
  const [hovered, setHovered] = useState('india')
  const active = hub(hovered) || HUBS[0]

  return (
    <div ref={ref} className={`ci-v3-map-wrap ${visible ? 'is-visible' : ''}`}>
      <div className="ci-v3-map-canvas">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" role="img" aria-label="World trade map">
          <defs>
            <linearGradient id="ci-map-ocean" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#0f172a" />
              <stop offset="100%" stopColor="#0c1222" />
            </linearGradient>
            <filter id="ci-route-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <rect width={W} height={H} fill="url(#ci-map-ocean)" rx="16" />

          {/* Graticule */}
          <g stroke="#1e293b" strokeWidth="0.6" opacity="0.5">
            {Array.from({ length: 9 }, (_, i) => (i + 1) * 100).map((x) => (
              <line key={`v${x}`} x1={x} y1={0} x2={x} y2={H} />
            ))}
            {Array.from({ length: 5 }, (_, i) => (i + 1) * 80).map((y) => (
              <line key={`h${y}`} x1={0} y1={y} x2={W} y2={y} />
            ))}
          </g>

          {/* Continents */}
          <g fill="#334155" stroke="#475569" strokeWidth="0.8" opacity="0.95">
            <path d="M120,95 C165,72 230,68 295,88 C355,108 395,145 410,195 C420,245 395,295 350,330 C300,365 235,375 175,355 C115,335 85,285 80,230 C75,175 90,120 120,95 Z" />
            <path d="M195,310 C225,295 255,305 275,335 C290,365 285,400 255,420 C225,435 195,425 180,395 C168,365 175,330 195,310 Z" />
            <path d="M455,105 C505,88 555,92 595,115 C630,138 645,175 635,215 C620,255 580,280 535,288 C490,295 450,275 430,240 C415,205 425,130 455,105 Z" />
            <path d="M470,175 C510,165 545,180 565,215 C580,250 575,295 550,335 C525,370 490,385 465,370 C440,355 430,315 440,275 C448,235 455,190 470,175 Z" />
            <path d="M545,105 C625,88 710,95 790,125 C860,155 910,195 925,245 C935,295 905,345 845,375 C775,405 690,415 610,400 C530,385 480,345 465,290 C455,235 485,125 545,105 Z" />
            <path d="M720,255 C748,248 772,258 782,278 C790,298 782,318 762,328 C742,338 722,330 712,310 C705,290 710,268 720,255 Z" />
            <path d="M795,315 C835,305 872,315 895,338 C912,358 905,382 882,395 C858,408 828,402 808,385 C788,368 780,338 795,315 Z" />
            <path d="M468,155 C498,148 522,158 535,178 C545,198 538,218 518,228 C498,238 478,230 472,210 C468,190 472,165 468,155 Z" />
          </g>

          {/* Trade routes */}
          <g fill="none" filter="url(#ci-route-glow)">
            {ROUTES.map((r, i) => (
              <path
                key={`${r.from}-${r.to}`}
                d={arcPath(r.from, r.to)}
                stroke={r.color}
                strokeWidth="2"
                strokeLinecap="round"
                className="ci-v3-map-route"
                style={{ animationDelay: `${i * 0.25}s` }}
                opacity="0.85"
              />
            ))}
          </g>

          {/* Hubs */}
          {HUBS.map((c) => (
            <g
              key={c.id}
              className={`ci-v3-map-hub ${hovered === c.id ? 'is-active' : ''}`}
              onMouseEnter={() => setHovered(c.id)}
              style={{ cursor: 'pointer' }}
            >
              <circle cx={c.x} cy={c.y} r="10" fill={c.color} opacity="0.2" className="ci-v3-map-hub-ring" />
              <circle cx={c.x} cy={c.y} r="4.5" fill={c.color} stroke="#fff" strokeWidth="1.5" />
              <text x={c.x} y={c.y + 18} fill="#e4e4e7" fontSize="11" fontWeight="600" textAnchor="middle">
                {c.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="ci-v3-map-card">
        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-2">Market intelligence</p>
        <h3 className="text-lg font-bold text-zinc-900 mb-1">{active.card.company}</h3>
        <p className="text-sm text-zinc-700 mb-3">{active.card.detail}</p>
        <dl className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <dt className="text-zinc-600">Shipments</dt>
            <dd className="font-semibold text-zinc-900">{active.card.shipments}</dd>
          </div>
          <div>
            <dt className="text-zinc-600">AI confidence</dt>
            <dd className="font-semibold text-[#FF773D]">{active.card.confidence}%</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-zinc-700 flex items-center gap-2 min-h-[1.25rem]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          {active.card.dm}
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-medium text-zinc-700">
          {['Exporters', 'Importers', 'HS codes', 'AI discovery'].map((tag) => (
            <span key={tag} className="px-2 py-1 rounded-full bg-zinc-100 border border-zinc-200">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
