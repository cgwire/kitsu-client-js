import { assetApi } from './api/asset.js'
import { entityApi } from './api/entity.js'
import { filesApi } from './api/files.js'
import { personApi } from './api/person.js'
import { projectApi } from './api/project.js'
import { shotApi } from './api/shot.js'
import { taskApi } from './api/task.js'
import { userApi } from './api/user.js'
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
    asset: assetApi(http),
    entity: entityApi(http),
    files: filesApi(http),
    person: personApi(http),
    project: projectApi(http),
    shot: shotApi(http),
    task: taskApi(http),
    user: userApi(http)
  })
}

export * from './core/errors.js'
export * from './utils/index.js'
