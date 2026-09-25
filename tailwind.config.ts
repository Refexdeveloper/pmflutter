/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          primary: '#1E88E5',
          secondary: '#1565C0',
          accent: '#2B5AED',
        },
        fontFamily: {
          sans: ['Inter', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
          display: ['Inter', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        },
        boxShadow: {
          'pt-panel': '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -12px rgba(15,23,42,0.10)',
          'pt-popover': '0 4px 6px -1px rgba(15,23,42,0.06), 0 16px 40px -12px rgba(15,23,42,0.18)',
        },
        transitionTimingFunction: {
          pt: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
        },
      },
    },
    plugins: [],
  }