import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? '/safee/' : '/', // GitHub Pages base path only in production
  server: { 
    port: 5179,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:4009',
        changeOrigin: false,
        secure: false,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL || 'http://localhost:4009'),
  },
})
