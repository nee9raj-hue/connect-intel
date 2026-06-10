import { C } from './settingsTheme'

export function SettingsCard({ children, className = '', style = {} }) {
  return (
    <div
      className={className}
      style={{
        background: C.cardBg,
        border: `0.5px solid ${C.border}`,
        borderRadius: 10,
        padding: 20,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function SettingsStatCard({ label, value, subtitle }) {
  return (
    <div
      style={{
        background: C.cardBg,
        border: `0.5px solid ${C.border}`,
        borderRadius: 8,
        padding: 16,
        minHeight: 88,
      }}
    >
      <p
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: C.textMuted,
          margin: 0,
          fontWeight: 500,
        }}
      >
        {label}
      </p>
      <p style={{ fontSize: 24, fontWeight: 500, color: C.text, margin: '6px 0 4px', lineHeight: 1.2 }}>
        {value}
      </p>
      {subtitle && (
        <p style={{ fontSize: 12, color: C.textSecondary, margin: 0 }}>{subtitle}</p>
      )}
    </div>
  )
}

export function SettingsBadge({ bg, color, children }) {
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 11,
        fontWeight: 500,
        padding: '3px 8px',
        borderRadius: 999,
        background: bg,
        color,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

export function PrimaryButton({ children, onClick, disabled, type = 'button', style = {} }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        fontSize: 13,
        fontWeight: 500,
        padding: '9px 16px',
        borderRadius: 8,
        border: 'none',
        background: disabled ? '#c4c4c4' : C.accent,
        color: '#ffffff',
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
    >
      {children}
    </button>
  )
}

export function TextButton({ children, onClick, disabled, danger = false, style = {} }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        fontSize: 13,
        fontWeight: 500,
        padding: '6px 10px',
        borderRadius: 6,
        border: 'none',
        background: 'transparent',
        color: danger ? '#791f1f' : C.accent,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  )
}

export function SettingsInput({ value, onChange, placeholder, type = 'text', style = {} }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{
        fontSize: 13,
        padding: '9px 12px',
        border: `0.5px solid ${C.border}`,
        borderRadius: 8,
        background: '#fff',
        color: C.text,
        outline: 'none',
        width: '100%',
        ...style,
      }}
    />
  )
}

export function SettingsSelect({ value, onChange, children, style = {} }) {
  return (
    <select
      value={value}
      onChange={onChange}
      style={{
        fontSize: 13,
        padding: '9px 12px',
        border: `0.5px solid ${C.border}`,
        borderRadius: 8,
        background: '#fff',
        color: C.text,
        ...style,
      }}
    >
      {children}
    </select>
  )
}

export function SectionLabel({ children }) {
  return (
    <p
      style={{
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: C.textMuted,
        margin: '0 0 12px',
        fontWeight: 500,
      }}
    >
      {children}
    </p>
  )
}

export function Toast({ message, type = 'success', onClose }) {
  if (!message) return null
  const isError = type === 'error'
  return (
    <div
      role={isError ? 'alert' : 'status'}
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 60,
        fontSize: 13,
        fontWeight: 500,
        padding: '12px 16px',
        borderRadius: 10,
        background: isError ? '#fcebeb' : '#eaf3de',
        color: isError ? '#791f1f' : '#27500a',
        border: `0.5px solid ${C.border}`,
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        maxWidth: 360,
      }}
    >
      {message}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          style={{ marginLeft: 12, fontSize: 12, border: 'none', background: 'none', cursor: 'pointer' }}
        >
          ✕
        </button>
      )}
    </div>
  )
}
