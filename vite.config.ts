import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api/eb': {
        target: 'https://www.eventbriteapi.com/v3',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/eb/, ''),
      },
    },
  },
})
