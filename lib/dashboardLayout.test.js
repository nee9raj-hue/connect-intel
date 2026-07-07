import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  defaultDashboardLayout,
  normalizeDashboardLayout,
  DASHBOARD_WIDGET_IDS,
} from './dashboardLayout.js'

describe('normalizeDashboardLayout', () => {
  it('returns defaults for empty input', () => {
    const layout = normalizeDashboardLayout([])
    assert.equal(layout.length, DASHBOARD_WIDGET_IDS.length)
    const teamReview = layout.find((row) => row.id === 'team_review')
    assert.equal(teamReview?.visible, false)
    assert.ok(layout.filter((row) => row.id !== 'team_review').every((row) => row.visible !== false))
  })

  it('preserves custom order and visibility', () => {
    const layout = normalizeDashboardLayout([
      { id: 'activity', visible: false },
      { id: 'kpis', visible: true },
    ])
    assert.equal(layout.length, 2)
    assert.equal(layout[0].id, 'activity')
    assert.equal(layout[0].visible, false)
    assert.equal(layout[1].id, 'kpis')
  })
})

describe('defaultDashboardLayout', () => {
  it('includes all widget ids', () => {
    assert.deepEqual(
      defaultDashboardLayout().map((r) => r.id),
      DASHBOARD_WIDGET_IDS
    )
  })

  it('hides team review when team intelligence hub is off', () => {
    const row = defaultDashboardLayout().find((r) => r.id === 'team_review')
    assert.equal(row?.visible, false)
  })
})
