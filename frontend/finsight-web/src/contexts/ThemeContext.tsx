import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

// ── Chart hex values — CSS variables can't be used in SVG presentation attributes
interface ChartColors {
  brand:    string
  danger:   string
  success:  string
  spy:      string   // S&P 500 line — amber
  qqq:      string   // Nasdaq-100 line — cyan
  grid:     string
  axis:     string
}

interface ThemeContextValue {
  isDark:      boolean
  toggleTheme: () => void
  chartColors: ChartColors
}

const LIGHT_CHART: ChartColors = {
  brand:   '#4f46e5',
  danger:  '#dc2626',
  success: '#16a34a',
  spy:     '#f59e0b',   // amber
  qqq:     '#0891b2',   // cyan
  grid:    '#f1f5f9',
  axis:    '#94a3b8',
}

const DARK_CHART: ChartColors = {
  brand:   '#818cf8',
  danger:  '#f87171',
  success: '#4ade80',
  spy:     '#fbbf24',
  qqq:     '#22d3ee',
  grid:    '#1e293b',
  axis:    '#475569',
}

const ThemeContext = createContext<ThemeContextValue>({
  isDark:      false,
  toggleTheme: () => {},
  chartColors: LIGHT_CHART,
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState<boolean>(() => {
    return localStorage.getItem('finsight_theme') === 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
    localStorage.setItem('finsight_theme', isDark ? 'dark' : 'light')
  }, [isDark])

  const toggleTheme = () => setIsDark((d) => !d)

  return (
    <ThemeContext.Provider value={{
      isDark,
      toggleTheme,
      chartColors: isDark ? DARK_CHART : LIGHT_CHART,
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
