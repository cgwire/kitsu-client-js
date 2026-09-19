import { beforeEach, describe, expect, it } from 'vitest'

import { NotFoundError, ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import {
  ASSET_ID,
  EPISODE_ID,
  OTHER_ID,
  PERSON_ID,
  PROJECT_ID,
  SEQUENCE_ID,
  SHOT_ID,
  TASK_ID
} from '../helpers/ids.js'

// makeClient() talks to http://kitsu.test/api
const WEB = 'http://kitsu.test'
const PRODUCTION = `${WEB}/productions/${PROJECT_ID}`
const TVSHOW = { id: PROJECT_ID, production_type: 'tvshow' }
const FEATURE = { id: PROJECT_ID, production_type: 'featurefilm' }

describe('namespace URL functions', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('project.getProjectUrl needs no request', async () => {
    expect(await kitsu.project.getProjectUrl(PROJECT_ID)).toBe(
      `${PRODUCTION}/assets/`
    )
    expect(
      await kitsu.project.getProjectUrl(
        { id: PROJECT_ID },
        { section: 'shots' }
      )
    ).toBe(`${PRODUCTION}/shots/`)
    expect(fake.calls).toHaveLength(0)
  })

  it('person.getPersonUrl needs no request', async () => {
    expect(await kitsu.person.getPersonUrl(PERSON_ID)).toBe(
      `${WEB}/people/${PERSON_ID}/`
    )
    expect(fake.calls).toHaveLength(0)
  })

  it('asset.getAssetUrl loads the asset and its project like gazu', async () => {
    fake
      .reply(200, { id: ASSET_ID, project_id: PROJECT_ID, episode_id: null })
      .reply(200, TVSHOW)
    expect(await kitsu.asset.getAssetUrl(ASSET_ID)).toBe(
      `${PRODUCTION}/episodes/main/assets/${ASSET_ID}/`
    )
    expect(fake.calls.map(call => call.path)).toEqual([
      `/data/assets/${ASSET_ID}`,
      `/data/projects/${PROJECT_ID}`
    ])
  })

  it('asset.getAssetUrl rejects with NotFoundError for a missing asset', async () => {
    fake.reply(404, {})
    await expect(kitsu.asset.getAssetUrl(ASSET_ID)).rejects.toBeInstanceOf(
      NotFoundError
    )
  })

  it('asset.getAllAssetsUrl loads the project', async () => {
    fake.reply(200, FEATURE)
    expect(await kitsu.asset.getAllAssetsUrl({ id: PROJECT_ID })).toBe(
      `${PRODUCTION}/assets/`
    )
    expect(fake.calls[0].path).toBe(`/data/projects/${PROJECT_ID}`)
  })

  it('asset.getAssetTypeUrl loads the type only when its name is missing', async () => {
    fake.reply(200, FEATURE)
    expect(
      await kitsu.asset.getAssetTypeUrl(PROJECT_ID, {
        id: OTHER_ID,
        name: 'Props'
      })
    ).toBe(`${PRODUCTION}/assets?search=type%3D%5BProps%5D`)
    expect(fake.calls).toHaveLength(1)

    fake.reply(200, TVSHOW).reply(200, { id: OTHER_ID, name: 'Sets' })
    expect(await kitsu.asset.getAssetTypeUrl(PROJECT_ID, OTHER_ID)).toBe(
      `${PRODUCTION}/episodes/main/assets?search=type%3D%5BSets%5D`
    )
    expect(fake.calls[2].path).toBe(`/data/asset-types/${OTHER_ID}`)
  })

  it('shot.getShotUrl loads the shot', async () => {
    fake.reply(200, {
      id: SHOT_ID,
      project_id: PROJECT_ID,
      episode_id: EPISODE_ID
    })
    expect(await kitsu.shot.getShotUrl(SHOT_ID)).toBe(
      `${PRODUCTION}/episodes/${EPISODE_ID}/shots/${SHOT_ID}/`
    )
    expect(fake.calls[0].path).toBe(`/data/shots/${SHOT_ID}`)
  })

  it('shot.getSequenceUrl loads the sequence', async () => {
    fake.reply(200, {
      id: SEQUENCE_ID,
      project_id: PROJECT_ID,
      parent_id: null
    })
    expect(await kitsu.shot.getSequenceUrl({ id: SEQUENCE_ID })).toBe(
      `${PRODUCTION}/sequences/${SEQUENCE_ID}/`
    )
    expect(fake.calls[0].path).toBe(`/data/sequences/${SEQUENCE_ID}`)
  })

  it('shot.getEpisodeUrl loads the episode', async () => {
    fake.reply(200, { id: EPISODE_ID, project_id: PROJECT_ID })
    expect(await kitsu.shot.getEpisodeUrl(EPISODE_ID)).toBe(
      `${PRODUCTION}/episodes/${EPISODE_ID}/shots`
    )
    expect(fake.calls[0].path).toBe(`/data/episodes/${EPISODE_ID}`)
  })

  it('shot.getAllEpisodesUrl and getAllSequencesUrl need no request', async () => {
    expect(await kitsu.shot.getAllEpisodesUrl(PROJECT_ID)).toBe(
      `${PRODUCTION}/episodes/`
    )
    expect(await kitsu.shot.getAllSequencesUrl(PROJECT_ID)).toBe(
      `${PRODUCTION}/sequences/`
    )
    expect(fake.calls).toHaveLength(0)
  })

  it('task.getTaskUrl needs the task object and no request', async () => {
    expect(
      await kitsu.task.getTaskUrl({ id: TASK_ID, project_id: PROJECT_ID })
    ).toBe(`${PRODUCTION}/shots/tasks/${TASK_ID}/`)
    await expect(kitsu.task.getTaskUrl(TASK_ID)).rejects.toBeInstanceOf(
      ParameterError
    )
    expect(fake.calls).toHaveLength(0)
  })

  it('files.getPreviewFileUrl loads the preview file for its extension', async () => {
    fake.reply(200, { id: OTHER_ID, extension: 'png' })
    expect(await kitsu.files.getPreviewFileUrl(OTHER_ID)).toBe(
      `pictures/originals/preview-files/${OTHER_ID}.png`
    )
    expect(fake.calls[0].path).toBe(`/data/preview-files/${OTHER_ID}`)
  })

  it('files.getPreviewMovieUrl and getPreviewLowdefMovieUrl', async () => {
    fake
      .reply(200, { id: OTHER_ID, extension: 'mp4' })
      .reply(200, { id: OTHER_ID, extension: 'mp4' })
      .reply(200, { id: OTHER_ID, extension: 'mp4' })
    expect(await kitsu.files.getPreviewMovieUrl(OTHER_ID)).toBe(
      `movies/originals/preview-files/${OTHER_ID}.mp4`
    )
    expect(
      await kitsu.files.getPreviewMovieUrl(OTHER_ID, { lowdef: true })
    ).toBe(`movies/low/preview-files/${OTHER_ID}.mp4`)
    expect(await kitsu.files.getPreviewLowdefMovieUrl({ id: OTHER_ID })).toBe(
      `movies/low/preview-files/${OTHER_ID}.mp4`
    )
  })

  it('files.getAttachmentThumbnailUrl needs no request', async () => {
    expect(await kitsu.files.getAttachmentThumbnailUrl(OTHER_ID)).toBe(
      `pictures/thumbnails/attachment-files/${OTHER_ID}.png`
    )
    expect(fake.calls).toHaveLength(0)
  })
})
