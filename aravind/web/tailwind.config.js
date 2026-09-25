import { resolve } from 'node:path'

const web = import.meta.dirname
const repoSrc = resolve(web, '../../src')

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    resolve(web, 'index.html'),
    resolve(web, 'src/**/*.{js,jsx}'),
    resolve(repoSrc, '**/*.{js,jsx}'),
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
      },
    },
  },
  plugins: [],
}
