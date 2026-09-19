// Read-only smoke test against a real Zou, run by hand:
//   KITSU_HOST=https://kitsu.example/api KITSU_TOKEN=<bot token> \
//     npm run test:live
// Only list and get calls belong here: it must never create, update or
// delete anything.
import { NotFoundError, createClient } from '../src/index.js'

const { KITSU_HOST, KITSU_TOKEN } = process.env
if (!KITSU_HOST || !KITSU_TOKEN) {
  console.error(
    'Usage: KITSU_HOST=https://kitsu.example/api KITSU_TOKEN=<bot token> ' +
      'npm run test:live'
  )
  process.exit(1)
}

const MAX_THUMBNAIL_TRIES = 5
const THUMBNAIL_STEP = 'http.download thumbnail'

const kitsu = createClient({ host: KITSU_HOST })
kitsu.setToken(KITSU_TOKEN)

const lineOf = (status, label, detail = '') =>
  `${status.padEnd(5)} ${label} ${detail}`.trimEnd()

const countOf = result => (Array.isArray(result) ? `(${result.length})` : '')

const attempt = async (label, run) => {
  try {
    return await run()
  } catch (err) {
    console.error(lineOf('FAIL', label))
    throw err
  }
}

const step = async (label, run, detailOf = countOf) => {
  const result = await attempt(label, run)
  console.log(lineOf('ok', label, detailOf(result)))
  return result
}

const previewFileIdsOf = entities => [
  ...new Set(entities.map(entity => entity.preview_file_id).filter(Boolean))
]

const downloadThumbnail = async previewFileId => {
  const response = await kitsu.http.download(
    `pictures/thumbnails/preview-files/${previewFileId}.png`
  )
  const type = response.headers.get('Content-Type') || 'no content type'
  const { byteLength } = await response.arrayBuffer()
  if (!type.startsWith('image/') || byteLength === 0) {
    throw new Error(`Unexpected thumbnail: ${type}, ${byteLength} bytes`)
  }
  return { type, byteLength }
}

// A database restored without its preview store answers 404 for its
// pictures: that says nothing about the client, so the next one is tried.
const firstThumbnail = async ([previewFileId, ...others]) => {
  if (!previewFileId) return null
  try {
    return await downloadThumbnail(previewFileId)
  } catch (err) {
    if (!(err instanceof NotFoundError)) throw err
    return firstThumbnail(others)
  }
}

const checkThumbnail = async entities => {
  const previewFileIds = previewFileIdsOf(entities).slice(
    0,
    MAX_THUMBNAIL_TRIES
  )
  if (previewFileIds.length === 0) {
    console.log(lineOf('skip', THUMBNAIL_STEP, '(no preview file found)'))
    return
  }
  const thumbnail = await attempt(THUMBNAIL_STEP, () =>
    firstThumbnail(previewFileIds)
  )
  console.log(
    thumbnail
      ? lineOf(
          'ok',
          THUMBNAIL_STEP,
          `(${thumbnail.type}, ${thumbnail.byteLength} bytes)`
        )
      : lineOf(
          'skip',
          THUMBNAIL_STEP,
          `(${previewFileIds.length} tried, none in the preview store)`
        )
  )
}

const checkProject = async project => {
  const assets = await step(`asset.allAssetsForProject [${project.name}]`, () =>
    kitsu.asset.allAssetsForProject(project)
  )
  const shots = await step(`shot.allShotsForProject [${project.name}]`, () =>
    kitsu.shot.allShotsForProject(project)
  )
  const assetsWithTasks = await step(
    'http.getNdjson data/assets/with-tasks',
    () =>
      kitsu.http.getNdjson('data/assets/with-tasks', {
        project_id: project.id
      })
  )
  await checkThumbnail([...assetsWithTasks, ...assets, ...shots])
}

try {
  await step('isAuthenticated', async () => {
    if (!(await kitsu.isAuthenticated())) {
      throw new Error('The token was refused')
    }
  })
  await step(
    'getCurrentUser',
    () => kitsu.getCurrentUser(),
    user => `(${user.full_name})`
  )
  const projects = await step('project.allOpenProjects', () =>
    kitsu.project.allOpenProjects()
  )
  await step('task.allTaskStatuses', () => kitsu.task.allTaskStatuses())
  await step('task.allTaskTypes', () => kitsu.task.allTaskTypes())
  await step('person.allPersons', () => kitsu.person.allPersons())
  if (projects.length > 0) await checkProject(projects[0])
  else console.log(lineOf('skip', 'project steps', '(no open project)'))
  console.log('Smoke test passed')
} catch (err) {
  console.error('Smoke test FAILED:', err.name, err.message, err.body || '')
  process.exitCode = 1
} finally {
  kitsu.close()
}
