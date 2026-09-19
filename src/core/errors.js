/**
 * @typedef {object} ErrorInfo
 * @property {number|null} [status] HTTP status, null when no answer came.
 * @property {string} [path]
 * @property {string} [method]
 * @property {any} [body] The parsed body of Zou when it sent one.
 */

export class KitsuError extends Error {
  /**
   * @param {string} message
   * @param {ErrorInfo} [info]
   */
  constructor(
    message,
    { status = null, path = '', method = '', body = '' } = {}
  ) {
    super(message)
    /** @type {number|null} */
    this.status = status
    /** @type {string} */
    this.path = path
    /** @type {string} */
    this.method = method
    /** @type {any} */
    this.body = body
  }
}

export class ParameterError extends KitsuError {}
export class NotAuthenticatedError extends KitsuError {}
export class NotAllowedError extends KitsuError {}
export class NotFoundError extends KitsuError {}
export class TooBigFileError extends KitsuError {}
export class ServerError extends KitsuError {}
export class NetworkError extends KitsuError {}
export class TimeoutError extends KitsuError {}

export class AuthFailedError extends KitsuError {}
export class WrongOtpError extends AuthFailedError {}
export class TooManyLoginAttemptsError extends AuthFailedError {}
export class DefaultPasswordError extends AuthFailedError {}
export class MissingOtpError extends AuthFailedError {
  /**
   * @param {string} message
   * @param {ErrorInfo} [info]
   */
  constructor(message, info = {}) {
    super(message, info)
    const body = info.body || {}
    /** @type {string|null} */
    this.preferredMethod = body.preferred_two_factor_authentication || null
    /** @type {string[]} */
    this.enabledMethods = body.two_factor_authentication_enabled || []
  }
}

// Names are literals: minifiers rename class identifiers, so a name read
// from the class would not survive the build of a consumer.
Object.entries({
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
}).forEach(([name, ErrorClass]) =>
  Object.defineProperty(ErrorClass.prototype, 'name', {
    value: name,
    writable: true,
    configurable: true
  })
)

const STATUS_ERRORS = {
  400: ParameterError,
  401: NotAuthenticatedError,
  403: NotAllowedError,
  404: NotFoundError,
  413: TooBigFileError
}

/**
 * @param {number} status
 * @param {ErrorInfo} info
 * @returns {KitsuError} The error class matching the status.
 */
export const errorFromResponse = (status, { path, method, body }) => {
  const ErrorClass =
    STATUS_ERRORS[status] || (status >= 500 ? ServerError : KitsuError)
  return new ErrorClass(`${method} ${path} failed with status ${status}`, {
    status,
    path,
    method,
    body
  })
}

// Zou spells the flag "attemps": keep the typo, it is the wire format.
const LOGIN_FLAGS = {
  missing_OTP: MissingOtpError,
  wrong_OTP: WrongOtpError,
  too_many_failed_login_attemps: TooManyLoginAttemptsError,
  default_password: DefaultPasswordError
}

/**
 * @param {KitsuError} err The error thrown by POST auth/login.
 * @returns {AuthFailedError}
 */
export const loginErrorFrom = err => {
  const body = err.body || {}
  const flag = Object.keys(LOGIN_FLAGS).find(name => body[name])
  const ErrorClass = flag ? LOGIN_FLAGS[flag] : AuthFailedError
  return new ErrorClass('Login failed', {
    status: err.status,
    path: err.path,
    method: err.method,
    body
  })
}
