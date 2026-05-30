import { CHITHI_MENU_ICON, CHITHI_MENU_ICON_CLASS } from '../../lib/brandAssets'

/**
 * Chithi menu icon — white on dark backgrounds (CRM sidebar) via CSS;
 * pass onLight on white panels (Chithi header, active nav pill).
 */
export default function ChithiMenuIcon({ className = '', onLight = false }) {
  return (
    <img
      src={CHITHI_MENU_ICON}
      alt=""
      draggable={false}
      aria-hidden
      className={[CHITHI_MENU_ICON_CLASS, onLight ? 'ci-chithi-menu-icon--on-light' : '', className]
        .filter(Boolean)
        .join(' ')}
    />
  )
}
