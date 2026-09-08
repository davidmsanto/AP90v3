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
          DEFAULT: '#0a0a0a',
          card: '#131313',
          elevated: '#1a1a1a',
          border: '#1f1f1f',
          'border-elevated': '#2e2e2e',
        },
        'text-primary': '#f5f5f5',
        'text-secondary': '#9a9a9a',
        accent: {
          success: '#10b981',
          'success-hover': '#059669',
          'success-subtle': 'rgba(16, 185, 129, 0.12)',
          critical: '#ef4444',
          'critical-subtle': 'rgba(239, 68, 68, 0.12)',
          warning: '#f59e0b',
          'warning-subtle': 'rgba(245, 158, 11, 0.12)',
        },
      },
      fontSize: {
        h1: ['28px', { lineHeight: '1.2', fontWeight: '700' }],
        h2: ['18px', { lineHeight: '1.3', fontWeight: '600' }],
        body: ['14px', { lineHeight: '1.5', fontWeight: '400' }],
        caption: ['12px', { lineHeight: '1.4', fontWeight: '400' }],
      },
      borderRadius: {
        card: '12px',
      },
    },
  },
  plugins: [],
}
