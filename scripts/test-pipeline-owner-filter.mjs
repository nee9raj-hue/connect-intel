import {
  pipelineAssigneePostgrestFilter,
  pipelineEntryMatchesAssignee,
} from '../lib/server/pipelineQuery.js'

const neeraj = 'user-neeraj'
const dakash = 'user-dakash'

const savedByNeerajAssignedDakash = {
  assignedToUserId: dakash,
  savedByUserId: neeraj,
  userId: neeraj,
}

if (pipelineEntryMatchesAssignee(savedByNeerajAssignedDakash, neeraj)) {
  console.error('assigned owner filter must not match saved-by only')
  process.exit(1)
}

if (!pipelineEntryMatchesAssignee(savedByNeerajAssignedDakash, dakash)) {
  console.error('assigned owner filter should match assignee')
  process.exit(1)
}

const postgrest = pipelineAssigneePostgrestFilter(neeraj)
if (!postgrest.includes('assignedToUserId') || postgrest.includes('savedByUserId')) {
  console.error('postgrest owner filter should use assignedToUserId only', postgrest)
  process.exit(1)
}

console.log('✓ Pipeline owner filter regression passed')
