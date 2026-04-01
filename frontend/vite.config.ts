import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo/**', 'icons/**', 'sounds/**'],
      manifest: {
        name: 'Synk.',
        short_name: 'Synk.',
        description: 'Synk. – real-time messenger',
        theme_color: '#121212',
        background_color: '#121212',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        orientation: 'portrait-primary',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/logo/synk_white.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
        ],
      },
      workbox: {
        // Precache all built assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,mp3,woff,woff2}'],
        // Serve index.html for all navigation (SPA + offline launch)
        navigateFallback: 'index.html',
        // Don't apply navigateFallback to API or WS routes
        navigateFallbackDenylist: [/^\/api/, /^\/ws/],
        runtimeCaching: [
          {
            // API calls: always go to network, never cache stale chat data
            urlPattern: /^https:\/\/api\.synk\.su\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
})
