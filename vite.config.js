import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      // Proxy tất cả request bắt đầu bằng /api sang backend để tránh CORS khi dev
      '/api': {
        target: 'https://cruise-silk-licence-shed.trycloudflare.com/potato-api',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
