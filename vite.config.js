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
      '/potato-api': {
        target: process.env.VITE_PROXY_TARGET || 'https://themselves-resolve-routing-ricky.trycloudflare.com',
        changeOrigin: true,
        secure: false,
        ws: false,
        rewrite: (path) => path.replace(/^\/potato-api/, '/potato-api'),
      },
      },
    },
  }
})
