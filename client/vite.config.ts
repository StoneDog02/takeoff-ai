import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '')
  const supabaseOrigin = (env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '')

  return {
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('jspdf') || id.includes('html2canvas')) return 'vendor-pdf'
          if (id.includes('@supabase')) return 'vendor-supabase'
          if (id.includes('lucide-react') || id.includes('@phosphor-icons') || id.includes('@iconscout'))
            return 'vendor-icons'
          if (id.includes('react-router')) return 'vendor-router'
          if (id.includes('react-dom') || id.includes('/react/') || id.includes('\\react\\')) return 'vendor-react'
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Default 2 MiB fails the build when the main chunk exceeds it (e.g. ~2.1 MB).
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          // Never cache Edge Functions (SW can break or mask failures; must always hit network).
          {
            urlPattern: /^https:\/\/[^/]+\.supabase\.co\/functions\/v1\//,
            handler: 'NetworkOnly',
          },
          {
            urlPattern:
              /^https:\/\/.*\.supabase\.co\/rest\/v1\/(projects|daily_logs|phases|employees)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'buildos-api-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
              networkTimeoutSeconds: 3,
            },
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'buildos-storage-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
            },
          },
        ],
      },
      manifest: {
        name: 'BuildOS',
        short_name: 'BuildOS',
        description: 'Construction management for GCs',
        theme_color: '#c0392b',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  envDir: path.resolve(__dirname, '..'),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Same-origin in dev so Edge Function calls avoid browser CORS "Failed to fetch"
      ...(supabaseOrigin
        ? {
            '/functions/v1': {
              target: supabaseOrigin,
              changeOrigin: true,
              secure: true,
            },
          }
        : {}),
    },
  },
  }
})
