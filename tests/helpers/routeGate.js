import { readFileSync } from 'node:fs'

const routes = JSON.parse(
  readFileSync(new URL('../fixtures/zou_routes.json', import.meta.url), 'utf8')
)

const escapeRegex = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// "/data/tasks/<task_id>" -> ^/data/tasks/[^/]+$
const toRegex = route =>
  new RegExp(
    `^${route
      .split(/<[^>]+>/)
      .map(escapeRegex)
      .join('[^/]+')}$`
  )

const PATTERNS = routes.map(toRegex)

// Served by Zou but absent from the blueprint snapshot (same list as gazu's gate).
const ALLOWED_EXACT = new Set([
  '/',
  '/auth/login',
  '/auth/logout',
  '/auth/authenticated',
  '/auth/refresh-token',
  '/auth/email-otp'
])

// Known gap, same as gazu: "/data/tasks/open" matches the CRUD
// "/data/tasks/<id>" shape and passes.
export const isKnownRoute = path =>
  ALLOWED_EXACT.has(path) || PATTERNS.some(pattern => pattern.test(path))
