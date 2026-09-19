import { authApi } from './auth.js'
import { createHttp } from './http.js'
import { createSession } from './session.js'

const DEFAULT_TIMEOUT = { response: 60000, deadline: 300000 }

/**
 * @typedef {object} ClientOptions
 * @property {string} host API root, for instance "https://kitsu.studio/api".
 *   A relative host ("/api") suits same-origin web apps.
 * @property {typeof fetch} [fetch] Defaults to the global fetch. Tauri apps
 *   inject the fetch of their http plugin here.
 * @property {'bearer'|'cookie'} [auth] Defaults to "bearer".
 * @property {import('./session.js').Tokens|null} [tokens] Resume a session.
 * @property {(tokens: import('./session.js').Tokens|null) => void} [onTokensChange]
 *   Called on every token change, to persist them.
 * @property {() => void} [onUnauthorized] Called when a request stays
 *   unauthorized after the refresh attempt.
 * @property {string} [eventHost] Defaults to the host without "/api".
 * @property {Function} [io] The socket.io-client "io" function.
 * @property {{response?: number, deadline?: number}} [timeout] Milliseconds.
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
    timeout: Object.freeze({ ...DEFAULT_TIMEOUT, ...options.timeout }),
    credentials: auth === 'cookie' ? 'same-origin' : undefined
  })
  const session = createSession({
    auth,
    tokens: options.tokens,
    onTokensChange: options.onTokensChange,
    onUnauthorized: options.onUnauthorized
  })
  const http = createHttp(config, session)

  return {
    host: config.host,
    http,
    events: null,
    close: () => http.abortAll(),
    ...authApi(http, session)
  }
}

export * from './errors.js'
