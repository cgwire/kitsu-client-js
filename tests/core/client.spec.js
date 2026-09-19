import { describe, expect, it, vi } from 'vitest'

import { TimeoutError, createClient } from '../../src/index.js'
import { createFakeFetch, jsonResponse } from '../helpers/fakeFetch.js'
import { HOST } from '../helpers/ids.js'

const hanging = (url, init) =>
  new Promise((resolve, reject) => {
    init.signal.addEventListener('abort', () =>
      reject(new DOMException('Aborted', 'AbortError'))
    )
  })

describe('createClient', () => {
  it('requires a host', () => {
    expect(() => createClient({})).toThrow(/host is required/)
  })

  it('returns a frozen client', () => {
    const kitsu = createClient({ host: HOST, fetch: createFakeFetch() })
    expect(Object.isFrozen(kitsu)).toBe(true)
  })

  it('is not affected by later mutation of the options object', async () => {
    const fake = createFakeFetch().reply(200, { user: {} })
    const options = { host: HOST, fetch: fake, tokens: { access_token: 'a' } }
    const kitsu = createClient(options)
    options.host = 'http://evil.test/api'
    options.tokens.access_token = 'mutated'
    await kitsu.getCurrentUser()
    expect(fake.calls[0].headers.Authorization).toBe('Bearer a')
    expect(kitsu.host).toBe(HOST)
  })

  it('keeps instances fully isolated', async () => {
    const fakeA = createFakeFetch().reply(200, { user: { id: 'a' } })
    const fakeB = createFakeFetch().reply(200, { user: { id: 'b' } })
    const a = createClient({ host: HOST, fetch: fakeA })
    const b = createClient({ host: 'http://other.test/api', fetch: fakeB })
    a.setToken('token-a')

    await a.getCurrentUser()
    await b.getCurrentUser()

    expect(fakeA.calls[0].headers.Authorization).toBe('Bearer token-a')
    expect(fakeB.calls[0].headers.Authorization).toBeUndefined()
    expect(b.getTokens()).toBeNull()
  })

  // Zou reads the session cookie before the Authorization header: a bearer
  // client living in a Kitsu page must not send the cookies of that page.
  it.each([
    ['bearer', 'omit'],
    ['cookie', 'same-origin']
  ])('in %s mode sends credentials: %s', async (auth, credentials) => {
    const inits = []
    const fetch = async (url, init) => {
      inits.push(init)
      return jsonResponse(200, { user: {} })
    }
    await createClient({ host: HOST, fetch, auth }).getCurrentUser()
    expect(inits[0].credentials).toBe(credentials)
  })

  describe('timeout option', () => {
    const answering = delay => () =>
      new Promise(resolve =>
        setTimeout(
          () => resolve(jsonResponse(200, { user: { id: 'u' } })),
          delay
        )
      )

    it.each([
      [{ response: undefined }],
      [{ deadline: null }],
      [{ response: Infinity, deadline: Infinity }],
      [{ response: 0 }]
    ])('%o does not make every request time out', async timeout => {
      const kitsu = createClient({ host: HOST, fetch: answering(20), timeout })
      expect(await kitsu.getCurrentUser()).toEqual({ id: 'u' })
    })

    it.each([[{ response: -1 }], [{ deadline: NaN }], [{ response: '60s' }]])(
      'rejects %o at creation',
      timeout => {
        expect(() =>
          createClient({ host: HOST, fetch: createFakeFetch(), timeout })
        ).toThrow(TypeError)
      }
    )

    it('keeps the default of a key left undefined', async () => {
      vi.useFakeTimers()
      try {
        const kitsu = createClient({
          host: HOST,
          fetch: hanging,
          timeout: { response: undefined }
        })
        const pending = kitsu.getCurrentUser().catch(e => e)
        await vi.advanceTimersByTimeAsync(59000)
        const early = await Promise.race([pending, 'pending'])
        await vi.advanceTimersByTimeAsync(1001)
        expect([early, (await pending).name]).toEqual([
          'pending',
          'TimeoutError'
        ])
      } finally {
        vi.useRealTimers()
      }
    })

    it('still applies a custom response timeout', async () => {
      const kitsu = createClient({
        host: HOST,
        fetch: hanging,
        timeout: { response: 10 }
      })
      await expect(kitsu.getCurrentUser()).rejects.toBeInstanceOf(TimeoutError)
    })
  })

  it('close aborts in-flight requests', async () => {
    const kitsu = createClient({ host: HOST, fetch: hanging })
    const pending = kitsu.getCurrentUser().catch(e => e)
    kitsu.close()
    expect((await pending).name).toBe('AbortError')
  })
})
