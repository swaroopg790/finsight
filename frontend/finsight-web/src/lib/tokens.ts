// ── FinSight Design Tokens ─────────────────────────────────────────────────
// Single source of truth for all visual constants.
//
// Theme strategy:
//   - Brand colours (indigo) are hex — they never change between light/dark.
//   - Semantic / chrome colours use CSS variables — they flip automatically
//     when <html data-theme="dark"> is set by ThemeContext.
//   - Recharts SVG attributes can't resolve CSS vars; use chartColors from
//     useTheme() for any fill/stroke values passed into recharts components.

export const colors = {
  // ── Brand (hex — safe to interpolate: e.g. `${colors.brand}50`) ─────────
  brand:       '#4f46e5',
  brandLight:  '#818cf8',
  brandDark:   '#3730a3',
  brandBg:     'var(--color-brand-bg)',
  brandBorder: 'var(--color-brand-border)',

  // ── Sidebar (always dark — no theme switch needed) ───────────────────────
  sidebar:           '#0f172a',
  sidebarHover:      '#1e293b',
  sidebarActive:     '#1e293b',
  sidebarActiveBg:   '#312e81',
  sidebarText:       '#94a3b8',
  sidebarTextActive: '#ffffff',
  sidebarBorder:     '#1e293b',

  // ── Page chrome (theme-sensitive → CSS vars) ─────────────────────────────
  pageBg:       'var(--color-page-bg)',
  surface:      'var(--color-surface)',
  surfaceHover: 'var(--color-surface-hover)',

  // ── Text (theme-sensitive → CSS vars) ────────────────────────────────────
  text:          'var(--color-text)',
  textSecondary: 'var(--color-text-secondary)',
  textMuted:     'var(--color-text-muted)',
  textInverted:  '#ffffff',

  // ── Borders (theme-sensitive → CSS vars) ─────────────────────────────────
  border:      'var(--color-border)',
  borderHover: 'var(--color-border-hover)',

  // ── Semantic (hex for text/icon colours; CSS var for backgrounds) ─────────
  success:     '#16a34a',
  successBg:   'var(--color-success-bg)',
  successText: '#15803d',
  danger:      '#dc2626',
  dangerBg:    'var(--color-danger-bg)',
  dangerText:  '#b91c1c',
  warning:     '#d97706',
  warningBg:   'var(--color-warning-bg)',
  warningText: '#92400e',
}

export const radius = {
  xs:   4,
  sm:   6,
  md:   10,
  lg:   14,
  xl:   20,
  full: 9999,
}

export const shadow = {
  xs: '0 1px 2px rgba(0,0,0,0.05)',
  sm: '0 1px 4px rgba(0,0,0,0.08)',
  md: '0 4px 16px rgba(0,0,0,0.08)',
  lg: '0 8px 32px rgba(0,0,0,0.12)',
  xl: '0 16px 48px rgba(0,0,0,0.16)',
}

export const font = {
  sans: "'Inter', -apple-system, 'Segoe UI', Roboto, sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
}

// Layout constants
export const SIDEBAR_W   = 220   // px — desktop sidebar width
export const TOPBAR_H    = 52    // px — mobile top bar height
export const BOTTOMNAV_H = 60    // px — mobile bottom nav height

// Allocation chart palette — starts with brand indigo
export const CHART_COLORS = [
  '#4f46e5', // indigo  (brand)
  '#0891b2', // cyan
  '#16a34a', // green
  '#d97706', // amber
  '#dc2626', // red
  '#7c3aed', // violet
  '#0f766e', // teal
  '#c2410c', // orange
  '#1d4ed8', // blue
  '#be185d', // pink
]
