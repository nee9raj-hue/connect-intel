import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import {
  TRAVEL_MODES,
  buildLeadDestinationLabel,
  computeTravelClaimAmount,
  fieldVisitMeetingToFormState,
  formatInr,
} from '../../lib/fieldVisitExpenses'
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '../../lib/crmUiConstants'

export default function FieldVisitRecordForm({
  lead,
  meetings = [],
  settings,
  busy = false,
  onSubmit,
  onCancel,
  editMeeting = null,
}) {
  const isEdit = Boolean(editMeeting?.id)
  const destinationDefault = useMemo(() => buildLeadDestinationLabel(lead), [lead])
  const pendingVisits = useMemo(
    () => meetings.filter((m) => m.type === 'field_visit' && !m.visitRecordedAt),
    [meetings]
  )

  const initial = useMemo(() => {
    if (isEdit) return fieldVisitMeetingToFormState(editMeeting, settings)
    return null
  }, [isEdit, editMeeting, settings])

  const [visitMeetingId, setVisitMeetingId] = useState('')
  const [quickLog, setQuickLog] = useState(pendingVisits.length === 0)
  const [visitAt, setVisitAt] = useState(toDatetimeLocalValue(new Date().toISOString()))
  const [visitTitle, setVisitTitle] = useState('')
  const [visitOutcome, setVisitOutcome] = useState('completed')
  const [visitNotes, setVisitNotes] = useState('')
  const [startLabel, setStartLabel] = useState(settings?.defaultStartLocation || '')
  const [endLabel, setEndLabel] = useState(destinationDefault)
  const [travelMode, setTravelMode] = useState('car')
  const [distanceKm, setDistanceKm] = useState('')
  const [cabAmount, setCabAmount] = useState('')
  const [distanceSource, setDistanceSource] = useState('manual')
  const [suggestedDistanceKm, setSuggestedDistanceKm] = useState(null)
  const [distanceHint, setDistanceHint] = useState(null)
  const [suggesting, setSuggesting] = useState(false)
  const [suggestError, setSuggestError] = useState(null)

  useEffect(() => {
    if (!isEdit) {
      setEndLabel(destinationDefault)
      return
    }
    setVisitMeetingId(initial.meetingId)
    setVisitAt(toDatetimeLocalValue(initial.visitAt))
    setVisitTitle(initial.title)
    setVisitOutcome(initial.outcome)
    setVisitNotes(initial.notes)
    setStartLabel(initial.startLabel)
    setEndLabel(initial.endLabel)
    setTravelMode(initial.travelMode)
    setDistanceKm(initial.distanceKm)
    setCabAmount(initial.cabAmount)
    setDistanceSource(initial.distanceSource)
    setSuggestedDistanceKm(initial.suggestedDistanceKm)
    setDistanceHint(null)
    setSuggestError(null)
  }, [isEdit, initial, destinationDefault])

  useEffect(() => {
    if (isEdit) return
    setStartLabel(settings?.defaultStartLocation || '')
  }, [settings?.defaultStartLocation, isEdit])

  useEffect(() => {
    if (isEdit) return
    if (pendingVisits.length === 1 && !visitMeetingId) {
      setVisitMeetingId(pendingVisits[0].id)
      setQuickLog(false)
    }
  }, [pendingVisits, visitMeetingId, isEdit])

  const claimPreview = useMemo(() => {
    const travel = {
      mode: travelMode,
      distanceKm: Number(distanceKm) || 0,
      cabAmount: Number(cabAmount) || 0,
    }
    return computeTravelClaimAmount(travel, settings)
  }, [travelMode, distanceKm, cabAmount, settings])

  const requestDistanceSuggest = async () => {
    setSuggesting(true)
    setSuggestError(null)
    setDistanceHint(null)
    try {
      const data = await api.suggestFieldVisitDistance({
        startLabel,
        endLabel,
        travelMode,
      })
      setSuggestedDistanceKm(data.distanceKm)
      setDistanceHint({
        km: data.distanceKm,
        minutes: data.durationMinutes,
        startResolved: data.startResolved,
        endResolved: data.endResolved,
        approximate: data.distanceSource === 'estimated',
      })
    } catch (err) {
      setSuggestError(err.message || 'Could not estimate distance')
    } finally {
      setSuggesting(false)
    }
  }

  const acceptSuggestion = () => {
    if (distanceHint?.km != null) {
      setDistanceKm(String(distanceHint.km))
      setDistanceSource(distanceHint.approximate ? 'estimated' : 'osrm')
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit?.({
      action: isEdit ? 'update' : undefined,
      meetingId: isEdit ? editMeeting.id : quickLog ? null : visitMeetingId || null,
      quickLog: isEdit ? false : quickLog,
      visitAt: fromDatetimeLocalValue(visitAt),
      title: visitTitle.trim() || `Visit — ${lead?.company || 'Lead'}`,
      outcome: visitOutcome,
      notes: visitNotes,
      location: endLabel,
      travel: {
        startLabel,
        endLabel,
        mode: travelMode,
        distanceKm: Number(distanceKm) || 0,
        cabAmount: Number(cabAmount) || 0,
        distanceSource,
        suggestedDistanceKm: suggestedDistanceKm ?? distanceHint?.km ?? null,
      },
    })
  }

  const showDistanceSuggest = travelMode === 'bike' || travelMode === 'car'

  return (
    <form onSubmit={handleSubmit} className="space-y-2 field-visit-record-form">
      {isEdit ? (
        <p className="text-xs text-[#516f90] bg-[#f5f8fa] border border-[#dfe3eb] rounded-lg px-2.5 py-2">
          Editing recorded visit — changes update your expense totals.
        </p>
      ) : null}

      {!isEdit && pendingVisits.length > 0 ? (
        <label className="block">
          <span className="text-[10px] font-semibold uppercase text-gray-400">Scheduled visit</span>
          <select
            value={quickLog ? '__quick__' : visitMeetingId}
            onChange={(e) => {
              if (e.target.value === '__quick__') {
                setQuickLog(true)
                setVisitMeetingId('')
              } else {
                setQuickLog(false)
                setVisitMeetingId(e.target.value)
              }
            }}
            className="mt-0.5 w-full text-xs border rounded-lg px-2.5 py-1.5"
          >
            <option value="__quick__">Log visit now (no schedule)</option>
            {pendingVisits.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title} · {new Date(m.scheduledAt).toLocaleString()}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="block">
        <span className="text-[10px] font-semibold uppercase text-gray-400">Visit date & time</span>
        <input
          type="datetime-local"
          value={visitAt}
          onChange={(e) => setVisitAt(e.target.value)}
          className="mt-0.5 w-full text-xs border rounded-lg px-2.5 py-1.5"
          required
        />
      </label>

      {!isEdit && quickLog ? (
        <input
          value={visitTitle}
          onChange={(e) => setVisitTitle(e.target.value)}
          placeholder="Visit title (optional)"
          className="w-full text-xs border rounded-lg px-2.5 py-1.5"
        />
      ) : null}

      <label className="block">
        <span className="text-[10px] font-semibold uppercase text-gray-400">Start location</span>
        <input
          value={startLabel}
          onChange={(e) => {
            setStartLabel(e.target.value)
            setDistanceHint(null)
          }}
          placeholder="Office / home / pincode / area"
          className="mt-0.5 w-full text-xs border rounded-lg px-2.5 py-1.5"
        />
      </label>

      <label className="block">
        <span className="text-[10px] font-semibold uppercase text-gray-400">Destination</span>
        <input
          value={endLabel}
          onChange={(e) => {
            setEndLabel(e.target.value)
            setDistanceHint(null)
          }}
          placeholder="Customer address, area, or pincode"
          className="mt-0.5 w-full text-xs border rounded-lg px-2.5 py-1.5"
        />
      </label>

      <label className="block">
        <span className="text-[10px] font-semibold uppercase text-gray-400">Travel mode</span>
        <select
          value={travelMode}
          onChange={(e) => setTravelMode(e.target.value)}
          className="mt-0.5 w-full text-xs border rounded-lg px-2.5 py-1.5"
        >
          {TRAVEL_MODES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      {showDistanceSuggest ? (
        <div className="field-visit-distance-suggest">
          <button
            type="button"
            disabled={suggesting || !startLabel.trim() || !endLabel.trim()}
            onClick={requestDistanceSuggest}
            className="crm-btn crm-btn-secondary w-full text-xs py-2"
          >
            {suggesting ? 'Calculating route…' : 'Get suggested distance'}
          </button>
          {!startLabel.trim() || !endLabel.trim() ? (
            <p className="text-[10px] text-[#7c98b6] mt-1 leading-relaxed">
              Uses free OpenStreetMap routing — no API key. Include area + city or pincode for best results.
            </p>
          ) : null}
          {suggestError ? (
            <p className="text-[10px] text-red-700 mt-1">{suggestError}</p>
          ) : null}
          {distanceHint ? (
            <div className="mt-2 rounded-lg border border-[#cbd6e2] bg-[#f5f8fa] px-2.5 py-2 text-xs text-[#33475b]">
              <p className="font-semibold">
                Suggested: {distanceHint.km} km
                {distanceHint.minutes ? ` · ~${distanceHint.minutes} min` : ''}
                {distanceHint.approximate ? ' · approximate' : ''}
              </p>
              {distanceHint.startResolved && distanceHint.endResolved ? (
                <p className="text-[#516f90] mt-1 leading-relaxed">
                  {distanceHint.startResolved} → {distanceHint.endResolved}
                </p>
              ) : null}
              <div className="flex gap-2 mt-2">
                <button type="button" onClick={acceptSuggestion} className="crm-btn crm-btn-primary text-[10px] py-1 px-2">
                  Use this distance
                </button>
                <button
                  type="button"
                  onClick={() => setDistanceHint(null)}
                  className="text-[10px] font-semibold text-[#0091ae] hover:underline"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {travelMode === 'cab' ? (
        <label className="block">
          <span className="text-[10px] font-semibold uppercase text-gray-400">Cab amount (actual)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={cabAmount}
            onChange={(e) => setCabAmount(e.target.value)}
            className="mt-0.5 w-full text-xs border rounded-lg px-2.5 py-1.5"
          />
        </label>
      ) : travelMode === 'bike' || travelMode === 'car' ? (
        <label className="block">
          <span className="text-[10px] font-semibold uppercase text-gray-400">
            Distance (km)
            {travelMode === 'bike'
              ? ` · ₹${settings?.bikeRatePerKm ?? 4}/km`
              : ` · ₹${settings?.carRatePerKm ?? 10}/km`}
            {distanceSource === 'osrm' || distanceSource === 'google' || distanceSource === 'estimated'
              ? ' · from route estimate'
              : ''}
          </span>
          <input
            type="number"
            min="0"
            step="0.1"
            value={distanceKm}
            onChange={(e) => {
              setDistanceKm(e.target.value)
              setDistanceSource('manual')
            }}
            className="mt-0.5 w-full text-xs border rounded-lg px-2.5 py-1.5"
          />
        </label>
      ) : null}

      {claimPreview > 0 ? (
        <p className="text-xs font-semibold text-[#33475b] bg-[#eaf0f6] rounded-lg px-2.5 py-2">
          Claim estimate: {formatInr(claimPreview)}
        </p>
      ) : null}

      <select
        value={visitOutcome}
        onChange={(e) => setVisitOutcome(e.target.value)}
        className="w-full text-xs border rounded-lg px-2.5 py-1.5"
      >
        <option value="completed">Completed</option>
        <option value="rescheduled">Rescheduled</option>
        <option value="no_show">No show</option>
      </select>

      <textarea
        value={visitNotes}
        onChange={(e) => setVisitNotes(e.target.value)}
        rows={3}
        placeholder="Visit notes, outcomes, next steps…"
        className="w-full text-xs border rounded-lg px-2.5 py-1.5"
      />

      <div className="flex flex-col gap-2">
        <button
          type="submit"
          disabled={busy || (!isEdit && !quickLog && !visitMeetingId && pendingVisits.length > 0)}
          className="w-full py-2 text-xs font-semibold border-2 border-[#FF773D] rounded-lg disabled:opacity-50"
        >
          {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Save visit & travel claim'}
        </button>
        {isEdit && onCancel ? (
          <button type="button" onClick={onCancel} className="w-full py-2 text-xs font-semibold text-[#516f90]">
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  )
}
