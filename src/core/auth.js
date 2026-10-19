import {
  AuthFailedError,
  KitsuError,
  NotAuthenticatedError,
  ParameterError,
  loginErrorFrom
} from './errors.js'
import { unlessAborted } from './http.js'
import { requiredOf, withoutNil } from './params.js'

/**
 * @typedef {import('./params.js').Entity} Entity
 * @typedef {import('./params.js').RequestOptions} RequestOptions
 * @typedef {{user: Entity, access_token?: string, refresh_token?: string,
 *   two_factor_authentication_required?: boolean,
 *   [field: string]: any}} LoginBody
 */

/**
 * @typedef {object} LogInOptions
 * @property {string} [totp] Time-based one-time password.
 * @property {string} [emailOtp] One-time password received by email.
 * @property {string} [recoveryCode]
 * @property {object} [fidoAuthenticationResponse] Answer of the WebAuthn
 *   device to getFidoChallenge. Cookie mode only, on the Kitsu origin: Zou
 *   keeps the challenge in its cookie session.
 * @property {AbortSignal} [signal]
 */

/**
 * Proof of identity Zou asks before weakening the two-factor setup: one of
 * the four is enough.
 * @typedef {object} TwoFactorOptions
 * @property {string} [totp] Time-based one-time password.
 * @property {string} [emailOtp] One-time password received by email.
 * @property {string} [recoveryCode]
 * @property {object} [fidoAuthenticationResponse] Answer of the WebAuthn
 *   device to getFidoChallenge. Cookie mode only, on the Kitsu origin: Zou
 *   keeps the challenge in its cookie session.
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
  // Session changes (logIn, logOut, setToken, a two-factor registration) are
  // numbered when they start: an answer is only adopted while no later
  // change started, so the last call wins whatever order the answers land in.
  let changes = 0
  const startChange = () => {
    changes += 1
    const started = changes
    return () => started === changes
  }

  // Cookie mode: the browser keeps the session and applies the cookies of
  // each answer as it lands. A change waits for the one before it to settle,
  // so its cookies land in call order too. Until its turn it is in flight
  // all the same: its signal rejects it at once, and its signal or close()
  // keeps it from being sent when its turn comes.
  let previous = Promise.resolve()
  let closes = 0
  const inTurn = (run, signal) => {
    if (session.mode !== 'cookie') return run()
    const queuedAt = closes
    const turn = previous.then(() => {
      if (closes !== queuedAt || (signal && signal.aborted)) {
        throw new DOMException('The operation was aborted', 'AbortError')
      }
      return run()
    })
    previous = turn.then(
      () => {},
      () => {}
    )
    return unlessAborted(turn, signal)
  }

  // Zou answers a two-factor registration with a new token pair, also set
  // as cookies: the one in use may carry the requires_2fa_setup claim, which
  // locks the API and the socket. The recovery codes come back even when a
  // later change keeps its own tokens: Zou shows them once, for the first
  // method only.
  const register = (path, payload, signal) => {
    const isLatest = startChange()
    return inTurn(() => http.post(path, payload, { signal }), signal).then(
      body => {
        if (body.access_token && isLatest()) {
          if (session.mode === 'bearer') {
            session.setTokens({
              access_token: body.access_token,
              refresh_token: body.refresh_token
            })
          } else {
            session.startCookieSession()
          }
        }
        return body.otp_recovery_codes ?? null
      }
    )
  }

  // Zou revokes a session from its access token. An expired one is renewed
  // first, like any request would do, with the refresh token of the session
  // being closed: the client already holds no token.
  const sendLogout = async (headers, refreshToken, signal) => {
    const logout = auth =>
      http.get('auth/logout', {}, { skipAuth: true, headers: auth, signal })
    try {
      return await logout(headers)
    } catch (err) {
      if (!(err instanceof NotAuthenticatedError) || !refreshToken) throw err
      const renewed = await http.get(
        'auth/refresh-token',
        {},
        {
          skipAuth: true,
          headers: { Authorization: `Bearer ${refreshToken}` },
          signal
        }
      )
      // A browser gets its token in a cookie only: nothing to revoke with.
      const token = renewed && renewed.access_token
      if (typeof token !== 'string' || !token) throw err
      return logout({ Authorization: `Bearer ${token}` })
    }
  }

  return {
    /**
     * For the close() of the core: the changes waiting for their turn are
     * aborted like the requests in flight.
     */
    abortTurns: () => {
      closes += 1
    },

    /**
     * Log in with user credentials. In bearer mode the tokens are kept by
     * this client only. The last session change started wins: when a
     * logIn, logOut, setToken or two-factor setup starts before the answer
     * lands, this logIn keeps nothing and rejects with an AbortError. In
     * cookie mode the browser applies the cookies of that answer all the
     * same: it stays logged in as that user, for the requests of the client
     * too, until a later logIn succeeds or a logOut reaches Zou.
     * @param {string} email
     * @param {string} password
     * @param {LogInOptions} [options]
     * @returns {Promise<LoginBody>} The login body of Zou (user, tokens, ...).
     *   two_factor_authentication_required: the tokens only open the
     *   two-factor setup (enableTotp, ...), logOut and getCurrentUser until
     *   the user sets up a second factor.
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
      const isLatest = startChange()
      const body = await inTurn(
        () => http.post('auth/login', payload, { skipAuth: true, signal }),
        signal
      ).catch(err => {
        // Only a refusal of Zou is a failed login: an outage (5xx) or a
        // host given without "/api" (405, 404, a page answered with a 200)
        // is not wrong credentials.
        throw err instanceof KitsuError && LOGIN_REFUSALS.includes(err.status)
          ? loginErrorFrom(err)
          : err
      })
      // A JSON answer without a token (proxy, wrong service) must not leave
      // the client believing it is logged in.
      if (
        session.mode === 'bearer' &&
        (typeof body?.access_token !== 'string' || !body.access_token)
      ) {
        throw new AuthFailedError('Login returned no access token', {
          status: 200,
          path: 'auth/login',
          method: 'POST',
          body
        })
      }
      if (!isLatest()) {
        throw new DOMException(
          'The login was superseded by a later session change',
          'AbortError'
        )
      }
      if (session.mode === 'bearer') {
        session.setTokens({
          access_token: body.access_token,
          refresh_token: body.refresh_token
        })
      } else {
        session.startCookieSession()
      }
      return body
    },

    /**
     * Log out. The client drops its session at once, whatever the answer:
     * the request only asks Zou to revoke it, an expired access token being
     * renewed for that.
     * @param {RequestOptions} [options]
     * @returns {Promise<Record<string, any>>}
     */
    logOut: async options => {
      startChange()
      const tokens = session.getTokens()
      const headers = session.headers()
      const { signal } = options ?? {}
      // In turn before the session is dropped: the drop runs app code (its
      // socket handlers, onTokensChange), which may start the next change.
      const sent = inTurn(
        () => sendLogout(headers, tokens && tokens.refresh_token, signal),
        signal
      )
      session.setTokens(null)
      return sent
    },

    /**
     * Authenticate with a long-lived token (bot token). No refresh happens.
     * @param {string} token
     */
    setToken: token => {
      startChange()
      session.setTokens({ access_token: token })
    },

    /**
     * @returns {import('./session.js').Tokens|null} A copy of the tokens.
     */
    getTokens: () => session.getTokens(),

    /**
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The person matching the current session.
     */
    getCurrentUser: async ({ signal } = {}) =>
      http.get('auth/authenticated', {}, { signal }).then(body => body.user),

    /**
     * Probe the session without triggering a refresh nor onUnauthorized:
     * false means that Zou refuses the current access token, even one that
     * the refresh token could renew. getCurrentUser() renews it.
     * @param {RequestOptions} [options]
     * @returns {Promise<boolean>}
     */
    isAuthenticated: async ({ signal } = {}) =>
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
     * @param {string} password Sent as its own confirmation, like
     *   person.changePasswordForPerson does.
     * @param {RequestOptions} [options]
     * @returns {Promise<Record<string, any>>}
     */
    changePassword: async (oldPassword, password, options = {}) => {
      // A confirmation given there, as 0.2.0 took it, must not pass for the
      // options: it would never be compared.
      if (typeof options === 'string') {
        throw new ParameterError(
          'changePassword: the third argument is the options, compare the ' +
            'confirmation before the call'
        )
      }
      const { signal } = options
      return http.post(
        'auth/change-password',
        {
          old_password: requiredOf('oldPassword', oldPassword),
          password: requiredOf('password', password),
          password_2: password
        },
        { signal }
      )
    },

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
     * @returns {Promise<string[]|null>} The recovery codes, or null when
     *   another method gave them already: the user keeps those.
     */
    enableTotp: async (totp, { signal } = {}) =>
      register('auth/totp', { totp: requiredOf('totp', totp) }, signal),

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
     * @returns {Promise<string[]|null>} The recovery codes, or null when
     *   another method gave them already: the user keeps those.
     */
    enableEmailOtp: async (emailOtp, { signal } = {}) =>
      register(
        'auth/email-otp',
        { email_otp: requiredOf('emailOtp', emailOtp) },
        signal
      ),

    /**
     * Disable email OTP for the current user.
     * @param {TwoFactorOptions} [options] Proof of identity and signal.
     * @returns {Promise<Record<string, any>>}
     */
    disableEmailOtp: async ({ signal, ...proof } = {}) =>
      http.del('auth/email-otp', twoFactorPayloadOf(proof), { signal }),

    /**
     * Start the registration of a FIDO device for the current user. Cookie
     * mode only, on the Kitsu origin, like every FIDO step: Zou keeps the
     * state of the ceremony in its cookie session.
     * @param {RequestOptions} [options]
     * @returns {Promise<Record<string, any>>} The WebAuthn creation options.
     */
    preRegisterFido: async ({ signal } = {}) =>
      http.put('auth/fido', {}, { signal }),

    /**
     * Finish the registration of a FIDO device, in cookie mode on the Kitsu
     * origin (see preRegisterFido).
     * @param {object} registrationResponse Answer of the WebAuthn device.
     * @param {string} deviceName
     * @param {RequestOptions} [options]
     * @returns {Promise<string[]|null>} The recovery codes, or null when
     *   another method gave them already: the user keeps those.
     */
    registerFido: async (registrationResponse, deviceName, { signal } = {}) =>
      register(
        'auth/fido',
        {
          registration_response: requiredOf(
            'registrationResponse',
            registrationResponse
          ),
          device_name: requiredOf('deviceName', deviceName)
        },
        signal
      ),

    /**
     * Get the FIDO challenge of a user, before logging in. No authentication
     * needed, but cookie mode on the Kitsu origin: Zou keeps the challenge in
     * its cookie session until the logIn that answers it.
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
