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

  const setTokens = next => {
    current = copy(next)
    onTokensChange(copy(current))
  }

  return {
    mode: auth,
    getTokens: () => copy(current),
    setTokens,
    onUnauthorized,
    headers: () =>
      auth === 'bearer' && current && current.access_token
        ? { Authorization: `Bearer ${current.access_token}` }
        : {},
    canRefresh: () =>
      auth === 'bearer' && Boolean(current && current.refresh_token),
    // Single flight: concurrent 401s all await the same promise, so only one
    // refresh request leaves the instance.
    refresh: send => {
      if (!refreshing) {
        refreshing = send('GET', 'auth/refresh-token', {
          headers: { Authorization: `Bearer ${current.refresh_token}` }
        })
          .then(body =>
            setTokens({
              ...current,
              access_token: body.access_token,
              refresh_token: body.refresh_token || current.refresh_token
            })
          )
          .finally(() => {
            refreshing = null
          })
      }
      return refreshing
    }
  }
}
