import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const allowedHosts = ['delightful-kindness-production-0c72.up.railway.app']

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    allowedHosts,
  },
  preview: {
    allowedHosts,
  },
})
