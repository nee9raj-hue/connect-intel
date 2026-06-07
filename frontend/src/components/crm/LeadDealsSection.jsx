import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import {
  getDealStageMeta,
  getDealStagesForFreight,
  isClosedDealStage,
} from '../../lib/crmConstants'
import { formatDealValue } from '../../lib/crmTimeline'
import { emptyFreightRfq, isFreightDealOrg } from '../../lib/freightDeal'
import FreightDealFields, { formatFreightSummary, freightDealCreateLabel } from './FreightDealFields'
import { getFreightCustomerTypeMeta } from '../../lib/freightDeal'
import DealShareActions from './DealShareActions'

function DealRow({ deal, busy, freightOrg, lead, user, onUpdate, onWon, onLost, patchLead, logCrmEmailSend, onNotice, onError }) {
  const [lostReason, setLostReason] = useState('')
  const [showLost, setShowLost] = useState(false)
  const [showFreight, setShowFreight] = useState(false)
  const [freightDraft, setFreightDraft] = useState(deal.freight || emptyFreightRfq())
  const meta = getDealStageMeta(deal.stage, { freightOrg })
  const closed = isClosedDealStage(deal.stage)
  const stageOptions = getDealStagesForFreight(freightOrg)
  const typeMeta = getFreightCustomerTypeMeta(deal.freight?.customerType)
  const freightSummary = formatFreightSummary(deal.freight)

  const saveFreight = () => {
    onUpdate(deal.id, { freight: freightDraft })
    setShowFreight(false)
  }

  return (
    <li className={`text-xs border rounded-lg p-2.5 space-y-2 ${closed ? 'opacity-80 bg-gray-50' : 'bg-white'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 truncate">{deal.name}</p>
          <div className="flex flex-wrap items-center gap-1 mt-1">
            <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-semibold uppercase ${meta.color}`}>
              {meta.label}
            </span>
            {freightOrg && deal.freight?.customerType && deal.freight.customerType !== 'spot_rfq' && (
              <span className="inline-block px-1.5 py-0.5 rounded border text-[10px] font-semibold uppercase bg-teal-50 text-teal-800 border-teal-200">
                {typeMeta.shortLabel}
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right space-y-0.5">
          {deal.amount != null && deal.amount > 0 && (
            <p className="font-semibold text-gray-900">{formatDealValue(deal.amount, deal.currency)}</p>
          )}
          {freightOrg && deal.freight?.invoiceAmount != null && deal.freight.invoiceAmount > 0 && (
            <p className="text-[10px] text-gray-500">
              Invoice {formatDealValue(deal.freight.invoiceAmount, deal.currency)}
            </p>
          )}
        </div>
      </div>

      {freightOrg && freightSummary && (
        <p className="text-gray-600 bg-indigo-50/60 border border-indigo-100 rounded px-2 py-1">{freightSummary}</p>
      )}
      {freightOrg && deal.freight?.rfqDetails && (
        <p className="text-gray-600 whitespace-pre-wrap">{deal.freight.rfqDetails}</p>
      )}

      {deal.expectedCloseDate && (
        <p className="text-gray-500">Close: {new Date(deal.expectedCloseDate).toLocaleDateString()}</p>
      )}
      {deal.lostReason && <p className="text-gray-500">Lost reason: {deal.lostReason}</p>}
      {deal.notes && <p className="text-gray-600 whitespace-pre-wrap">{deal.notes}</p>}

      {freightOrg && (
        <div>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setFreightDraft(deal.freight || emptyFreightRfq())
              setShowFreight((v) => !v)
            }}
            className="text-[11px] font-semibold text-indigo-700"
          >
            {showFreight ? 'Hide RFQ details' : deal.freight ? 'Edit RFQ details' : 'Add RFQ details'}
          </button>
          {showFreight && (
            <div className="mt-2 space-y-2">
              <FreightDealFields freight={freightDraft} onChange={setFreightDraft} disabled={busy} compact />
              {!closed && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={saveFreight}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-indigo-600 text-white disabled:opacity-50"
                >
                  Save RFQ
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {!closed && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={deal.stage}
              disabled={busy}
              onChange={(e) => onUpdate(deal.id, { stage: e.target.value })}
              className="w-full text-xs border rounded-lg px-2 py-1.5"
            >
              {stageOptions.filter((s) => !isClosedDealStage(s.id)).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              defaultValue={deal.amount ?? ''}
              disabled={busy}
              placeholder={freightOrg ? 'Freight charges ₹' : 'Amount ₹'}
              onBlur={(e) => {
                const val = e.target.value === '' ? null : Number(e.target.value)
                if (val !== deal.amount) onUpdate(deal.id, { amount: val })
              }}
              className="w-full text-xs border rounded-lg px-2 py-1.5"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onWon(deal.id)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#fff4ee] text-[#FF773D] border border-[#ffd4b8]"
            >
              Mark won
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setShowLost((v) => !v)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-gray-300 text-gray-600"
            >
              Mark lost
            </button>
          </div>
          {showLost && (
            <div className="flex gap-2">
              <input
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                placeholder="Why lost?"
                className="flex-1 text-xs border rounded-lg px-2 py-1.5"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => onLost(deal.id, lostReason)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-gray-900 text-white"
              >
                Confirm lost
              </button>
            </div>
          )}
        </>
      )}

      <DealShareActions
        deal={deal}
        lead={lead}
        user={user}
        freightOrg={freightOrg}
        busy={busy}
        onNotice={onNotice}
        onError={onError}
        patchLead={patchLead}
        logCrmEmailSend={logCrmEmailSend}
      />
    </li>
  )
}

/** HubSpot-style deals — multiple opportunities per lead. */
export default function LeadDealsSection({ lead, patchLead, user, busy = false, onNotice, onError }) {
  const { logCrmEmailSend } = useApp()
  const crm = lead.crm || {}
  const deals = crm.deals || []
  const freightOrg = isFreightDealOrg(user)
  const stageOptions = getDealStagesForFreight(freightOrg)

  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [stage, setStage] = useState(freightOrg ? 'rfq' : 'new')
  const [expectedCloseDate, setExpectedCloseDate] = useState('')
  const [freight, setFreight] = useState(emptyFreightRfq())
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const { open, won, lost } = useMemo(() => {
    const o = []
    const w = []
    const l = []
    for (const d of deals) {
      if (d.stage === 'won') w.push(d)
      else if (d.stage === 'lost') l.push(d)
      else o.push(d)
    }
    return { open: o, won: w, lost: l }
  }, [deals])

  const totals = useMemo(() => {
    const openValue = open.reduce((sum, d) => sum + (Number(d.amount) || 0), 0)
    const wonValue = won.reduce((sum, d) => sum + (Number(d.amount) || 0), 0)
    return { openValue, wonValue }
  }, [open, won])

  const runDeal = async (body, okMsg) => {
    if (saving || busy) return false
    setSaving(true)
    onError?.(null)
    try {
      await patchLead(lead.id, { deal: body })
      if (okMsg) {
        onNotice?.(okMsg)
        setFeedback(okMsg)
        setTimeout(() => setFeedback(null), 5000)
      }
      return true
    } catch (e) {
      onError?.(e.message)
      return false
    } finally {
      setSaving(false)
    }
  }

  const addDeal = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    const payload = {
      action: 'add',
      name: name.trim(),
      stage,
      amount: amount === '' ? null : Number(amount),
      expectedCloseDate: expectedCloseDate || null,
    }
    if (freightOrg) payload.freight = freight
    const ok = await runDeal(payload, freightOrg ? `${freightDealCreateLabel(freight.customerType).replace('Create ', '')} created` : 'Deal created')
    if (ok) {
      setName('')
      setAmount('')
      setStage(freightOrg ? 'rfq' : 'new')
      setExpectedCloseDate('')
      setFreight(emptyFreightRfq())
    }
  }

  const updateDeal = (dealId, patch) => runDeal({ action: 'update', dealId, ...patch }, 'Deal updated')

  const markWon = (dealId) => runDeal({ action: 'won', dealId }, 'Deal marked won')

  const markLost = (dealId, lostReason) =>
    runDeal({ action: 'lost', dealId, lostReason: lostReason.trim() }, 'Deal marked lost')

  const dealBusy = saving || busy

  return (
    <div className="space-y-4">
      {freightOrg && (
        <p className="text-xs text-indigo-800 bg-indigo-50 border border-indigo-100 rounded-lg px-2.5 py-2">
          Choose opportunity type per deal — spot RFQ, courier contract, or mixed. Invoice value lives on the
          RFQ; freight charges are the deal amount used in pipeline totals.
        </p>
      )}

      <section className="grid grid-cols-2 gap-2">
        <div className="border rounded-lg p-2.5 bg-white">
          <p className="text-[10px] font-semibold uppercase text-gray-400">Open pipeline</p>
          <p className="text-sm font-bold text-gray-900">{formatDealValue(totals.openValue || crm.dealValue)}</p>
          <p className="text-[11px] text-gray-500">
            {open.length} open deal{open.length === 1 ? '' : 's'}
            {freightOrg ? ' · freight charges' : ''}
          </p>
        </div>
        <div className="border rounded-lg p-2.5 bg-white">
          <p className="text-[10px] font-semibold uppercase text-gray-400">Won</p>
          <p className="text-sm font-bold text-[#FF773D]">{formatDealValue(totals.wonValue)}</p>
          <p className="text-[11px] text-gray-500">{won.length} won</p>
        </div>
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase text-gray-400 mb-2">
          {freightOrg ? 'Create freight deal' : 'Create deal'}
        </h3>
        <form onSubmit={addDeal} className="space-y-2 border rounded-lg p-2.5 bg-gray-50">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={freightOrg ? 'Deal name (e.g. Mumbai → US air freight)' : 'Deal name (e.g. Q2 freight contract)'}
            required
            className="w-full text-xs border rounded-lg px-2.5 py-1.5 bg-white"
          />
          {freightOrg && (
            <FreightDealFields freight={freight} onChange={setFreight} disabled={dealBusy} />
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold uppercase text-gray-500 block mb-1">
                Deal stage
              </label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                className="w-full text-xs border rounded-lg px-2.5 py-1.5 bg-white"
              >
                {stageOptions.filter((s) => !isClosedDealStage(s.id)).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              {freightOrg && (
                <p className="text-[10px] text-gray-500 mt-1 leading-snug">
                  Shipment pipeline: RFQ → Quoted → Negotiation → Booked → Won.
                  Separate from this contact&apos;s lead status.
                </p>
              )}
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase text-gray-500 block mb-1">
                Freight charges (₹)
              </label>
              <input
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Quoted / booked freight rate"
                className="w-full text-xs border rounded-lg px-2.5 py-1.5 bg-white"
              />
              {freightOrg && (
                <p className="text-[10px] text-gray-500 mt-1 leading-snug">
                  Your freight quote for this shipment — used in pipeline value totals.
                </p>
              )}
            </div>
          </div>
          <input
            type="date"
            value={expectedCloseDate}
            onChange={(e) => setExpectedCloseDate(e.target.value)}
            className="w-full text-xs border rounded-lg px-2.5 py-1.5 bg-white"
          />
          <button
            type="submit"
            disabled={dealBusy}
            className="w-full py-2 text-xs font-semibold bg-[#FF773D] text-white rounded-lg disabled:opacity-50"
          >
            {saving ? 'Creating…' : freightOrg ? freightDealCreateLabel(freight.customerType) : 'Create deal'}
          </button>
          {feedback && (
            <p className="text-xs font-semibold text-green-800 bg-green-50 border border-green-200 rounded-lg px-2.5 py-2" role="status">
              ✓ {feedback}
            </p>
          )}
        </form>
      </section>

      {open.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase text-gray-400 mb-2">Open deals</h3>
          <ul className="space-y-2">
            {open.map((d) => (
              <DealRow
                key={d.id}
                deal={d}
                lead={lead}
                user={user}
                busy={dealBusy}
                freightOrg={freightOrg}
                onUpdate={updateDeal}
                onWon={markWon}
                onLost={markLost}
                patchLead={patchLead}
                logCrmEmailSend={logCrmEmailSend}
                onNotice={onNotice}
                onError={onError}
              />
            ))}
          </ul>
        </section>
      )}

      {won.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase text-gray-400 mb-2">Won deals</h3>
          <ul className="space-y-2">
            {won.map((d) => (
              <DealRow
                key={d.id}
                deal={d}
                lead={lead}
                user={user}
                busy={dealBusy}
                freightOrg={freightOrg}
                onUpdate={updateDeal}
                onWon={markWon}
                onLost={markLost}
                patchLead={patchLead}
                logCrmEmailSend={logCrmEmailSend}
                onNotice={onNotice}
                onError={onError}
              />
            ))}
          </ul>
        </section>
      )}

      {lost.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase text-gray-400 mb-2">Lost deals</h3>
          <ul className="space-y-2">
            {lost.map((d) => (
              <DealRow
                key={d.id}
                deal={d}
                lead={lead}
                user={user}
                busy={dealBusy}
                freightOrg={freightOrg}
                onUpdate={updateDeal}
                onWon={markWon}
                onLost={markLost}
                patchLead={patchLead}
                logCrmEmailSend={logCrmEmailSend}
                onNotice={onNotice}
                onError={onError}
              />
            ))}
          </ul>
        </section>
      )}

      {!deals.length && (
        <p className="text-xs text-gray-500">
          {freightOrg
            ? 'No freight deals yet. Create spot RFQs, courier contracts, or mixed opportunities — one deal per shipment or contract lane.'
            : 'No deals yet. Create one opportunity per product line, contract, or renewal — like HubSpot deals on a contact.'}
        </p>
      )}
    </div>
  )
}
