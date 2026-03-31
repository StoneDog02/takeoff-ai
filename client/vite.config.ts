import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import fs from 'fs'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '')
  const supabaseOrigin = (env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '')
  /** Same-origin /functions/v1 + Netlify _redirects proxy (avoids prod CORS/SW "Failed to fetch"). */
  const edgeFunctionsRelative =
    env.VITE_EDGE_FUNCTIONS_RELATIVE === 'true' ||
    (process.env.NETLIFY === 'true' && env.VITE_EDGE_FUNCTIONS_RELATIVE !== 'false')

  return {
  define: {
    'import.meta.env.VITE_EDGE_FUNCTIONS_RELATIVE': JSON.stringify(edgeFunctionsRelative ? 'true' : 'false'),
  },
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
          // Matches both direct Supabase URLs and same-origin /functions/v1 (Netlify proxy).
          {
            urlPattern: /^https?:\/\/[^/]+\/functions\/v1\//,
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
    {
      name: 'netlify-edge-functions-redirect',
      closeBundle() {
        if (mode !== 'production' || !supabaseOrigin) return
        if (!edgeFunctionsRelative) return
        const distDir = path.resolve(__dirname, 'dist')
        const line = `/functions/v1/*  ${supabaseOrigin}/functions/v1/:splat  200\n`
        const dest = path.join(distDir, '_redirects')
        let existing = ''
        try {
          if (fs.existsSync(dest)) existing = fs.readFileSync(dest, 'utf8')
        } catch (e) {
          console.warn('[vite] Could not read dist/_redirects:', e)
          return
        }
        if (existing.includes('/functions/v1/*')) return
        try {
          fs.writeFileSync(dest, line + existing, 'utf8')
        } catch (e) {
          console.warn('[vite] Could not write dist/_redirects for Edge Functions proxy:', e)
        }
      },
    },
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
