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
 * @param {(tokens: Tokens|null) => void} [options.onTokensChange]
 * @param {() => void} [options.onUnauthorized]
 */
export const createSession = ({
  auth = 'bearer',
  tokens = null,
  onTokensChange = () => {},
  onUnauthorized = () => {}
} = {}) => {
  let current = copy(tokens)
  let refreshing = null
  // Counts the sessions this instance went through: logIn, logOut and
  // setToken open a new one, a token refresh does not.
  let generation = 0

  const write = next => {
    current = copy(next)
    onTokensChange(copy(current))
  }

  const setTokens = next => {
    generation += 1
    refreshing = null
    write(next)
  }

  return {
    mode: auth,
    getTokens: () => copy(current),
    setTokens,
    generation: () => generation,
    onUnauthorized,
    headers: () =>
      auth === 'bearer' && current && current.access_token
        ? { Authorization: `Bearer ${current.access_token}` }
        : {},
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
