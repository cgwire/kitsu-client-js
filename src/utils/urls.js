import { ParameterError } from '../core/errors.js'
import { idOf } from '../core/params.js'

/**
 * @typedef {import('../core/params.js').Entity} Entity
 * @typedef {import('../core/params.js').Model} Model
 */

/**
 * @param {string} apiHost The host given to createClient.
 * @returns {string} The host of the Kitsu web app: the API host without its
 *   "/api" suffix, like gazu. Empty for a relative host, which gives
 *   relative URLs.
 */
export const webHostOf = apiHost =>
  apiHost.replace(/\/+$/, '').replace(/\/api$/, '')

// The builders read fields that an id string, or a dict loaded without them,
// does not carry: refuse it rather than build the URL of another page.
const fieldOf = (entity, field, label) => {
  const value = entity && typeof entity === 'object' ? entity[field] : null
  if (typeof value === 'string' && value !== '') return value
  throw new ParameterError(`Missing parameter: ${label}.${field} is required`)
}

const productionUrl = (webHost, project) =>
  `${webHost.replace(/\/+$/, '')}/productions/${idOf(project)}`

const projectUrlOf = (webHost, entity, label) =>
  productionUrl(webHost, fieldOf(entity, 'project_id', label))

const isTvShow = project =>
  fieldOf(project, 'production_type', 'project') === 'tvshow'

/**
 * @param {string} webHost
 * @param {Model} project
 * @param {string} [section] "assets" by default.
 * @returns {string}
 */
export const getProjectUrl = (webHost, project, section = 'assets') =>
  `${productionUrl(webHost, project)}/${section}/`

/**
 * @param {string} webHost
 * @param {Entity} asset Needs project_id. In a TV show, an asset without
 *   episode_id belongs to the main pack.
 * @param {Entity} project Needs production_type.
 * @returns {string}
 */
export const getAssetUrl = (webHost, asset, project) => {
  const base = projectUrlOf(webHost, asset, 'asset')
  if (!isTvShow(project)) return `${base}/assets/${idOf(asset)}/`
  // A main pack asset has no episode: Zou writes it null or empty.
  const episode = asset.episode_id ? idOf(asset.episode_id) : 'main'
  return `${base}/episodes/${episode}/assets/${idOf(asset)}/`
}

/**
 * @param {string} webHost
 * @param {Entity} project Needs production_type.
 * @returns {string}
 */
export const getAllAssetsUrl = (webHost, project) =>
  isTvShow(project)
    ? `${productionUrl(webHost, project)}/episodes/main/assets/`
    : `${productionUrl(webHost, project)}/assets/`

/**
 * @param {string} webHost
 * @param {Entity} project Needs production_type.
 * @param {Entity} assetType Needs name.
 * @returns {string} The asset list filtered on the asset type.
 */
export const getAssetTypeUrl = (webHost, project, assetType) => {
  const name = fieldOf(assetType, 'name', 'assetType')
  const query = new URLSearchParams({ search: `type=[${name}]` })
  const list = getAllAssetsUrl(webHost, project).replace(/\/$/, '')
  return `${list}?${query}`
}

/**
 * @param {string} webHost
 * @param {Entity} episode Needs project_id.
 * @returns {string}
 */
export const getEpisodeUrl = (webHost, episode) =>
  `${projectUrlOf(webHost, episode, 'episode')}/episodes/${idOf(episode)}/shots`

/**
 * @param {string} webHost
 * @param {Entity} shot Needs project_id and episode_id.
 * @returns {string}
 */
export const getShotUrl = (webHost, shot) => {
  const base = projectUrlOf(webHost, shot, 'shot')
  return shot.episode_id
    ? `${base}/episodes/${idOf(shot.episode_id)}/shots/${idOf(shot)}/`
    : `${base}/shots/${idOf(shot)}/`
}

/**
 * @param {string} webHost
 * @param {Entity} edit Needs project_id, and episode_id in a TV show.
 * @returns {string}
 */
export const getEditUrl = (webHost, edit) => {
  const base = projectUrlOf(webHost, edit, 'edit')
  return edit.episode_id
    ? `${base}/episodes/${idOf(edit.episode_id)}/edits/${idOf(edit)}/`
    : `${base}/edits/${idOf(edit)}/`
}

/**
 * @param {string} webHost
 * @param {Entity} sequence Needs project_id, and parent_id in a TV show.
 * @returns {string}
 */
export const getSequenceUrl = (webHost, sequence) => {
  const base = projectUrlOf(webHost, sequence, 'sequence')
  return sequence.parent_id
    ? `${base}/episodes/${idOf(sequence.parent_id)}/sequences/${idOf(sequence)}/`
    : `${base}/sequences/${idOf(sequence)}/`
}

/**
 * @param {string} webHost
 * @param {Model} project
 * @returns {string}
 */
export const getAllEpisodesUrl = (webHost, project) =>
  `${productionUrl(webHost, project)}/episodes/`

/**
 * @param {string} webHost
 * @param {Model} project
 * @returns {string}
 */
export const getAllSequencesUrl = (webHost, project) =>
  `${productionUrl(webHost, project)}/sequences/`

/**
 * @param {string} webHost
 * @param {Entity} task The task object: its project_id is needed.
 * @returns {string}
 */
export const getTaskUrl = (webHost, task) =>
  `${projectUrlOf(webHost, task, 'task')}/shots/tasks/${idOf(task)}/`

/**
 * @param {string} webHost
 * @param {Model} person
 * @returns {string}
 */
export const getPersonUrl = (webHost, person) =>
  `${webHost.replace(/\/+$/, '')}/people/${idOf(person)}/`

/**
 * @param {Entity} previewFile Needs extension.
 * @returns {string} Path of the original file, relative to the API host.
 */
export const getPreviewFilePath = previewFile => {
  const extension = fieldOf(previewFile, 'extension', 'previewFile')
  const kind = extension === 'mp4' ? 'movies' : 'pictures'
  return `${kind}/originals/preview-files/${idOf(previewFile)}.${extension}`
}

/**
 * @param {Model} previewFile
 * @param {{lowdef?: boolean}} [options]
 * @returns {string} Path of the movie, relative to the API host. Zou serves
 *   both definitions as mp4 only, whatever the uploaded format.
 */
export const getPreviewMoviePath = (previewFile, { lowdef = false } = {}) =>
  `movies/${lowdef ? 'low' : 'originals'}/preview-files/${idOf(previewFile)}.mp4`

/**
 * @param {Model} attachmentFile
 * @returns {string} Path of the thumbnail, relative to the API host.
 */
export const getAttachmentThumbnailPath = attachmentFile =>
  `pictures/thumbnails/attachment-files/${idOf(attachmentFile)}.png`
