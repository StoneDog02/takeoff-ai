/**
 * Base URL for `/api/*` requests. VITE_API_URL should be the API host only (e.g. https://api.example.com),
 * not including `/api` — but if it already ends with `/api`, we avoid doubling to `/api/api/...`.
 */
const raw = import.meta.env.VITE_API_URL as string | undefined
export const API_BASE = (() => {
  if (!raw?.trim()) return '/api'
  const b = raw.trim().replace(/\/$/, '')
  if (b.endsWith('/api')) return b
  return `${b}/api`
})()
