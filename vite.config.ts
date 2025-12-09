import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // string shorthand: http://localhost:5173/foo -> http://localhost:3001/foo
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    }
  }
})
