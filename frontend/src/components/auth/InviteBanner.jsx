import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { storeInviteToken } from '../../context/AppContext'

export default function InviteBanner({ token, onContinue }) {
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!token) return
    storeInviteToken(token)
    api
      .previewInvite(token)
      .then((data) => setPreview(data.invite))
      .catch((e) => setError(e.message))
  }, [token])

  if (error) {
    return (
      <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-100 text-sm text-red-800">
        {error}
      </div>
    )
  }

  if (!preview) {
    return (
      <div className="mb-6 p-4 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-600">
        Loading invitation…
      </div>
    )
  }

  return (
    <div className="mb-6 p-4 rounded-lg bg-[#fff4ee] border border-[#ffd4b8]">
      <p className="text-sm font-semibold text-[#FF773D]">
        You&apos;re invited to {preview.organizationName}
      </p>
      <p className="text-xs text-gray-600 mt-1">
        Sign in as <strong>{preview.email}</strong> to join as {preview.pipelineRoleLabel}.
        {preview.canSearch ? ' You will be able to search leads using company credits.' : ''}
      </p>
      <button
        type="button"
        onClick={onContinue}
        className="mt-3 text-xs font-semibold text-[#FF773D] underline"
      >
        Continue to sign in
      </button>
    </div>
  )
}
