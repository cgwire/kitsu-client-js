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

/**
 * @param {ClientOptions} options
 * @returns {'all'|'progress'|'none'} The uploads that go through XHR.
 */
const uploadsOverXhr = ({ xhrUploads, fetch }) => {
  if (xhrUploads === true) return 'all'
  return xhrUploads === false || fetch ? 'none' : 'progress'
}

const resolveTimeout = (timeout = {}) =>
  Object.freeze({
    response: timerOf('response', timeout.response),
    deadline: timerOf('deadline', timeout.deadline)
  })

const OPTION_TYPES = {
  fetch: 'function',
  xhrUploads: 'boolean',
  onTokensChange: 'function',
  onUnauthorized: 'function',
  eventHost: 'string'
}

// A wrong option throws at creation, instead of being ignored or failing
// later in a request. Undefined and null keep the default.
const checkOptions = options => {
  if (typeof options.host !== 'string') {
    throw new TypeError('createClient: host must be a string')
  }
  if (!['bearer', 'cookie', undefined, null].includes(options.auth)) {
    throw new TypeError('createClient: auth must be "bearer" or "cookie"')
  }
  const { timeout } = options
  if (
    timeout !== undefined &&
    timeout !== null &&
    typeof timeout !== 'object'
  ) {
    throw new TypeError(
      'createClient: timeout must be an object: { response, deadline }'
    )
  }
  Object.entries(OPTION_TYPES).forEach(([name, type]) => {
    const value = options[name]
    if (value !== undefined && value !== null && typeof value !== type) {
      throw new TypeError(`createClient: ${name} must be a ${type}`)
    }
  })
}

/**
 * @typedef {object} ClientOptions
 * @property {string} host API root, for instance "https://kitsu.studio/api".
 *   A relative host ("/api") suits same-origin web apps.
 * @property {typeof fetch} [fetch] Defaults to the global fetch. Tauri apps
 *   inject the fetch of their http plugin here. Every request goes through
 *   it, uploads included: they then report no progress (see xhrUploads).
 * @property {boolean} [xhrUploads] Which uploads go through
 *   XMLHttpRequest, the only way to report their progress. Left out, the
 *   uploads given an onProgress, none with a fetch option. true: every
 *   upload, skipping an injected fetch and the headers it adds. false: none.
 *   In bearer mode an upload to the origin of the page goes through fetch
 *   anyway: XMLHttpRequest would send the Kitsu session cookie of the page,
 *   which Zou reads before the token.
 * @property {'bearer'|'cookie'} [auth] Defaults to "bearer".
 * @property {import('./session.js').Tokens|null} [tokens] Resume a session.
 * @property {(tokens: import('./session.js').Tokens|null) => void} [onTokensChange]
 *   Called on every token change, to persist them.
 * @property {() => void} [onUnauthorized] Called when a request stays
 *   unauthorized after the refresh attempt, or when Zou refuses to renew the
 *   token it refused the event socket. Zou never renews the token of a
 *   bearer client it takes for a browser: such a session ends with its
 *   access token.
 * @property {string} [eventHost] Defaults to the host without "/api".
 * @property {Function} [io] The socket.io-client "io" function. Left out,
 *   the first events.on() imports the optional peer "socket.io-client",
 *   which only works in Node without a bundler: a bundled app, in a browser
 *   or not, passes io.
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
  checkOptions(options)
  const auth = options.auth || 'bearer'
  const config = Object.freeze({
    host: options.host,
    // Wrapped: calling a detached window.fetch throws "Illegal invocation".
    fetch: options.fetch || ((input, init) => globalThis.fetch(input, init)),
    // Which uploads use XHR. XHR goes out like the global fetch: an
    // injected fetch carries them all instead, unless the app opts in.
    xhrUploads: uploadsOverXhr(options),
    timeout: resolveTimeout(options.timeout || undefined),
    // Bearer mode never sends cookies: Zou reads the session cookie before
    // the Authorization header, so a bearer client living in a Kitsu page
    // would act as the logged-in user.
    credentials: auth === 'cookie' ? 'same-origin' : 'omit'
  })
  const session = createSession({
    auth,
    tokens: options.tokens,
    onChange: () => syncSession(),
    onTokensChange: options.onTokensChange || undefined,
    onUnauthorized: options.onUnauthorized || undefined
  })
  const http = createHttp(config, session)
  const { syncSession, ...events } = createEvents({
    eventHost: (
      options.eventHost || config.host.replace(/\/+$/, '').replace(/\/api$/, '')
    ).replace(/\/+$/, ''),
    session,
    io: options.io,
    probe: () => http.get('auth/authenticated')
  })

  const { abortTurns, ...account } = authApi(http, session)

  return {
    host: config.host,
    http,
    events,
    close: () => {
      try {
        events.disconnect()
      } finally {
        abortTurns()
        http.abortAll()
      }
    },
    ...account
  }
}

export {
  KitsuError,
  ParameterError,
  NotAuthenticatedError,
  NotAllowedError,
  NotFoundError,
  TooBigFileError,
  ServerError,
  NetworkError,
  TimeoutError,
  AuthFailedError,
  WrongOtpError,
  TooManyLoginAttemptsError,
  DefaultPasswordError,
  MissingOtpError
} from './errors.js'
