import { describe, expect, it, vi } from 'vitest'

import { NotAuthenticatedError } from '../../src/core/errors.js'
import { createHttp } from '../../src/core/http.js'
import { createSession } from '../../src/core/session.js'
import { createFakeFetch, jsonResponse } from '../helpers/fakeFetch.js'
import { HOST } from '../helpers/ids.js'

const TIMEOUT = { response: 1000, deadline: 5000 }

const setup = (fake, sessionOptions = {}) => {
  const session = createSession({
    auth: 'bearer',
    tokens: { access_token: 'old', refresh_token: 'refresh' },
    ...sessionOptions
  })
  const http = createHttp(
    { host: HOST, fetch: fake, timeout: TIMEOUT },
    session
  )
  return { session, http }
}

// Answers 200 to the fresh access token only, like an expired session would.
const expiringApi = () => {
  const fake = createFakeFetch()
  fake.on('GET', '/data/persons', call =>
    call.headers.Authorization === 'Bearer new'
      ? jsonResponse(200, [{ ok: true }])
      : jsonResponse(401, {})
  )
  return fake
}

describe('session', () => {
  it('sends the bearer token, and none in cookie mode', () => {
    expect(
      createSession({ auth: 'bearer', tokens: { access_token: 'a' } }).headers()
    ).toEqual({
      Authorization: 'Bearer a'
    })
    expect(createSession({ auth: 'cookie' }).headers()).toEqual({})
  })

  it('never exposes nor keeps a reference to the caller tokens', () => {
    const tokens = { access_token: 'a', refresh_token: 'r' }
    const session = createSession({ auth: 'bearer', tokens })
    tokens.access_token = 'mutated'
    session.getTokens().access_token = 'mutated too'
    expect(session.getTokens().access_token).toBe('a')
  })

  it('notifies token changes', () => {
    const onTokensChange = vi.fn()
    const session = createSession({ auth: 'bearer', onTokensChange })
    session.setTokens({ access_token: 'a' })
    session.setTokens(null)
    expect(onTokensChange.mock.calls).toEqual([[{ access_token: 'a' }], [null]])
  })
})

describe('401 handling', () => {
  it('refreshes once for ten concurrent 401s and replays each request once', async () => {
    const fake = expiringApi()
    fake.on('GET', '/auth/refresh-token', () =>
      jsonResponse(200, { access_token: 'new' })
    )
    const { http, session } = setup(fake)

    const results = await Promise.all(
      Array.from({ length: 10 }, () => http.get('data/persons'))
    )

    expect(results).toHaveLength(10)
    const refreshCalls = fake.calls.filter(
      call => call.path === '/auth/refresh-token'
    )
    expect(refreshCalls).toHaveLength(1)
    expect(refreshCalls[0].headers.Authorization).toBe('Bearer refresh')
    expect(
      fake.calls.filter(call => call.path === '/data/persons')
    ).toHaveLength(20)
    expect(session.getTokens()).toEqual({
      access_token: 'new',
      refresh_token: 'refresh'
    })
  })

  it('adopts a rotated refresh token when the server sends one', async () => {
    const fake = expiringApi()
    fake.on('GET', '/auth/refresh-token', () =>
      jsonResponse(200, { access_token: 'new', refresh_token: 'rotated' })
    )
    const { http, session } = setup(fake)
    await http.get('data/persons')
    expect(session.getTokens().refresh_token).toBe('rotated')
  })

  it('replays without refreshing when the token was renewed meanwhile', async () => {
    const fake = createFakeFetch()
    const { http, session } = setup(fake)
    fake.on('GET', '/data/persons', call => {
      if (call.headers.Authorization === 'Bearer new')
        return jsonResponse(200, [])
      session.setTokens({ access_token: 'new', refresh_token: 'refresh' })
      return jsonResponse(401, {})
    })
    expect(await http.get('data/persons')).toEqual([])
    expect(fake.calls.map(call => call.path)).toEqual([
      '/data/persons',
      '/data/persons'
    ])
  })

  it('replays at most once, then reports unauthorized', async () => {
    const fake = createFakeFetch()
    fake.on('GET', '/data/persons', () => jsonResponse(401, {}))
    fake.on('GET', '/auth/refresh-token', () =>
      jsonResponse(200, { access_token: 'new' })
    )
    const onUnauthorized = vi.fn()
    const { http } = setup(fake, { onUnauthorized })

    await expect(http.get('data/persons')).rejects.toBeInstanceOf(
      NotAuthenticatedError
    )
    expect(
      fake.calls.filter(call => call.path === '/data/persons')
    ).toHaveLength(2)
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('reports unauthorized when the refresh itself fails', async () => {
    const fake = expiringApi()
    fake.on('GET', '/auth/refresh-token', () => jsonResponse(401, {}))
    const onUnauthorized = vi.fn()
    const { http } = setup(fake, { onUnauthorized })

    await expect(http.get('data/persons')).rejects.toBeInstanceOf(
      NotAuthenticatedError
    )
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('does not try to refresh without a refresh token or in cookie mode', async () => {
    const fake = createFakeFetch().reply(401, {})
    const onUnauthorized = vi.fn()
    const { http } = setup(fake, {
      auth: 'cookie',
      tokens: null,
      onUnauthorized
    })

    await expect(http.get('data/persons')).rejects.toBeInstanceOf(
      NotAuthenticatedError
    )
    expect(fake.calls).toHaveLength(1)
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('skipAuth sends no token and never replays', async () => {
    const fake = createFakeFetch().reply(401, {})
    const { http } = setup(fake)
    await expect(
      http.post('auth/login', {}, { skipAuth: true })
    ).rejects.toBeInstanceOf(NotAuthenticatedError)
    expect(fake.calls).toHaveLength(1)
    expect(fake.calls[0].headers.Authorization).toBeUndefined()
  })
})
