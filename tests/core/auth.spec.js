import { describe, expect, it, vi } from 'vitest'

import { createCore } from '../../src/core/index.js'
import {
  AuthFailedError,
  KitsuError,
  MissingOtpError
} from '../../src/core/errors.js'
import { createFakeFetch } from '../helpers/fakeFetch.js'
import { HOST } from '../helpers/ids.js'

const LOGIN_BODY = {
  login: true,
  user: { id: 'u1' },
  access_token: 'access',
  refresh_token: 'refresh'
}

describe('logIn', () => {
  it('posts credentials without token and stores the tokens', async () => {
    const fake = createFakeFetch().reply(200, LOGIN_BODY)
    const onTokensChange = vi.fn()
    const kitsu = createCore({ host: HOST, fetch: fake, onTokensChange })

    const body = await kitsu.logIn('a@b.c', 'secret', { totp: '123456' })

    expect(body.user).toEqual({ id: 'u1' })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: '/auth/login',
      body: { email: 'a@b.c', password: 'secret', totp: '123456' }
    })
    expect(fake.calls[0].headers.Authorization).toBeUndefined()
    expect(kitsu.getTokens()).toEqual({
      access_token: 'access',
      refresh_token: 'refresh'
    })
    expect(onTokensChange).toHaveBeenCalledWith({
      access_token: 'access',
      refresh_token: 'refresh'
    })
  })

  it('keeps no token in cookie mode', async () => {
    const fake = createFakeFetch().reply(200, LOGIN_BODY)
    const kitsu = createCore({ host: HOST, fetch: fake, auth: 'cookie' })
    await kitsu.logIn('a@b.c', 'secret')
    expect(kitsu.getTokens()).toBeNull()
  })

  it('throws typed login errors', async () => {
    const fake = createFakeFetch()
      .reply(400, {
        login: false,
        missing_OTP: true,
        two_factor_authentication_enabled: ['totp']
      })
      .reply(400, { login: false })
    const kitsu = createCore({ host: HOST, fetch: fake })
    const otpError = await kitsu.logIn('a@b.c', 'secret').catch(e => e)
    expect(otpError).toBeInstanceOf(MissingOtpError)
    expect(otpError.enabledMethods).toEqual(['totp'])
    await expect(kitsu.logIn('a@b.c', 'bad')).rejects.toBeInstanceOf(
      AuthFailedError
    )
  })

  it('does not report a page answered with a 200 as wrong credentials', async () => {
    const page = async () =>
      new Response('<html></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      })
    const kitsu = createCore({ host: HOST, fetch: page })
    const err = await kitsu.logIn('a@b.c', 'secret').catch(e => e)
    expect(err).toBeInstanceOf(KitsuError)
    expect(err).not.toBeInstanceOf(AuthFailedError)
    expect(kitsu.getTokens()).toBeNull()
  })
})

describe('session helpers', () => {
  it('setToken authenticates the following requests', async () => {
    const fake = createFakeFetch().reply(200, { user: { id: 'bot' } })
    const kitsu = createCore({ host: HOST, fetch: fake })
    kitsu.setToken('bot-token')
    expect(await kitsu.getCurrentUser()).toEqual({ id: 'bot' })
    expect(fake.calls[0].path).toBe('/auth/authenticated')
    expect(fake.calls[0].headers.Authorization).toBe('Bearer bot-token')
  })

  it('isAuthenticated answers false on 401 without reporting unauthorized', async () => {
    const fake = createFakeFetch().reply(401, {}).reply(200, { user: {} })
    const onUnauthorized = vi.fn()
    const kitsu = createCore({ host: HOST, fetch: fake, onUnauthorized })
    expect(await kitsu.isAuthenticated()).toBe(false)
    expect(await kitsu.isAuthenticated()).toBe(true)
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('logOut clears the tokens even when the request fails', async () => {
    const fake = createFakeFetch().reply(500, {})
    const kitsu = createCore({
      host: HOST,
      fetch: fake,
      tokens: { access_token: 'a' }
    })
    await kitsu.logOut().catch(() => {})
    expect(fake.calls[0].path).toBe('/auth/logout')
    expect(kitsu.getTokens()).toBeNull()
  })
})
