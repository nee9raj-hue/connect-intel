import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  dedupeKnowledgeCompanies,
  buildCompactKnowledgeReply,
} from './knowledgeAgent.js'

describe('knowledgeAgent', () => {
  it('dedupes same company with multiple founders', () => {
    const rows = [
      { company: 'BluePine Foods', contactName: 'Aditi Madan', id: 'a' },
      { company: 'BluePine Foods', contactName: 'Naveen Panwar', id: 'b' },
      { company: 'Chefling', contactName: 'Rounit Kashyap Gambhir', id: 'c' },
    ]
    const out = dedupeKnowledgeCompanies(rows)
    assert.equal(out.length, 2)
    assert.match(out[0].contactName, /Aditi Madan/)
    assert.match(out[0].contactName, /Naveen Panwar/)
  })

  it('builds a short knowledge reply', () => {
    const u = {
      entity: 'Shark Tank India',
      season: 'all',
      filters: { linkedin: true, preferExport: true },
    }
    const reply = buildCompactKnowledgeReply(u, [{}, {}, {}], {
      linkedinCount: 2,
      exportCount: 1,
    })
    assert.match(reply, /3.*Shark Tank India/)
    assert.match(reply, /2.*verified LinkedIn/)
    assert.doesNotMatch(reply, /Why it matters/i)
  })
})
