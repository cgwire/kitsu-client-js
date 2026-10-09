import { beforeEach, describe, expect, it } from 'vitest'

import { NotFoundError, ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import {
  EPISODE_ID,
  OTHER_ID,
  PROJECT_ID,
  SEQUENCE_ID,
  SHOT_ID
} from '../helpers/ids.js'

describe('shot namespace: writes', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('newSequence creates the sequence when the name is free', async () => {
    fake.reply(200, []).reply(201, { id: SEQUENCE_ID, name: 'SQ01' })
    expect(
      await kitsu.shot.newSequence({ id: PROJECT_ID }, 'SQ01')
    ).toMatchObject({ id: SEQUENCE_ID })
    expect(fake.calls[0].path).toBe('/data/sequences')
    expect(fake.calls[0].query.get('project_id')).toBe(PROJECT_ID)
    expect(fake.calls[0].query.get('name')).toBe('SQ01')
    expect(fake.calls[1]).toMatchObject({
      method: 'POST',
      path: `/data/projects/${PROJECT_ID}/sequences`
    })
    expect(fake.calls[1].body).toEqual({ name: 'SQ01' })
  })

  it('newSequence scopes the sequence to an episode', async () => {
    fake.reply(200, []).reply(201, { id: SEQUENCE_ID })
    await kitsu.shot.newSequence(PROJECT_ID, 'SQ01', {
      episode: { id: EPISODE_ID }
    })
    expect(fake.calls[0].query.get('episode_id')).toBe(EPISODE_ID)
    expect(fake.calls[1].body).toEqual({ name: 'SQ01', episode_id: EPISODE_ID })
  })

  it('newSequence returns the existing sequence instead of creating', async () => {
    fake.reply(200, [{ id: SEQUENCE_ID, name: 'SQ01' }])
    expect(await kitsu.shot.newSequence(PROJECT_ID, 'SQ01')).toEqual({
      id: SEQUENCE_ID,
      name: 'SQ01'
    })
    expect(fake.calls).toHaveLength(1)
  })

  it('newShot creates a bare shot when the name is free', async () => {
    fake.reply(200, []).reply(201, { id: SHOT_ID, name: 'SH010' })
    expect(
      await kitsu.shot.newShot({ id: PROJECT_ID }, { id: SEQUENCE_ID }, 'SH010')
    ).toMatchObject({ id: SHOT_ID })
    expect(fake.calls[0].path).toBe('/data/shots/all')
    expect(fake.calls[0].query.get('sequence_id')).toBe(SEQUENCE_ID)
    expect(fake.calls[0].query.get('name')).toBe('SH010')
    expect(fake.calls[1]).toMatchObject({
      method: 'POST',
      path: `/data/projects/${PROJECT_ID}/shots`
    })
    expect(fake.calls[1].body).toEqual({
      name: 'SH010',
      data: {},
      sequence_id: SEQUENCE_ID
    })
  })

  it('newShot sends frames, description and metadata', async () => {
    fake.reply(200, []).reply(201, { id: SHOT_ID })
    const data = { camera: 'A' }
    await kitsu.shot.newShot(PROJECT_ID, SEQUENCE_ID, 'SH010', {
      nbFrames: 24,
      frameIn: 0,
      frameOut: 23,
      description: 'Opening',
      data
    })
    expect(fake.calls[1].body).toEqual({
      name: 'SH010',
      data: { camera: 'A', frame_in: 0, frame_out: 23 },
      sequence_id: SEQUENCE_ID,
      nb_frames: 24,
      description: 'Opening'
    })
    expect(data).toEqual({ camera: 'A' })
  })

  it('newShot returns the existing shot instead of creating', async () => {
    fake.reply(200, [{ id: SHOT_ID, name: 'SH010' }])
    expect(await kitsu.shot.newShot(PROJECT_ID, SEQUENCE_ID, 'SH010')).toEqual({
      id: SHOT_ID,
      name: 'SH010'
    })
    expect(fake.calls).toHaveLength(1)
  })

  it('newShot rejects a malformed project before any request', async () => {
    await expect(
      kitsu.shot.newShot('not-a-uuid', SEQUENCE_ID, 'SH010')
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('updateShot saves the shot through the entity route', async () => {
    fake.reply(200, { id: SHOT_ID, name: 'SH011' })
    const shot = { id: SHOT_ID, name: 'SH011' }
    expect(await kitsu.shot.updateShot(shot)).toEqual(shot)
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/entities/${SHOT_ID}`
    })
    expect(fake.calls[0].body).toEqual({ name: 'SH011' })
    expect(shot).toEqual({ id: SHOT_ID, name: 'SH011' })
  })

  it('updateSequence saves the sequence through the entity route', async () => {
    fake.reply(200, { id: SEQUENCE_ID, name: 'SQ02' })
    await kitsu.shot.updateSequence({ id: SEQUENCE_ID, name: 'SQ02' })
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/entities/${SEQUENCE_ID}`
    })
    expect(fake.calls[0].body).toEqual({ name: 'SQ02' })
  })

  it('updateEpisode saves the episode through the entity route', async () => {
    fake.reply(200, { id: EPISODE_ID, name: 'E02' })
    await kitsu.shot.updateEpisode({ id: EPISODE_ID, name: 'E02' })
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/entities/${EPISODE_ID}`
    })
    expect(fake.calls[0].body).toEqual({ name: 'E02' })
  })

  it('updateShotData merges the new keys into the stored metadata', async () => {
    fake
      .reply(200, { id: SHOT_ID, name: 'SH010', data: { fps: 24, lens: 35 } })
      .reply(200, { id: SHOT_ID })
    const data = { lens: 50 }
    await kitsu.shot.updateShotData({ id: SHOT_ID }, data)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/shots/${SHOT_ID}`
    })
    expect(fake.calls[1]).toMatchObject({
      method: 'PUT',
      path: `/data/entities/${SHOT_ID}`
    })
    expect(fake.calls[1].body).toEqual({ data: { fps: 24, lens: 50 } })
    expect(data).toEqual({ lens: 50 })
  })

  it('updateShotData copes with a shot without metadata', async () => {
    fake.reply(200, { id: SHOT_ID, data: null }).reply(200, { id: SHOT_ID })
    await kitsu.shot.updateShotData(SHOT_ID, { lens: 50 })
    expect(fake.calls[1].body).toEqual({ data: { lens: 50 } })
  })

  it('updateShotData rejects when the shot does not exist', async () => {
    fake.reply(404, {})
    await expect(
      kitsu.shot.updateShotData(SHOT_ID, { lens: 50 })
    ).rejects.toBeInstanceOf(NotFoundError)
    expect(fake.calls).toHaveLength(1)
  })

  it('updateSequenceData merges the new keys into the stored metadata', async () => {
    fake
      .reply(200, { id: SEQUENCE_ID, data: { mood: 'dark' } })
      .reply(200, { id: SEQUENCE_ID })
    await kitsu.shot.updateSequenceData(SEQUENCE_ID, { act: 2 })
    expect(fake.calls[0].path).toBe(`/data/sequences/${SEQUENCE_ID}`)
    expect(fake.calls[1]).toMatchObject({
      method: 'PUT',
      path: `/data/entities/${SEQUENCE_ID}`
    })
    expect(fake.calls[1].body).toEqual({ data: { mood: 'dark', act: 2 } })
  })

  it('updateEpisodeData merges the new keys into the stored metadata', async () => {
    fake
      .reply(200, { id: EPISODE_ID, data: { air: '2026' } })
      .reply(200, { id: EPISODE_ID })
    await kitsu.shot.updateEpisodeData({ id: EPISODE_ID }, { director: 'Ann' })
    expect(fake.calls[0].path).toBe(`/data/episodes/${EPISODE_ID}`)
    expect(fake.calls[1]).toMatchObject({
      method: 'PUT',
      path: `/data/entities/${EPISODE_ID}`
    })
    expect(fake.calls[1].body).toEqual({
      data: { air: '2026', director: 'Ann' }
    })
  })

  it('removeShot deletes the shot, forcing on demand', async () => {
    fake.reply(204).reply(204)
    await kitsu.shot.removeShot(SHOT_ID)
    await kitsu.shot.removeShot({ id: SHOT_ID }, { force: true })
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/shots/${SHOT_ID}`
    })
    expect(fake.calls[0].query.has('force')).toBe(false)
    expect(fake.calls[1].query.get('force')).toBe('true')
  })

  it('restoreShot uncancels the shot', async () => {
    fake.reply(200, { id: SHOT_ID, canceled: false })
    expect(await kitsu.shot.restoreShot({ id: SHOT_ID })).toMatchObject({
      canceled: false
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/shots/${SHOT_ID}`
    })
    expect(fake.calls[0].body).toEqual({ canceled: false })
  })

  it('newEpisode creates the episode when the name is free', async () => {
    fake.reply(200, []).reply(201, { id: EPISODE_ID, name: 'E01' })
    expect(
      await kitsu.shot.newEpisode({ id: PROJECT_ID }, 'E01')
    ).toMatchObject({ id: EPISODE_ID })
    expect(fake.calls[0].path).toBe('/data/episodes')
    expect(fake.calls[0].query.get('project_id')).toBe(PROJECT_ID)
    expect(fake.calls[0].query.get('name')).toBe('E01')
    expect(fake.calls[1]).toMatchObject({
      method: 'POST',
      path: `/data/projects/${PROJECT_ID}/episodes`
    })
    expect(fake.calls[1].body).toEqual({ name: 'E01' })
  })

  it('newEpisode returns the existing episode instead of creating', async () => {
    fake.reply(200, [{ id: EPISODE_ID, name: 'E01' }])
    expect(await kitsu.shot.newEpisode(PROJECT_ID, 'E01')).toEqual({
      id: EPISODE_ID,
      name: 'E01'
    })
    expect(fake.calls).toHaveLength(1)
  })

  it('removeEpisode deletes the episode, forcing on demand', async () => {
    fake.reply(204).reply(204)
    await kitsu.shot.removeEpisode({ id: EPISODE_ID })
    await kitsu.shot.removeEpisode(EPISODE_ID, { force: true })
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/episodes/${EPISODE_ID}`
    })
    expect(fake.calls[0].query.has('force')).toBe(false)
    expect(fake.calls[1].query.get('force')).toBe('true')
  })

  it('removeSequence deletes the sequence, forcing on demand', async () => {
    fake.reply(204).reply(204)
    await kitsu.shot.removeSequence({ id: SEQUENCE_ID })
    await kitsu.shot.removeSequence(SEQUENCE_ID, { force: true })
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/sequences/${SEQUENCE_ID}`
    })
    expect(fake.calls[0].query.has('force')).toBe(false)
    expect(fake.calls[1].query.get('force')).toBe('true')
  })

  it('addAssetInstanceToShot links the instance to the shot', async () => {
    fake.reply(201, { id: SHOT_ID })
    expect(
      await kitsu.shot.addAssetInstanceToShot({ id: SHOT_ID }, { id: OTHER_ID })
    ).toEqual({ id: SHOT_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/data/shots/${SHOT_ID}/asset-instances`
    })
    expect(fake.calls[0].body).toEqual({ asset_instance_id: OTHER_ID })
  })

  it('removeAssetInstanceFromShot unlinks the instance', async () => {
    fake.reply(204)
    await kitsu.shot.removeAssetInstanceFromShot(SHOT_ID, { id: OTHER_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/shots/${SHOT_ID}/asset-instances/${OTHER_ID}`
    })
  })
})
