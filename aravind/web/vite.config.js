import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

const repo = resolve(import.meta.dirname, '../..')
const aravind = resolve(import.meta.dirname, '..')
const nm = resolve(aravind, 'node_modules')

export default defineConfig({
  root: resolve(import.meta.dirname),
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom', 'framer-motion'],
    alias: {
      '@': resolve(repo, 'src'),
      react: resolve(nm, 'react'),
      'react-dom': resolve(nm, 'react-dom'),
      'framer-motion': resolve(nm, 'framer-motion'),
    },
  },
  server: {
    port: 4173,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
})
