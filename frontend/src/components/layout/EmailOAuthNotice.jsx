import { useEffect, useState } from 'react'

export default function EmailOAuthNotice({ onOpenSystemStatus }) {
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const oauth = params.get('email_oauth')
    const message = params.get('message')
    const mailbox = params.get('mailbox')

    if (!oauth) return

    if (oauth === 'connected') {
      setNotice({
        type: 'success',
        title: 'Invite email connected',
        body: mailbox
          ? `Sending from ${decodeURIComponent(mailbox)}. Refresh System status — Team invite email should show On.`
          : 'invite@connectintel.net is connected. Refresh System status to confirm.',
      })
      window.setTimeout(() => window.location.reload(), 1500)
    } else if (oauth === 'error') {
      setNotice({
        type: 'error',
        title: 'Could not connect invite email',
        body: message
          ? decodeURIComponent(message.replace(/\+/g, ' '))
          : 'Try again from System status → Connect invite@connectintel.net.',
      })
    } else if (oauth === 'cancelled') {
      setNotice({
        type: 'warning',
        title: 'Google sign-in cancelled',
        body: 'Click Connect again and choose invite@connectintel.net when Google asks.',
      })
    }

    const url = new URL(window.location.href)
    url.searchParams.delete('email_oauth')
    url.searchParams.delete('message')
    url.searchParams.delete('mailbox')
    window.history.replaceState({}, '', url.pathname + url.search)
  }, [])

  if (!notice) return null

  const styles =
    notice.type === 'success'
      ? 'bg-green-50 border-green-300 text-green-900'
      : notice.type === 'error'
        ? 'bg-red-50 border-red-300 text-red-900'
        : 'bg-amber-50 border-amber-300 text-amber-900'

  return (
    <div className={`shrink-0 mx-4 mt-3 rounded-lg border px-4 py-3 text-sm ${styles}`} role="alert">
      <p className="font-semibold">{notice.title}</p>
      <p className="text-xs mt-1 leading-relaxed opacity-90">{notice.body}</p>
      {notice.type !== 'success' && onOpenSystemStatus && (
        <button
          type="button"
          onClick={onOpenSystemStatus}
          className="mt-2 text-xs font-semibold underline"
        >
          Open System status
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
