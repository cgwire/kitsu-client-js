import { describe, expect, it } from 'vitest'

import {
  AuthFailedError,
  DefaultPasswordError,
  KitsuError,
  MissingOtpError,
  NetworkError,
  NotAllowedError,
  NotAuthenticatedError,
  NotFoundError,
  ParameterError,
  ServerError,
  TimeoutError,
  TooBigFileError,
  TooManyLoginAttemptsError,
  WrongOtpError,
  errorFromResponse,
  loginErrorFrom
} from '../../src/core/errors.js'

const info = { path: 'data/tasks', method: 'GET', body: { message: 'nope' } }

describe('errorFromResponse', () => {
  it.each([
    [400, ParameterError, 'ParameterError'],
    [401, NotAuthenticatedError, 'NotAuthenticatedError'],
    [403, NotAllowedError, 'NotAllowedError'],
    [404, NotFoundError, 'NotFoundError'],
    [413, TooBigFileError, 'TooBigFileError'],
    [500, ServerError, 'ServerError'],
    [503, ServerError, 'ServerError'],
    [418, KitsuError, 'KitsuError']
  ])('maps status %i', (status, ErrorClass, name) => {
    const err = errorFromResponse(status, info)
    expect(err).toBeInstanceOf(ErrorClass)
    expect(err).toBeInstanceOf(KitsuError)
    expect(err.name).toBe(name)
    expect(err).toMatchObject({ status, ...info })
  })
})

describe('error names', () => {
  const NAMES = {
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
    MissingOtpError,
    WrongOtpError,
    TooManyLoginAttemptsError,
    DefaultPasswordError
  }

  it.each(Object.entries(NAMES))('%s carries its name', (name, ErrorClass) => {
    expect(new ErrorClass('boom').name).toBe(name)
    expect(String(new ErrorClass('boom'))).toBe(`${name}: boom`)
  })

  // Minifiers rename class identifiers: the name must not be read from them.
  it('survives the renaming of the class identifier', () => {
    const original = Object.getOwnPropertyDescriptor(NotFoundError, 'name')
    Object.defineProperty(NotFoundError, 'name', { value: 'i' })
    try {
      expect(new NotFoundError('boom').name).toBe('NotFoundError')
    } finally {
      Object.defineProperty(NotFoundError, 'name', original)
    }
  })
})

describe('loginErrorFrom', () => {
  const loginError = body => errorFromResponse(400, { ...info, body })

  it('maps the missing OTP flag and carries the available methods', () => {
    const err = loginErrorFrom(
      loginError({
        missing_OTP: true,
        preferred_two_factor_authentication: 'totp',
        two_factor_authentication_enabled: ['totp', 'email_otp']
      })
    )
    expect(err).toBeInstanceOf(MissingOtpError)
    expect(err).toBeInstanceOf(AuthFailedError)
    expect(err.preferredMethod).toBe('totp')
    expect(err.enabledMethods).toEqual(['totp', 'email_otp'])
  })

  it.each([
    [{ wrong_OTP: true }, WrongOtpError],
    [{ too_many_failed_login_attemps: true }, TooManyLoginAttemptsError],
    [{ default_password: true }, DefaultPasswordError],
    [{ login: false }, AuthFailedError]
  ])('maps %o', (body, ErrorClass) => {
    const err = loginErrorFrom(loginError(body))
    expect(err.constructor).toBe(ErrorClass)
    expect(err.body).toEqual(body)
  })
})
