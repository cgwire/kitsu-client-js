import { createClient } from '../../src/index.js'
import { createFakeFetch } from './fakeFetch.js'
import { HOST } from './ids.js'

export const makeClient = () => {
  const fake = createFakeFetch()
  const kitsu = createClient({
    host: HOST,
    fetch: fake,
    tokens: { access_token: 'token' }
  })
  return { kitsu, fake }
}
