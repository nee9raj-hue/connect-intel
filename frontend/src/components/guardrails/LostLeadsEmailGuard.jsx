import GuidanceCard, { GuidanceModal } from './GuidanceCard.jsx'

export default function LostLeadsEmailGuard({
  open,
  lostCount,
  onExclude,
  onIncludeAll,
  onReview,
  onClose,
}) {
  if (!open || lostCount < 1) return null

  return (
    <GuidanceModal open onClose={onClose}>
      <GuidanceCard
        icon="◎"
        title="Review your audience"
        message="Some selected contacts are marked as Lost. Exclude them from this campaign?"
        hint={`${lostCount} contact${lostCount === 1 ? '' : 's'} in Lost, Closed Lost, or Disqualified.`}
        primaryLabel="Exclude lost leads"
        onPrimary={onExclude}
        secondaryLabel="Include all"
        onSecondary={onIncludeAll}
      />
      <button
        type="button"
        className="ci-guidance-link"
        onClick={onReview}
      >
        Review selection
      </button>
    </GuidanceModal>
  )
}
