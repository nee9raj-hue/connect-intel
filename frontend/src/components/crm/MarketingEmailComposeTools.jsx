import { useMemo } from 'react'
import { leadDisplayName } from '../../lib/emailUtils'
import {
  localizeSampleDraftForLead,
  mergeTemplateFields,
} from '../../../../lib/server/marketingTemplates.js'
import { MERGE_FIELDS } from '../../lib/marketingEmailDesign.js'

export function RecipientEmailPreview({
  recipients,
  previewIndex,
  onPreviewIndexChange,
  subject,
  body,
  personalizeEach,
  sampleLead,
  aiPreview,
  aiPreviewLoading,
  onPreviewAiDraft,
}) {
  const total = recipients.length
  const idx = total ? Math.min(Math.max(0, previewIndex), total - 1) : 0
  const lead = recipients[idx]

  const merged = useMemo(() => {
    if (!lead) return { subject: '', body: '' }
    if (personalizeEach && aiPreview?.leadId === lead.id) {
      return { subject: aiPreview.subject || '', body: aiPreview.body || '' }
    }
    const hasDraft = Boolean(subject?.trim() || body?.trim())
    if (personalizeEach && !hasDraft) {
      return { subject: '', body: '' }
    }
    if (personalizeEach && hasDraft && sampleLead) {
      return localizeSampleDraftForLead(
        { subject: subject || '', body: body || '' },
        sampleLead,
        lead
      )
    }
    return mergeTemplateFields({ subject: subject || '', body: body || '' }, lead)
  }, [lead, subject, body, personalizeEach, sampleLead, aiPreview])

  if (!total) return null

  return (
    <section className="space-y-2 rounded-lg border border-[#dfe3eb] bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase text-gray-400">Recipient preview</h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="text-xs px-2 py-1 rounded border border-gray-200 disabled:opacity-40"
            disabled={idx <= 0}
            onClick={() => onPreviewIndexChange(idx - 1)}
          >
            ←
          </button>
          <span className="text-xs text-gray-500 tabular-nums min-w-[4.5rem] text-center">
            {idx + 1} / {total}
          </span>
          <button
            type="button"
            className="text-xs px-2 py-1 rounded border border-gray-200 disabled:opacity-40"
            disabled={idx >= total - 1}
            onClick={() => onPreviewIndexChange(idx + 1)}
          >
            →
          </button>
        </div>
      </div>

      <p className="text-xs text-[#516f90]">
        <span className="font-medium text-[#33475b]">{leadDisplayName(lead)}</span>
        {lead.email ? ` · ${lead.email}` : ''}
        {lead.company ? ` · ${lead.company}` : ''}
      </p>

      {personalizeEach && onPreviewAiDraft && (
        <button
          type="button"
          onClick={() => onPreviewAiDraft(lead)}
          disabled={aiPreviewLoading}
          className="text-xs font-semibold text-[#ff7a59] hover:underline disabled:opacity-50"
        >
          {aiPreviewLoading ? 'Drafting for this lead…' : '✨ Preview AI draft for this lead'}
        </button>
      )}

      <div className="rounded-lg bg-[#f5f8fa] border border-[#eaf0f6] p-2.5 space-y-2">
        <p className="text-xs font-semibold text-[#33475b] break-words">
          {merged.subject || <span className="text-gray-400 font-normal">(no subject yet)</span>}
        </p>
        <pre className="text-xs text-[#516f90] whitespace-pre-wrap font-sans leading-relaxed max-h-40 overflow-y-auto">
          {merged.body ||
            (personalizeEach && !subject?.trim() && !body?.trim()
              ? 'AI will write a unique message for each lead at send time.'
              : '(no body yet)')}
        </pre>
      </div>

      {!personalizeEach && (
        <p className="text-[11px] text-gray-400">
          Merge fields: {MERGE_FIELDS.map((f) => f.token).join(', ')}
        </p>
      )}
    </section>
  )
}
