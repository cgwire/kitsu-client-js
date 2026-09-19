import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createCore } from '../../src/core/index.js'
import { createFakeFetch } from '../helpers/fakeFetch.js'
import { HOST } from '../helpers/ids.js'

const TOKENS = { access_token: 'access', refresh_token: 'refresh' }
const NEW_TOKENS = { access_token: 'access-2', refresh_token: 'refresh-2' }
const CODES = ['code-1', 'code-2']
const REGISTRATION_BODY = { otp_recovery_codes: CODES, ...NEW_TOKENS }

let fake
let kitsu

beforeEach(() => {
  fake = createFakeFetch()
  kitsu = createCore({ host: HOST, fetch: fake, tokens: TOKENS })
})

describe('getConfig', () => {
  it('reads the public configuration without token', async () => {
    fake.reply(200, { is_self_hosted: true })
    expect(await kitsu.getConfig()).toEqual({ is_self_hosted: true })
    expect(fake.calls[0]).toMatchObject({ method: 'GET', path: '/config' })
    expect(fake.calls[0].headers.Authorization).toBeUndefined()
  })
})

describe('changePassword', () => {
  it('posts the old and the new password and keeps the tokens', async () => {
    fake.reply(200, { success: true })
    const body = await kitsu.changePassword('old', 'new-secret', 'new-secret')
    expect(body).toEqual({ success: true })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: '/auth/change-password',
      body: {
        old_password: 'old',
        password: 'new-secret',
        password_2: 'new-secret'
      }
    })
    expect(fake.calls[0].headers.Authorization).toBe('Bearer access')
    expect(kitsu.getTokens()).toEqual(TOKENS)
  })

  it('confirms the new password by default', async () => {
    fake.reply(200, { success: true })
    await kitsu.changePassword('old', 'new-secret')
    expect(fake.calls[0].body.password_2).toBe('new-secret')
  })

  it('rejects when a password is missing', async () => {
    await expect(kitsu.changePassword('old')).rejects.toThrow(/password/)
    await expect(kitsu.changePassword('', 'new')).rejects.toThrow(/oldPassword/)
    expect(fake.calls).toHaveLength(0)
  })
})

describe('TOTP', () => {
  it('preEnableTotp puts an empty body', async () => {
    const setup = { totp_provisionning_uri: 'otpauth://x', otp_secret: 's' }
    fake.reply(200, setup)
    expect(await kitsu.preEnableTotp()).toEqual(setup)
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: '/auth/totp',
      body: {}
    })
  })

  it('enableTotp returns the recovery codes and adopts the new tokens', async () => {
    const onTokensChange = vi.fn()
    kitsu = createCore({
      host: HOST,
      fetch: fake,
      tokens: TOKENS,
      onTokensChange
    })
    fake.reply(200, REGISTRATION_BODY)
    expect(await kitsu.enableTotp('123456')).toEqual(CODES)
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: '/auth/totp',
      body: { totp: '123456' }
    })
    expect(kitsu.getTokens()).toEqual(NEW_TOKENS)
    expect(onTokensChange).toHaveBeenCalledWith(NEW_TOKENS)
  })

  it('enableTotp keeps the tokens when Zou sends none', async () => {
    fake.reply(200, { otp_recovery_codes: CODES })
    await kitsu.enableTotp('123456')
    expect(kitsu.getTokens()).toEqual(TOKENS)
  })

  it('enableTotp keeps no token in cookie mode', async () => {
    kitsu = createCore({ host: HOST, fetch: fake, auth: 'cookie' })
    fake.reply(200, REGISTRATION_BODY)
    expect(await kitsu.enableTotp('123456')).toEqual(CODES)
    expect(kitsu.getTokens()).toBeNull()
  })

  it('enableTotp rejects without a code', async () => {
    await expect(kitsu.enableTotp()).rejects.toThrow(/totp/)
    expect(fake.calls).toHaveLength(0)
  })

  it('disableTotp deletes with the two factor payload as body', async () => {
    fake.reply(200, { success: true })
    expect(await kitsu.disableTotp({ totp: '123456' })).toEqual({
      success: true
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: '/auth/totp'
    })
    expect(fake.calls[0].body).toEqual({ totp: '123456' })
    expect(kitsu.getTokens()).toEqual(TOKENS)
  })
})

describe('email OTP', () => {
  it('sendEmailOtp asks for a code without token', async () => {
    fake.reply(200, { success: true })
    await kitsu.sendEmailOtp('a+b@c.d')
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/auth/email-otp'
    })
    expect(fake.calls[0].query.get('email')).toBe('a+b@c.d')
    expect(fake.calls[0].headers.Authorization).toBeUndefined()
  })

  it('sendEmailOtp rejects without an email', async () => {
    await expect(kitsu.sendEmailOtp()).rejects.toThrow(/email/)
    expect(fake.calls).toHaveLength(0)
  })

  it('preEnableEmailOtp puts an empty body', async () => {
    fake.reply(200, { success: true })
    expect(await kitsu.preEnableEmailOtp()).toEqual({ success: true })
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: '/auth/email-otp',
      body: {}
    })
  })

  it('enableEmailOtp returns the recovery codes and adopts the new tokens', async () => {
    fake.reply(200, REGISTRATION_BODY)
    expect(await kitsu.enableEmailOtp('654321')).toEqual(CODES)
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: '/auth/email-otp',
      body: { email_otp: '654321' }
    })
    expect(kitsu.getTokens()).toEqual(NEW_TOKENS)
  })

  it('disableEmailOtp deletes with the two factor payload as body', async () => {
    fake.reply(200, { success: true })
    await kitsu.disableEmailOtp({ emailOtp: '654321', recoveryCode: 'rc' })
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: '/auth/email-otp'
    })
    expect(fake.calls[0].body).toEqual({
      email_otp: '654321',
      recovery_code: 'rc'
    })
  })
})

describe('FIDO', () => {
  it('preRegisterFido puts an empty body', async () => {
    fake.reply(200, { challenge: 'abc' })
    expect(await kitsu.preRegisterFido()).toEqual({ challenge: 'abc' })
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: '/auth/fido',
      body: {}
    })
  })

  it('registerFido returns the recovery codes and adopts the new tokens', async () => {
    fake.reply(200, REGISTRATION_BODY)
    const registration = { id: 'credential' }
    expect(await kitsu.registerFido(registration, 'My key')).toEqual(CODES)
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: '/auth/fido',
      body: { registration_response: registration, device_name: 'My key' }
    })
    expect(kitsu.getTokens()).toEqual(NEW_TOKENS)
  })

  it('registerFido rejects without a device name', async () => {
    await expect(kitsu.registerFido({ id: 'c' })).rejects.toThrow(/deviceName/)
    expect(fake.calls).toHaveLength(0)
  })

  it('getFidoChallenge asks for a challenge without token', async () => {
    fake.reply(200, { challenge: 'abc' })
    expect(await kitsu.getFidoChallenge('a@b.c')).toEqual({ challenge: 'abc' })
    expect(fake.calls[0]).toMatchObject({ method: 'GET', path: '/auth/fido' })
    expect(fake.calls[0].query.get('email')).toBe('a@b.c')
    expect(fake.calls[0].headers.Authorization).toBeUndefined()
  })

  it('unregisterFido deletes with the device name as body', async () => {
    fake.reply(200, { success: true })
    await kitsu.unregisterFido('My key')
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: '/auth/fido'
    })
    expect(fake.calls[0].body).toEqual({ device_name: 'My key' })
  })

  it('unregisterFido sends the two factor proof next to the name', async () => {
    fake.reply(200, { success: true })
    const fidoAuthenticationResponse = { id: 'assertion' }
    await kitsu.unregisterFido('My key', { fidoAuthenticationResponse })
    expect(fake.calls[0].body).toEqual({
      device_name: 'My key',
      fido_authentication_response: fidoAuthenticationResponse
    })
  })
})

describe('newRecoveryCodes', () => {
  it('puts the two factor payload and returns the new codes', async () => {
    fake.reply(200, { otp_recovery_codes: CODES })
    expect(await kitsu.newRecoveryCodes({ totp: '123456' })).toEqual(CODES)
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: '/auth/recovery-codes'
    })
    expect(fake.calls[0].body).toEqual({ totp: '123456' })
    expect(kitsu.getTokens()).toEqual(TOKENS)
  })
})

describe('bad arguments', () => {
  it('reject instead of throwing', async () => {
    const names = [
      'changePassword',
      'enableTotp',
      'sendEmailOtp',
      'enableEmailOtp',
      'registerFido',
      'getFidoChallenge',
      'unregisterFido'
    ]
    const results = names.map(name => kitsu[name]())
    results.forEach(result => expect(result).toBeInstanceOf(Promise))
    await Promise.all(
      results.map(result => expect(result).rejects.toThrow(/Missing/))
    )
  })
})
