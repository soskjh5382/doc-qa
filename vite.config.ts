import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // /api로 시작하는 요청을 백엔드 서버(3001)로 넘긴다
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
})
