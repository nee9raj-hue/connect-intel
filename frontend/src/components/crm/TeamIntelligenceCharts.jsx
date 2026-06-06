import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { INTEL_CHART_COLORS } from '../../lib/teamIntelligenceConstants'

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="intel-chart-tooltip">
      <p className="intel-chart-tooltip__label">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: <strong>{entry.value}</strong>
        </p>
      ))}
    </div>
  )
}

export function ActivityMixPie({ data = [] }) {
  if (!data.length) {
    return <p className="dashboard-empty">No activity recorded this period.</p>
  }
  const chartData = data.map((row) => ({ name: row.label, value: row.count }))
  return (
    <div className="intel-chart intel-chart--pie">
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={52}
            outerRadius={88}
            paddingAngle={2}
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={INTEL_CHART_COLORS[i % INTEL_CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
          <Legend layout="horizontal" verticalAlign="bottom" />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ActivityTrendChart({ data = [] }) {
  if (!data.length) {
    return <p className="dashboard-empty">No daily activity yet.</p>
  }
  const chartData = data.map((d) => ({
    label: d.label,
    Email: d.email || 0,
    Calls: d.call || 0,
    WhatsApp: d.whatsapp || 0,
    Meetings: d.meeting || 0,
    Tasks: d.task || 0,
    Notes: d.note || 0,
    Total: d.count || 0,
  }))

  return (
    <div className="intel-chart intel-chart--area">
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8eef3" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#647185' }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#647185' }} />
          <Tooltip content={<ChartTooltip />} />
          <Legend />
          <Area type="monotone" dataKey="Email" stackId="1" stroke="#00a4bd" fill="#00a4bd" fillOpacity={0.7} />
          <Area type="monotone" dataKey="Calls" stackId="1" stroke="#ff7a59" fill="#ff7a59" fillOpacity={0.7} />
          <Area type="monotone" dataKey="WhatsApp" stackId="1" stroke="#25d366" fill="#25d366" fillOpacity={0.7} />
          <Area type="monotone" dataKey="Meetings" stackId="1" stroke="#516f90" fill="#516f90" fillOpacity={0.7} />
          <Area type="monotone" dataKey="Tasks" stackId="1" stroke="#f5c518" fill="#f5c518" fillOpacity={0.7} />
          <Area type="monotone" dataKey="Notes" stackId="1" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.65} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function TeamHoursBarChart({ members = [] }) {
  if (!members.length) return <p className="dashboard-empty">No team members.</p>
  const chartData = members.slice(0, 12).map((m) => ({
    name: m.name?.split(' ')[0] || 'Member',
    hours: m.hoursInApp || 0,
    activities: m.activitiesTotal || 0,
  }))

  return (
    <div className="intel-chart intel-chart--bar">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8eef3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#647185' }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#647185' }} />
          <Tooltip content={<ChartTooltip />} />
          <Legend />
          <Bar dataKey="hours" name="Hours in app" fill="#00a4bd" radius={[4, 4, 0, 0]} />
          <Bar dataKey="activities" name="CRM actions" fill="#ff7a59" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function PipelineFunnelChart({ rows = [], onClick }) {
  if (!rows.length) return <p className="dashboard-empty">No pipeline data.</p>
  const max = Math.max(1, ...rows.map((r) => r.count))
  return (
    <ul className="intel-funnel-list">
      {rows.map((row) => {
        const pct = Math.round((row.count / max) * 100)
        const label = row.label || row.status?.replace(/_/g, ' ')
        return (
          <li key={row.status}>
            <button type="button" className="intel-funnel-row" onClick={() => onClick?.(row.status)}>
              <span className="intel-funnel-row__label">{label}</span>
              <span className="intel-funnel-row__track">
                <span className="intel-funnel-row__fill" style={{ width: `${pct}%` }} />
              </span>
              <span className="intel-funnel-row__count">{row.count}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
