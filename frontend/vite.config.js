import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 后端端口配置（修改这里即可）
const BACKEND_PORT = process.env.BACKEND_PORT || 3485

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    // 允许的域名
    allowedHosts: [ 'localhost', '127.0.0.1'],
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${BACKEND_PORT}`,
        changeOrigin: true
      }
    }
  }
})
