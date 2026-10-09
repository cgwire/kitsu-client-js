import { authApi } from './auth.js'
import { createEvents } from './events.js'
import { createHttp } from './http.js'
import { createSession } from './session.js'

const DEFAULT_TIMEOUT = { response: 60000, deadline: 300000 }
// Above it setTimeout overflows and fires at once.
const MAX_TIMER = 2147483647

const timerOf = (key, value) => {
  if (value === undefined || value === null) return DEFAULT_TIMEOUT[key]
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
    throw new TypeError(
      `createClient: timeout.${key} must be a number of milliseconds`
    )
  }
  return value === 0 || value > MAX_TIMER ? Infinity : value
}

const resolveTimeout = (timeout = {}) =>
  Object.freeze({
    response: timerOf('response', timeout.response),
    deadline: timerOf('deadline', timeout.deadline)
  })

/**
 * @typedef {object} ClientOptions
 * @property {string} host API root, for instance "https://kitsu.studio/api".
 *   A relative host ("/api") suits same-origin web apps.
 * @property {typeof fetch} [fetch] Defaults to the global fetch. Tauri apps
 *   inject the fetch of their http plugin here. Every request goes through
 *   it, uploads included: they then report no progress.
 * @property {'bearer'|'cookie'} [auth] Defaults to "bearer".
 * @property {import('./session.js').Tokens|null} [tokens] Resume a session.
 * @property {(tokens: import('./session.js').Tokens|null) => void} [onTokensChange]
 *   Called on every token change, to persist them.
 * @property {() => void} [onUnauthorized] Called when a request stays
 *   unauthorized after the refresh attempt.
 * @property {string} [eventHost] Defaults to the host without "/api".
 * @property {Function} [io] The socket.io-client "io" function. Left out,
 *   the first events.on() imports the optional peer "socket.io-client".
 * @property {{response?: number|null, deadline?: number|null}} [timeout]
 *   Milliseconds to the first byte (60 000) and for the whole call
 *   (300 000). A key left out, undefined or null keeps its default; 0 or
 *   Infinity disables that timer; anything else throws a TypeError.
 */

/**
 * Create the core of a client: http, authentication and lifecycle, without
 * any namespace. Every core is fully isolated from the others.
 * @param {ClientOptions} options
 */
export const createCore = options => {
  if (!options || !options.host) {
    throw new TypeError('createClient: host is required')
  }
  const auth = options.auth || 'bearer'
  const config = Object.freeze({
    host: options.host,
    // Wrapped: calling a detached window.fetch throws "Illegal invocation".
    fetch: options.fetch || ((input, init) => globalThis.fetch(input, init)),
    // Uploads with progress use XHR, which goes out like the global fetch:
    // an injected fetch carries them instead.
    globalFetch: !options.fetch,
    timeout: resolveTimeout(options.timeout || undefined),
    // Bearer mode never sends cookies: Zou reads the session cookie before
    // the Authorization header, so a bearer client living in a Kitsu page
    // would act as the logged-in user.
    credentials: auth === 'cookie' ? 'same-origin' : 'omit'
  })
  const persistTokens = options.onTokensChange || (() => {})
  const session = createSession({
    auth,
    tokens: options.tokens,
    onTokensChange: tokens => {
      // The socket follows the session first. The app hook persists the
      // tokens: it runs whatever happens to the socket.
      try {
        syncSession()
      } finally {
        persistTokens(tokens)
      }
    },
    onUnauthorized: options.onUnauthorized
  })
  const http = createHttp(config, session)
  const { syncSession, ...events } = createEvents({
    eventHost: (
      options.eventHost || config.host.replace(/\/api\/?$/, '')
    ).replace(/\/+$/, ''),
    session,
    io: options.io
  })

  return {
    host: config.host,
    http,
    events,
    close: () => {
      try {
        events.disconnect()
      } finally {
        http.abortAll()
      }
    },
    ...authApi(http, session)
  }
}

export * from './errors.js'
