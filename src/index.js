import { entityApi } from './api/entity.js'
import { createCore } from './core/index.js'

/**
 * Create a Kitsu client. Every client owns its session, its in-flight
 * requests and its event socket: two clients never share anything.
 * @param {import('./core/index.js').ClientOptions} options
 */
export const createClient = options => {
  const core = createCore(options)
  const { http } = core
  // Listed explicitly, not built from a map: this is what lets the generated
  // type declarations expose every namespace function.
  return Object.freeze({
    ...core,
    entity: entityApi(http)
  })
}

export * from './core/errors.js'
