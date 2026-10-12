import { vi } from 'vitest'

import { createClient } from '../../src/index.js'
import { createFakeFetch } from './fakeFetch.js'
import { HOST } from './ids.js'

// globalFetch builds the client of a web app, without fetch option: the fake
// stands in for the global fetch until vi.unstubAllGlobals(). Only such a
// client uploads through XMLHttpRequest.
export const makeClient = ({ globalFetch = false } = {}) => {
  const fake = createFakeFetch()
  if (globalFetch) vi.stubGlobal('fetch', fake)
  const kitsu = createClient({
    host: HOST,
    fetch: globalFetch ? undefined : fake,
    tokens: { access_token: 'token' }
  })
  return { kitsu, fake }
}
