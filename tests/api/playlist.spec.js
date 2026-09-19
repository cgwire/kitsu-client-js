import { beforeEach, describe, expect, it } from 'vitest'

import { NotFoundError, ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import {
  BUILD_JOB_ID,
  ENTITY_ID,
  EPISODE_ID,
  OTHER_ID,
  PLAYLIST_ID,
  PROJECT_ID,
  SHOT_ID
} from '../helpers/ids.js'

const rawResponse = () => new Response('bytes')

describe('playlist namespace: reads', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('allPlaylists lists every playlist, sorted by name', async () => {
    fake.reply(200, [{ name: 'Weekly' }, { name: 'dailies' }])
    expect(await kitsu.playlist.allPlaylists()).toEqual([
      { name: 'dailies' },
      { name: 'Weekly' }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/playlists'
    })
  })

  it('allShotsForPlaylist returns the entries of the playlist', async () => {
    fake.reply(200, {
      id: PLAYLIST_ID,
      shots: [
        { entity_id: SHOT_ID, name: 'SH020' },
        { entity_id: OTHER_ID, name: 'SH010' }
      ]
    })
    expect(
      await kitsu.playlist.allShotsForPlaylist({ id: PLAYLIST_ID })
    ).toEqual([
      { entity_id: OTHER_ID, name: 'SH010' },
      { entity_id: SHOT_ID, name: 'SH020' }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/playlists/${PLAYLIST_ID}`
    })
  })

  it('allShotsForPlaylist gives an empty list for an empty playlist', async () => {
    fake.reply(200, { id: PLAYLIST_ID, shots: null })
    expect(await kitsu.playlist.allShotsForPlaylist(PLAYLIST_ID)).toEqual([])
  })

  it('allShotsForPlaylist rejects when the playlist is missing', async () => {
    fake.reply(404, {})
    await expect(
      kitsu.playlist.allShotsForPlaylist(PLAYLIST_ID)
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it('allPlaylistsForProject lists the first page, sorted by name', async () => {
    fake.reply(200, [{ name: 'b' }, { name: 'A' }])
    expect(
      await kitsu.playlist.allPlaylistsForProject({ id: PROJECT_ID })
    ).toEqual([{ name: 'A' }, { name: 'b' }])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/playlists`
    })
    expect(fake.calls[0].query.get('page')).toBe('1')
  })

  it('allPlaylistsForProject asks for the given page', async () => {
    fake.reply(200, [])
    await kitsu.playlist.allPlaylistsForProject(PROJECT_ID, { page: 3 })
    expect(fake.calls[0].query.get('page')).toBe('3')
  })

  it('allPlaylistsForEpisode uses the project of the episode object', async () => {
    fake.reply(200, [{ name: 'b' }, { name: 'A' }])
    expect(
      await kitsu.playlist.allPlaylistsForEpisode({
        id: EPISODE_ID,
        project_id: PROJECT_ID
      })
    ).toEqual([{ name: 'A' }, { name: 'b' }])
    expect(fake.calls).toHaveLength(1)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/episodes/${EPISODE_ID}/playlists`
    })
  })

  it('allPlaylistsForEpisode reads the episode given as an id', async () => {
    fake.reply(200, { id: EPISODE_ID, project_id: PROJECT_ID }).reply(200, [])
    await kitsu.playlist.allPlaylistsForEpisode(EPISODE_ID)
    expect(fake.calls.map(call => call.path)).toEqual([
      `/data/episodes/${EPISODE_ID}`,
      `/data/projects/${PROJECT_ID}/episodes/${EPISODE_ID}/playlists`
    ])
  })

  it('allPlaylistsForEpisode rejects when the episode is missing', async () => {
    fake.reply(404, {})
    await expect(
      kitsu.playlist.allPlaylistsForEpisode(EPISODE_ID)
    ).rejects.toBeInstanceOf(NotFoundError)
    expect(fake.calls).toHaveLength(1)
  })

  it('getPlaylist reads the playlist', async () => {
    fake.reply(200, { id: PLAYLIST_ID })
    expect(await kitsu.playlist.getPlaylist({ id: PLAYLIST_ID })).toEqual({
      id: PLAYLIST_ID
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/playlists/${PLAYLIST_ID}`
    })
  })

  it('getPlaylist gives null on a 404', async () => {
    fake.reply(404, {})
    expect(await kitsu.playlist.getPlaylist(PLAYLIST_ID)).toBeNull()
  })

  it('getPlaylistByName looks the name up in the project', async () => {
    fake.reply(200, [{ id: PLAYLIST_ID, name: 'Dailies' }])
    expect(
      await kitsu.playlist.getPlaylistByName({ id: PROJECT_ID }, 'Dailies')
    ).toEqual({ id: PLAYLIST_ID, name: 'Dailies' })
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/playlists'
    })
    expect(fake.calls[0].query.get('project_id')).toBe(PROJECT_ID)
    expect(fake.calls[0].query.get('name')).toBe('Dailies')
  })

  it('getPlaylistByName gives null when nothing matches', async () => {
    fake.reply(200, [])
    expect(
      await kitsu.playlist.getPlaylistByName(PROJECT_ID, 'Dailies')
    ).toBeNull()
  })

  it('getPlaylistByName rejects a blank name without any request', async () => {
    await expect(
      kitsu.playlist.getPlaylistByName(PROJECT_ID, '')
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('getEntityPreviewFiles reads the previews grouped by task type', async () => {
    fake.reply(200, { [OTHER_ID]: [{ id: ENTITY_ID }] })
    expect(await kitsu.playlist.getEntityPreviewFiles({ id: SHOT_ID })).toEqual(
      { [OTHER_ID]: [{ id: ENTITY_ID }] }
    )
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/playlists/entities/${SHOT_ID}/preview-files`
    })
  })

  it('getBuildJob reads the build job of the playlist', async () => {
    fake.reply(200, { id: BUILD_JOB_ID })
    expect(
      await kitsu.playlist.getBuildJob(
        { id: PLAYLIST_ID },
        { id: BUILD_JOB_ID }
      )
    ).toEqual({ id: BUILD_JOB_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/playlists/${PLAYLIST_ID}/jobs/${BUILD_JOB_ID}`
    })
  })

  it('getBuildJob gives null on a 404', async () => {
    fake.reply(404, {})
    expect(
      await kitsu.playlist.getBuildJob(PLAYLIST_ID, BUILD_JOB_ID)
    ).toBeNull()
  })

  it('allBuildJobsForProject lists the build jobs', async () => {
    fake.reply(200, [{ id: BUILD_JOB_ID }])
    expect(
      await kitsu.playlist.allBuildJobsForProject({ id: PROJECT_ID })
    ).toEqual([{ id: BUILD_JOB_ID }])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/build-jobs`
    })
  })

  it('allShareLinksForPlaylist lists the active share links', async () => {
    fake.reply(200, [{ token: 'abc' }])
    expect(
      await kitsu.playlist.allShareLinksForPlaylist({ id: PLAYLIST_ID })
    ).toEqual([{ token: 'abc' }])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/playlists/${PLAYLIST_ID}/share`
    })
  })

  it('downloadPlaylistBuild returns the raw response of the movie', async () => {
    const path = `/data/playlists/${PLAYLIST_ID}/jobs/${BUILD_JOB_ID}/build/mp4`
    fake.on('GET', path, rawResponse)
    const response = await kitsu.playlist.downloadPlaylistBuild(
      { id: PLAYLIST_ID },
      { id: BUILD_JOB_ID }
    )
    expect(response).toBeInstanceOf(Response)
    expect(await response.text()).toBe('bytes')
    expect(fake.calls[0]).toMatchObject({ method: 'GET', path })
  })

  it('downloadPlaylistZip returns the raw response of the archive', async () => {
    const path = `/data/playlists/${PLAYLIST_ID}/download/zip`
    fake.on('GET', path, rawResponse)
    const response = await kitsu.playlist.downloadPlaylistZip(PLAYLIST_ID)
    expect(response).toBeInstanceOf(Response)
    expect(await response.text()).toBe('bytes')
    expect(fake.calls[0]).toMatchObject({ method: 'GET', path })
  })

  // The core aborts its own request signal as soon as the caller signal is
  // aborted: an aborted request signal proves the option went through.
  it.each([
    ['allPlaylists', []],
    ['allShotsForPlaylist', [PLAYLIST_ID]],
    ['allPlaylistsForProject', [PROJECT_ID]],
    ['allPlaylistsForEpisode', [{ id: EPISODE_ID, project_id: PROJECT_ID }]],
    ['getPlaylist', [PLAYLIST_ID]],
    ['getPlaylistByName', [PROJECT_ID, 'Dailies']],
    ['getEntityPreviewFiles', [SHOT_ID]],
    ['getBuildJob', [PLAYLIST_ID, BUILD_JOB_ID]],
    ['allBuildJobsForProject', [PROJECT_ID]],
    ['allShareLinksForPlaylist', [PLAYLIST_ID]],
    ['downloadPlaylistBuild', [PLAYLIST_ID, BUILD_JOB_ID]],
    ['downloadPlaylistZip', [PLAYLIST_ID]]
  ])('%s forwards the caller signal', async (name, args) => {
    const controller = new AbortController()
    controller.abort()
    fake.reply(200, [])
    await kitsu.playlist[name](...args, { signal: controller.signal })
    expect(fake.calls[0].signal.aborted).toBe(true)
  })
})
