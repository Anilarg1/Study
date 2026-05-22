/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        // Base dark palette
        bg:      '#0d0d0f',
        surface: '#141416',
        card:    '#1c1c20',
        border:  '#2a2a30',
        muted:   '#3a3a42',
        // Text
        dim:     '#6b6b7a',
        soft:    '#a0a0b0',
        bright:  '#e8e8f0',
        // Accent
        accent:  '#7c6af0',        // violet
        'accent-dim': '#5a4fd0',
        green:   '#4ade80',
        amber:   '#fbbf24',
        red:     '#f87171',
      },
      keyframes: {
        'pulse-ring': {
          '0%, 100%': { opacity: '0.15', transform: 'scale(1)' },
          '50%':       { opacity: '0.30', transform: 'scale(1.06)' },
        },
        'xp-fill': {
          from: { width: '0%' },
        },
        'pop': {
          '0%':   { transform: 'scale(0.8)', opacity: '0' },
          '60%':  { transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)',   opacity: '1' },
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring 2s ease-in-out infinite',
        'xp-fill':    'xp-fill 0.6s ease-out forwards',
        'pop':        'pop 0.3s ease-out forwards',
      },
    },
  },
  plugins: [],
}
