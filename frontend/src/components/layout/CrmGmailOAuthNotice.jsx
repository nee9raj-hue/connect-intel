import { useEffect, useState } from 'react'

import { sanitizeCustomerText } from '../../lib/productCopy'

/** Shows success/error after Connect work email OAuth redirect (all users). */
export default function CrmGmailOAuthNotice({ onOpenTeam }) {
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const oauth = params.get('crm_gmail')
    const message = params.get('message')
    const mailbox = params.get('mailbox')

    if (!oauth) return

    if (oauth === 'connected') {
      setNotice({
        type: 'success',
        title: 'Work email connected',
        body: mailbox
          ? `Sending from ${decodeURIComponent(mailbox)}. Open Pipeline → Email to send to leads.`
          : 'Your work email is connected. Open Pipeline → Email to send.',
      })
    } else if (oauth === 'error') {
      const raw = message
        ? sanitizeCustomerText(decodeURIComponent(message.replace(/\+/g, ' ')))
        : ''
      const blocked = /verification|access blocked|has not completed/i.test(raw)
      const body = blocked
        ? `${raw || 'Google blocked access.'}\n\nUse company domain email instead (ask your admin — Team → Outbound email), or ask Connect Intel to add your address as a Google OAuth test user. Open Work email in the sidebar for steps.`
        : raw || 'Connection failed. Open Work email in the sidebar to try again.'
      setNotice({
        type: 'error',
        title: blocked ? 'Google has not verified Connect Intel yet' : 'Could not connect work email',
        body,
      })
    }

    const url = new URL(window.location.href)
    url.searchParams.delete('crm_gmail')
    url.searchParams.delete('message')
    url.searchParams.delete('mailbox')
    window.history.replaceState({}, '', url.pathname + url.search)
  }, [])

  if (!notice) return null

  const styles =
    notice.type === 'success'
      ? 'bg-green-50 border-green-300 text-green-900'
      : 'bg-red-50 border-red-300 text-red-900'

  return (
    <div className={`shrink-0 mx-3 md:mx-4 mt-2 rounded-lg border px-4 py-3 text-sm ${styles}`} role="alert">
      <p className="font-semibold">{notice.title}</p>
      <p className="text-xs mt-1 leading-relaxed opacity-90 whitespace-pre-wrap">{notice.body}</p>
      {notice.type === 'error' && onOpenTeam && (
        <button type="button" onClick={onOpenTeam} className="mt-2 text-xs font-semibold underline">
          Open Work email setup
        </button>
      )}
      <button
        type="button"
        onClick={() => setNotice(null)}
        className="mt-2 ml-3 text-xs opacity-70 hover:opacity-100"
      >
        Dismiss
      </button>
    </div>
  )
}
