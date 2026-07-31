import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api/eventbrite': {
        target: 'https://www.eventbriteapi.com',
        changeOrigin: true,
        rewrite: () => '/v3/events/search/',
      },
    },
  },
})
