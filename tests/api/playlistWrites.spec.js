import { beforeEach, describe, expect, it } from 'vitest'

import { NotFoundError, ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import {
  BUILD_JOB_ID,
  ENTITY_ID,
  EPISODE_ID,
  OTHER_ID,
  PLAYLIST_ID,
  PREVIEW_FILE_ID,
  PROJECT_ID,
  SHOT_ID,
  TASK_TYPE_ID
} from '../helpers/ids.js'

const NEWER_PREVIEW_ID = 'c4c4c4c4-c4c4-4c4c-8c4c-c4c4c4c4c4c4'
const TOKEN = 'c5c5c5c5-c5c5-4c5c-8c5c-c5c5c5c5c5c5'

// A row of allPlaylistsForProject or allPlaylistsForEpisode: the list routes
// leave the entries out.
const LIST_ROW = {
  type: 'Playlist',
  id: PLAYLIST_ID,
  name: 'Dailies',
  project_id: PROJECT_ID,
  first_preview_file_id: PREVIEW_FILE_ID
}
const STORED_ENTRIES = [
  { entity_id: SHOT_ID, preview_file_id: PREVIEW_FILE_ID },
  { entity_id: OTHER_ID, preview_file_id: PREVIEW_FILE_ID }
]
const STORED = { id: PLAYLIST_ID, name: 'Dailies', shots: STORED_ENTRIES }

// Bodies are compared without their id: an update sends it in its path, and
// whether the body repeats it is up to http.update.
const withoutId = body =>
  Object.fromEntries(Object.entries(body).filter(([key]) => key !== 'id'))

describe('playlist namespace: writes', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('newPlaylist creates the playlist when the name is free', async () => {
    fake.reply(200, []).reply(201, { id: PLAYLIST_ID, name: 'Dailies' })
    expect(
      await kitsu.playlist.newPlaylist({ id: PROJECT_ID }, 'Dailies')
    ).toEqual({ id: PLAYLIST_ID, name: 'Dailies' })
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/playlists'
    })
    expect(fake.calls[0].query.get('project_id')).toBe(PROJECT_ID)
    expect(fake.calls[0].query.get('name')).toBe('Dailies')
    expect(fake.calls[1]).toMatchObject({
      method: 'POST',
      path: '/data/playlists'
    })
    expect(fake.calls[1].body).toEqual({
      name: 'Dailies',
      project_id: PROJECT_ID,
      for_entity: 'shot',
      for_client: false,
      is_for_all: false
    })
  })

  it('newPlaylist sends the episode and the options', async () => {
    fake.reply(200, []).reply(201, { id: PLAYLIST_ID })
    await kitsu.playlist.newPlaylist(PROJECT_ID, 'Dailies', {
      episode: { id: EPISODE_ID },
      forEntity: 'asset',
      forClient: true,
      isForAll: true
    })
    expect(fake.calls[1].body).toEqual({
      name: 'Dailies',
      project_id: PROJECT_ID,
      for_entity: 'asset',
      for_client: true,
      is_for_all: true,
      episode_id: EPISODE_ID
    })
  })

  it('newPlaylist returns the existing playlist instead of creating', async () => {
    fake.reply(200, [{ id: PLAYLIST_ID, name: 'Dailies' }])
    expect(await kitsu.playlist.newPlaylist(PROJECT_ID, 'Dailies')).toEqual({
      id: PLAYLIST_ID,
      name: 'Dailies'
    })
    expect(fake.calls).toHaveLength(1)
  })

  it('updatePlaylist saves the playlist', async () => {
    const playlist = { id: PLAYLIST_ID, name: 'Renamed', shots: [] }
    fake.reply(200, playlist)
    expect(await kitsu.playlist.updatePlaylist(playlist)).toEqual(playlist)
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/playlists/${PLAYLIST_ID}`
    })
    expect(fake.calls[0].body).toEqual(playlist)
  })

  it('updatePlaylist rejects a playlist without id', async () => {
    await expect(
      kitsu.playlist.updatePlaylist({ name: 'Renamed' })
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('addEntityToPlaylist picks the most recent preview of the entity', async () => {
    fake
      .reply(200, {
        [TASK_TYPE_ID]: [
          { id: PREVIEW_FILE_ID, created_at: '2026-01-01T10:00:00' },
          { id: OTHER_ID, created_at: '2025-01-01T10:00:00' }
        ],
        [OTHER_ID]: [],
        [ENTITY_ID]: [
          { id: NEWER_PREVIEW_ID, created_at: '2026-02-01T10:00:00' }
        ]
      })
      .reply(200, { id: PLAYLIST_ID, shots: [{ entity_id: SHOT_ID }] })
    expect(
      await kitsu.playlist.addEntityToPlaylist(
        { id: PLAYLIST_ID },
        { id: SHOT_ID }
      )
    ).toEqual({ id: PLAYLIST_ID, shots: [{ entity_id: SHOT_ID }] })
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/playlists/entities/${SHOT_ID}/preview-files`
    })
    expect(fake.calls[1]).toMatchObject({
      method: 'POST',
      path: `/actions/playlists/${PLAYLIST_ID}/add-entity`
    })
    expect(fake.calls[1].body).toEqual({
      entity_id: SHOT_ID,
      preview_file_id: NEWER_PREVIEW_ID
    })
  })

  it('addEntityToPlaylist adds an entity that has no preview', async () => {
    fake.reply(200, { [TASK_TYPE_ID]: [] }).reply(200, { id: PLAYLIST_ID })
    await kitsu.playlist.addEntityToPlaylist(PLAYLIST_ID, SHOT_ID)
    expect(fake.calls[1].body).toEqual({ entity_id: SHOT_ID })
  })

  it('addEntityToPlaylist forces the given preview', async () => {
    fake.reply(200, { id: PLAYLIST_ID })
    await kitsu.playlist.addEntityToPlaylist(PLAYLIST_ID, SHOT_ID, {
      previewFile: { id: PREVIEW_FILE_ID }
    })
    expect(fake.calls).toHaveLength(1)
    expect(fake.calls[0].body).toEqual({
      entity_id: SHOT_ID,
      preview_file_id: PREVIEW_FILE_ID
    })
  })

  it('addEntityToPlaylist without persist returns an updated copy', async () => {
    const playlist = { id: PLAYLIST_ID, shots: [{ entity_id: OTHER_ID }] }
    expect(
      await kitsu.playlist.addEntityToPlaylist(playlist, SHOT_ID, {
        previewFile: PREVIEW_FILE_ID,
        persist: false
      })
    ).toEqual({
      id: PLAYLIST_ID,
      shots: [
        { entity_id: OTHER_ID },
        { entity_id: SHOT_ID, preview_file_id: PREVIEW_FILE_ID }
      ]
    })
    expect(playlist.shots).toEqual([{ entity_id: OTHER_ID }])
    expect(fake.calls).toHaveLength(0)
  })

  it('addEntityToPlaylist without persist starts from an empty list', async () => {
    expect(
      await kitsu.playlist.addEntityToPlaylist(
        { id: PLAYLIST_ID, shots: null },
        SHOT_ID,
        { previewFile: PREVIEW_FILE_ID, persist: false }
      )
    ).toEqual({
      id: PLAYLIST_ID,
      shots: [{ entity_id: SHOT_ID, preview_file_id: PREVIEW_FILE_ID }]
    })
  })

  it('removeEntityFromPlaylist saves the playlist without the entity', async () => {
    const playlist = {
      id: PLAYLIST_ID,
      shots: [
        { entity_id: SHOT_ID },
        { entity_id: OTHER_ID },
        { entity_id: SHOT_ID }
      ]
    }
    fake.reply(200, { id: PLAYLIST_ID })
    expect(
      await kitsu.playlist.removeEntityFromPlaylist(playlist, { id: SHOT_ID })
    ).toEqual({ id: PLAYLIST_ID, shots: [{ entity_id: OTHER_ID }] })
    expect(playlist.shots).toHaveLength(3)
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/playlists/${PLAYLIST_ID}`
    })
    expect(fake.calls[0].body).toEqual({
      id: PLAYLIST_ID,
      shots: [{ entity_id: OTHER_ID }]
    })
  })

  it('removeEntityFromPlaylist without persist sends nothing', async () => {
    expect(
      await kitsu.playlist.removeEntityFromPlaylist(
        { id: PLAYLIST_ID, shots: [{ entity_id: SHOT_ID }] },
        SHOT_ID,
        { persist: false }
      )
    ).toEqual({ id: PLAYLIST_ID, shots: [] })
    expect(fake.calls).toHaveLength(0)
  })

  it('updateEntityPreview saves the new preview of the entity', async () => {
    const playlist = {
      id: PLAYLIST_ID,
      shots: [
        { entity_id: SHOT_ID, preview_file_id: PREVIEW_FILE_ID },
        { entity_id: OTHER_ID, preview_file_id: PREVIEW_FILE_ID }
      ]
    }
    const updated = {
      id: PLAYLIST_ID,
      shots: [
        { entity_id: SHOT_ID, preview_file_id: NEWER_PREVIEW_ID },
        { entity_id: OTHER_ID, preview_file_id: PREVIEW_FILE_ID }
      ]
    }
    fake.reply(200, { id: PLAYLIST_ID })
    expect(
      await kitsu.playlist.updateEntityPreview(
        playlist,
        { id: SHOT_ID },
        { id: NEWER_PREVIEW_ID }
      )
    ).toEqual(updated)
    expect(playlist.shots[0].preview_file_id).toBe(PREVIEW_FILE_ID)
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/playlists/${PLAYLIST_ID}`
    })
    expect(fake.calls[0].body).toEqual(updated)
  })

  it('updateEntityPreview without persist sends nothing', async () => {
    expect(
      await kitsu.playlist.updateEntityPreview(
        { id: PLAYLIST_ID, shots: [{ entity_id: SHOT_ID }] },
        SHOT_ID,
        NEWER_PREVIEW_ID,
        { persist: false }
      )
    ).toEqual({
      id: PLAYLIST_ID,
      shots: [{ entity_id: SHOT_ID, preview_file_id: NEWER_PREVIEW_ID }]
    })
    expect(fake.calls).toHaveLength(0)
  })

  it('removeEntityFromPlaylist keeps the stored entries of a list row', async () => {
    const row = { ...LIST_ROW }
    const updated = {
      ...LIST_ROW,
      shots: [{ entity_id: OTHER_ID, preview_file_id: PREVIEW_FILE_ID }]
    }
    fake.reply(200, STORED).reply(200, { id: PLAYLIST_ID })
    expect(await kitsu.playlist.removeEntityFromPlaylist(row, SHOT_ID)).toEqual(
      updated
    )
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/playlists/${PLAYLIST_ID}`
    })
    expect(fake.calls[1]).toMatchObject({
      method: 'PUT',
      path: `/data/playlists/${PLAYLIST_ID}`
    })
    expect(withoutId(fake.calls[1].body)).toEqual(withoutId(updated))
    expect(row).toEqual(LIST_ROW)
  })

  it('updateEntityPreview keeps the stored entries of a list row', async () => {
    const updated = {
      ...LIST_ROW,
      shots: [
        { entity_id: SHOT_ID, preview_file_id: NEWER_PREVIEW_ID },
        { entity_id: OTHER_ID, preview_file_id: PREVIEW_FILE_ID }
      ]
    }
    fake.reply(200, STORED).reply(200, { id: PLAYLIST_ID })
    expect(
      await kitsu.playlist.updateEntityPreview(
        LIST_ROW,
        SHOT_ID,
        NEWER_PREVIEW_ID
      )
    ).toEqual(updated)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/playlists/${PLAYLIST_ID}`
    })
    expect(withoutId(fake.calls[1].body)).toEqual(withoutId(updated))
  })

  it.each([[PLAYLIST_ID], [{ id: PLAYLIST_ID }]])(
    'removeEntityFromPlaylist reads the entries of the playlist %j',
    async playlist => {
      const updated = {
        id: PLAYLIST_ID,
        shots: [{ entity_id: OTHER_ID, preview_file_id: PREVIEW_FILE_ID }]
      }
      fake.reply(200, STORED).reply(200, { id: PLAYLIST_ID })
      expect(
        await kitsu.playlist.removeEntityFromPlaylist(playlist, SHOT_ID)
      ).toEqual(updated)
      expect(fake.calls[0].path).toBe(`/data/playlists/${PLAYLIST_ID}`)
      expect(fake.calls[1]).toMatchObject({
        method: 'PUT',
        path: `/data/playlists/${PLAYLIST_ID}`
      })
      expect(withoutId(fake.calls[1].body)).toEqual(withoutId(updated))
    }
  )

  it('removeEntityFromPlaylist without persist reads but saves nothing', async () => {
    fake.reply(200, STORED)
    expect(
      await kitsu.playlist.removeEntityFromPlaylist(LIST_ROW, OTHER_ID, {
        persist: false
      })
    ).toEqual({
      ...LIST_ROW,
      shots: [{ entity_id: SHOT_ID, preview_file_id: PREVIEW_FILE_ID }]
    })
    expect(fake.calls).toHaveLength(1)
    expect(fake.calls[0].method).toBe('GET')
  })

  it('removeEntityFromPlaylist saves nothing when the playlist is missing', async () => {
    fake.reply(404, { message: 'Playlist not found' })
    await expect(
      kitsu.playlist.removeEntityFromPlaylist(LIST_ROW, SHOT_ID)
    ).rejects.toBeInstanceOf(NotFoundError)
    expect(fake.calls.map(call => call.method)).toEqual(['GET'])
  })

  it('updateEntityPreview takes stored shots: null as an empty list', async () => {
    fake.reply(200, { id: PLAYLIST_ID, shots: null }).reply(200, {})
    await kitsu.playlist.updateEntityPreview(PLAYLIST_ID, SHOT_ID, {
      id: NEWER_PREVIEW_ID
    })
    expect(withoutId(fake.calls[1].body)).toEqual({ shots: [] })
  })

  it('addEntityToPlaylist without persist adds to the stored entries', async () => {
    fake.reply(200, STORED)
    expect(
      await kitsu.playlist.addEntityToPlaylist(
        LIST_ROW,
        { id: ENTITY_ID },
        { previewFile: NEWER_PREVIEW_ID, persist: false }
      )
    ).toEqual({
      ...LIST_ROW,
      shots: [
        ...STORED_ENTRIES,
        { entity_id: ENTITY_ID, preview_file_id: NEWER_PREVIEW_ID }
      ]
    })
    expect(fake.calls).toHaveLength(1)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/playlists/${PLAYLIST_ID}`
    })
  })

  // Zou appends the entry to the stored ones: nothing to read.
  it('addEntityToPlaylist adds to a list row on the server side', async () => {
    fake.reply(200, STORED)
    expect(
      await kitsu.playlist.addEntityToPlaylist(LIST_ROW, SHOT_ID, {
        previewFile: PREVIEW_FILE_ID
      })
    ).toEqual(STORED)
    expect(fake.calls).toHaveLength(1)
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/actions/playlists/${PLAYLIST_ID}/add-entity`
    })
  })

  it('the read of the entries forwards the caller signal', async () => {
    const controller = new AbortController()
    controller.abort()
    fake.reply(200, STORED).reply(200, {})
    await kitsu.playlist.removeEntityFromPlaylist(LIST_ROW, SHOT_ID, {
      signal: controller.signal
    })
    expect(fake.calls).toHaveLength(2)
    fake.calls.forEach(call => expect(call.signal.aborted).toBe(true))
  })

  it('deletePlaylist deletes the playlist', async () => {
    fake.reply(204)
    await kitsu.playlist.deletePlaylist({ id: PLAYLIST_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/playlists/${PLAYLIST_ID}`
    })
  })

  it('removeBuildJob deletes the build job of the playlist', async () => {
    fake.reply(204)
    await kitsu.playlist.removeBuildJob(
      { id: PLAYLIST_ID },
      { id: BUILD_JOB_ID }
    )
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/playlists/${PLAYLIST_ID}/jobs/${BUILD_JOB_ID}`
    })
  })

  it('buildPlaylistMovie asks for the movie build', async () => {
    fake.reply(200, { id: BUILD_JOB_ID })
    expect(
      await kitsu.playlist.buildPlaylistMovie({ id: PLAYLIST_ID })
    ).toEqual({ id: BUILD_JOB_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/playlists/${PLAYLIST_ID}/build/mp4`
    })
  })

  it('generateTempPlaylist posts the generation data', async () => {
    const data = { task_ids: [OTHER_ID] }
    fake.reply(200, [{ id: SHOT_ID }])
    expect(
      await kitsu.playlist.generateTempPlaylist({ id: PROJECT_ID }, data)
    ).toEqual([{ id: SHOT_ID }])
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/data/projects/${PROJECT_ID}/playlists/temp`
    })
    expect(fake.calls[0].body).toEqual(data)
  })

  it('notifyClientsPlaylistReady posts an empty body', async () => {
    fake.reply(200, { status: 'success' })
    expect(
      await kitsu.playlist.notifyClientsPlaylistReady({ id: PLAYLIST_ID })
    ).toEqual({ status: 'success' })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/data/playlists/${PLAYLIST_ID}/notify-clients`
    })
    expect(fake.calls[0].body).toEqual({})
  })

  it('newShareLink creates a link open to comments by default', async () => {
    fake.reply(201, { token: TOKEN })
    expect(await kitsu.playlist.newShareLink({ id: PLAYLIST_ID })).toEqual({
      token: TOKEN
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/data/playlists/${PLAYLIST_ID}/share`
    })
    expect(fake.calls[0].body).toEqual({ can_comment: true })
  })

  it('newShareLink sends the expiration date, the password and the flag', async () => {
    fake.reply(201, { token: TOKEN })
    await kitsu.playlist.newShareLink(PLAYLIST_ID, {
      expirationDate: '2026-12-31',
      canComment: false,
      password: 'secret'
    })
    expect(fake.calls[0].body).toEqual({
      can_comment: false,
      expiration_date: '2026-12-31',
      password: 'secret'
    })
  })

  it('newShareLink leaves out a blank date and a blank password', async () => {
    fake.reply(201, { token: TOKEN })
    await kitsu.playlist.newShareLink(PLAYLIST_ID, {
      expirationDate: '',
      password: ''
    })
    expect(fake.calls[0].body).toEqual({ can_comment: true })
  })

  it('removeShareLink revokes the link', async () => {
    fake.reply(204)
    await kitsu.playlist.removeShareLink({ id: PLAYLIST_ID }, TOKEN)
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/playlists/${PLAYLIST_ID}/share/${TOKEN}`
    })
  })

  it.each([[''], [undefined], ['..'], ['a/b'], ['a?b']])(
    'removeShareLink rejects the token %j without any request',
    async token => {
      await expect(
        kitsu.playlist.removeShareLink(PLAYLIST_ID, token)
      ).rejects.toBeInstanceOf(ParameterError)
      expect(fake.calls).toHaveLength(0)
    }
  )

  // The core aborts its own request signal as soon as the caller signal is
  // aborted: an aborted request signal proves the option went through.
  it.each([
    ['newPlaylist', [PROJECT_ID, 'Dailies']],
    ['updatePlaylist', [{ id: PLAYLIST_ID }]],
    ['addEntityToPlaylist', [PLAYLIST_ID, SHOT_ID]],
    ['removeEntityFromPlaylist', [{ id: PLAYLIST_ID, shots: [] }, SHOT_ID]],
    [
      'updateEntityPreview',
      [{ id: PLAYLIST_ID, shots: [] }, SHOT_ID, PREVIEW_FILE_ID]
    ],
    ['deletePlaylist', [PLAYLIST_ID]],
    ['removeBuildJob', [PLAYLIST_ID, BUILD_JOB_ID]],
    ['buildPlaylistMovie', [PLAYLIST_ID]],
    ['generateTempPlaylist', [PROJECT_ID, {}]],
    ['notifyClientsPlaylistReady', [PLAYLIST_ID]],
    ['newShareLink', [PLAYLIST_ID]],
    ['removeShareLink', [PLAYLIST_ID, TOKEN]]
  ])('%s forwards the caller signal', async (name, args) => {
    const controller = new AbortController()
    controller.abort()
    fake.reply(200, []).reply(200, [])
    await kitsu.playlist[name](...args, { signal: controller.signal })
    expect(fake.calls.length).toBeGreaterThan(0)
    fake.calls.forEach(call => expect(call.signal.aborted).toBe(true))
  })
})
