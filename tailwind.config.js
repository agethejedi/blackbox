/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bb: {
          bg:       '#070510',
          surface:  '#0e0c1a',
          border:   '#1e1a2e',
          purple:   '#8b5cf6',
          teal:     '#2dd4bf',
          muted:    '#6b7280',
          text:     '#e2e8f0',
          subtext:  '#94a3b8',
        },
      },
      fontFamily: {
        mono: ['ui-monospace', 'SF Mono', 'monospace'],
        sans: ['ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
