import { useCallback, useState } from 'react'
import { useApp } from '../context/AppContext'
import {
  buildTelUrl,
  formatPhoneDisplay,
  leadHasCallablePhone,
  normalizePhoneDigits,
} from '../lib/phoneUtils'

/**
 * Opens the system dialer and logs an outbound call on the lead timeline.
 */
export function useLeadPhoneCall(leadId) {
  const { patchLead } = useApp()
  const [logging, setLogging] = useState(false)

  const initiateCall = useCallback(
    async (phone) => {
      const telUrl = buildTelUrl(phone)
      if (!telUrl) return { ok: false, reason: 'invalid_phone' }

      const digits = normalizePhoneDigits(phone)
      const display = formatPhoneDisplay(digits) || String(phone || '').trim()

      if (leadId) {
        setLogging(true)
        try {
          await patchLead(leadId, {
            activity: {
              type: 'call',
              summary: `Outgoing call to ${display}`,
              meta: {
                phone: display,
                direction: 'outbound',
                status: 'initiated',
                initiatedAt: new Date().toISOString(),
              },
            },
          })
        } catch (error) {
          setLogging(false)
          return { ok: false, reason: error.message || 'log_failed' }
        }
        setLogging(false)
      }

      window.location.href = telUrl
      return { ok: true }
    },
    [leadId, patchLead]
  )

  return {
    initiateCall,
    logging,
    canCall: (phone) => leadHasCallablePhone(phone),
  }
}
