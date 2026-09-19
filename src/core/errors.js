export class KitsuError extends Error {
  constructor(
    message,
    { status = null, path = '', method = '', body = '' } = {}
  ) {
    super(message)
    this.name = new.target.name
    this.status = status
    this.path = path
    this.method = method
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
  constructor(message, info = {}) {
    super(message, info)
    const body = info.body || {}
    this.preferredMethod = body.preferred_two_factor_authentication || null
    this.enabledMethods = body.two_factor_authentication_enabled || []
  }
}

const STATUS_ERRORS = {
  400: ParameterError,
  401: NotAuthenticatedError,
  403: NotAllowedError,
  404: NotFoundError,
  413: TooBigFileError
}

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
