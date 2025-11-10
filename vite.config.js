import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [react()],
    server: {
      port: 5174,
      proxy: {
        // Proxy tất cả request bắt đầu bằng /api sang backend để tránh CORS khi dev
        // URL được lấy từ biến môi trường VITE_API_BASE_URL
        '/api': {
          target: env.VITE_API_BASE_URL || 'https://themselves-resolve-routing-ricky.trycloudflare.com/potato-api',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  }
})
