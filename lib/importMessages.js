/**
 * User-facing copy for CSV/Excel imports — no internal terms (master DB, etc.).
 */
export function formatImportSuccessMessage(stats = {}, { addToPipeline = true } = {}) {
  const added = Number(stats.pipelineAdded) || 0
  const skipped = Number(stats.pipelineSkipped) || 0
  const rejected = Number(stats.rejectedRows) || 0
  const contacts = Number(stats.contactsCreated) || 0

  if (!addToPipeline) {
    if (contacts === 0) return 'No new contacts were saved from your file.'
    return `Saved ${contacts} contact${contacts === 1 ? '' : 's'} from your file.`
  }

  if (added === 0 && skipped > 0) {
    return `No new contacts added — ${skipped} ${skipped === 1 ? 'was' : 'were'} already in your pipeline.`
  }

  if (added === 0 && contacts === 0 && rejected > 0) {
    return `Import finished. ${rejected} row${rejected === 1 ? '' : 's'} could not be imported — check email or company name.`
  }

  if (added === 0) {
    return 'Import finished. No new contacts were added to your pipeline.'
  }

  let msg = `Successfully imported ${added} contact${added === 1 ? '' : 's'} into your pipeline.`
  if (skipped > 0) {
    msg += ` ${skipped} duplicate${skipped === 1 ? '' : 's'} skipped.`
  }
  if (rejected > 0) {
    msg += ` ${rejected} row${rejected === 1 ? '' : 's'} could not be imported.`
  }
  return msg
}
