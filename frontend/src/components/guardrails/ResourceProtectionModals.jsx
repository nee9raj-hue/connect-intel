import GuidanceCard, { GuidanceModal } from './GuidanceCard.jsx'

export function PipelineEmailGuideModal({ open, variant, onMarketingHub, onClose }) {
  if (!open) return null
  const isBlock = variant === 'block_large'
  return (
    <GuidanceModal open onClose={onClose}>
      <GuidanceCard
        icon="✉"
        title={isBlock ? 'Campaigns work best here' : 'Recommended for larger outreach'}
        message={
          isBlock
            ? 'Large audience outreach is managed through Marketing Hub Campaigns.'
            : 'For larger outreach, use Marketing Hub Campaigns for better tracking, deliverability, and reporting.'
        }
        hint="Marketing Hub is built for campaigns — pipeline email shines for personal 1-to-1 follow-ups."
        primaryLabel={isBlock ? 'Open Marketing Hub' : 'Move to Marketing Hub'}
        onPrimary={onMarketingHub}
        secondaryLabel="Cancel"
        onSecondary={onClose}
      />
    </GuidanceModal>
  )
}

export function BulkAssignConfirmModal({ open, count, variant, onContinue, onReview, onClose }) {
  if (!open) return null
  const needsManager = variant === 'manager_required'
  return (
    <GuidanceModal open onClose={onClose}>
      <GuidanceCard
        icon="◎"
        title={needsManager ? 'Team lead review suggested' : 'Review before assigning'}
        message={
          needsManager
            ? 'This assignment is larger than usual for your role. A manager or admin can help distribute leads fairly across the team.'
            : 'You are assigning a large group of leads. This action may impact team workloads.'
        }
        hint={
          needsManager
            ? `${count.toLocaleString()} leads selected`
            : `${count.toLocaleString()} leads will change owner`
        }
        primaryLabel={needsManager ? 'Review selection' : 'Continue'}
        onPrimary={needsManager ? onReview : onContinue}
        secondaryLabel={needsManager ? 'Cancel' : 'Review'}
        onSecondary={needsManager ? onClose : onReview}
      />
    </GuidanceModal>
  )
}

export function BulkEditReviewModal({
  open,
  count,
  currentStageLabel,
  targetStageLabel,
  onConfirm,
  onClose,
}) {
  if (!open) return null
  return (
    <GuidanceModal open onClose={onClose}>
      <GuidanceCard
        icon="↻"
        title="Confirm bulk update"
        message="You're about to update a large group of records. Take a moment to confirm the details below."
        hint={
          <>
            <span className="ci-guidance-review-row">
              <strong>Records</strong> {count.toLocaleString()}
            </span>
            {currentStageLabel ? (
              <span className="ci-guidance-review-row">
                <strong>Current stage</strong> {currentStageLabel}
              </span>
            ) : null}
            {targetStageLabel ? (
              <span className="ci-guidance-review-row">
                <strong>Target stage</strong> {targetStageLabel}
              </span>
            ) : null}
          </>
        }
        primaryLabel="Confirm update"
        onPrimary={onConfirm}
        secondaryLabel="Go back"
        onSecondary={onClose}
      />
    </GuidanceModal>
  )
}

export function ExportPrepareModal({ open, count, mode, onContinue, onClose, preparing }) {
  if (!open) return null
  const isBackground = mode === 'background'
  return (
    <GuidanceModal open onClose={preparing ? undefined : onClose}>
      <GuidanceCard
        icon="↓"
        title={isBackground ? 'Preparing your export' : 'Export ready to prepare'}
        message={
          isBackground
            ? preparing
              ? `We're assembling ${count.toLocaleString()} records — you'll be notified when your file is ready.`
              : 'Your export is ready. Download will start automatically.'
            : `We'll prepare ${count.toLocaleString()} records for download. This keeps your pipeline snappy while you work.`
        }
        hint={
          isBackground
            ? 'Recommended for larger operations — Marketing Hub also offers rich campaign and audience exports.'
            : 'You can keep working while we finish up.'
        }
        primaryLabel={preparing ? undefined : isBackground ? 'Got it' : 'Continue export'}
        onPrimary={preparing ? undefined : onContinue}
        secondaryLabel={preparing ? undefined : 'Cancel'}
        onSecondary={preparing ? undefined : onClose}
      />
    </GuidanceModal>
  )
}

export function MeetingsBulkGuideModal({ open, count, onClose }) {
  if (!open) return null
  return (
    <GuidanceModal open onClose={onClose}>
      <GuidanceCard
        icon="📅"
        title="Schedule in smaller groups"
        message="For larger scheduling, use a guided workflow — book up to 25 meetings at a time for the best experience."
        hint={`${count} meetings selected — try batches of 25 or use calendar templates.`}
        primaryLabel="Got it"
        onPrimary={onClose}
        onSecondary={null}
      />
    </GuidanceModal>
  )
}
