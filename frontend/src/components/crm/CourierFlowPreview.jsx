import { useMemo, useState } from 'react'
import FreightDealFields from './FreightDealFields'
import CourierDealsBoard from './CourierDealsBoard'
import { emptyFreightRfq, DEAL_BOOK_FILTERS, courierContractProjection } from '../../lib/freightDeal'
import { DashboardSegmented } from '../dashboard/dashboardUi'

const SAMPLE_ROWS = [
  {
    leadId: 'sample-apparel',
    leadName: 'Northwind Apparel',
    company: 'Northwind Apparel',
    deal: {
      id: 'sample-1',
      name: 'USA + UK courier',
      stage: 'quoted',
      freight: {
        customerType: 'courier',
        courier: {
          destinationCountries: ['usa', 'uk'],
          contractTerm: '12',
          competitors: ['dhl'],
          competitorRatePerKg: 480,
          proposedRatePerKg: 430,
          lanes: [
            { countryId: 'usa', monthlyShipments: 220, monthlyWeightKg: 1400, targetRatePerKg: 430 },
            { countryId: 'uk', monthlyShipments: 60, monthlyWeightKg: 380, targetRatePerKg: 460 },
          ],
        },
      },
    },
  },
  {
    leadId: 'sample-electronics',
    leadName: 'Bright Circuits',
    company: 'Bright Circuits',
    deal: {
      id: 'sample-2',
      name: 'EU electronics',
      stage: 'lost',
      freight: {
        customerType: 'courier',
        courier: {
          destinationCountries: ['eu'],
          contractTerm: '6',
          competitors: ['fedex'],
          competitorRatePerKg: 390,
          proposedRatePerKg: 410,
          lanes: [{ countryId: 'eu', monthlyShipments: 40, monthlyWeightKg: 260, targetRatePerKg: 410 }],
        },
      },
    },
  },
]

export default function CourierFlowPreview() {
  const [step, setStep] = useState('fill')
  const [book, setBook] = useState('courier')
  const [freight, setFreight] = useState(() => ({ ...emptyFreightRfq(), customerType: 'courier' }))
  const [selected, setSelected] = useState(() => new Set())

  const liveRow = useMemo(
    () => ({
      leadId: 'draft',
      leadName: 'This account',
      company: 'This account',
      deal: {
        id: 'draft',
        name: 'Courier contract in progress',
        stage: 'rfq',
        freight,
      },
    }),
    [freight]
  )

  const rows =
    book === 'courier'
      ? [liveRow, ...SAMPLE_ROWS].sort(
          (a, b) =>
            (courierContractProjection(b.deal.freight.courier).monthlyWeightKg || 0) -
            (courierContractProjection(a.deal.freight.courier).monthlyWeightKg || 0)
        )
      : []

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-[#0f172a]">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        <header>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Courier deals</p>
          <h1 className="text-xl font-semibold">Fill once, then review the book</h1>
          <ol className="mt-3 grid gap-2 sm:grid-cols-3 text-sm">
            <li className="rounded-xl border bg-white px-3 py-2">1. On the lead, choose Courier contract.</li>
            <li className="rounded-xl border bg-white px-3 py-2">2. Enter lanes and rates. Totals update as you type.</li>
            <li className="rounded-xl border bg-white px-3 py-2">3. On Deals, switch to Courier and mark won or lost.</li>
          </ol>
        </header>
        <div className="flex gap-2">
          <button
            type="button"
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${step === 'fill' ? 'bg-slate-900 text-white' : 'bg-white'}`}
            onClick={() => setStep('fill')}
          >
            Lead deal form
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${step === 'book' ? 'bg-slate-900 text-white' : 'bg-white'}`}
            onClick={() => setStep('book')}
          >
            Deals list
          </button>
        </div>
        {step === 'fill' ? (
          <div className="rounded-2xl border bg-white p-4">
            <FreightDealFields freight={freight} onChange={setFreight} />
          </div>
        ) : (
          <div className="rounded-2xl border bg-white py-4 space-y-3">
            <div className="courier-book px-4">
              <DashboardSegmented
                value={book}
                onChange={setBook}
                options={DEAL_BOOK_FILTERS.map((opt) => ({ value: opt.id, label: opt.label }))}
              />
              <p>
                {book === 'courier'
                  ? 'Sorted by monthly kg. The row named “in progress” is the contract on the form.'
                  : 'Commercial shipment quotes stay on the other side of this switch.'}
              </p>
            </div>
            {book === 'courier' ? (
              <CourierDealsBoard
                rows={rows}
                selected={selected}
                allSelected={false}
                onToggleRow={(row, checked) => {
                  const key = `${row.leadId}:${row.deal.id}`
                  setSelected((current) => {
                    const next = new Set(current)
                    if (checked) next.add(key)
                    else next.delete(key)
                    return next
                  })
                }}
                onToggleAll={() => {}}
                onOpenLead={() => setStep('fill')}
              />
            ) : (
              <p className="text-sm text-slate-500 px-4 py-8">
                Commercial shows per-shipment spot quotes. Courier contracts do not appear here.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
