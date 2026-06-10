import { C } from './settingsTheme'

export default function HierarchySetupBanner({ error, sql }) {
  if (!error && sql !== false) return null

  const message =
    error ||
    'Departments and teams need SQL hierarchy enabled. Run Supabase migrations and enterprise backfill for your org.'

  return (
    <div
      role="alert"
      style={{
        marginBottom: 16,
        padding: '12px 16px',
        borderRadius: 8,
        background: '#faeeda',
        border: `0.5px solid ${C.border}`,
        fontSize: 12,
        color: '#633806',
        lineHeight: 1.5,
      }}
    >
      <p style={{ margin: 0, fontWeight: 500 }}>Team hierarchy unavailable</p>
      <p style={{ margin: '6px 0 0' }}>{message}</p>
    </div>
  )
}
