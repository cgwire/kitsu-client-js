import { assetApi } from './api/asset.js'
import { castingApi } from './api/casting.js'
import { conceptApi } from './api/concept.js'
import { customActionApi } from './api/customAction.js'
import { editApi } from './api/edit.js'
import { entityApi } from './api/entity.js'
import { eventApi } from './api/event.js'
import { filesApi } from './api/files.js'
import { hardwareApi } from './api/hardware.js'
import { newsApi } from './api/news.js'
import { personApi } from './api/person.js'
import { playlistApi } from './api/playlist.js'
import { projectApi } from './api/project.js'
import { projectTemplateApi } from './api/projectTemplate.js'
import { sceneApi } from './api/scene.js'
import { scheduleApi } from './api/schedule.js'
import { searchApi } from './api/search.js'
import { shotApi } from './api/shot.js'
import { studioApi } from './api/studio.js'
import { taskApi } from './api/task.js'
import { userApi } from './api/user.js'
import { createCore } from './core/index.js'

// The public types. Other type names in the declarations of a subpath are
// internal and may change in any release.
/**
 * @typedef {import('./core/index.js').ClientOptions} ClientOptions
 * @typedef {import('./core/session.js').Tokens} Tokens
 * @typedef {import('./core/errors.js').ErrorInfo} ErrorInfo
 * @typedef {ReturnType<typeof createClient>} KitsuClient
 * @typedef {import('./core/params.js').Entity} Entity
 * @typedef {import('./core/params.js').Model} Model
 */

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
    casting: castingApi(http),
    concept: conceptApi(http),
    customAction: customActionApi(http),
    edit: editApi(http),
    entity: entityApi(http),
    event: eventApi(http),
    files: filesApi(http),
    hardware: hardwareApi(http),
    news: newsApi(http),
    person: personApi(http),
    playlist: playlistApi(http),
    project: projectApi(http),
    projectTemplate: projectTemplateApi(http),
    scene: sceneApi(http),
    schedule: scheduleApi(http),
    search: searchApi(http),
    shot: shotApi(http),
    studio: studioApi(http),
    task: taskApi(http),
    user: userApi(http)
  })
}

export {
  KitsuError,
  ParameterError,
  NotAuthenticatedError,
  NotAllowedError,
  NotFoundError,
  TooBigFileError,
  ServerError,
  NetworkError,
  TimeoutError,
  AuthFailedError,
  WrongOtpError,
  TooManyLoginAttemptsError,
  DefaultPasswordError,
  MissingOtpError
} from './core/errors.js'
export * from './utils/index.js'
