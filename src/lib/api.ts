import ky from 'ky'

// All requests go to /api which Vite proxies to localhost:8080.
export const api = ky.create({
  prefix: '/api',
  headers: { 'Content-Type': 'application/json' },
})
