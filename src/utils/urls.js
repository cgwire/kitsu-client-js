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

const productionUrl = (webHost, project) =>
  `${webHost.replace(/\/+$/, '')}/productions/${idOf(project)}`

const isTvShow = project => project.production_type === 'tvshow'

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
 * @param {Entity} asset Needs project_id, and episode_id in a TV show.
 * @param {Entity} project Needs production_type.
 * @returns {string}
 */
export const getAssetUrl = (webHost, asset, project) => {
  const base = productionUrl(webHost, asset.project_id)
  return isTvShow(project)
    ? `${base}/episodes/${asset.episode_id || 'main'}/assets/${idOf(asset)}/`
    : `${base}/assets/${idOf(asset)}/`
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
  const query = new URLSearchParams({ search: `type=[${assetType.name}]` })
  const list = getAllAssetsUrl(webHost, project).replace(/\/$/, '')
  return `${list}?${query}`
}

/**
 * @param {string} webHost
 * @param {Entity} episode Needs project_id.
 * @returns {string}
 */
export const getEpisodeUrl = (webHost, episode) =>
  `${productionUrl(webHost, episode.project_id)}/episodes/${idOf(episode)}/shots`

/**
 * @param {string} webHost
 * @param {Entity} shot Needs project_id and episode_id.
 * @returns {string}
 */
export const getShotUrl = (webHost, shot) => {
  const base = productionUrl(webHost, shot.project_id)
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
  const base = productionUrl(webHost, edit.project_id)
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
  const base = productionUrl(webHost, sequence.project_id)
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
export const getTaskUrl = (webHost, task) => {
  if (!task || typeof task !== 'object') {
    throw new ParameterError('Wrong format: getTaskUrl needs the task object')
  }
  return `${productionUrl(webHost, task.project_id)}/shots/tasks/${idOf(task)}/`
}

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
  const kind = previewFile.extension === 'mp4' ? 'movies' : 'pictures'
  return `${kind}/originals/preview-files/${idOf(previewFile)}.${previewFile.extension}`
}

/**
 * @param {Entity} previewFile Needs extension, unless lowdef is set.
 * @param {{lowdef?: boolean}} [options] The low definition movie is always
 *   an mp4.
 * @returns {string} Path of the movie, relative to the API host.
 */
export const getPreviewMoviePath = (previewFile, { lowdef = false } = {}) =>
  lowdef
    ? `movies/low/preview-files/${idOf(previewFile)}.mp4`
    : `movies/originals/preview-files/${idOf(previewFile)}.${previewFile.extension}`

/**
 * @param {Model} attachmentFile
 * @returns {string} Path of the thumbnail, relative to the API host.
 */
export const getAttachmentThumbnailPath = attachmentFile =>
  `pictures/thumbnails/attachment-files/${idOf(attachmentFile)}.png`
