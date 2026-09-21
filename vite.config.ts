import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'DJ TEVENX - XDJ-RR MASTER LAB',
        short_name: 'TEVENX RR',
        description: '48 controles reales XDJ-RR + Simulador + SUBIR TRACKS',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        display_override: ['standalone', 'window-controls-overlay'],
        scope: '/',
        start_url: '/',
        orientation: 'landscape',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.netlify\.app\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'rr-lab-cache' },
          },
        ],
      },
    }),
  ],
})
