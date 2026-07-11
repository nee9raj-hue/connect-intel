/**
 * Premium 3D globe — market intelligence wow moment.
 * CSS perspective sphere + animated trade pulses + hover intelligence cards.
 */

import { useState } from 'react'
import { useLandingReveal } from '../../hooks/useLandingReveal'

const CITIES = [
  {
    id: 'india',
    label: 'India',
    left: '62%',
    top: '46%',
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
    left: '22%',
    top: '42%',
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
    left: '48%',
    top: '32%',
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
    left: '58%',
    top: '44%',
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
    left: '72%',
    top: '52%',
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
    left: '78%',
    top: '68%',
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

function city(id) {
  return CITIES.find((c) => c.id === id)
}

export default function WorldTradeMap() {
  const [ref, visible] = useLandingReveal({ threshold: 0.15 })
  const [hovered, setHovered] = useState('india')
  const active = city(hovered) || CITIES[0]

  return (
    <div ref={ref} className={`ci-v3-globe-wrap ${visible ? 'is-visible' : ''}`}>
      <div className="ci-v3-globe-stage" role="img" aria-label="3D globe showing global trade routes and company intelligence">
        <div className="ci-v3-globe-sphere">
          <div className="ci-v3-globe-map" style={{ backgroundImage: 'url(/world-map.svg)' }} aria-hidden />
          <div className="ci-v3-globe-shine" aria-hidden />
          {CITIES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`ci-v3-globe-city ${hovered === c.id ? 'is-active' : ''}`}
              style={{ left: c.left, top: c.top, '--city-color': c.color }}
              onMouseEnter={() => setHovered(c.id)}
              onFocus={() => setHovered(c.id)}
              aria-label={`${c.label} trade hub`}
            >
              <span className="ci-v3-globe-city-core" />
              <span className="ci-v3-globe-city-pulse" />
              <span className="ci-v3-globe-city-label">{c.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="ci-v3-globe-card">
        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">Market intelligence</p>
        <h3 className="text-lg font-bold text-zinc-900 mb-1">{active.card.company}</h3>
        <p className="text-sm text-zinc-600 mb-3">{active.card.detail}</p>
        <dl className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <dt className="text-zinc-500">Shipments</dt>
            <dd className="font-semibold text-zinc-900">{active.card.shipments}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">AI confidence</dt>
            <dd className="font-semibold text-[#FF773D]">{active.card.confidence}%</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-zinc-600 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          {active.card.dm}
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-medium text-zinc-600">
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
