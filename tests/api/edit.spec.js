import { beforeEach, describe, expect, it } from 'vitest'

import { NotFoundError, ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import {
  EDIT_ID,
  EPISODE_ID,
  OTHER_ID,
  PROJECT_ID,
  TASK_TYPE_ID
} from '../helpers/ids.js'

const WEB_HOST = 'http://kitsu.test'
const OTHER_EPISODE_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

describe('edit namespace', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('getEdit accepts an object or an id and returns null on 404', async () => {
    fake.reply(200, { id: EDIT_ID }).reply(404, {})
    expect(await kitsu.edit.getEdit({ id: EDIT_ID })).toEqual({ id: EDIT_ID })
    expect(await kitsu.edit.getEdit(EDIT_ID)).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/edits/${EDIT_ID}`
    })
  })

  it('getEditByName filters by project and name', async () => {
    const edit = { id: EDIT_ID, name: 'Trailer', parent_id: null }
    fake.reply(200, [edit]).reply(200, [])
    expect(
      await kitsu.edit.getEditByName({ id: PROJECT_ID }, 'Trailer')
    ).toEqual(edit)
    expect(await kitsu.edit.getEditByName(PROJECT_ID, 'Missing')).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/edits/all'
    })
    expect(fake.calls[0].query.get('project_id')).toBe(PROJECT_ID)
    expect(fake.calls[0].query.get('name')).toBe('Trailer')
  })

  // Zou matches a name filter with ILIKE: any case, _ and % as wildcards.
  it('getEditByName keeps the exact name among the ILIKE matches', async () => {
    const nearName = { id: OTHER_ID, name: 'EP01-cut', parent_id: null }
    const edit = { id: EDIT_ID, name: 'EP01_cut', parent_id: null }
    fake.reply(200, [nearName, edit]).reply(200, [nearName])
    expect(await kitsu.edit.getEditByName(PROJECT_ID, 'EP01_cut')).toEqual(edit)
    expect(await kitsu.edit.getEditByName(PROJECT_ID, 'EP01_cut')).toBeNull()
  })

  it('getEditByName keeps the edit of the given episode', async () => {
    const edits = [
      { id: OTHER_ID, name: 'Animatic', parent_id: OTHER_EPISODE_ID },
      { id: EDIT_ID, name: 'Animatic', parent_id: EPISODE_ID }
    ]
    fake.reply(200, edits).reply(200, edits)
    expect(
      await kitsu.edit.getEditByName(PROJECT_ID, 'Animatic', {
        episode: { id: EPISODE_ID }
      })
    ).toEqual(edits[1])
    // Without an episode, only an edit outside any episode matches.
    expect(await kitsu.edit.getEditByName(PROJECT_ID, 'Animatic')).toBeNull()
  })

  it('getEditByName rejects a blank name without any request', async () => {
    await expect(
      kitsu.edit.getEditByName(PROJECT_ID, '')
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('getEditUrl builds the web URL of a feature film edit', async () => {
    fake.reply(200, { id: EDIT_ID, project_id: PROJECT_ID, episode_id: null })
    expect(await kitsu.edit.getEditUrl({ id: EDIT_ID })).toBe(
      `${WEB_HOST}/productions/${PROJECT_ID}/edits/${EDIT_ID}/`
    )
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/edits/${EDIT_ID}`
    })
  })

  it('getEditUrl goes through the episode in a TV show', async () => {
    fake.reply(200, {
      id: EDIT_ID,
      project_id: PROJECT_ID,
      episode_id: EPISODE_ID
    })
    expect(await kitsu.edit.getEditUrl(EDIT_ID)).toBe(
      `${WEB_HOST}/productions/${PROJECT_ID}/episodes/${EPISODE_ID}/edits/${EDIT_ID}/`
    )
  })

  it('getEditUrl rejects when the edit does not exist', async () => {
    fake.reply(404, {})
    await expect(kitsu.edit.getEditUrl(EDIT_ID)).rejects.toBeInstanceOf(
      NotFoundError
    )
  })

  it('allEditsForProject lists the project edits sorted by name', async () => {
    fake.reply(200, [
      { id: OTHER_ID, name: 'Trailer' },
      { id: EDIT_ID, name: 'Animatic' }
    ])
    expect(await kitsu.edit.allEditsForProject({ id: PROJECT_ID })).toEqual([
      { id: EDIT_ID, name: 'Animatic' },
      { id: OTHER_ID, name: 'Trailer' }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/edits`
    })
  })

  it('allPreviewsForEdit groups the preview files of the edit by task type', async () => {
    const previews = { [TASK_TYPE_ID]: [{ id: OTHER_ID, revision: 1 }] }
    fake.reply(200, previews).reply(200, {})
    expect(await kitsu.edit.allPreviewsForEdit({ id: EDIT_ID })).toEqual(
      previews
    )
    // An edit without any preview: an empty dict, not a list.
    expect(await kitsu.edit.allPreviewsForEdit(EDIT_ID)).toEqual({})
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/edits/${EDIT_ID}/preview-files`
    })
  })

  it('newEdit creates a bare edit when the name is free', async () => {
    fake.reply(200, []).reply(201, { id: EDIT_ID, name: 'Trailer' })
    expect(
      await kitsu.edit.newEdit({ id: PROJECT_ID }, 'Trailer')
    ).toMatchObject({ id: EDIT_ID })
    expect(fake.calls[0].path).toBe('/data/edits/all')
    expect(fake.calls[0].query.get('project_id')).toBe(PROJECT_ID)
    expect(fake.calls[0].query.get('name')).toBe('Trailer')
    expect(fake.calls[1]).toMatchObject({
      method: 'POST',
      path: `/data/projects/${PROJECT_ID}/edits`
    })
    expect(fake.calls[1].body).toEqual({ name: 'Trailer', data: {} })
  })

  it('newEdit sends the description, the metadata and the episode', async () => {
    fake.reply(200, []).reply(201, { id: EDIT_ID })
    await kitsu.edit.newEdit(PROJECT_ID, 'Trailer', {
      description: 'First cut',
      data: { fps: 24 },
      episode: { id: EPISODE_ID }
    })
    expect(fake.calls[1].body).toEqual({
      name: 'Trailer',
      data: { fps: 24 },
      episode_id: EPISODE_ID,
      description: 'First cut'
    })
  })

  it('newEdit returns the existing edit instead of creating', async () => {
    const edit = { id: EDIT_ID, name: 'Trailer', parent_id: null }
    fake.reply(200, [edit])
    expect(await kitsu.edit.newEdit(PROJECT_ID, 'Trailer')).toEqual(edit)
    expect(fake.calls).toHaveLength(1)
  })

  // Zou creates the edit in its episode when another episode has that name.
  it('newEdit creates the edit of an episode when another one has that name', async () => {
    fake
      .reply(200, [
        { id: OTHER_ID, name: 'Animatic', parent_id: OTHER_EPISODE_ID }
      ])
      .reply(201, { id: EDIT_ID, name: 'Animatic', parent_id: EPISODE_ID })
    expect(
      await kitsu.edit.newEdit(PROJECT_ID, 'Animatic', { episode: EPISODE_ID })
    ).toMatchObject({ id: EDIT_ID })
    expect(fake.calls[1]).toMatchObject({
      method: 'POST',
      path: `/data/projects/${PROJECT_ID}/edits`,
      body: { name: 'Animatic', data: {}, episode_id: EPISODE_ID }
    })
  })

  it('newEdit returns the edit of its episode', async () => {
    const edit = { id: EDIT_ID, name: 'Animatic', parent_id: EPISODE_ID }
    fake.reply(200, [
      { id: OTHER_ID, name: 'Animatic', parent_id: OTHER_EPISODE_ID },
      edit
    ])
    expect(
      await kitsu.edit.newEdit(PROJECT_ID, 'Animatic', {
        episode: { id: EPISODE_ID }
      })
    ).toEqual(edit)
    expect(fake.calls).toHaveLength(1)
  })

  it('removeEdit deletes the edit, with force only when asked', async () => {
    fake.reply(204).reply(204)
    await kitsu.edit.removeEdit({ id: EDIT_ID })
    await kitsu.edit.removeEdit(EDIT_ID, { force: true })
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/edits/${EDIT_ID}`
    })
    expect(fake.calls[0].query.has('force')).toBe(false)
    expect(fake.calls[1].query.get('force')).toBe('true')
  })

  it('updateEdit saves the edit through the entity route', async () => {
    fake.reply(200, { id: EDIT_ID, name: 'Teaser' })
    const edit = { id: EDIT_ID, name: 'Teaser' }
    expect(await kitsu.edit.updateEdit(edit)).toEqual(edit)
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/entities/${EDIT_ID}`
    })
    expect(fake.calls[0].body).toEqual({ name: 'Teaser' })
    expect(edit).toEqual({ id: EDIT_ID, name: 'Teaser' })
  })

  it('updateEditData sends only the given keys, Zou merges them', async () => {
    fake.reply(200, { id: EDIT_ID, data: { fps: 24, lens: 50 } })
    const data = { lens: 50 }
    expect(await kitsu.edit.updateEditData({ id: EDIT_ID }, data)).toEqual({
      id: EDIT_ID,
      data: { fps: 24, lens: 50 }
    })
    expect(fake.calls).toHaveLength(1)
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/entities/${EDIT_ID}`
    })
    expect(fake.calls[0].body).toEqual({ data: { lens: 50 } })
    expect(data).toEqual({ lens: 50 })
  })

  it('updateEditData sends empty metadata when no data is given', async () => {
    fake.reply(200, { id: EDIT_ID })
    await kitsu.edit.updateEditData(EDIT_ID, null)
    expect(fake.calls[0].body).toEqual({ data: {} })
  })

  it('updateEditData rejects when the edit does not exist', async () => {
    fake.reply(404, {})
    await expect(
      kitsu.edit.updateEditData(EDIT_ID, { fps: 25 })
    ).rejects.toBeInstanceOf(NotFoundError)
    expect(fake.calls).toHaveLength(1)
    expect(fake.calls[0].method).toBe('PUT')
  })
})
