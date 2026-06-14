import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import {
  getDealStageMeta,
  getDealStagesForFreight,
  isClosedDealStage,
} from '../../lib/crmConstants'
import { formatDealValue } from '../../lib/crmTimeline'
import { buildAutoDealName } from '../../lib/dealNaming'
import { emptyFreightRfq, isFreightDealOrg } from '../../lib/freightDeal'
import FreightDealFields, { formatFreightSummary, freightDealCreateLabel } from './FreightDealFields'
import { getFreightCustomerTypeMeta } from '../../lib/freightDeal'
import DealShareActions from './DealShareActions'
import {
  LwField,
  LwFormStack,
  LwInput,
  LwNotice,
  LwSelect,
  LwSubmitBtn,
} from './leadWorkspaceUi'
import {
  CalendarIcon,
  CheckIcon,
  ChevronRightIcon,
  CloseIcon,
  CopyIcon,
  PipelineIcon,
  PlusIcon,
  RouteIcon,
  TrashIcon,
} from '../ui/icons'

function stageBadgeClass(stage, freightOrg) {
  const meta = getDealStageMeta(stage, { freightOrg })
  return meta.color || 'bg-gray-50 text-gray-700 border-gray-200'
}

function DealRow({
  deal,
  busy,
  freightOrg,
  lead,
  user,
  onUpdate,
  onWon,
  onLost,
  onDuplicate,
  onDelete,
  patchLead,
  logCrmEmailSend,
  onNotice,
  onError,
}) {
  const [lostReason, setLostReason] = useState('')
  const [showLost, setShowLost] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showFreight, setShowFreight] = useState(false)
  const [freightDraft, setFreightDraft] = useState(deal.freight || emptyFreightRfq())
  const [nameDraft, setNameDraft] = useState(deal.name || '')
  const closed = isClosedDealStage(deal.stage)
  const stageOptions = getDealStagesForFreight(freightOrg)
  const typeMeta = getFreightCustomerTypeMeta(deal.freight?.customerType)
  const freightSummary = formatFreightSummary(deal.freight)

  useEffect(() => {
    setNameDraft(deal.name || '')
  }, [deal.name])

  const saveFreight = () => {
    onUpdate(deal.id, { freight: freightDraft })
    setShowFreight(false)
  }

  const saveName = () => {
    const next = nameDraft.trim()
    if (!next || next === deal.name) return
    onUpdate(deal.id, { name: next })
  }

  return (
    <li className={`lw-deal-card ${closed ? 'is-closed' : ''}`}>
      <div className="lw-deal-card__head">
        <div className="lw-deal-card__main">
          <input
            value={nameDraft}
            disabled={busy}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={saveName}
            className="lw-deal-card__name"
            aria-label="Deal name"
          />
          <div className="lw-deal-card__meta">
            <span className={`lw-deal-card__stage ${stageBadgeClass(deal.stage, freightOrg)}`}>
              {getDealStageMeta(deal.stage, { freightOrg }).label}
            </span>
            {freightOrg && deal.freight?.customerType && deal.freight.customerType !== 'spot_rfq' && (
              <span className="lw-deal-card__type">{typeMeta.shortLabel}</span>
            )}
          </div>
        </div>
        <div className="lw-deal-card__amount">
          {deal.amount != null && deal.amount > 0 ? (
            <div className="lw-deal-card__amount-value">{formatDealValue(deal.amount, deal.currency)}</div>
          ) : (
            <div className="lw-deal-card__amount-sub">No amount</div>
          )}
          {freightOrg && deal.freight?.invoiceAmount > 0 && (
            <div className="lw-deal-card__amount-sub">
              Inv {formatDealValue(deal.freight.invoiceAmount, deal.currency)}
            </div>
          )}
        </div>
      </div>

      {freightOrg && freightSummary && (
        <div className="lw-deal-card__route">
          <RouteIcon aria-hidden />
          <span>{freightSummary}</span>
        </div>
      )}

      {!closed && (
        <>
          <div className="lw-deal-card__controls">
            <LwSelect
              value={deal.stage}
              disabled={busy}
              onChange={(e) => onUpdate(deal.id, { stage: e.target.value })}
              aria-label="Stage"
            >
              {stageOptions.filter((s) => !isClosedDealStage(s.id)).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </LwSelect>
            <LwInput
              type="number"
              min={0}
              defaultValue={deal.amount ?? ''}
              disabled={busy}
              placeholder={freightOrg ? 'Freight ₹' : 'Amount ₹'}
              aria-label="Amount"
              onBlur={(e) => {
                const val = e.target.value === '' ? null : Number(e.target.value)
                if (val !== deal.amount) onUpdate(deal.id, { amount: val })
              }}
            />
          </div>

          <div className="lw-deal-card__actions">
            <button type="button" disabled={busy} onClick={() => onWon(deal.id)} className="lw-deal-action lw-deal-action--won">
              <CheckIcon aria-hidden />
              Won
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setShowLost((v) => !v)}
              className="lw-deal-action lw-deal-action--lost"
            >
              <CloseIcon aria-hidden />
              Lost
            </button>
            <button type="button" disabled={busy} onClick={() => onDuplicate(deal.id)} className="lw-deal-action lw-deal-action--icon" title="Duplicate">
              <CopyIcon aria-hidden />
            </button>
            {!confirmDelete ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmDelete(true)}
                className="lw-deal-action lw-deal-action--danger lw-deal-action--icon"
                title="Delete"
              >
                <TrashIcon aria-hidden />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    onDelete(deal.id)
                    setConfirmDelete(false)
                  }}
                  className="lw-deal-action lw-deal-action--danger"
                >
                  Confirm delete
                </button>
                <button type="button" disabled={busy} onClick={() => setConfirmDelete(false)} className="lw-deal-action">
                  Cancel
                </button>
              </>
            )}
          </div>

          {showLost && (
            <div className="lw-deal-lost-form">
              <LwInput
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                placeholder="Reason (optional)"
              />
              <button type="button" disabled={busy} onClick={() => onLost(deal.id, lostReason)} className="lw-deal-action lw-deal-action--lost">
                Save
              </button>
            </div>
          )}
        </>
      )}

      {closed && (
        <div className="lw-deal-card__actions">
          <button type="button" disabled={busy} onClick={() => onDuplicate(deal.id)} className="lw-deal-action">
            <CopyIcon aria-hidden />
            Duplicate
          </button>
        </div>
      )}

      {freightOrg && (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setFreightDraft(deal.freight || emptyFreightRfq())
              setShowFreight((v) => !v)
            }}
            className="lw-deal-rfq-toggle"
          >
            <ChevronRightIcon
              aria-hidden
              style={{ transform: showFreight ? 'rotate(90deg)' : undefined, transition: 'transform 0.15s' }}
            />
            {showFreight ? 'Hide RFQ' : deal.freight ? 'Edit RFQ' : 'Add RFQ'}
          </button>
          {showFreight && (
            <div className="lw-deal-rfq-panel lw-freight-fields">
              <FreightDealFields freight={freightDraft} onChange={setFreightDraft} disabled={busy} compact />
              {!closed && (
                <button type="button" disabled={busy} onClick={saveFreight} className="lw-deal-action lw-deal-action--won mt-2">
                  Save RFQ
                </button>
              )}
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

/** Deals on a lead — compact cards, minimal copy. */
export default function LeadDealsSection({ lead, patchLead, user, busy = false, onNotice, onError }) {
  const { logCrmEmailSend } = useApp()
  const crm = lead.crm || {}
  const deals = crm.deals || []
  const freightOrg = isFreightDealOrg(user)
  const stageOptions = getDealStagesForFreight(freightOrg)

  const [name, setName] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [amount, setAmount] = useState('')
  const [stage, setStage] = useState(freightOrg ? 'rfq' : 'new')
  const [expectedCloseDate, setExpectedCloseDate] = useState('')
  const [freight, setFreight] = useState(emptyFreightRfq())
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [showCreate, setShowCreate] = useState(deals.length === 0)
  const [listFilter, setListFilter] = useState('open')

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

  const visibleDeals = useMemo(() => {
    if (listFilter === 'won') return won
    if (listFilter === 'lost') return lost
    return open
  }, [listFilter, open, won, lost])

  const suggestedDealName = useMemo(
    () => buildAutoDealName({ company: lead.company, existingDeals: deals }),
    [lead.company, deals]
  )

  useEffect(() => {
    if (!nameTouched) setName(suggestedDealName)
  }, [suggestedDealName, nameTouched])

  const runDeal = async (body, okMsg) => {
    if (saving || busy) return false
    setSaving(true)
    onError?.(null)
    try {
      await patchLead(lead.id, { deal: body })
      if (okMsg) {
        onNotice?.(okMsg)
        setFeedback(okMsg)
        setTimeout(() => setFeedback(null), 4000)
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
    const dealName = name.trim() || buildAutoDealName({ company: lead.company, existingDeals: deals })
    const payload = {
      action: 'add',
      name: dealName,
      autoName: !name.trim(),
      company: lead.company || '',
      stage,
      amount: amount === '' ? null : Number(amount),
      expectedCloseDate: expectedCloseDate || null,
    }
    if (freightOrg) payload.freight = freight
    const ok = await runDeal(
      payload,
      freightOrg ? freightDealCreateLabel(freight.customerType).replace('Create ', '') + ' added' : 'Deal added'
    )
    if (ok) {
      setNameTouched(false)
      setAmount('')
      setStage(freightOrg ? 'rfq' : 'new')
      setExpectedCloseDate('')
      setFreight(emptyFreightRfq())
      setShowCreate(false)
      setListFilter('open')
    }
  }

  const updateDeal = (dealId, patch) => runDeal({ action: 'update', dealId, ...patch }, 'Updated')
  const duplicateDeal = (dealId) =>
    runDeal({ action: 'duplicate', dealId, company: lead.company || '', stage: freightOrg ? 'rfq' : 'new' }, 'Duplicated')
  const markWon = (dealId) => runDeal({ action: 'won', dealId }, 'Marked won')
  const markLost = (dealId, lostReason) =>
    runDeal({ action: 'lost', dealId, lostReason: lostReason.trim() }, 'Marked lost')
  const removeDeal = (dealId) => runDeal({ action: 'delete', dealId }, 'Deleted')

  const dealBusy = saving || busy

  const filterOptions = [
    { id: 'open', label: 'Open', count: open.length },
    { id: 'won', label: 'Won', count: won.length },
    { id: 'lost', label: 'Lost', count: lost.length },
  ].filter((f) => f.count > 0 || f.id === 'open')

  return (
    <div className="lw-deals">
      <div className="lw-deals-kpi">
        <div className="lw-deals-kpi__card">
          <div className="lw-deals-kpi__icon lw-deals-kpi__icon--open">
            <PipelineIcon aria-hidden />
          </div>
          <div>
            <div className="lw-deals-kpi__label">Open</div>
            <div className="lw-deals-kpi__value">{formatDealValue(totals.openValue || crm.dealValue)}</div>
            <div className="lw-deals-kpi__sub">{open.length} deal{open.length === 1 ? '' : 's'}</div>
          </div>
        </div>
        <div className="lw-deals-kpi__card">
          <div className="lw-deals-kpi__icon lw-deals-kpi__icon--won">
            <CheckIcon aria-hidden />
          </div>
          <div>
            <div className="lw-deals-kpi__label">Won</div>
            <div className="lw-deals-kpi__value">{formatDealValue(totals.wonValue)}</div>
            <div className="lw-deals-kpi__sub">{won.length} deal{won.length === 1 ? '' : 's'}</div>
          </div>
        </div>
      </div>

      {deals.length > 0 && (
        <div className="lw-deals-filter" role="tablist" aria-label="Deal status">
          {filterOptions.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={listFilter === f.id}
              onClick={() => setListFilter(f.id)}
              className={`lw-deals-filter__btn ${listFilter === f.id ? 'is-active' : ''}`}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>
      )}

      {!showCreate ? (
        <button type="button" className="lw-deals-create-toggle" onClick={() => setShowCreate(true)}>
          <PlusIcon aria-hidden />
          {freightOrg ? 'New freight deal' : 'New deal'}
        </button>
      ) : (
        <div className="lw-deals-create-form">
          <LwFormStack onSubmit={addDeal}>
            <LwField label="Name">
              <LwInput
                value={name}
                onChange={(e) => {
                  setNameTouched(true)
                  setName(e.target.value)
                }}
                placeholder={suggestedDealName}
                required
              />
            </LwField>

            {freightOrg && <FreightDealFields freight={freight} onChange={setFreight} disabled={dealBusy} compact />}

            <div className="lw-deal-card__controls">
              <LwField label="Stage">
                <LwSelect value={stage} onChange={(e) => setStage(e.target.value)}>
                  {stageOptions.filter((s) => !isClosedDealStage(s.id)).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </LwSelect>
              </LwField>
              <LwField label={freightOrg ? 'Freight ₹' : 'Amount ₹'}>
                <LwInput
                  type="number"
                  min={0}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                />
              </LwField>
            </div>

            <LwField label="Close date" icon={CalendarIcon}>
              <LwInput type="date" value={expectedCloseDate} onChange={(e) => setExpectedCloseDate(e.target.value)} />
            </LwField>

            <div className="lw-btn-row">
              <LwSubmitBtn variant="brand" icon={PlusIcon} disabled={dealBusy}>
                {saving ? 'Creating…' : freightOrg ? freightDealCreateLabel(freight.customerType) : 'Create deal'}
              </LwSubmitBtn>
              {deals.length > 0 && (
                <button type="button" className="lw-deal-action" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
              )}
            </div>
            {feedback && <LwNotice>{feedback}</LwNotice>}
          </LwFormStack>
        </div>
      )}

      {visibleDeals.length > 0 ? (
        <ul className="lw-deals-list">
          {visibleDeals.map((d) => (
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
              onDuplicate={duplicateDeal}
              onDelete={removeDeal}
              patchLead={patchLead}
              logCrmEmailSend={logCrmEmailSend}
              onNotice={onNotice}
              onError={onError}
            />
          ))}
        </ul>
      ) : deals.length === 0 && !showCreate ? (
        <div className="lw-deals-empty">
          <PipelineIcon aria-hidden />
          <p>No deals yet</p>
        </div>
      ) : visibleDeals.length === 0 ? (
        <div className="lw-deals-empty">
          <p>No {listFilter} deals</p>
        </div>
      ) : null}
    </div>
  )
}
