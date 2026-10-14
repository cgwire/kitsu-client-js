import { beforeEach, describe, expect, it } from 'vitest'

import { NotFoundError, ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import {
  BUILD_JOB_ID,
  DEPARTMENT_ID,
  ENTITY_ID,
  EPISODE_ID,
  OTHER_ID,
  PERSON_ID,
  PLAYLIST_ID,
  PREVIEW_FILE_ID,
  PROJECT_ID,
  SHOT_ID,
  STUDIO_ID,
  TASK_TYPE_ID
} from '../helpers/ids.js'

const NEWER_PREVIEW_ID = 'c4c4c4c4-c4c4-4c4c-8c4c-c4c4c4c4c4c4'
const MODELING_PREVIEW_ID = 'c0c0c0c0-c0c0-4c0c-8c0c-c0c0c0c0c0c0'
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

// What getPlaylist answers: the CRUD read, its build jobs included.
const READ = {
  type: 'Playlist',
  id: PLAYLIST_ID,
  name: 'Dailies',
  shots: STORED_ENTRIES,
  project_id: PROJECT_ID,
  episode_id: null,
  task_type_id: null,
  for_client: false,
  for_entity: 'shot',
  is_for_all: false,
  created_by: PERSON_ID,
  build_jobs: [BUILD_JOB_ID],
  created_at: '2026-10-01T10:00:00',
  updated_at: '2026-10-02T10:00:00'
}

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
      isForAll: true,
      taskType: { id: TASK_TYPE_ID }
    })
    expect(fake.calls[0].query.get('episode_id')).toBe(EPISODE_ID)
    expect(fake.calls[1].body).toEqual({
      name: 'Dailies',
      project_id: PROJECT_ID,
      for_entity: 'asset',
      for_client: true,
      is_for_all: true,
      episode_id: EPISODE_ID,
      task_type_id: TASK_TYPE_ID
    })
  })

  it('newPlaylist returns the existing playlist instead of creating', async () => {
    const playlist = { id: PLAYLIST_ID, name: 'Dailies', episode_id: null }
    fake.reply(200, [playlist])
    expect(await kitsu.playlist.newPlaylist(PROJECT_ID, 'Dailies')).toEqual(
      playlist
    )
    expect(fake.calls).toHaveLength(1)
  })

  // What Zou answers to the name filter without episode filter: the
  // playlists of every episode.
  it('newPlaylist creates the playlist next to the one of an episode', async () => {
    const row = { id: OTHER_ID, name: 'Dailies', episode_id: EPISODE_ID }
    fake.reply(200, [row]).reply(201, { id: PLAYLIST_ID, name: 'Dailies' })
    expect(await kitsu.playlist.newPlaylist(PROJECT_ID, 'Dailies')).toEqual({
      id: PLAYLIST_ID,
      name: 'Dailies'
    })
    expect(fake.calls[1]).toMatchObject({
      method: 'POST',
      path: '/data/playlists'
    })
  })

  // Both without episode, where Zou keeps no name unique: the All playlist
  // of the shots is not the Main Pack one of the assets.
  it('newPlaylist creates an All playlist next to a Main Pack one of that name', async () => {
    const mainPack = {
      id: OTHER_ID,
      name: 'Client review',
      episode_id: null,
      is_for_all: false,
      for_entity: 'asset'
    }
    fake.reply(200, [mainPack]).reply(201, { id: PLAYLIST_ID })
    expect(
      await kitsu.playlist.newPlaylist(PROJECT_ID, 'Client review', {
        isForAll: true,
        forEntity: 'shot'
      })
    ).toEqual({ id: PLAYLIST_ID })
    expect(fake.calls[1]).toMatchObject({
      method: 'POST',
      path: '/data/playlists',
      body: {
        name: 'Client review',
        project_id: PROJECT_ID,
        for_entity: 'shot',
        for_client: false,
        is_for_all: true
      }
    })
  })

  it('newPlaylist returns the All playlist of the same entity type', async () => {
    const allAssets = {
      id: OTHER_ID,
      name: 'Client review',
      episode_id: null,
      is_for_all: true,
      for_entity: 'asset'
    }
    fake.reply(200, [allAssets])
    expect(
      await kitsu.playlist.newPlaylist(PROJECT_ID, 'Client review', {
        isForAll: true,
        forEntity: 'asset'
      })
    ).toEqual(allAssets)
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
    expect(fake.calls[0].body).toEqual({ name: 'Renamed', shots: [] })
  })

  // Zou serves an entry without preview without the key, and the enriched
  // reads (getPlaylistForProject) add id and the preview details.
  it('updatePlaylist sends each entry as its entity and its preview', async () => {
    const playlist = {
      id: PLAYLIST_ID,
      name: 'Dailies',
      shots: [
        { entity_id: SHOT_ID },
        {
          entity_id: OTHER_ID,
          id: OTHER_ID,
          preview_file_id: PREVIEW_FILE_ID,
          preview_file_extension: 'mp4',
          preview_files: {}
        },
        { entity_id: ENTITY_ID, id: ENTITY_ID, preview_files: {} },
        { id: SHOT_ID, preview_file_id: NEWER_PREVIEW_ID }
      ]
    }
    const copy = structuredClone(playlist)
    fake.reply(200, { id: PLAYLIST_ID })
    await kitsu.playlist.updatePlaylist(playlist)
    expect(fake.calls[0].body).toEqual({
      name: 'Dailies',
      shots: [
        { entity_id: SHOT_ID, preview_file_id: null },
        { entity_id: OTHER_ID, preview_file_id: PREVIEW_FILE_ID },
        { entity_id: ENTITY_ID, preview_file_id: null },
        { entity_id: SHOT_ID, preview_file_id: NEWER_PREVIEW_ID }
      ]
    })
    expect(playlist).toEqual(copy)
  })

  // Its build_jobs would drop a build job started since the read, which Zou
  // refuses with a 400.
  it('updatePlaylist leaves out the build jobs and the read-only keys', async () => {
    fake.reply(200, { id: PLAYLIST_ID })
    await kitsu.playlist.updatePlaylist({
      ...READ,
      name: 'Renamed',
      first_preview_file_id: PREVIEW_FILE_ID
    })
    expect(fake.calls[0].body).toEqual({
      name: 'Renamed',
      shots: STORED_ENTRIES,
      project_id: PROJECT_ID,
      episode_id: null,
      task_type_id: null,
      for_client: false,
      for_entity: 'shot',
      is_for_all: false,
      created_by: PERSON_ID
    })
  })

  // A playlist read before its first entry carries shots: null, which Zou
  // answers with a 400.
  it('updatePlaylist leaves out shots: null', async () => {
    fake.reply(200, { id: PLAYLIST_ID })
    await kitsu.playlist.updatePlaylist({
      id: PLAYLIST_ID,
      name: 'Renamed',
      shots: null
    })
    expect(fake.calls[0].body).toEqual({ name: 'Renamed' })
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
      shots: [{ entity_id: OTHER_ID, preview_file_id: null }]
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
    expect(fake.calls[0].body).toEqual({ shots: updated.shots })
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

  // An entity reviewed under two task types: one entry per preview.
  const REVIEWED_TWICE = {
    id: PLAYLIST_ID,
    shots: [
      { entity_id: SHOT_ID, preview_file_id: MODELING_PREVIEW_ID },
      { entity_id: OTHER_ID, preview_file_id: MODELING_PREVIEW_ID },
      { entity_id: SHOT_ID, preview_file_id: PREVIEW_FILE_ID },
      { entity_id: SHOT_ID }
    ]
  }

  it('updateEntityPreview gives the new preview to every entry of the entity', async () => {
    fake.reply(200, { id: PLAYLIST_ID })
    await kitsu.playlist.updateEntityPreview(
      REVIEWED_TWICE,
      SHOT_ID,
      NEWER_PREVIEW_ID
    )
    expect(fake.calls[0].body).toEqual({
      shots: [
        { entity_id: SHOT_ID, preview_file_id: NEWER_PREVIEW_ID },
        { entity_id: OTHER_ID, preview_file_id: MODELING_PREVIEW_ID },
        { entity_id: SHOT_ID, preview_file_id: NEWER_PREVIEW_ID },
        { entity_id: SHOT_ID, preview_file_id: NEWER_PREVIEW_ID }
      ]
    })
  })

  it.each([
    [{ id: PREVIEW_FILE_ID }, 2],
    [MODELING_PREVIEW_ID, 0],
    [null, 3]
  ])(
    'updateEntityPreview changes the entry of the previous preview %j only',
    async (previousPreviewFile, index) => {
      fake.reply(200, { id: PLAYLIST_ID })
      const updated = await kitsu.playlist.updateEntityPreview(
        REVIEWED_TWICE,
        { id: SHOT_ID },
        NEWER_PREVIEW_ID,
        { previousPreviewFile }
      )
      const shots = REVIEWED_TWICE.shots.map((entry, position) =>
        position === index
          ? { ...entry, preview_file_id: NEWER_PREVIEW_ID }
          : entry
      )
      expect(updated).toEqual({ ...REVIEWED_TWICE, shots })
      expect(fake.calls[0].body.shots[index]).toEqual({
        entity_id: SHOT_ID,
        preview_file_id: NEWER_PREVIEW_ID
      })
    }
  )

  // Saved anyway, a playlist read earlier would undo the entries added since.
  it('updateEntityPreview sends nothing when no entry has the previous preview', async () => {
    const updated = await kitsu.playlist.updateEntityPreview(
      REVIEWED_TWICE,
      OTHER_ID,
      NEWER_PREVIEW_ID,
      { previousPreviewFile: PREVIEW_FILE_ID }
    )
    expect(updated).toEqual(REVIEWED_TWICE)
    expect(fake.calls).toHaveLength(0)
  })

  it('updateEntityPreview sends nothing for an entity out of the playlist', async () => {
    fake.reply(200, STORED)
    expect(
      await kitsu.playlist.updateEntityPreview(
        REVIEWED_TWICE,
        ENTITY_ID,
        NEWER_PREVIEW_ID
      )
    ).toEqual(REVIEWED_TWICE)
    expect(
      await kitsu.playlist.updateEntityPreview(
        LIST_ROW,
        ENTITY_ID,
        NEWER_PREVIEW_ID
      )
    ).toEqual({ ...LIST_ROW, shots: STORED_ENTRIES })
    expect(fake.calls.map(call => call.method)).toEqual(['GET'])
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
    expect(fake.calls[1].body).toEqual({ shots: updated.shots })
    expect(row).toEqual(LIST_ROW)
  })

  // Its build_jobs would drop a build job started since the read (Zou then
  // answers a 400), its other fields would revert the changes made since.
  it.each([
    ['removeEntityFromPlaylist', [SHOT_ID]],
    ['updateEntityPreview', [SHOT_ID, NEWER_PREVIEW_ID]]
  ])('%s saves only the entries of a read playlist', async (name, args) => {
    fake.reply(200, { id: PLAYLIST_ID })
    const updated = await kitsu.playlist[name](READ, ...args)
    expect(updated).toMatchObject({ ...READ, shots: expect.any(Array) })
    expect(fake.calls).toHaveLength(1)
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/playlists/${PLAYLIST_ID}`
    })
    expect(fake.calls[0].body).toEqual({ shots: updated.shots })
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
    expect(fake.calls[1].body).toEqual({ shots: updated.shots })
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
      expect(fake.calls[1].body).toEqual({ shots: updated.shots })
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
    fake.reply(200, { id: PLAYLIST_ID, shots: null })
    expect(
      await kitsu.playlist.updateEntityPreview(PLAYLIST_ID, SHOT_ID, {
        id: NEWER_PREVIEW_ID
      })
    ).toEqual({ id: PLAYLIST_ID, shots: [] })
    expect(fake.calls.map(call => call.method)).toEqual(['GET'])
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
    expect(fake.calls[0].query.has('full')).toBe(false)
  })

  it('buildPlaylistMovie asks for a full re-encoding', async () => {
    fake.reply(200, { id: BUILD_JOB_ID })
    await kitsu.playlist.buildPlaylistMovie(PLAYLIST_ID, { full: true })
    expect(fake.calls[0].query.get('full')).toBe('true')
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
    expect(fake.calls[0].query.has('sort')).toBe(false)
  })

  it('generateTempPlaylist asks for sorted entries', async () => {
    fake.reply(200, [])
    await kitsu.playlist.generateTempPlaylist(
      PROJECT_ID,
      { entity_ids: [SHOT_ID] },
      { sort: true }
    )
    expect(fake.calls[0].query.get('sort')).toBe('true')
    expect(fake.calls[0].body).toEqual({ entity_ids: [SHOT_ID] })
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

  it('notifyClientsPlaylistReady tells the clients of a studio and a department', async () => {
    fake.reply(200, { status: 'success' })
    await kitsu.playlist.notifyClientsPlaylistReady(PLAYLIST_ID, {
      studio: { id: STUDIO_ID },
      department: DEPARTMENT_ID
    })
    expect(fake.calls[0].body).toEqual({
      studio_id: STUDIO_ID,
      department_id: DEPARTMENT_ID
    })
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

  // Zou keeps a link given a day open to the end of that day.
  it('newShareLink sends the local day of a Date', async () => {
    fake.reply(201, { token: TOKEN })
    await kitsu.playlist.newShareLink(PLAYLIST_ID, {
      expirationDate: new Date(2026, 9, 13, 18, 30)
    })
    expect(fake.calls[0].body).toEqual({
      can_comment: true,
      expiration_date: '2026-10-13'
    })
  })

  it('newShareLink rejects an invalid Date without any request', async () => {
    await expect(
      kitsu.playlist.newShareLink(PLAYLIST_ID, {
        expirationDate: new Date('not a date')
      })
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('newShareLink leaves out a blank date and a blank password', async () => {
    fake.reply(201, { token: TOKEN })
    await kitsu.playlist.newShareLink(PLAYLIST_ID, {
      expirationDate: '',
      password: ''
    })
    expect(fake.calls[0].body).toEqual({ can_comment: true })
  })

  // Zou keeps the link, inactive, and answers it.
  it('removeShareLink revokes the link', async () => {
    const link = { id: ENTITY_ID, token: TOKEN, is_active: false }
    fake.reply(200, link)
    expect(
      await kitsu.playlist.removeShareLink({ id: PLAYLIST_ID }, TOKEN)
    ).toEqual(link)
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
      [
        { id: PLAYLIST_ID, shots: [{ entity_id: SHOT_ID }] },
        SHOT_ID,
        PREVIEW_FILE_ID
      ]
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
