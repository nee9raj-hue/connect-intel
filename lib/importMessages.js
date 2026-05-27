/**
 * User-facing copy for CSV/Excel imports — no internal terms (master DB, etc.).
 */
export function formatImportSuccessMessage(stats = {}, { addToPipeline = true } = {}) {
  const added = Number(stats.pipelineAdded) || 0
  const updated = Number(stats.pipelineUpdated) || 0
  const skipped = Number(stats.pipelineSkipped) || 0
  const rejected = Number(stats.rejectedRows) || 0
  const contacts = Number(stats.contactsCreated) || 0
  const contactsMerged = Number(stats.contactsUpdated) || 0

  if (!addToPipeline) {
    if (contacts === 0 && contactsMerged === 0) return 'No new contacts were saved from your file.'
    let m = `Saved ${contacts} new contact${contacts === 1 ? '' : 's'} from your file.`
    if (contactsMerged > 0) {
      m += ` ${contactsMerged} existing contact${contactsMerged === 1 ? '' : 's'} were refreshed with newer values.`
    }
    return m
  }

  if (added === 0 && updated === 0 && contacts === 0 && contactsMerged === 0 && rejected > 0) {
    return `Import finished. ${rejected} row${rejected === 1 ? '' : 's'} could not be imported — each row needs a company name (column: company).`
  }

  if (added === 0 && updated === 0) {
    if (skipped > 0 && contacts === 0) {
      return `Import finished. No rows were added to your pipeline — rows need email or mobile on the contact, plus a matched company row.`
    }
    return 'Import finished. No rows were applied to your pipeline.'
  }

  const parts = []
  if (added > 0) {
    parts.push(`added ${added} lead${added === 1 ? '' : 's'}`)
  }
  if (updated > 0) {
    parts.push(`updated ${updated} existing lead${updated === 1 ? '' : 's'} (matched by email or phone)`)
  }
  let msg = `Successfully ${parts.join(' and ')} in your pipeline.`
  if (skipped > 0) {
    msg += ` ${skipped} row${skipped === 1 ? '' : 's'} skipped (could not attach to CRM — check company/name and contact info).`
  }
  if (rejected > 0) {
    msg += ` ${rejected} row${rejected === 1 ? '' : 's'} could not be imported.`
  }
  if (contactsMerged > 0 && addToPipeline) {
    msg += ` ${contactsMerged} contact record${contactsMerged === 1 ? '' : 's'} merged in the shared directory.`
  }
  return msg
}
