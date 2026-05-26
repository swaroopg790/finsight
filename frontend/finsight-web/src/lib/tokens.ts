// ── FinSight Design Tokens ─────────────────────────────────────────────────
// Single source of truth for all visual constants.
// Components import from here — never hardcode colours or spacing inline.

export const colors = {
  // Brand — Indigo
  brand:       '#4f46e5',
  brandLight:  '#818cf8',
  brandDark:   '#3730a3',
  brandBg:     '#eef2ff',
  brandBorder: '#c7d2fe',

  // Sidebar
  sidebar:           '#0f172a',
  sidebarHover:      '#1e293b',
  sidebarActive:     '#1e293b',
  sidebarActiveBg:   '#312e81',
  sidebarText:       '#94a3b8',
  sidebarTextActive: '#ffffff',
  sidebarBorder:     '#1e293b',

  // Page chrome
  pageBg:   '#f8fafc',
  surface:  '#ffffff',
  surfaceHover: '#f8fafc',

  // Text
  text:          '#0f172a',
  textSecondary: '#475569',
  textMuted:     '#94a3b8',
  textInverted:  '#ffffff',

  // Borders
  border:      '#e2e8f0',
  borderHover: '#cbd5e1',

  // Semantic
  success:    '#16a34a',
  successBg:  '#dcfce7',
  successText:'#15803d',
  danger:     '#dc2626',
  dangerBg:   '#fee2e2',
  dangerText: '#b91c1c',
  warning:    '#d97706',
  warningBg:  '#fef3c7',
  warningText:'#92400e',
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
