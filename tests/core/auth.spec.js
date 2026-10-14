import { describe, expect, it, vi } from 'vitest'

import { createCore } from '../../src/core/index.js'
import {
  AuthFailedError,
  KitsuError,
  MissingOtpError,
  NotFoundError,
  ServerError
} from '../../src/core/errors.js'
import { createFakeFetch, jsonResponse } from '../helpers/fakeFetch.js'
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

  // 401: inactive user, 409: no authentication strategy configured.
  it.each([
    [401, { login: false, unactive: true }],
    [409, { login: false }]
  ])(
    'reports the refusal %i of Zou as a failed login',
    async (status, body) => {
      const fake = createFakeFetch().reply(status, body)
      const kitsu = createCore({ host: HOST, fetch: fake })
      const err = await kitsu.logIn('a@b.c', 'secret').catch(e => e)
      expect(err.constructor).toBe(AuthFailedError)
      expect(err).toMatchObject({ status, body })
    }
  )

  // 500: Zou cannot reach its database, 502: proxy while Zou restarts,
  // 405 and 404: host given without "/api".
  it.each([
    [500, ServerError, 'application/json', '{"login": false}'],
    [502, ServerError, 'text/html', '<html>Bad Gateway</html>'],
    [405, KitsuError, 'text/html', '<html>Not Allowed</html>'],
    [404, NotFoundError, 'text/html', '<html>Not Found</html>']
  ])(
    'keeps the regular error of a %i',
    async (status, ErrorClass, type, text) => {
      const fake = createFakeFetch().on(
        'POST',
        '/auth/login',
        () => new Response(text, { status, headers: { 'Content-Type': type } })
      )
      const kitsu = createCore({ host: HOST, fetch: fake })
      const err = await kitsu.logIn('a@b.c', 'secret').catch(e => e)
      expect(err.constructor).toBe(ErrorClass)
      expect(err.status).toBe(status)
      expect(kitsu.getTokens()).toBeNull()
    }
  )

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

  it('rejects a JSON answer without access token in bearer mode', async () => {
    const fake = createFakeFetch().reply(200, { login: true })
    const kitsu = createCore({ host: HOST, fetch: fake })
    await expect(kitsu.logIn('a@b.c', 'secret')).rejects.toBeInstanceOf(
      AuthFailedError
    )
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

  // Zou revokes the session, refresh token included, from the access token.
  it('logOut renews an expired access token to revoke the session', async () => {
    const fake = createFakeFetch()
      .on('GET', '/auth/logout', call =>
        call.headers.Authorization === 'Bearer renewed'
          ? jsonResponse(200, { logout: true })
          : jsonResponse(401, {})
      )
      .on('GET', '/auth/refresh-token', () =>
        jsonResponse(200, { access_token: 'renewed' })
      )
    const onTokensChange = vi.fn()
    const onUnauthorized = vi.fn()
    const kitsu = createCore({
      host: HOST,
      fetch: fake,
      tokens: { access_token: 'expired', refresh_token: 'refresh' },
      onTokensChange,
      onUnauthorized
    })

    expect(await kitsu.logOut()).toEqual({ logout: true })

    expect(
      fake.calls.map(call => [call.path, call.headers.Authorization])
    ).toEqual([
      ['/auth/logout', 'Bearer expired'],
      ['/auth/refresh-token', 'Bearer refresh'],
      ['/auth/logout', 'Bearer renewed']
    ])
    expect(kitsu.getTokens()).toBeNull()
    expect(onTokensChange.mock.calls).toEqual([[null]])
    expect(onUnauthorized).not.toHaveBeenCalled()
  })
})

// The last session change started wins, whatever order the answers of Zou
// land in.
describe('overlapping session changes', () => {
  const ALICE = { access_token: 'alice', refresh_token: 'alice-refresh' }
  const BOB = { access_token: 'bob', refresh_token: 'bob-refresh' }
  const CODES = ['code-1']

  // Every answer waits for the test to release it, in the order it wants,
  // or for the abort of its request.
  const parked = (options = {}) => {
    const fake = createFakeFetch()
    const answers = []
    const park = call =>
      new Promise((resolve, reject) => {
        answers.push({ call, resolve })
        call.signal.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError'))
        )
      })
    fake
      .on('POST', '/auth/login', park)
      .on('GET', '/auth/logout', park)
      .on('POST', '/auth/totp', park)
    const onTokensChange = vi.fn()
    const kitsu = createCore({
      host: HOST,
      fetch: fake,
      tokens: ALICE,
      onTokensChange,
      ...options
    })
    const release = (path, body, email) => {
      const index = answers.findIndex(
        ({ call }) =>
          call.path === path && (!email || call.body.email === email)
      )
      const [{ resolve }] = answers.splice(index, 1)
      resolve(jsonResponse(200, body))
    }
    const sent = count =>
      vi.waitFor(() => expect(fake.calls).toHaveLength(count))
    return { fake, kitsu, release, sent, onTokensChange }
  }

  it('keeps a logIn started after a logOut whose answer lands last', async () => {
    const { kitsu, release, sent } = parked()
    const loggingOut = kitsu.logOut()
    const loggingIn = kitsu.logIn('bob@studio.test', 'secret')
    await sent(2)

    release('/auth/login', { user: { id: 'bob' }, ...BOB })
    await loggingIn
    release('/auth/logout', { logout: true })
    await loggingOut

    expect(kitsu.getTokens()).toEqual(BOB)
  })

  it('stays logged out when a logIn started before a logOut lands last', async () => {
    const { kitsu, release, sent, onTokensChange } = parked()
    const loggingIn = kitsu.logIn('bob@studio.test', 'secret').catch(e => e)
    const loggingOut = kitsu.logOut()
    expect(kitsu.getTokens()).toBeNull()
    await sent(2)

    release('/auth/logout', { logout: true })
    await loggingOut
    release('/auth/login', { user: { id: 'bob' }, ...BOB })

    expect((await loggingIn).name).toBe('AbortError')
    expect(kitsu.getTokens()).toBeNull()
    expect(onTokensChange.mock.calls).toEqual([[null]])
  })

  it.each([
    ['last', ['bob', 'carol']],
    ['first', ['carol', 'bob']]
  ])(
    'keeps the last of two logIns when the answer of the first lands %s',
    async (_, order) => {
      const { kitsu, release, sent, onTokensChange } = parked()
      const answers = {
        carol: kitsu.logIn('carol@studio.test', 'secret').catch(e => e),
        bob: kitsu.logIn('bob@studio.test', 'secret')
      }
      const bodies = {
        carol: { user: { id: 'carol' }, access_token: 'carol' },
        bob: { user: { id: 'bob' }, ...BOB }
      }
      await sent(2)

      for (const name of order) {
        release('/auth/login', bodies[name], `${name}@studio.test`)
        await answers[name]
      }

      expect((await answers.carol).name).toBe('AbortError')
      expect((await answers.bob).user).toEqual({ id: 'bob' })
      expect(kitsu.getTokens()).toEqual(BOB)
      expect(onTokensChange.mock.calls).toEqual([[BOB]])
    }
  )

  it('keeps the token of a setToken done while a logIn is pending', async () => {
    const { kitsu, release, sent } = parked()
    const loggingIn = kitsu.logIn('bob@studio.test', 'secret').catch(e => e)
    await sent(1)
    kitsu.setToken('bot-token')

    release('/auth/login', { user: { id: 'bob' }, ...BOB })

    expect((await loggingIn).name).toBe('AbortError')
    expect(kitsu.getTokens()).toEqual({ access_token: 'bot-token' })
  })

  it('returns the codes of a two-factor registration a logOut overtook, without its tokens', async () => {
    const { kitsu, release, sent } = parked()
    const enabling = kitsu.enableTotp('123456')
    const loggingOut = kitsu.logOut()
    await sent(2)

    release('/auth/logout', { logout: true })
    await loggingOut
    release('/auth/totp', { otp_recovery_codes: CODES, ...BOB })

    expect(await enabling).toEqual(CODES)
    expect(kitsu.getTokens()).toBeNull()
  })

  // The browser applies the cookies of each answer as it lands.
  it('in cookie mode sends a session change once the one before it settled', async () => {
    const { kitsu, fake, release, sent } = parked({
      auth: 'cookie',
      tokens: null
    })
    const loggingOut = kitsu.logOut()
    const loggingIn = kitsu.logIn('bob@studio.test', 'secret')
    await sent(1)
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(fake.calls.map(call => call.path)).toEqual(['/auth/logout'])

    release('/auth/logout', { logout: true })
    await loggingOut
    await sent(2)
    release('/auth/login', { user: { id: 'bob' } })

    expect((await loggingIn).user).toEqual({ id: 'bob' })
  })

  it('in cookie mode never sends a queued change that close() aborted', async () => {
    const { kitsu, fake, sent } = parked({ auth: 'cookie', tokens: null })
    const loggingOut = kitsu.logOut().catch(e => e)
    const loggingIn = kitsu.logIn('bob@studio.test', 'secret').catch(e => e)
    await sent(1)

    kitsu.close()

    expect((await loggingOut).name).toBe('AbortError')
    expect((await loggingIn).name).toBe('AbortError')
    expect(fake.calls.map(call => call.path)).toEqual(['/auth/logout'])
  })

  it('in cookie mode never sends a queued change whose signal aborted', async () => {
    const { kitsu, fake, release, sent } = parked({
      auth: 'cookie',
      tokens: null
    })
    const loggingOut = kitsu.logOut()
    const controller = new AbortController()
    const loggingIn = kitsu
      .logIn('bob@studio.test', 'secret', { signal: controller.signal })
      .catch(e => e)
    await sent(1)

    controller.abort()
    release('/auth/logout', { logout: true })
    await loggingOut

    expect((await loggingIn).name).toBe('AbortError')
    expect(fake.calls.map(call => call.path)).toEqual(['/auth/logout'])
  })

  it('in cookie mode rejects at once a queued change whose signal aborts', async () => {
    const { kitsu, fake, release, sent } = parked({
      auth: 'cookie',
      tokens: null
    })
    const loggingIn = kitsu.logIn('bob@studio.test', 'secret').catch(e => e)
    const controller = new AbortController()
    const loggingOut = kitsu.logOut({ signal: controller.signal }).catch(e => e)
    await sent(1)

    controller.abort()

    // Settled while the logIn before it still waits for its answer.
    const settled = await Promise.race([
      loggingOut,
      new Promise(resolve => setTimeout(() => resolve('pending'), 50))
    ])
    expect(settled.name).toBe('AbortError')
    release('/auth/login', { user: { id: 'bob' } })
    expect((await loggingIn).name).toBe('AbortError')
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(fake.calls.map(call => call.path)).toEqual(['/auth/login'])
  })

  // Dropping the session runs app code, which may start the next change.
  it('in cookie mode sends a change started by the logOut itself after it', async () => {
    let next = null
    const { kitsu, fake, release, sent } = parked({
      auth: 'cookie',
      tokens: null,
      onTokensChange: () => {
        next = kitsu.logIn('bob@studio.test', 'secret')
      }
    })

    const loggingOut = kitsu.logOut()
    await sent(1)
    expect(fake.calls.map(call => call.path)).toEqual(['/auth/logout'])
    release('/auth/logout', { logout: true })
    await loggingOut
    await sent(2)
    release('/auth/login', { user: { id: 'bob' } })

    expect((await next).user).toEqual({ id: 'bob' })
  })
})
