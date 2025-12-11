import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  root: '.',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/client'),
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts': ['recharts'],
          'vendor-forms': ['react-hook-form', 'zod'],
          'vendor-leaflet': ['leaflet', 'react-leaflet'],
          'vendor-pdf': ['jspdf', 'jspdf-autotable', 'html2canvas'],
          'vendor-excel': ['xlsx'],
          'vendor-ui': ['lucide-react', 'axios', 'clsx']
        }
      }
    },
    chunkSizeWarningLimit: 2000
  },
  server: {
    port: 5173,
    host: true
  }
})
