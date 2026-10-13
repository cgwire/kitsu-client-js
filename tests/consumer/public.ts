// Compiled by "npm run test:types" against the declarations that "npm run
// types" builds, through the "exports" map: what a TypeScript consumer gets.
import {
  createClient,
  KitsuError,
  MissingOtpError,
  NotFoundError,
  type ClientOptions,
  type Entity,
  type ErrorInfo,
  type KitsuClient,
  type Model,
  type Tokens
} from '@cgwire/kitsu-client'
import { createCore } from '@cgwire/kitsu-client/core'
import {
  formatRevision,
  formatToTimecode,
  frameToSeconds,
  getEntityFrameStart,
  sortByName,
  sortByPersonName,
  sortTaskNames,
  sortTasks,
  sortTaskStatuses,
  sortTaskTypes
} from '@cgwire/kitsu-client/utils'
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
// @ts-expect-error a subpath in another casing is not exported
import { projectTemplateApi as miscased } from '@cgwire/kitsu-client/projecttemplate'

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

// The utilities take the dicts that the client returns, without a cast.
const useUtilities = async () => {
  const project = await kitsu.project.getProject(model)
  const shot = await kitsu.shot.getShot(model)
  const previewFile = await kitsu.files.getPreviewFile(model)
  const tasks = await kitsu.task.allTasksForShot(entity)
  const taskTypes = await kitsu.task.allTaskTypes()
  const taskTypeMap = new Map(taskTypes.map(type => [type.id, type]))
  const persons = await kitsu.person.allPersons()
  const personMap = new Map(persons.map(person => [person.id, person]))
  const duration: number = frameToSeconds(shot?.nb_frames, project, shot)
  const frameStart: number | undefined = getEntityFrameStart(shot)
  const revision: string = formatRevision(previewFile?.revision, project)
  const sortedTasks: Entity[] = sortTasks(tasks, taskTypeMap)
  const sortedNames: Entity[] = sortTaskNames(tasks, taskTypeMap)
  const assignees: string[] = sortByPersonName(tasks[0].assignees, personMap)
  const sortedTypes: Entity[] = sortTaskTypes(taskTypes, project)
  const statuses = await kitsu.task.allTaskStatuses()
  const sortedStatuses: Entity[] = sortTaskStatuses(statuses, project)
  const timecode: string = formatToTimecode(shot?.data?.frame_in, project?.fps)
  // @ts-expect-error sortByPersonName sorts ids, not the person dicts
  sortByPersonName(persons, personMap)
  // @ts-expect-error a timecode is a string
  const wrongTimecode: number = formatToTimecode(0)
}

// The quick start of the README and the upload of docs/files.md.
const quickStart = async () => {
  kitsu.setToken('token')
  const projects: Entity[] = await kitsu.project.allOpenProjects()
  const shots: Entity[] = await kitsu.shot.allShotsForProject(projects[0])
  const tasks: Entity[] = await kitsu.task.allTasksForShot(shots[0])
  await kitsu.task.publishPreview(tasks[0], model, new Blob([]), {
    comment: 'First pass',
    onProgress: ({ loaded, total }) => {
      const ratio: number = loaded / total
    }
  })
}

// Errors narrow with instanceof, as docs/authentication.md shows.
const handleErrors = async () => {
  try {
    await kitsu.task.getTask(model)
  } catch (err) {
    // @ts-expect-error a caught value is unknown until narrowed
    err.status
    if (err instanceof NotFoundError) {
      const status: number | null = err.status
      const path: string = err.path
    }
    if (err instanceof MissingOtpError) {
      const methods: string[] = err.enabledMethods
      const kitsuError: KitsuError = err
    }
  }
}

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
