import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildCampaignRecipientRow,
  buildCampaignV3Row,
  enrollmentFromRecipientRow,
  leadFromRecipientEnrollment,
  leadFromRecipientRow,
} from './campaignsV3Table.js'

describe('buildCampaignV3Row', () => {
  it('maps campaign fields for SQL upsert', () => {
    const row = buildCampaignV3Row(
      {
        id: 'camp-1',
        name: 'Launch',
        channel: 'email',
        status: 'active',
        sendStatus: 'sending',
        emailProvider: 'resend',
        stats: { enrolled: 10, sent: 3 },
        updatedAt: '2026-06-01T00:00:00.000Z',
      },
      { id: 'user-1', organizationId: 'org-1' }
    )

    assert.equal(row.id, 'camp-1')
    assert.equal(row.organization_id, 'org-1')
    assert.equal(row.send_status, 'sending')
    assert.equal(row.provider, 'resend')
    assert.equal(row.stats.enrolled, 10)
  })
})

describe('buildCampaignRecipientRow', () => {
  it('snapshots lead data for send-without-pipeline', () => {
    const row = buildCampaignRecipientRow(
      { id: 'camp-1' },
      {
        id: 'enr-1',
        leadId: 'lead-1',
        contactEmail: 'ada@example.com',
        status: 'active',
        currentStep: 0,
        nextSendAt: '2026-06-01T12:00:00.000Z',
      },
      {
        id: 'lead-1',
        email: 'ada@example.com',
        firstName: 'Ada',
        lastName: 'Lovelace',
        company: 'Analytical',
      }
    )

    assert.equal(row.campaign_id, 'camp-1')
    assert.equal(row.enrollment_ref, 'enr-1')
    assert.equal(row.status, 'queued')
    assert.equal(row.payload.leadSnapshot.firstName, 'Ada')
    assert.equal(row.payload.leadSnapshot.name, 'Ada Lovelace')
  })

  it('builds minimal snapshot when lead is missing', () => {
    const row = buildCampaignRecipientRow(
      { id: 'camp-1' },
      {
        id: 'enr-2',
        leadId: 'lead-2',
        contactEmail: 'bob@example.com',
        status: 'active',
      },
      null
    )

    assert.equal(row.email, 'bob@example.com')
    assert.equal(row.payload.leadSnapshot.email, 'bob@example.com')
    assert.equal(row.payload.leadSnapshot.name, 'bob@example.com')
  })
})

describe('leadFromRecipientRow', () => {
  it('rehydrates lead from SQL recipient row', () => {
    const enrollment = enrollmentFromRecipientRow({
      id: 'rec-1',
      campaign_id: 'camp-1',
      lead_id: 'lead-1',
      email: 'ada@example.com',
      status: 'queued',
      next_send_at: '2026-06-01T12:00:00.000Z',
      enrollment_ref: 'enr-1',
      payload: {
        leadSnapshot: {
          id: 'lead-1',
          email: 'ada@example.com',
          firstName: 'Ada',
          lastName: 'Lovelace',
          name: 'Ada Lovelace',
        },
      },
      updated_at: '2026-06-01T00:00:00.000Z',
    })

    const lead = leadFromRecipientEnrollment(enrollment)
    assert.equal(lead.email, 'ada@example.com')
    assert.equal(lead.firstName, 'Ada')
    assert.equal(leadFromRecipientRow({
      id: 'rec-1',
      campaign_id: 'camp-1',
      lead_id: 'lead-1',
      email: 'ada@example.com',
      status: 'queued',
      enrollment_ref: 'enr-1',
      payload: enrollment.payload,
    }).name, 'Ada Lovelace')
  })
})
