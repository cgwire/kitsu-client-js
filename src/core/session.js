import { NotAuthenticatedError } from './errors.js'

const copy = tokens => (tokens ? { ...tokens } : null)

/**
 * @typedef {{access_token?: string, refresh_token?: string}} Tokens
 */

/**
 * Per-instance authentication state.
 * @param {object} [options]
 * @param {'bearer'|'cookie'} [options.auth]
 * @param {Tokens|null} [options.tokens]
 * @param {() => void} [options.onChange] Called first on every change: a
 *   new session or new tokens.
 * @param {(tokens: Tokens|null) => void} [options.onTokensChange]
 * @param {() => void} [options.onUnauthorized]
 */
export const createSession = ({
  auth = 'bearer',
  tokens = null,
  onChange = () => {},
  onTokensChange = () => {},
  onUnauthorized = () => {}
} = {}) => {
  let current = copy(tokens)
  let refreshing = null
  // Counts the sessions this instance went through: logIn, logOut and
  // setToken open a new one, a token refresh does not.
  let generation = 0
  // Cookie mode: whether the browser holds a session that a logIn of this
  // instance opened. No token tells it.
  let cookieLogIn = false

  // The instance (its socket) follows the change first. The app hook
  // persists the tokens: it runs whatever happens to the socket.
  const write = next => {
    current = copy(next)
    try {
      onChange()
    } finally {
      onTokensChange(copy(current))
    }
  }

  // A refresh still in flight belongs to the former session.
  const nextSession = () => {
    generation += 1
    refreshing = null
  }

  const setTokens = next => {
    nextSession()
    cookieLogIn = false
    write(next)
  }

  return {
    mode: auth,
    getTokens: () => copy(current),
    setTokens,
    // A cookie-mode logIn: a new session, kept by the browser. There is no
    // token to persist, but the instance follows it like any other.
    startCookieSession: () => {
      nextSession()
      cookieLogIn = true
      onChange()
    },
    generation: () => generation,
    onUnauthorized,
    headers: () =>
      auth === 'bearer' && current && current.access_token
        ? { Authorization: `Bearer ${current.access_token}` }
        : {},
    // Whether a connection opened now can authenticate: with the bearer
    // token, or with the cookie that a logIn of this instance set.
    canAuthenticate: () =>
      auth === 'bearer'
        ? Boolean(current && current.access_token)
        : cookieLogIn,
    canRefresh: () =>
      auth === 'bearer' && Boolean(current && current.refresh_token),
    // Single flight: concurrent 401s all await the same promise, so only one
    // refresh request leaves the instance per session.
    refresh: send => {
      if (!refreshing) {
        const startedIn = generation
        const used = current
        const path = 'auth/refresh-token'
        const flight = send('GET', path, {
          headers: { Authorization: `Bearer ${used.refresh_token}` }
        })
          .then(body => {
            // The session was replaced meanwhile: this answer belongs to the
            // former one and must not overwrite the new tokens.
            if (generation !== startedIn) return
            // Zou answers browsers with { refresh: true } and the token in a
            // cookie only, which a bearer client cannot use.
            const token = body && body.access_token
            if (typeof token !== 'string' || !token) {
              throw new NotAuthenticatedError(
                'Token refresh returned no access token',
                { path, method: 'GET', body }
              )
            }
            write({
              ...used,
              access_token: token,
              refresh_token: body.refresh_token || used.refresh_token
            })
          })
          .finally(() => {
            if (refreshing === flight) refreshing = null
          })
        refreshing = flight
      }
      return refreshing
    }
  }
}
