import { describe, expect, it } from 'vitest'

import { createClient } from '../../src/index.js'
import { createFakeFetch } from '../helpers/fakeFetch.js'
import { HOST } from '../helpers/ids.js'

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

  it('close aborts in-flight requests', async () => {
    const hanging = (url, init) =>
      new Promise((resolve, reject) => {
        init.signal.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError'))
        )
      })
    const kitsu = createClient({ host: HOST, fetch: hanging })
    const pending = kitsu.getCurrentUser().catch(e => e)
    kitsu.close()
    expect((await pending).name).toBe('AbortError')
  })
})
