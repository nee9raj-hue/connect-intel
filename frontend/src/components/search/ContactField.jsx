export default function ContactField({
  lead,
  field,
  value,
  missingLabel,
  mono = false,
  onReveal,
  revealing = false,
}) {
  const access = lead.access || {}
  const locked = field === 'email' ? access.emailLocked : access.phoneLocked
  const unlocked = field === 'email' ? access.emailUnlocked : access.phoneUnlocked
  const pricePaise = field === 'email' ? access.emailUnlockPricePaise : access.phoneUnlockPricePaise

  if (!value && !locked) {
    return <span className="text-[11px] text-red-600 font-medium">{missingLabel}</span>
  }

  if (unlocked && value && !String(value).includes('•')) {
    const href = field === 'email' ? `mailto:${value}` : `tel:${value}`
    const className = `text-[12px] text-gray-800 break-all hover:text-[#8a6600] hover:underline ${mono ? 'font-mono' : ''}`
    return (
      <a href={href} className={className}>
        {value}
      </a>
    )
  }

  if (locked) {
    return (
      <button
        type="button"
        onClick={() => onReveal?.(lead, field)}
        disabled={revealing}
        className="text-[11px] font-semibold text-left text-[#8a6600] bg-[#fffbeb] border border-[#ffe48a] rounded px-2 py-1 hover:bg-[#fff4bf] disabled:opacity-60"
      >
        {revealing ? 'Revealing…' : `Reveal ${field} · ₹${(pricePaise || 100) / 100}`}
      </button>
    )
  }

  return <span className={`text-[12px] text-gray-800 break-all ${mono ? 'font-mono' : ''}`}>{value}</span>
}
