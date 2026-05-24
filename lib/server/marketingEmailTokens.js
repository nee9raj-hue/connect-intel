export const FONT_OPTIONS = [
  { id: 'arial', label: 'Arial', stack: 'Arial, Helvetica, sans-serif' },
  { id: 'helvetica', label: 'Helvetica', stack: 'Helvetica, Arial, sans-serif' },
  { id: 'georgia', label: 'Georgia', stack: 'Georgia, Times New Roman, serif' },
  { id: 'times', label: 'Times New Roman', stack: 'Times New Roman, Times, serif' },
  { id: 'trebuchet', label: 'Trebuchet MS', stack: 'Trebuchet MS, Helvetica, sans-serif' },
  { id: 'verdana', label: 'Verdana', stack: 'Verdana, Geneva, sans-serif' },
  { id: 'courier', label: 'Courier', stack: 'Courier New, Courier, monospace' },
  { id: 'system', label: 'System UI', stack: 'system-ui, -apple-system, Segoe UI, sans-serif' },
]

export const FONT_SIZE_OPTIONS = [11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 28, 32, 36, 42, 48]

export const POPULAR_ICONS = [
  { id: 'email', label: 'Email', iconify: 'mdi:email-outline' },
  { id: 'phone', label: 'Phone', iconify: 'mdi:phone' },
  { id: 'calendar', label: 'Calendar', iconify: 'mdi:calendar-month-outline' },
  { id: 'check', label: 'Check', iconify: 'mdi:check-circle-outline' },
  { id: 'star', label: 'Star', iconify: 'mdi:star-outline' },
  { id: 'heart', label: 'Heart', iconify: 'mdi:heart-outline' },
  { id: 'link', label: 'Link', iconify: 'mdi:link-variant' },
  { id: 'location', label: 'Location', iconify: 'mdi:map-marker-outline' },
  { id: 'clock', label: 'Clock', iconify: 'mdi:clock-outline' },
  { id: 'gift', label: 'Gift', iconify: 'mdi:gift-outline' },
  { id: 'rocket', label: 'Rocket', iconify: 'mdi:rocket-launch-outline' },
  { id: 'chart', label: 'Chart', iconify: 'mdi:chart-line' },
  { id: 'users', label: 'Team', iconify: 'mdi:account-group-outline' },
  { id: 'shield', label: 'Shield', iconify: 'mdi:shield-check-outline' },
  { id: 'bell', label: 'Bell', iconify: 'mdi:bell-outline' },
  { id: 'download', label: 'Download', iconify: 'mdi:download-outline' },
  { id: 'play', label: 'Play', iconify: 'mdi:play-circle-outline' },
  { id: 'info', label: 'Info', iconify: 'mdi:information-outline' },
  { id: 'trophy', label: 'Trophy', iconify: 'mdi:trophy-outline' },
  { id: 'cart', label: 'Cart', iconify: 'mdi:cart-outline' },
]

export const SOCIAL_NETWORKS = [
  { id: 'linkedin', label: 'LinkedIn', color: '0A66C2' },
  { id: 'x', label: 'X', color: '000000' },
  { id: 'facebook', label: 'Facebook', color: '0866FF' },
  { id: 'instagram', label: 'Instagram', color: 'E4405F' },
  { id: 'youtube', label: 'YouTube', color: 'FF0000' },
  { id: 'tiktok', label: 'TikTok', color: '000000' },
  { id: 'github', label: 'GitHub', color: '181717' },
  { id: 'whatsapp', label: 'WhatsApp', color: '25D366' },
  { id: 'telegram', label: 'Telegram', color: '26A5E4' },
  { id: 'pinterest', label: 'Pinterest', color: 'BD081C' },
  { id: 'snapchat', label: 'Snapchat', color: 'FFFC00' },
  { id: 'discord', label: 'Discord', color: '5865F2' },
  { id: 'slack', label: 'Slack', color: '4A154B' },
  { id: 'google', label: 'Google', color: '4285F4' },
  { id: 'apple', label: 'Apple', color: '000000' },
  { id: 'spotify', label: 'Spotify', color: '1DB954' },
]

export const IMAGE_PRESETS = [
  {
    id: 'business-team',
    label: 'Team meeting',
    url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&h=280&fit=crop&q=80',
  },
  {
    id: 'office',
    label: 'Modern office',
    url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=280&fit=crop&q=80',
  },
  {
    id: 'handshake',
    label: 'Handshake',
    url: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=600&h=280&fit=crop&q=80',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&h=280&fit=crop&q=80',
  },
  {
    id: 'product',
    label: 'Product',
    url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=280&fit=crop&q=80',
  },
  {
    id: 'celebration',
    label: 'Celebration',
    url: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=600&h=280&fit=crop&q=80',
  },
]

export function iconifyUrl(iconify, { size = 48, color = '#374151' } = {}) {
  const col = encodeURIComponent(color.startsWith('#') ? color : `#${color}`)
  return `https://api.iconify.design/${iconify}.svg?color=${col}&width=${size}&height=${size}`
}

export function socialIconUrl(slug, color) {
  const c = String(color || '000000').replace('#', '')
  return `https://cdn.simpleicons.org/${slug}/${c}`
}

export function resolveFontStack(fontFamily, fallback) {
  if (!fontFamily) return fallback
  const match = FONT_OPTIONS.find((f) => f.id === fontFamily || f.stack === fontFamily)
  return match?.stack || fontFamily
}
