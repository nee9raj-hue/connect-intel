import { CRM_STATUS_IDS, crmLeadStatusLabel } from '../../../lib/crmConstants'

const STAGE_ORDER = CRM_STATUS_IDS

export default function SalesPipelineSnapshot({ stages = [], role = 'rep', total = 0, onStageClick }) {
  const rows = STAGE_ORDER.map((id) => {
    const hit = (stages || []).find((s) => s.id === id)
    return { id, count: hit?.count || 0, pct: hit?.pct || 0 }
  }).filter((r) => r.count > 0 || r.id === 'unqualified' || r.id === 'opportunity')

  const pipelineTotal = total || rows.reduce((n, r) => n + r.count, 0)

  return (
    <section className="dash-ent__pipeline" aria-label="Sales pipeline">
      <div className="dash-ent__pipeline-head">
        <div>
          <h2 className="dash-ent__section-title">Sales pipeline</h2>
          <p className="dash-ent__section-sub">
            {pipelineTotal.toLocaleString()} open leads across stages
          </p>
        </div>
        <button
          type="button"
          className="dash-home__btn"
          onClick={() =>
            onStageClick({
              panel: 'pipeline',
              returnTo: 'overview',
              ...(role === 'rep'
                ? { scopeOwner: 'me' }
                : role === 'manager'
                  ? { hierarchyTeam: 'mine' }
                  : { scope: 'all' }),
            })
          }
        >
          Open pipeline
        </button>
      </div>
      <div className="dash-ent__pipeline-funnel">
        {rows.map((row) => (
          <button
            key={row.id}
            type="button"
            className="dash-ent__pipeline-stage"
            aria-label={`${crmLeadStatusLabel(row.id)}: ${row.count} leads`}
            onClick={() =>
              onStageClick({
                panel: 'pipeline',
                status: row.id,
                returnTo: 'overview',
                ...(role === 'rep'
                  ? { scopeOwner: 'me' }
                  : role === 'manager'
                    ? { hierarchyTeam: 'mine' }
                    : { scope: 'all' }),
              })
            }
          >
            <span className="dash-ent__pipeline-stage-label">{crmLeadStatusLabel(row.id)}</span>
            <span className="dash-ent__pipeline-stage-bar" style={{ '--w': `${Math.max(row.pct || 8, 8)}%` }} />
            <span className="dash-ent__pipeline-stage-count">{row.count}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
