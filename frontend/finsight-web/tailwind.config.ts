import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        base:    '#050510',
        surface: {
          1: 'rgba(255,255,255,0.03)',
          2: 'rgba(255,255,255,0.05)',
          3: 'rgba(255,255,255,0.08)',
        },
        accent: {
          DEFAULT: '#6366f1',
          light:   '#818cf8',
          dim:     'rgba(99,102,241,0.15)',
        },
        positive: '#10b981',
        negative: '#ef4444',
        warn:     '#f59e0b',
      },
      fontFamily: {
        sans:    ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px' }],
        xs:    ['12px', { lineHeight: '16px' }],
        sm:    ['14px', { lineHeight: '20px' }],
        base:  ['16px', { lineHeight: '24px' }],
        lg:    ['20px', { lineHeight: '28px' }],
        xl:    ['28px', { lineHeight: '36px' }],
        '2xl': ['40px', { lineHeight: '48px' }],
        '3xl': ['56px', { lineHeight: '64px' }],
      },
      borderRadius: {
        sm:   '8px',
        md:   '12px',
        lg:   '16px',
        xl:   '20px',
        '2xl':'24px',
        '3xl':'32px',
        full: '9999px',
      },
      boxShadow: {
        card:     '0 0 40px rgba(0,0,0,0.4)',
        glow:     '0 0 24px rgba(99,102,241,0.25)',
        'glow-sm':'0 0 12px rgba(99,102,241,0.15)',
        lift:     '0 8px 40px rgba(0,0,0,0.5)',
      },
      backdropBlur: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        xl: '24px',
      },
      animation: {
        'fade-up':    'fadeUp 0.28s ease-out both',
        'fade-in':    'fadeIn 0.2s ease-out both',
        shimmer:      'shimmer 1.8s ease-in-out infinite',
        spin:         'spin 1s linear infinite',
        pulse:        'pulse 2s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
      },
    },
  },
  plugins: [],
}

export default config
