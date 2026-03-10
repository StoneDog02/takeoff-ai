const base = import.meta.env.VITE_API_URL as string | undefined
export const API_BASE = base ? `${base.replace(/\/$/, '')}/api` : '/api'
