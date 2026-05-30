import { BRAND_SETTINGS_ICON, BRAND_SETTINGS_ICON_CLASS } from '../../lib/brandAssets'

function LineIcon({ className, children, viewBox = '0 0 24 24' }) {
  return (
    <svg
      className={className}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
      aria-hidden
    >
      {children}
    </svg>
  )
}

/** Brand settings gear — use for view settings and configuration affordances. */
export function SettingsIcon({ className = '', size, alt = '' }) {
  const dim = size != null ? { width: size, height: size } : undefined
  return (
    <img
      src={BRAND_SETTINGS_ICON}
      alt={alt}
      className={[BRAND_SETTINGS_ICON_CLASS, className].filter(Boolean).join(' ')}
      style={dim}
      width={size}
      height={size}
      draggable={false}
      aria-hidden={alt ? undefined : true}
    />
  )
}

/** Stroke settings gear — adapts to currentColor (sidebar, dark/light UI). */
export function SettingsGearIcon({ className }) {
  return (
    <LineIcon className={className}>
      <circle cx="12" cy="12" r="3.25" />
      <path d="M12 3.25v2M12 18.75v2M5.04 5.04l1.41 1.41M17.55 17.55l1.41 1.41M3.25 12h2M18.75 12h2M5.04 18.96l1.41-1.41M17.55 6.45l1.41-1.41" />
    </LineIcon>
  )
}

export function MapPinIcon({ className }) {
  return (
    <LineIcon className={className}>
      <path d="M12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
      <path d="M12 21s-6.5-6.12-6.5-10.5a6.5 6.5 0 1 1 13 0C18.5 14.88 12 21 12 21Z" />
    </LineIcon>
  )
}

export function MapIcon({ className }) {
  return (
    <LineIcon className={className}>
      <path d="M3 6.5 9 4l6 2.5 6-2.5v13l-6 2.5-6-2.5-6 2.5V6.5Z" />
      <path d="M9 4v13M15 6.5v13" />
    </LineIcon>
  )
}

export function SlidersIcon({ className }) {
  return (
    <LineIcon className={className}>
      <path d="M4 7h16M4 12h16M4 17h16" />
      <path d="M8 5.25v3.5M14 10.25v3.5M10 15.25v3.5" />
    </LineIcon>
  )
}

export function BellIcon({ className }) {
  return (
    <LineIcon className={className}>
      <path d="M6.75 8.75a5.25 5.25 0 1 1 10.5 0v4.18c0 .57.23 1.12.64 1.53l.86.86H5.25l.86-.86c.41-.41.64-.96.64-1.53V8.75Z" />
      <path d="M10 18a2 2 0 0 0 4 0" />
    </LineIcon>
  )
}

export function ChevronRightIcon({ className }) {
  return (
    <LineIcon className={className}>
      <path d="m9 6 6 6-6 6" />
    </LineIcon>
  )
}

export function ChevronLeftIcon({ className }) {
  return (
    <LineIcon className={className}>
      <path d="m15 6-6 6 6 6" />
    </LineIcon>
  )
}

export function SaveIcon({ className }) {
  return (
    <LineIcon className={className}>
      <path d="M5 5h11v14H5z" />
      <path d="M8 5V3h8v2" />
      <path d="M8 13h8v6H8z" />
    </LineIcon>
  )
}

export function GripIcon({ className }) {
  return (
    <LineIcon className={className} viewBox="0 0 24 24">
      <circle cx="9" cy="7" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="15" cy="7" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="9" cy="17" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="15" cy="17" r="1.25" fill="currentColor" stroke="none" />
    </LineIcon>
  )
}

export function DatabaseIcon({ className }) {
  return (
    <LineIcon className={className}>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v5c0 1.66 3.13 3 7 3s7-1.34 7-3V6" />
      <path d="M5 11v7c0 1.66 3.13 3 7 3s7-1.34 7-3v-7" />
    </LineIcon>
  )
}

export function TeamIcon({ className }) {
  return (
    <LineIcon className={className}>
      <path d="M16 18v-.75A3.25 3.25 0 0 0 12.75 14h-3.5A3.25 3.25 0 0 0 6 17.25V18" />
      <circle cx="11" cy="8" r="3" />
      <path d="M17.25 15.25v-.25A2.75 2.75 0 0 1 20 12.25" />
      <path d="M17 5.75a2.25 2.25 0 1 1 0 4.5" />
    </LineIcon>
  )
}

export function WhatsAppIcon({ className }) {
  return (
    <LineIcon className={className}>
      <path d="M12 20a7.9 7.9 0 0 1-3.81-.97L4.5 20l1-3.57A8 8 0 1 1 12 20Z" />
      <path d="M9.4 8.9c.18-.4.38-.4.56-.4h.48c.16 0 .37.06.49.34l.55 1.31c.08.2.05.37-.05.52l-.42.6c-.1.15-.08.28.02.42.2.31.62.95 1.44 1.46.28.18.41.16.57-.03l.55-.65c.14-.17.3-.2.5-.13l1.34.5c.28.1.38.3.35.52l-.03.42c-.05.46-.37.87-.8 1.02-.34.12-.8.17-1.37-.05-.66-.26-1.55-.8-2.6-1.88-1.17-1.19-1.78-2.32-2.05-3.07-.2-.56-.1-1.02.04-1.33Z" />
    </LineIcon>
  )
}

export function HomeIcon({ className }) {
  return (
    <LineIcon className={className}>
      <path d="M4.5 10.5 12 4l7.5 6.5" />
      <path d="M7 9.75V20h10V9.75" />
      <path d="M10 20v-5.25h4V20" />
    </LineIcon>
  )
}

export function PeopleIcon({ className }) {
  return (
    <LineIcon className={className}>
      <circle cx="9" cy="8" r="2.75" />
      <path d="M4.5 18a4.5 4.5 0 0 1 9 0" />
      <path d="M15.5 10.25a2.25 2.25 0 1 0 0-4.5" />
      <path d="M18.75 18a3.75 3.75 0 0 0-3.75-3.75" />
    </LineIcon>
  )
}

export function ListIcon({ className }) {
  return (
    <LineIcon className={className}>
      <path d="M8.5 6.5h10" />
      <path d="M8.5 12h10" />
      <path d="M8.5 17.5h10" />
      <circle cx="5.25" cy="6.5" r=".75" fill="currentColor" stroke="none" />
      <circle cx="5.25" cy="12" r=".75" fill="currentColor" stroke="none" />
      <circle cx="5.25" cy="17.5" r=".75" fill="currentColor" stroke="none" />
    </LineIcon>
  )
}

export function PipelineIcon({ className }) {
  return (
    <LineIcon className={className}>
      <rect x="4" y="6" width="4.5" height="12" rx="1.25" />
      <rect x="9.75" y="9" width="4.5" height="9" rx="1.25" />
      <rect x="15.5" y="4" width="4.5" height="14" rx="1.25" />
    </LineIcon>
  )
}

export function LogIcon({ className }) {
  return (
    <LineIcon className={className}>
      <path d="M8 4.75h8l3 3V19a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6.75a2 2 0 0 1 2-2Z" />
      <path d="M16 4.75v3h3" />
      <path d="M9 11h6" />
      <path d="M9 15h6" />
    </LineIcon>
  )
}

export function CalendarIcon({ className }) {
  return (
    <LineIcon className={className}>
      <rect x="4" y="5.5" width="16" height="14.5" rx="2" />
      <path d="M8 3.75v3.5" />
      <path d="M16 3.75v3.5" />
      <path d="M4 9.5h16" />
    </LineIcon>
  )
}

export function BoltIcon({ className }) {
  return (
    <LineIcon className={className}>
      <path d="M13 2.75 5.75 13h5.1L10.9 21.25 18.25 11H13V2.75Z" />
    </LineIcon>
  )
}

export function MailIcon({ className }) {
  return (
    <LineIcon className={className}>
      <rect x="3.75" y="5.5" width="16.5" height="13" rx="2" />
      <path d="m4.5 7 7.5 5.75L19.5 7" />
    </LineIcon>
  )
}

export function ChartIcon({ className }) {
  return (
    <LineIcon className={className}>
      <path d="M4.5 19.5h15" />
      <path d="M7 16V11" />
      <path d="M12 16V7.5" />
      <path d="M17 16v-5" />
    </LineIcon>
  )
}

export function NoteIcon({ className }) {
  return (
    <LineIcon className={className}>
      <path d="M7.5 4.75h7l3 3V19a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V6.75a2 2 0 0 1 2-2Z" />
      <path d="M14.5 4.75v3h3" />
      <path d="M9 11h6" />
      <path d="M9 15h4.5" />
    </LineIcon>
  )
}

/** Team hub — chat, mentions, shared work. */
export function TeamHubIcon({ className }) {
  return (
    <LineIcon className={className}>
      <path d="M5.5 6.5h11a2.5 2.5 0 0 1 2.5 2.5v5.5a2.5 2.5 0 0 1-2.5 2.5H11l-3.5 2.5V16.5H5.5A2.5 2.5 0 0 1 3 14V9a2.5 2.5 0 0 1 2.5-2.5Z" />
      <path d="M8.25 11h3.5" />
      <path d="M8.25 13.25h5.5" />
    </LineIcon>
  )
}

export function TaskIcon({ className }) {
  return (
    <LineIcon className={className}>
      <rect x="5" y="4.75" width="14" height="16.25" rx="2" />
      <path d="M9 4.75h6v2.5H9z" />
      <path d="m9.25 13.25 1.75 1.75 3.75-4" />
    </LineIcon>
  )
}

export function SparkIcon({ className }) {
  return (
    <LineIcon className={className}>
      <path d="m12 3 1.95 5.55L19.5 10.5l-5.55 1.95L12 18l-1.95-5.55L4.5 10.5l5.55-1.95L12 3Z" />
      <path d="M5 3v2.5" />
      <path d="M3.75 4.25h2.5" />
      <path d="M19 16.5V19" />
      <path d="M17.75 17.75h2.5" />
    </LineIcon>
  )
}

export function SupportIcon({ className }) {
  return (
    <LineIcon className={className}>
      <circle cx="12" cy="8.25" r="3.25" />
      <path d="M5 18.5a7 7 0 0 1 14 0" />
      <path d="M4 10.5H2.75A1.75 1.75 0 0 0 1 12.25v1.5a1.75 1.75 0 0 0 1.75 1.75H4" />
      <path d="M20 10.5h1.25A1.75 1.75 0 0 1 23 12.25v1.5a1.75 1.75 0 0 1-1.75 1.75H20" />
    </LineIcon>
  )
}

export function SignOutIcon({ className }) {
  return (
    <LineIcon className={className}>
      <path d="M9 4.75H6.75A2.75 2.75 0 0 0 4 7.5v9a2.75 2.75 0 0 0 2.75 2.75H9" />
      <path d="M13 8.25 17.5 12 13 15.75" />
      <path d="M8.5 12h9" />
    </LineIcon>
  )
}

export function MoreHorizontalIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </svg>
  )
}

export function PlusIcon({ className }) {
  return (
    <LineIcon className={className}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </LineIcon>
  )
}

export function UploadIcon({ className }) {
  return (
    <LineIcon className={className}>
      <path d="M12 16V7" />
      <path d="m8.5 10.5 3.5-3.5 3.5 3.5" />
      <path d="M5 18.5h14" />
    </LineIcon>
  )
}

export function MenuIcon({ className }) {
  return (
    <LineIcon className={className}>
      <path d="M4.5 7h15" />
      <path d="M4.5 12h15" />
      <path d="M4.5 17h15" />
    </LineIcon>
  )
}

export function SearchIcon({ className }) {
  return (
    <LineIcon className={className}>
      <circle cx="10.5" cy="10.5" r="5.75" />
      <path d="m15 15 4.5 4.5" />
    </LineIcon>
  )
}

export function EyeIcon({ className }) {
  return (
    <LineIcon className={className}>
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.75" />
    </LineIcon>
  )
}

export function DesktopIcon({ className }) {
  return (
    <LineIcon className={className}>
      <rect x="4" y="5" width="16" height="11" rx="2" />
      <path d="M10 19h4" />
      <path d="M12 16v3" />
    </LineIcon>
  )
}

export function MobileDeviceIcon({ className }) {
  return (
    <LineIcon className={className}>
      <rect x="8" y="3.5" width="8" height="17" rx="2" />
      <path d="M11 6.5h2" />
      <circle cx="12" cy="17.25" r=".75" fill="currentColor" stroke="none" />
    </LineIcon>
  )
}

export function LayoutTemplateIcon({ className }) {
  return (
    <LineIcon className={className}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M4 9.5h16" />
      <path d="M10 9.5V19" />
    </LineIcon>
  )
}

export function SwatchIcon({ className }) {
  return (
    <LineIcon className={className}>
      <path d="M12 4.5a7.5 7.5 0 1 0 0 15c1.25 0 2.25-.93 2.25-2.08 0-.68-.34-1.17-.34-1.92 0-.92.69-1.5 1.68-1.5H17a4.5 4.5 0 0 0 0-9Z" />
      <circle cx="7.5" cy="11" r=".8" fill="currentColor" stroke="none" />
      <circle cx="10" cy="8" r=".8" fill="currentColor" stroke="none" />
      <circle cx="14" cy="8.5" r=".8" fill="currentColor" stroke="none" />
    </LineIcon>
  )
}

export function BlocksIcon({ className }) {
  return (
    <LineIcon className={className}>
      <rect x="4" y="5" width="6.5" height="6.5" rx="1.25" />
      <rect x="13.5" y="5" width="6.5" height="6.5" rx="1.25" />
      <rect x="4" y="14.5" width="6.5" height="4.5" rx="1.25" />
      <rect x="13.5" y="14.5" width="6.5" height="4.5" rx="1.25" />
    </LineIcon>
  )
}

export function PencilIcon({ className }) {
  return (
    <LineIcon className={className}>
      <path d="M14.5 5.5 18.5 9.5 8 20H4v-4L14.5 5.5Z" />
      <path d="M12.5 7.5l2 2" />
    </LineIcon>
  )
}

export function UndoIcon({ className }) {
  return (
    <LineIcon className={className}>
      <path d="M8 7.5H5.5v-2.5" />
      <path d="M5.5 7.5a6.5 6.5 0 1 0 2.2 4.85" />
    </LineIcon>
  )
}

export function RedoIcon({ className }) {
  return (
    <LineIcon className={className}>
      <path d="M16 7.5h2.5v-2.5" />
      <path d="M18.5 7.5a6.5 6.5 0 1 1-2.2 4.85" />
    </LineIcon>
  )
}

export function PanelLeftIcon({ className }) {
  return (
    <LineIcon className={className}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M10 5v14" />
      <path d="m7.75 12 1.75-1.75" />
      <path d="M7.75 12 9.5 13.75" />
    </LineIcon>
  )
}

export function PanelRightIcon({ className }) {
  return (
    <LineIcon className={className}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M14 5v14" />
      <path d="m16.25 12-1.75-1.75" />
      <path d="m16.25 12-1.75 1.75" />
    </LineIcon>
  )
}

export function SidebarExpandIcon({ className }) {
  return (
    <LineIcon className={className}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M9 5v14" />
      <path d="m13 10 3 2-3 2" />
    </LineIcon>
  )
}

export function SidebarCollapseIcon({ className }) {
  return (
    <LineIcon className={className}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M9 5v14" />
      <path d="m16 10-3 2 3 2" />
    </LineIcon>
  )
}

/** Small pipeline email validation icons (HubSpot-style, currentColor). */
export function EmailValidIcon({ className }) {
  return (
    <LineIcon className={className} viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="6.25" />
      <path d="m5.25 8 1.75 1.75L10.75 6.5" />
    </LineIcon>
  )
}

export function EmailInvalidIcon({ className }) {
  return (
    <LineIcon className={className} viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="6.25" />
      <path d="m5.75 5.75 4.5 4.5M10.25 5.75l-4.5 4.5" />
    </LineIcon>
  )
}

export function EmailUncertainIcon({ className }) {
  return (
    <LineIcon className={className} viewBox="0 0 16 16">
      <path d="M8 4.75v.5" />
      <path d="M8 11.25h.01" />
      <path d="M8 1.75a6.25 6.25 0 1 1 0 12.5 6.25 6.25 0 0 1 0-12.5Z" />
    </LineIcon>
  )
}
