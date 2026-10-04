/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#07090d',
          card: 'rgba(16, 22, 30, 0.65)',
          'card-solid': '#0f141c',
          elevated: 'rgba(23, 32, 44, 0.75)',
          'elevated-solid': '#17202c',
          border: 'rgba(255, 255, 255, 0.08)',
          'border-elevated': 'rgba(255, 255, 255, 0.16)',
          'border-neon': 'rgba(0, 230, 118, 0.45)',
        },
        'text-primary': '#f3f4f6',
        'text-secondary': '#8b9bb0',
        'text-muted': '#526173',
        accent: {
          neon: '#00e676',
          'neon-hover': '#00c853',
          'neon-glow': 'rgba(0, 230, 118, 0.35)',
          success: '#00e676',
          'success-hover': '#00c853',
          'success-subtle': 'rgba(0, 230, 118, 0.12)',
          critical: '#ff5252',
          'critical-subtle': 'rgba(255, 82, 82, 0.15)',
          warning: '#ffb300',
          'warning-subtle': 'rgba(255, 179, 0, 0.15)',
        },
      },
      fontSize: {
        h1: ['30px', { lineHeight: '1.2', fontWeight: '700' }],
        h2: ['20px', { lineHeight: '1.3', fontWeight: '600' }],
        body: ['14px', { lineHeight: '1.5', fontWeight: '400' }],
        caption: ['12px', { lineHeight: '1.4', fontWeight: '400' }],
      },
      borderRadius: {
        card: '18px',
        hud: '22px',
      },
      boxShadow: {
        'glow-neon': '0 0 25px -2px rgba(0, 230, 118, 0.45), 0 0 10px -1px rgba(0, 230, 118, 0.25)',
        'glow-neon-sm': '0 0 14px -2px rgba(0, 230, 118, 0.35)',
        'glow-neon-border': 'inset 0 0 15px rgba(0, 230, 118, 0.15), 0 0 15px rgba(0, 230, 118, 0.25)',
        'glass-card': '0 12px 36px 0 rgba(0, 0, 0, 0.45)',
      },
    },
  },
  plugins: [],
}
