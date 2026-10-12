// Compiled by "npm run test:types" against the declarations that "npm run
// types" builds, through the "exports" map: what a TypeScript consumer gets.
import {
  createClient,
  NotFoundError,
  type ClientOptions,
  type Entity,
  type ErrorInfo,
  type KitsuClient,
  type Model,
  type Tokens
} from '@cgwire/kitsu-client'
import { createCore } from '@cgwire/kitsu-client/core'
import { sortByName } from '@cgwire/kitsu-client/utils'
import { assetApi } from '@cgwire/kitsu-client/asset'
import { castingApi } from '@cgwire/kitsu-client/casting'
import { conceptApi } from '@cgwire/kitsu-client/concept'
import { customActionApi } from '@cgwire/kitsu-client/customAction'
import { editApi } from '@cgwire/kitsu-client/edit'
import { entityApi } from '@cgwire/kitsu-client/entity'
import { eventApi } from '@cgwire/kitsu-client/event'
import { filesApi } from '@cgwire/kitsu-client/files'
import { hardwareApi } from '@cgwire/kitsu-client/hardware'
import { newsApi } from '@cgwire/kitsu-client/news'
import { personApi } from '@cgwire/kitsu-client/person'
import { playlistApi } from '@cgwire/kitsu-client/playlist'
import { projectApi } from '@cgwire/kitsu-client/project'
import { projectTemplateApi } from '@cgwire/kitsu-client/projectTemplate'
import { sceneApi } from '@cgwire/kitsu-client/scene'
import { scheduleApi } from '@cgwire/kitsu-client/schedule'
import { searchApi } from '@cgwire/kitsu-client/search'
import { shotApi } from '@cgwire/kitsu-client/shot'
import { studioApi } from '@cgwire/kitsu-client/studio'
import { taskApi } from '@cgwire/kitsu-client/task'
import { userApi } from '@cgwire/kitsu-client/user'

// any would let every mistake through: the public types must not be any.
type IsAny<T> = 0 extends 1 & T ? true : false

const options: ClientOptions = { host: 'https://kitsu.example.com/api' }
const kitsu: KitsuClient = createClient(options)
const tokens: Tokens = { access_token: 'access', refresh_token: 'refresh' }
const info: ErrorInfo = { status: 404, path: 'data/tasks', method: 'GET' }
const model: Model = '5a2a7e3b-6c9e-4b4f-8f5e-2c1d0b9a8f7e'
const entity: Entity = { id: '5a2a7e3b-6c9e-4b4f-8f5e-2c1d0b9a8f7e' }

const typedClient: IsAny<KitsuClient> = false
const typedTask: IsAny<Awaited<ReturnType<KitsuClient['task']['getTask']>>> =
  false
const typedError: IsAny<NotFoundError['status']> = false

// @ts-expect-error the host is required
createClient({})
// @ts-expect-error a model is an id or an object holding one
const wrongModel: Model = 42
// @ts-expect-error the client has no such namespace
kitsu.missing

// Every subpath builds its namespace from the http of a core.
const { http } = createCore(options)
const namespaces = [
  assetApi(http),
  castingApi(http),
  conceptApi(http),
  customActionApi(http),
  editApi(http),
  entityApi(http),
  eventApi(http),
  filesApi(http),
  hardwareApi(http),
  newsApi(http),
  personApi(http),
  playlistApi(http),
  projectApi(http),
  projectTemplateApi(http),
  sceneApi(http),
  scheduleApi(http),
  searchApi(http),
  shotApi(http),
  studioApi(http),
  taskApi(http),
  userApi(http)
]
