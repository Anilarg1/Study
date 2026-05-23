/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        // ── v2 palette ──────────────────────────────────────────────────────
        bg:           '#08090a',
        'bg-up':      '#0b0c0e',
        surface:      '#101114',
        'surface-2':  '#16171c',
        'surface-3':  '#1c1d23',
        // Text scale
        text:         '#f4f5f8',
        'text-dim':   '#8a8f98',
        'text-mute':  '#5e636c',
        'text-faint': '#3e424a',
        // Mode accents
        focus:        '#8b85ff',
        short:        '#4cb782',
        long:         '#5e9eea',
        xp:           '#b59aff',
        streak:       '#f5a25a',
        // ── legacy aliases (existing classes keep working) ─────────────────
        card:         '#16171c',
        border:       'rgba(255,255,255,0.055)',
        muted:        '#3e424a',
        dim:          '#8a8f98',
        soft:         '#a0a0b0',
        bright:       '#f4f5f8',
        accent:       '#8b85ff',
        'accent-dim': '#6e68e8',
        green:        '#4cb782',
        amber:        '#f5a25a',
        red:          '#f87171',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { opacity: '0.35', transform: 'scale(1)' },
          '50%':      { opacity: '0.6',  transform: 'scale(1.03)' },
        },
        shimmer: {
          '0%':   { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        pop: {
          '0%':   { transform: 'scale(0.8)', opacity: '0' },
          '60%':  { transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)',   opacity: '1' },
        },
        'pulse-ring': {
          '0%, 100%': { opacity: '0.15', transform: 'scale(1)' },
          '50%':      { opacity: '0.30', transform: 'scale(1.06)' },
        },
        'xp-fill': {
          from: { width: '0%' },
        },
      },
      animation: {
        breathe:      'breathe 4s ease-in-out infinite',
        shimmer:      'shimmer 2.4s linear infinite',
        pop:          'pop 0.3s ease-out forwards',
        'pulse-ring': 'pulse-ring 2s ease-in-out infinite',
        'xp-fill':    'xp-fill 0.6s ease-out forwards',
      },
    },
  },
  plugins: [],
}
