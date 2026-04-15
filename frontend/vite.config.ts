import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    nodePolyfills({
      include: ['events', 'buffer', 'process'],
    }),
  ],
  server: {
    // Local dev convenience: keep VITE_API_URL=/api and let Vite proxy to Nest (http://localhost:3000/api).
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // Socket.io endpoint used by the taker sandbox (and admin updates)
      '/socket.io': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  resolve: {
    alias: {
      events: 'events',
    },
  },
  define: {
    global: 'globalThis',
  },
})
