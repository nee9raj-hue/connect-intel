import { defineConfig } from 'vite'
import process from 'node:process'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { VitePWA } from 'vite-plugin-pwa'

const standalone = process.env.STANDALONE === '1'

function pwaStubPlugin() {
  return {
    name: 'pwa-register-stub',
    resolveId(id) {
      if (id === 'virtual:pwa-register') return id
    },
    load(id) {
      if (id === 'virtual:pwa-register') {
        return 'export function registerSW() { return () => {} }'
      }
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    ...(standalone
      ? [viteSingleFile(), pwaStubPlugin()]
      : [
          VitePWA({
            registerType: 'autoUpdate',
            includeAssets: [
              'connect-intel-hero-logo.png',
              'connect-intel-logo-icon-light.png',
              'phone-call-icon.png',
              'apple-touch-icon.png',
              'pwa-192.png',
              'pwa-512.png',
            ],
            manifest: {
              name: 'Connect Intel',
              short_name: 'Connect Intel',
              description: 'B2B lead search, CRM pipeline, and Chithi team chat.',
              theme_color: '#17191c',
              background_color: '#f4f6f8',
              display: 'standalone',
              orientation: 'portrait-primary',
              start_url: '/?source=pwa',
              scope: '/',
              id: '/',
              categories: ['business', 'productivity'],
              icons: [
                {
                  src: 'pwa-192.png',
                  sizes: '192x192',
                  type: 'image/png',
                  purpose: 'any',
                },
                {
                  src: 'pwa-512.png',
                  sizes: '512x512',
                  type: 'image/png',
                  purpose: 'any',
                },
                {
                  src: 'pwa-512.png',
                  sizes: '512x512',
                  type: 'image/png',
                  purpose: 'maskable',
                },
              ],
            },
            workbox: {
              skipWaiting: true,
              clientsClaim: true,
              cleanupOutdatedCaches: true,
              globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
              importScripts: ['chithi-push-sw.js'],
              navigateFallback: '/index.html',
              navigateFallbackDenylist: [/^\/api\//],
              runtimeCaching: [
                {
                  urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                  handler: 'CacheFirst',
                  options: {
                    cacheName: 'google-fonts-stylesheets',
                    expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                  },
                },
                {
                  urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                  handler: 'CacheFirst',
                  options: {
                    cacheName: 'google-fonts-webfonts',
                    expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
                  },
                },
              ],
            },
            devOptions: {
              enabled: true,
            },
          }),
        ]),
  ],
  base: standalone ? './' : process.env.VITE_BASE_PATH || '/',
  build: {
    outDir: standalone ? '../site-standalone' : '../site',
    emptyOutDir: true,
    ...(standalone
      ? {
          cssCodeSplit: false,
          assetsInlineLimit: 100000000,
        }
      : {}),
  },
})
