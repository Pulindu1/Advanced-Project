import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // allow connections from the local network / other local tools (Burp embedded browser)
    // Run `npm run dev` after this change. This exposes the dev server on 0.0.0.0.
    host: true,
    proxy: {
      // Proxy API requests to the backend so cookies are same-site during dev
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: false,
        secure: false,
        cookieDomainRewrite: 'localhost'
      }
    }
  }
})
