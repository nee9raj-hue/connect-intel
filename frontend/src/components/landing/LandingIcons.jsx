/** Consistent stroke icons for enterprise landing (Lucide-style, no external dep). */

const defaults = {
  width: 20,
  height: 20,
  strokeWidth: 1.75,
  className: '',
}

function Icon({ children, className = '' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={defaults.strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      width={defaults.width}
      height={defaults.height}
      aria-hidden
    >
      {children}
    </svg>
  )
}

export function IconPipeline(props) {
  return (
    <Icon {...props}>
      <path d="M4 6h16M4 12h10M4 18h6" />
    </Icon>
  )
}

export function IconShield(props) {
  return (
    <Icon {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </Icon>
  )
}

export function IconSpark(props) {
  return (
    <Icon {...props}>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </Icon>
  )
}

export function IconUsers(props) {
  return (
    <Icon {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </Icon>
  )
}

export function IconChart(props) {
  return (
    <Icon {...props}>
      <path d="M3 3v18h18" />
      <path d="M7 16l4-6 4 3 5-7" />
    </Icon>
  )
}

export function IconMail(props) {
  return (
    <Icon {...props}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 6-10 7L2 6" />
    </Icon>
  )
}

export function IconBolt(props) {
  return (
    <Icon {...props}>
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </Icon>
  )
}

export function IconBuilding(props) {
  return (
    <Icon {...props}>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22v-4h6v4M9 6h.01M15 6h.01M9 10h.01M15 10h.01M9 14h.01M15 14h.01" />
    </Icon>
  )
}

export const ENTERPRISE_ICON_MAP = {
  'Multi-tenant architecture': IconBuilding,
  'Role-based access': IconUsers,
  'Audit logs': IconShield,
  'Scalable infrastructure': IconChart,
  'Data isolation': IconShield,
  'Security-first auth': IconShield,
  'Organization management': IconUsers,
  'API-ready platform': IconBolt,
}
