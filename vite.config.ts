import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Mi Colección de Juegos',
        short_name: 'Mi Colección',
        description: 'Tu colección de videojuegos, la misma que en el escritorio y en Android',
        lang: 'es',
        start_url: '/',
        display: 'standalone',
        background_color: '#f3effa',
        theme_color: '#673ab7',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        // Las llamadas al servidor nunca se sirven desde la caché.
        navigateFallbackDenylist: [/^\/api\//],
        // El lector de códigos pesa casi 1 MB: entra en la caché para que el escáner abra al momento.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm}'],
      },
    }),
  ],
  server: {
    // En desarrollo, /api lo atiende `npm run dev:api` (wrangler) en el puerto 8789.
    // 127.0.0.1 y no localhost: wrangler solo escucha en IPv4 y Node puede resolver localhost a ::1.
    proxy: { '/api': 'http://127.0.0.1:8789' },
    host: true,
  },
})
