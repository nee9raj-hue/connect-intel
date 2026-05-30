import { useEffect, useMemo, useState } from 'react'
import {
  TRAVEL_MODES,
  buildLeadDestinationLabel,
  computeTravelClaimAmount,
  formatInr,
} from '../../lib/fieldVisitExpenses'
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '../../lib/crmUiConstants'

export default function FieldVisitRecordForm({
  lead,
  meetings = [],
  settings,
  busy = false,
  onSubmit,
}) {
  const destinationDefault = useMemo(() => buildLeadDestinationLabel(lead), [lead])
  const pendingVisits = useMemo(
    () => meetings.filter((m) => m.type === 'field_visit' && !m.visitRecordedAt),
    [meetings]
  )

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

  useEffect(() => {
    setEndLabel(destinationDefault)
  }, [destinationDefault])

  useEffect(() => {
    setStartLabel(settings?.defaultStartLocation || '')
  }, [settings?.defaultStartLocation])

  useEffect(() => {
    if (pendingVisits.length === 1 && !visitMeetingId) {
      setVisitMeetingId(pendingVisits[0].id)
      setQuickLog(false)
    }
  }, [pendingVisits, visitMeetingId])

  const claimPreview = useMemo(() => {
    const travel = {
      mode: travelMode,
      distanceKm: Number(distanceKm) || 0,
      cabAmount: Number(cabAmount) || 0,
    }
    return computeTravelClaimAmount(travel, settings)
  }, [travelMode, distanceKm, cabAmount, settings])

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit?.({
      meetingId: quickLog ? null : visitMeetingId || null,
      quickLog,
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
        distanceSource: 'manual',
      },
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 field-visit-record-form">
      {pendingVisits.length > 0 ? (
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

      {quickLog ? (
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
          onChange={(e) => setStartLabel(e.target.value)}
          placeholder="Office / home / starting point"
          className="mt-0.5 w-full text-xs border rounded-lg px-2.5 py-1.5"
        />
      </label>

      <label className="block">
        <span className="text-[10px] font-semibold uppercase text-gray-400">Destination</span>
        <input
          value={endLabel}
          onChange={(e) => setEndLabel(e.target.value)}
          placeholder="Customer address or area"
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
          </span>
          <input
            type="number"
            min="0"
            step="0.1"
            value={distanceKm}
            onChange={(e) => setDistanceKm(e.target.value)}
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

      <button
        type="submit"
        disabled={busy || (!quickLog && !visitMeetingId && pendingVisits.length > 0)}
        className="w-full py-2 text-xs font-semibold border-2 border-[#FF773D] rounded-lg disabled:opacity-50"
      >
        {busy ? 'Saving…' : 'Save visit & travel claim'}
      </button>
    </form>
  )
}
