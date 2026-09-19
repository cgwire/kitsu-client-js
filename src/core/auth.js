import { KitsuError, NotAuthenticatedError, loginErrorFrom } from './errors.js'

/**
 * @typedef {{signal?: AbortSignal}} RequestOptions
 */

/**
 * @typedef {object} LogInOptions
 * @property {string} [totp] Time-based one-time password.
 * @property {string} [emailOtp] One-time password received by email.
 * @property {string} [recoveryCode]
 * @property {object} [fidoAuthenticationResponse]
 * @property {AbortSignal} [signal]
 */

export const authApi = (http, session) => ({
  /**
   * Log in with user credentials. In bearer mode the tokens are kept by
   * this client only.
   * @param {string} email
   * @param {string} password
   * @param {LogInOptions} [options]
   * @returns {Promise<object>} The login body of Zou (user, tokens, ...).
   * @throws {import('./errors.js').AuthFailedError} or one of its subclasses.
   */
  logIn: async (
    email,
    password,
    { totp, emailOtp, recoveryCode, fidoAuthenticationResponse, signal } = {}
  ) => {
    const payload = {
      email,
      password,
      totp,
      email_otp: emailOtp,
      recovery_code: recoveryCode,
      fido_authentication_response: fidoAuthenticationResponse
    }
    const body = await http
      .post('auth/login', payload, { skipAuth: true, signal })
      .catch(err => {
        throw err instanceof KitsuError && err.status
          ? loginErrorFrom(err)
          : err
      })
    if (session.mode === 'bearer') {
      session.setTokens({
        access_token: body.access_token,
        refresh_token: body.refresh_token
      })
    }
    return body
  },

  /**
   * Log out. Tokens are cleared even when the request fails.
   * @param {RequestOptions} [options]
   * @returns {Promise<object>}
   */
  logOut: ({ signal } = {}) =>
    http
      .get('auth/logout', {}, { signal })
      .finally(() => session.setTokens(null)),

  /**
   * Authenticate with a long-lived token (bot token). No refresh happens.
   * @param {string} token
   */
  setToken: token => session.setTokens({ access_token: token }),

  /**
   * @returns {import('./session.js').Tokens|null} A copy of the tokens.
   */
  getTokens: () => session.getTokens(),

  /**
   * @param {RequestOptions} [options]
   * @returns {Promise<object>} The person matching the current session.
   */
  getCurrentUser: ({ signal } = {}) =>
    http.get('auth/authenticated', {}, { signal }).then(body => body.user),

  /**
   * Probe the session without triggering a refresh nor onUnauthorized.
   * @param {RequestOptions} [options]
   * @returns {Promise<boolean>}
   */
  isAuthenticated: ({ signal } = {}) =>
    http
      .get(
        'auth/authenticated',
        {},
        { skipAuth: true, headers: session.headers(), signal }
      )
      .then(
        () => true,
        err => {
          if (err instanceof NotAuthenticatedError) return false
          throw err
        }
      )
})
