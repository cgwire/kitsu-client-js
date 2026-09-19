import { describe, expect, it, vi } from 'vitest'

import {
  NetworkError,
  NotAuthenticatedError,
  ServerError,
  TimeoutError
} from '../../src/core/errors.js'
import { createHttp } from '../../src/core/http.js'
import { createCore } from '../../src/core/index.js'
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

const deferred = () => {
  let resolve
  const promise = new Promise(done => {
    resolve = done
  })
  return { promise, resolve }
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
    const late = deferred()
    const staleAnswers = [
      () => jsonResponse(401, {}),
      () => late.promise.then(() => jsonResponse(401, {}))
    ]
    fake.on('GET', '/data/persons', call =>
      call.headers.Authorization === 'Bearer new'
        ? jsonResponse(200, [])
        : staleAnswers.shift()()
    )
    fake.on('GET', '/auth/refresh-token', () =>
      jsonResponse(200, { access_token: 'new' })
    )
    const { http } = setup(fake)

    const first = http.get('data/persons')
    const second = http.get('data/persons')
    expect(await first).toEqual([])
    late.resolve()
    expect(await second).toEqual([])

    expect(
      fake.calls.filter(call => call.path === '/auth/refresh-token')
    ).toHaveLength(1)
    expect(
      fake.calls.filter(call => call.path === '/data/persons')
    ).toHaveLength(4)
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

describe('refresh failures', () => {
  const failingRefresh = refreshHandler => {
    const fake = expiringApi()
    fake.on('GET', '/auth/refresh-token', refreshHandler)
    const onUnauthorized = vi.fn()
    const onTokensChange = vi.fn()
    const { http, session } = setup(fake, { onUnauthorized, onTokensChange })
    return { fake, http, session, onUnauthorized, onTokensChange }
  }

  const abortable = call =>
    new Promise((resolve, reject) => {
      call.signal.addEventListener('abort', () =>
        reject(new DOMException('Aborted', 'AbortError'))
      )
    })

  it('rejects a refresh answer without access token, as Zou sends to browsers', async () => {
    const { fake, http, session, onUnauthorized, onTokensChange } =
      failingRefresh(() => jsonResponse(200, { refresh: true }))

    await expect(http.get('data/persons')).rejects.toBeInstanceOf(
      NotAuthenticatedError
    )
    expect(session.getTokens()).toEqual({
      access_token: 'old',
      refresh_token: 'refresh'
    })
    expect(onTokensChange).not.toHaveBeenCalled()
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    expect(
      fake.calls.filter(call => call.path === '/data/persons')
    ).toHaveLength(1)
  })

  it('reports a network failure of the refresh as such, not as unauthorized', async () => {
    const { http, session, onUnauthorized } = failingRefresh(() => {
      throw new TypeError('fetch failed')
    })
    await expect(http.get('data/persons')).rejects.toBeInstanceOf(NetworkError)
    expect(onUnauthorized).not.toHaveBeenCalled()
    expect(session.getTokens().refresh_token).toBe('refresh')
  })

  it('reports a server failure of the refresh as such, not as unauthorized', async () => {
    const { http, onUnauthorized } = failingRefresh(() => jsonResponse(502, {}))
    await expect(http.get('data/persons')).rejects.toBeInstanceOf(ServerError)
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('reports a refresh timeout as such, not as unauthorized', async () => {
    vi.useFakeTimers()
    try {
      const { http, onUnauthorized } = failingRefresh(abortable)
      const pending = http.get('data/persons').catch(e => e)
      await vi.advanceTimersByTimeAsync(TIMEOUT.response + 1)
      expect(await pending).toBeInstanceOf(TimeoutError)
      expect(onUnauthorized).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('abortAll during the refresh rejects with AbortError, not unauthorized', async () => {
    const { fake, http, onUnauthorized } = failingRefresh(abortable)
    const pending = http.get('data/persons').catch(e => e)
    await vi.waitFor(() =>
      expect(fake.calls.map(call => call.path)).toContain('/auth/refresh-token')
    )
    http.abortAll()
    expect((await pending).name).toBe('AbortError')
    expect(onUnauthorized).not.toHaveBeenCalled()
  })
})

describe('session replaced while a request or a refresh is in flight', () => {
  const BOB = { access_token: 'bob-access', refresh_token: 'bob-refresh' }

  // Alice's access token is expired and her refresh answer is parked.
  const parkedRefresh = () => {
    const fake = createFakeFetch()
    const refreshAnswer = deferred()
    fake.on('GET', '/data/persons', () => jsonResponse(401, {}))
    fake.on('GET', '/auth/refresh-token', () => refreshAnswer.promise)
    fake.on('POST', '/auth/login', () => jsonResponse(200, { ...BOB }))
    fake.on('GET', '/auth/logout', () => jsonResponse(200, {}))
    const onTokensChange = vi.fn()
    const onUnauthorized = vi.fn()
    const kitsu = createCore({
      host: HOST,
      fetch: fake,
      tokens: { access_token: 'alice-old', refresh_token: 'alice-refresh' },
      onTokensChange,
      onUnauthorized
    })
    const pending = kitsu.http.get('data/persons').catch(e => e)
    const refreshSent = () =>
      vi.waitFor(() =>
        expect(fake.calls.map(call => call.path)).toContain(
          '/auth/refresh-token'
        )
      )
    return {
      fake,
      kitsu,
      pending,
      refreshAnswer,
      refreshSent,
      onTokensChange,
      onUnauthorized
    }
  }

  const expectDropped = async ({ fake, pending, onUnauthorized }) => {
    expect(await pending).toBeInstanceOf(NotAuthenticatedError)
    expect(onUnauthorized).not.toHaveBeenCalled()
    expect(
      fake.calls.filter(call => call.path === '/data/persons')
    ).toHaveLength(1)
  }

  it('a logIn completed during a refresh keeps its tokens', async () => {
    const context = parkedRefresh()
    const { kitsu, refreshAnswer, onTokensChange } = context
    await context.refreshSent()
    await kitsu.logIn('bob@studio.test', 'secret')
    refreshAnswer.resolve(jsonResponse(200, { access_token: 'alice-new' }))

    await expectDropped(context)
    expect(kitsu.getTokens()).toEqual(BOB)
    expect(onTokensChange.mock.calls).toEqual([[BOB]])
  })

  it('a setToken done during a refresh keeps its token', async () => {
    const context = parkedRefresh()
    const { kitsu, refreshAnswer } = context
    await context.refreshSent()
    kitsu.setToken('bot-token')
    refreshAnswer.resolve(jsonResponse(200, { access_token: 'alice-new' }))

    await expectDropped(context)
    expect(kitsu.getTokens()).toEqual({ access_token: 'bot-token' })
  })

  it('a logOut completed during a refresh stays logged out', async () => {
    const context = parkedRefresh()
    const { kitsu, refreshAnswer, onTokensChange } = context
    await context.refreshSent()
    await kitsu.logOut()
    refreshAnswer.resolve(
      jsonResponse(200, { access_token: 'alice-new', refresh_token: 'rotated' })
    )

    await expectDropped(context)
    expect(kitsu.getTokens()).toBeNull()
    expect(onTokensChange.mock.calls).toEqual([[null]])
  })

  it('a logOut followed by a failed refresh does not report unauthorized', async () => {
    const context = parkedRefresh()
    await context.refreshSent()
    await context.kitsu.logOut()
    context.refreshAnswer.resolve(jsonResponse(401, {}))
    await expectDropped(context)
  })

  it('a new session refreshes on its own instead of waiting for the former refresh', async () => {
    const context = parkedRefresh()
    const { fake, kitsu } = context
    await context.refreshSent()
    await kitsu.logIn('bob@studio.test', 'secret')
    const bobRequest = kitsu.http.get('data/persons').catch(e => e)

    await vi.waitFor(() =>
      expect(
        fake.calls
          .filter(call => call.path === '/auth/refresh-token')
          .map(call => call.headers.Authorization)
      ).toEqual(['Bearer alice-refresh', 'Bearer bob-refresh'])
    )
    context.refreshAnswer.resolve(jsonResponse(401, {}))
    await bobRequest
  })

  const lateUnauthorized = () => {
    const fake = createFakeFetch()
    const answer = deferred()
    fake.on('POST', '/data/persons', () => answer.promise)
    fake.on('POST', '/auth/login', () => jsonResponse(200, { ...BOB }))
    fake.on('GET', '/auth/logout', () => jsonResponse(200, {}))
    const onUnauthorized = vi.fn()
    const kitsu = createCore({
      host: HOST,
      fetch: fake,
      tokens: { access_token: 'alice-old' },
      onUnauthorized
    })
    const pending = kitsu.http.post('data/persons', { name: 'x' }).catch(e => e)
    const land = () => answer.resolve(jsonResponse(401, {}))
    return { fake, kitsu, pending, land, onUnauthorized }
  }

  const expectNotReplayed = async ({ fake, pending, onUnauthorized }) => {
    expect(await pending).toBeInstanceOf(NotAuthenticatedError)
    expect(
      fake.calls.filter(call => call.path === '/data/persons')
    ).toHaveLength(1)
    expect(onUnauthorized).not.toHaveBeenCalled()
  }

  it('a 401 landing after logOut is not replayed anonymously', async () => {
    const context = lateUnauthorized()
    await context.kitsu.logOut()
    context.land()
    await expectNotReplayed(context)
  })

  it('a 401 landing after another logIn is not replayed under the new identity', async () => {
    const context = lateUnauthorized()
    await context.kitsu.logIn('bob@studio.test', 'secret')
    context.land()
    await expectNotReplayed(context)
  })
})
