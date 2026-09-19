import { describe, expect, it } from 'vitest'

import { makeClient } from '../helpers/client.js'

const CORE_KEYS = ['http', 'events']

const functionsOf = client =>
  Object.entries(client)
    .filter(
      ([key, value]) =>
        value && typeof value === 'object' && !CORE_KEYS.includes(key)
    )
    .flatMap(([namespace, api]) =>
      Object.keys(api).map(name => [namespace, name])
    )

// Called without arguments, a function fails on its first idOf(): the
// failure must come as a rejection, so .catch() and Promise.all() see it.
describe('namespace functions', () => {
  it.each(functionsOf(makeClient().kitsu))(
    '%s.%s rejects instead of throwing',
    async (namespace, name) => {
      const { kitsu } = makeClient()
      const results = []
      expect(() => results.push(kitsu[namespace][name]())).not.toThrow()
      expect(results[0]).toBeInstanceOf(Promise)
      await results[0].catch(() => {})
    }
  )
})
