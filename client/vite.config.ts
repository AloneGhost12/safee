import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || (process.env.NODE_ENV === 'production' ? '/safee/' : '/'), // Use env var or default base path
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
