import {
  AuthFailedError,
  KitsuError,
  NotAuthenticatedError,
  loginErrorFrom
} from './errors.js'
import { requiredOf, withoutNil } from './params.js'

/**
 * @typedef {import('./params.js').Entity} Entity
 * @typedef {import('./params.js').RequestOptions} RequestOptions
 * @typedef {{user: Entity, access_token?: string, refresh_token?: string,
 *   [field: string]: any}} LoginBody
 */

/**
 * @typedef {object} LogInOptions
 * @property {string} [totp] Time-based one-time password.
 * @property {string} [emailOtp] One-time password received by email.
 * @property {string} [recoveryCode]
 * @property {object} [fidoAuthenticationResponse]
 * @property {AbortSignal} [signal]
 */

/**
 * Proof of identity Zou asks before weakening the two-factor setup: one of
 * the four is enough.
 * @typedef {object} TwoFactorOptions
 * @property {string} [totp] Time-based one-time password.
 * @property {string} [emailOtp] One-time password received by email.
 * @property {string} [recoveryCode]
 * @property {object} [fidoAuthenticationResponse]
 * @property {AbortSignal} [signal]
 */

// The statuses Zou refuses a login with, whatever the cause, error.status
// telling them apart. 400: wrong credentials, missing or wrong OTP, too many
// attempts, default password, LDAP user without fallback, malformed body,
// and also a timeout of its database pool. 401: inactive user. 409: no
// authentication strategy configured, which refuses every user alike.
const LOGIN_REFUSALS = [400, 401, 409]

/**
 * @param {TwoFactorOptions} options
 * @returns {Record<string, any>} The two factor payload of Zou.
 */
const twoFactorPayloadOf = ({
  totp,
  emailOtp,
  recoveryCode,
  fidoAuthenticationResponse
}) =>
  withoutNil({
    totp,
    email_otp: emailOtp,
    recovery_code: recoveryCode,
    fido_authentication_response: fidoAuthenticationResponse
  })

export const authApi = (http, session) => {
  // Zou answers a two-factor registration with a new token pair: the one in
  // use may carry the requires_2fa_setup claim, which locks the API.
  const adoptTokens = body => {
    if (session.mode === 'bearer' && body.access_token) {
      session.setTokens({
        access_token: body.access_token,
        refresh_token: body.refresh_token
      })
    }
    return body.otp_recovery_codes
  }

  return {
    /**
     * Log in with user credentials. In bearer mode the tokens are kept by
     * this client only.
     * @param {string} email
     * @param {string} password
     * @param {LogInOptions} [options]
     * @returns {Promise<LoginBody>} The login body of Zou (user, tokens, ...).
     * @throws {import('./errors.js').AuthFailedError} or one of its
     *   subclasses when Zou refuses the login. Any other failure keeps its
     *   own error: a ServerError for a 5xx, for instance.
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
          // Only a refusal of Zou is a failed login: an outage (5xx) or a
          // host given without "/api" (405, 404, a page answered with a 200)
          // is not wrong credentials.
          throw err instanceof KitsuError && LOGIN_REFUSALS.includes(err.status)
            ? loginErrorFrom(err)
            : err
        })
      if (session.mode === 'bearer') {
        // A JSON answer without a token (proxy, wrong service) must not
        // leave the client believing it is logged in.
        if (typeof body?.access_token !== 'string' || !body.access_token) {
          throw new AuthFailedError('Login returned no access token', {
            status: 200,
            path: 'auth/login',
            method: 'POST',
            body
          })
        }
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
     * @returns {Promise<Record<string, any>>}
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
     * @returns {Promise<Entity>} The person matching the current session.
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
        ),

    /**
     * Read the public configuration of the API. No authentication needed.
     * @param {RequestOptions} [options]
     * @returns {Promise<Record<string, any>>}
     */
    getConfig: async ({ signal } = {}) =>
      http.get('config', {}, { skipAuth: true, signal }),

    /**
     * Change the password of the current user. Zou keeps the session: the
     * tokens are left untouched.
     * @param {string} oldPassword
     * @param {string} password
     * @param {string} [password2] Confirmation, the new password by default.
     * @param {RequestOptions} [options]
     * @returns {Promise<Record<string, any>>}
     */
    changePassword: async (
      oldPassword,
      password,
      password2 = password,
      { signal } = {}
    ) =>
      http.post(
        'auth/change-password',
        {
          old_password: requiredOf('oldPassword', oldPassword),
          password: requiredOf('password', password),
          password_2: password2
        },
        { signal }
      ),

    /**
     * Start the TOTP setup of the current user.
     * @param {RequestOptions} [options]
     * @returns {Promise<{totp_provisionning_uri: string, otp_secret: string}>}
     */
    preEnableTotp: async ({ signal } = {}) =>
      http.put('auth/totp', {}, { signal }),

    /**
     * Finish the TOTP setup. In bearer mode the tokens issued by Zou replace
     * the current ones.
     * @param {string} totp Code given by the authenticator application.
     * @param {RequestOptions} [options]
     * @returns {Promise<string[]>} The recovery codes.
     */
    enableTotp: async (totp, { signal } = {}) =>
      http
        .post('auth/totp', { totp: requiredOf('totp', totp) }, { signal })
        .then(adoptTokens),

    /**
     * Disable TOTP for the current user.
     * @param {TwoFactorOptions} [options] Proof of identity and signal.
     * @returns {Promise<Record<string, any>>}
     */
    disableTotp: async ({ signal, ...proof } = {}) =>
      http.del('auth/totp', twoFactorPayloadOf(proof), { signal }),

    /**
     * Send a one-time password by email, before logging in. No authentication
     * needed.
     * @param {string} email
     * @param {RequestOptions} [options]
     * @returns {Promise<Record<string, any>>}
     */
    sendEmailOtp: async (email, { signal } = {}) =>
      http.get(
        'auth/email-otp',
        { email: requiredOf('email', email) },
        { skipAuth: true, signal }
      ),

    /**
     * Start the email OTP setup of the current user: Zou sends a code by email.
     * @param {RequestOptions} [options]
     * @returns {Promise<Record<string, any>>}
     */
    preEnableEmailOtp: async ({ signal } = {}) =>
      http.put('auth/email-otp', {}, { signal }),

    /**
     * Finish the email OTP setup. In bearer mode the tokens issued by Zou
     * replace the current ones.
     * @param {string} emailOtp Code received by email.
     * @param {RequestOptions} [options]
     * @returns {Promise<string[]>} The recovery codes.
     */
    enableEmailOtp: async (emailOtp, { signal } = {}) =>
      http
        .post(
          'auth/email-otp',
          { email_otp: requiredOf('emailOtp', emailOtp) },
          { signal }
        )
        .then(adoptTokens),

    /**
     * Disable email OTP for the current user.
     * @param {TwoFactorOptions} [options] Proof of identity and signal.
     * @returns {Promise<Record<string, any>>}
     */
    disableEmailOtp: async ({ signal, ...proof } = {}) =>
      http.del('auth/email-otp', twoFactorPayloadOf(proof), { signal }),

    /**
     * Start the registration of a FIDO device for the current user.
     * @param {RequestOptions} [options]
     * @returns {Promise<Record<string, any>>} The WebAuthn creation options.
     */
    preRegisterFido: async ({ signal } = {}) =>
      http.put('auth/fido', {}, { signal }),

    /**
     * Finish the registration of a FIDO device. In bearer mode the tokens
     * issued by Zou replace the current ones.
     * @param {object} registrationResponse Answer of the WebAuthn device.
     * @param {string} deviceName
     * @param {RequestOptions} [options]
     * @returns {Promise<string[]>} The recovery codes.
     */
    registerFido: async (registrationResponse, deviceName, { signal } = {}) =>
      http
        .post(
          'auth/fido',
          {
            registration_response: requiredOf(
              'registrationResponse',
              registrationResponse
            ),
            device_name: requiredOf('deviceName', deviceName)
          },
          { signal }
        )
        .then(adoptTokens),

    /**
     * Get the FIDO challenge of a user, before logging in. No authentication
     * needed.
     * @param {string} email
     * @param {RequestOptions} [options]
     * @returns {Promise<Record<string, any>>} The WebAuthn request options.
     */
    getFidoChallenge: async (email, { signal } = {}) =>
      http.get(
        'auth/fido',
        { email: requiredOf('email', email) },
        { skipAuth: true, signal }
      ),

    /**
     * Unregister a FIDO device of the current user.
     * @param {string} deviceName
     * @param {TwoFactorOptions} [options] Proof of identity and signal.
     * @returns {Promise<Record<string, any>>}
     */
    unregisterFido: async (deviceName, { signal, ...proof } = {}) =>
      http.del(
        'auth/fido',
        {
          device_name: requiredOf('deviceName', deviceName),
          ...twoFactorPayloadOf(proof)
        },
        { signal }
      ),

    /**
     * Replace the recovery codes of the current user.
     * @param {TwoFactorOptions} [options] Proof of identity and signal.
     * @returns {Promise<string[]>} The new recovery codes.
     */
    newRecoveryCodes: async ({ signal, ...proof } = {}) =>
      http
        .put('auth/recovery-codes', twoFactorPayloadOf(proof), { signal })
        .then(body => body.otp_recovery_codes)
  }
}
