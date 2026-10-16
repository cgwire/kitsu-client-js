import { describe, expect, it } from 'vitest'

import { ParameterError } from '../../src/index.js'
import {
  getAllAssetsUrl,
  getAllEpisodesUrl,
  getAllSequencesUrl,
  getAssetTypeUrl,
  getAssetUrl,
  getAttachmentThumbnailPath,
  getEditUrl,
  getEpisodeUrl,
  getPersonUrl,
  getPreviewFilePath,
  getPreviewMoviePath,
  getProjectUrl,
  getSequenceUrl,
  getShotUrl,
  getTaskUrl,
  webHostOf
} from '../../src/utils/urls.js'
import {
  ASSET_ID,
  EDIT_ID,
  EPISODE_ID,
  OTHER_ID,
  PERSON_ID,
  PROJECT_ID,
  SEQUENCE_ID,
  SHOT_ID,
  TASK_ID
} from '../helpers/ids.js'

const WEB = 'https://kitsu.studio'
const FEATURE = { id: PROJECT_ID, production_type: 'featurefilm' }
const TVSHOW = { id: PROJECT_ID, production_type: 'tvshow' }

describe('webHostOf', () => {
  it('strips the api suffix like gazu', () => {
    expect(webHostOf('https://kitsu.studio/api')).toBe(WEB)
    expect(webHostOf('https://kitsu.studio/api/')).toBe(WEB)
    expect(webHostOf('https://kitsu.studio')).toBe(WEB)
    expect(webHostOf('/api')).toBe('')
  })
})

describe('project and people URLs', () => {
  it('getProjectUrl builds the URL of a production section', () => {
    expect(getProjectUrl(WEB, { id: PROJECT_ID })).toBe(
      `${WEB}/productions/${PROJECT_ID}/assets/`
    )
    expect(getProjectUrl(`${WEB}/`, PROJECT_ID, 'shots')).toBe(
      `${WEB}/productions/${PROJECT_ID}/shots/`
    )
  })

  it('gives a relative URL with a relative host', () => {
    expect(getProjectUrl('', PROJECT_ID)).toBe(
      `/productions/${PROJECT_ID}/assets/`
    )
  })

  it('getPersonUrl', () => {
    expect(getPersonUrl(WEB, { id: PERSON_ID })).toBe(
      `${WEB}/people/${PERSON_ID}/`
    )
  })

  it('rejects a wrong id instead of building a broken URL', () => {
    expect(() => getProjectUrl(WEB, 'not-a-uuid')).toThrow(ParameterError)
  })

  it('getProjectUrl rejects the options object of the namespace function', () => {
    const options = { section: 'shots' }
    expect(() => getProjectUrl(WEB, PROJECT_ID, options)).toThrow(
      ParameterError
    )
    expect(() => getProjectUrl(WEB, PROJECT_ID, '')).toThrow(ParameterError)
  })
})

describe('asset URLs', () => {
  const asset = { id: ASSET_ID, project_id: PROJECT_ID }

  it('getAssetUrl outside and inside a TV show', () => {
    expect(getAssetUrl(WEB, asset, FEATURE)).toBe(
      `${WEB}/productions/${PROJECT_ID}/assets/${ASSET_ID}/`
    )
    expect(getAssetUrl(WEB, asset, TVSHOW)).toBe(
      `${WEB}/productions/${PROJECT_ID}/episodes/main/assets/${ASSET_ID}/`
    )
    expect(getAssetUrl(WEB, { ...asset, episode_id: EPISODE_ID }, TVSHOW)).toBe(
      `${WEB}/productions/${PROJECT_ID}/episodes/${EPISODE_ID}/assets/${ASSET_ID}/`
    )
  })

  it('getAllAssetsUrl', () => {
    expect(getAllAssetsUrl(WEB, FEATURE)).toBe(
      `${WEB}/productions/${PROJECT_ID}/assets/`
    )
    expect(getAllAssetsUrl(WEB, TVSHOW)).toBe(
      `${WEB}/productions/${PROJECT_ID}/episodes/main/assets/`
    )
  })

  it('getAssetTypeUrl encodes the type search', () => {
    const type = { id: OTHER_ID, name: 'Props & Sets' }
    const query = 'search=type%3D%5BProps+%26+Sets%5D'
    expect(getAssetTypeUrl(WEB, FEATURE, type)).toBe(
      `${WEB}/productions/${PROJECT_ID}/assets?${query}`
    )
    expect(getAssetTypeUrl(WEB, TVSHOW, type)).toBe(
      `${WEB}/productions/${PROJECT_ID}/episodes/main/assets?${query}`
    )
  })
})

describe('shot, sequence, episode and task URLs', () => {
  it('getEpisodeUrl', () => {
    expect(getEpisodeUrl(WEB, { id: EPISODE_ID, project_id: PROJECT_ID })).toBe(
      `${WEB}/productions/${PROJECT_ID}/episodes/${EPISODE_ID}/shots`
    )
  })

  it('getShotUrl with and without episode', () => {
    const shot = { id: SHOT_ID, project_id: PROJECT_ID, episode_id: null }
    expect(getShotUrl(WEB, shot)).toBe(
      `${WEB}/productions/${PROJECT_ID}/shots/${SHOT_ID}/`
    )
    expect(getShotUrl(WEB, { ...shot, episode_id: EPISODE_ID })).toBe(
      `${WEB}/productions/${PROJECT_ID}/episodes/${EPISODE_ID}/shots/${SHOT_ID}/`
    )
  })

  it('getEditUrl with and without episode', () => {
    const edit = { id: EDIT_ID, project_id: PROJECT_ID, episode_id: null }
    expect(getEditUrl(`${WEB}/`, edit)).toBe(
      `${WEB}/productions/${PROJECT_ID}/edits/${EDIT_ID}/`
    )
    expect(getEditUrl(WEB, { ...edit, episode_id: EPISODE_ID })).toBe(
      `${WEB}/productions/${PROJECT_ID}/episodes/${EPISODE_ID}/edits/${EDIT_ID}/`
    )
  })

  it('getSequenceUrl with and without episode', () => {
    const sequence = { id: SEQUENCE_ID, project_id: PROJECT_ID }
    expect(getSequenceUrl(WEB, sequence)).toBe(
      `${WEB}/productions/${PROJECT_ID}/sequences/${SEQUENCE_ID}/`
    )
    expect(getSequenceUrl(WEB, { ...sequence, parent_id: EPISODE_ID })).toBe(
      `${WEB}/productions/${PROJECT_ID}/episodes/${EPISODE_ID}/sequences/${SEQUENCE_ID}/`
    )
  })

  it('getAllEpisodesUrl and getAllSequencesUrl', () => {
    expect(getAllEpisodesUrl(WEB, PROJECT_ID)).toBe(
      `${WEB}/productions/${PROJECT_ID}/episodes/`
    )
    expect(getAllSequencesUrl(WEB, { id: PROJECT_ID })).toBe(
      `${WEB}/productions/${PROJECT_ID}/sequences/`
    )
  })

  it('getTaskUrl needs the task object', () => {
    expect(getTaskUrl(WEB, { id: TASK_ID, project_id: PROJECT_ID })).toBe(
      `${WEB}/productions/${PROJECT_ID}/shots/tasks/${TASK_ID}/`
    )
    expect(() => getTaskUrl(WEB, TASK_ID)).toThrow(ParameterError)
  })
})

describe('API file paths (relative to the API host, like gazu)', () => {
  it('getPreviewFilePath picks movies or pictures from the extension', () => {
    expect(getPreviewFilePath({ id: OTHER_ID, extension: 'mp4' })).toBe(
      `movies/originals/preview-files/${OTHER_ID}.mp4`
    )
    expect(getPreviewFilePath({ id: OTHER_ID, extension: 'png' })).toBe(
      `pictures/originals/preview-files/${OTHER_ID}.png`
    )
  })

  it('getPreviewMoviePath, original and low definition', () => {
    const preview = { id: OTHER_ID, extension: 'mp4' }
    expect(getPreviewMoviePath(preview)).toBe(
      `movies/originals/preview-files/${OTHER_ID}.mp4`
    )
    expect(getPreviewMoviePath(preview, { lowdef: true })).toBe(
      `movies/low/preview-files/${OTHER_ID}.mp4`
    )
  })

  it('getPreviewMoviePath gives the mp4 that Zou serves, from an id too', () => {
    expect(getPreviewMoviePath({ id: OTHER_ID, extension: 'mov' })).toBe(
      `movies/originals/preview-files/${OTHER_ID}.mp4`
    )
    expect(getPreviewMoviePath(OTHER_ID)).toBe(
      `movies/originals/preview-files/${OTHER_ID}.mp4`
    )
  })

  it('getAttachmentThumbnailPath', () => {
    expect(getAttachmentThumbnailPath(OTHER_ID)).toBe(
      `pictures/thumbnails/attachment-files/${OTHER_ID}.png`
    )
  })
})

// An id string, or a dict loaded without the field, would build the URL of
// another page: a TV show read as a feature film, type=[undefined]...
describe('builders that read a field of the object', () => {
  const asset = { id: ASSET_ID, project_id: PROJECT_ID }

  it('reject an object without the field they read', () => {
    expect(() => getAllAssetsUrl(WEB, PROJECT_ID)).toThrow(
      'project.production_type is required'
    )
    expect(() => getAllAssetsUrl(WEB, { id: PROJECT_ID })).toThrow(
      ParameterError
    )
    expect(() => getAssetUrl(WEB, asset, PROJECT_ID)).toThrow(ParameterError)
    expect(() => getAssetUrl(WEB, ASSET_ID, TVSHOW)).toThrow(
      'asset.project_id is required'
    )
    expect(() => getAssetTypeUrl(WEB, FEATURE, OTHER_ID)).toThrow(
      'assetType.name is required'
    )
    expect(() => getAssetTypeUrl(WEB, TVSHOW, { id: OTHER_ID })).toThrow(
      ParameterError
    )
    expect(() => getEpisodeUrl(WEB, EPISODE_ID)).toThrow(
      'episode.project_id is required'
    )
    expect(() => getShotUrl(WEB, SHOT_ID)).toThrow(ParameterError)
    expect(() => getEditUrl(WEB, { id: EDIT_ID })).toThrow(ParameterError)
    expect(() => getSequenceUrl(WEB, SEQUENCE_ID)).toThrow(ParameterError)
    expect(() => getTaskUrl(WEB, { id: TASK_ID })).toThrow(
      'task.project_id is required'
    )
    expect(() => getPreviewFilePath(OTHER_ID)).toThrow(
      'previewFile.extension is required'
    )
    expect(() => getPreviewFilePath({ id: OTHER_ID, extension: '' })).toThrow(
      ParameterError
    )
  })

  it('reject an episode id that is not a UUID in a TV show', () => {
    const misplaced = { ...asset, episode_id: 'E01' }
    expect(() => getAssetUrl(WEB, misplaced, TVSHOW)).toThrow(ParameterError)
    expect(getAssetUrl(WEB, { ...asset, episode_id: '' }, TVSHOW)).toBe(
      `${WEB}/productions/${PROJECT_ID}/episodes/main/assets/${ASSET_ID}/`
    )
  })
})
