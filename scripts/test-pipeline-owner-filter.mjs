import {
  pipelineAssigneePostgrestFilter,
  pipelineEntryMatchesAssignee,
} from '../lib/server/pipelineQuery.js'
import { pipelineOwnerUserId } from '../lib/pipelineOwner.js'

const neeraj = 'user-neeraj'
const dakash = 'user-dakash'
const lokesh = 'user-lokesh'

const savedByNeerajAssignedDakash = {
  assignedToUserId: dakash,
  savedByUserId: neeraj,
  userId: neeraj,
}

const unassignedSavedByLokesh = {
  assignedToUserId: null,
  savedByUserId: lokesh,
  userId: lokesh,
}

const assignedToNeeraj = {
  assignedToUserId: neeraj,
  savedByUserId: neeraj,
  userId: neeraj,
}

if (pipelineEntryMatchesAssignee(savedByNeerajAssignedDakash, neeraj)) {
  console.error('owner filter must not match when lead is assigned to another rep')
  process.exit(1)
}

if (!pipelineEntryMatchesAssignee(savedByNeerajAssignedDakash, dakash)) {
  console.error('owner filter should match assignee')
  process.exit(1)
}

if (!pipelineEntryMatchesAssignee(unassignedSavedByLokesh, lokesh)) {
  console.error('owner filter should match unassigned leads saved by rep')
  process.exit(1)
}

if (pipelineOwnerUserId(unassignedSavedByLokesh) !== lokesh) {
  console.error('pipelineOwnerUserId should fall back to saved-by when unassigned')
  process.exit(1)
}

if (!pipelineEntryMatchesAssignee(assignedToNeeraj, neeraj)) {
  console.error('owner filter should match explicitly assigned leads')
  process.exit(1)
}

const postgrest = pipelineAssigneePostgrestFilter(neeraj)
if (!postgrest.includes('assignedToUserId') || !postgrest.includes('owner_id')) {
  console.error('postgrest owner filter should use assignee and owner_id', postgrest)
  process.exit(1)
}

console.log('✓ Pipeline owner filter regression passed')
