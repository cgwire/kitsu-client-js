import { beforeEach, describe, expect, it } from 'vitest'

import { ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import {
  EPISODE_ID,
  OTHER_ID,
  PROJECT_ID,
  SEQUENCE_ID,
  SHOT_ID
} from '../helpers/ids.js'

const UNSORTED = [{ name: 'sh030' }, { name: 'SH010' }, { name: 'sh020' }]
const SORTED_NAMES = ['SH010', 'sh020', 'sh030']

describe('shot namespace: reads', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('getShotByName looks a shot up inside its sequence', async () => {
    fake.reply(200, [{ id: SHOT_ID, name: 'SH010' }]).reply(200, [])
    expect(
      await kitsu.shot.getShotByName({ id: SEQUENCE_ID }, 'SH010')
    ).toMatchObject({ id: SHOT_ID })
    expect(await kitsu.shot.getShotByName(SEQUENCE_ID, 'nope')).toBeNull()
    expect(fake.calls[0].path).toBe('/data/shots/all')
    expect(fake.calls[0].query.get('sequence_id')).toBe(SEQUENCE_ID)
    expect(fake.calls[0].query.get('name')).toBe('SH010')
  })

  it('allPreviewsForShot lists the previews of a shot', async () => {
    fake.reply(200, [{ id: OTHER_ID }])
    expect(await kitsu.shot.allPreviewsForShot({ id: SHOT_ID })).toEqual([
      { id: OTHER_ID }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/shots/${SHOT_ID}/preview-files`
    })
  })

  it('allShotsForProject lists the shots sorted by name', async () => {
    fake.reply(200, UNSORTED)
    const shots = await kitsu.shot.allShotsForProject({ id: PROJECT_ID })
    expect(shots.map(shot => shot.name)).toEqual(SORTED_NAMES)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/shots`
    })
  })

  it('allShotsForEpisode lists the shots sorted by name', async () => {
    fake.reply(200, UNSORTED)
    const shots = await kitsu.shot.allShotsForEpisode(EPISODE_ID)
    expect(shots.map(shot => shot.name)).toEqual(SORTED_NAMES)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/episodes/${EPISODE_ID}/shots`
    })
  })

  it('allShotsForSequence lists the shots sorted by name', async () => {
    fake.reply(200, UNSORTED)
    const shots = await kitsu.shot.allShotsForSequence({ id: SEQUENCE_ID })
    expect(shots.map(shot => shot.name)).toEqual(SORTED_NAMES)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/sequences/${SEQUENCE_ID}/shots`
    })
  })

  it('allSequencesForProject lists the sequences sorted by name', async () => {
    fake.reply(200, UNSORTED)
    const sequences = await kitsu.shot.allSequencesForProject(PROJECT_ID)
    expect(sequences.map(sequence => sequence.name)).toEqual(SORTED_NAMES)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/sequences`
    })
  })

  it('allSequencesForEpisode lists the sequences sorted by name', async () => {
    fake.reply(200, UNSORTED)
    const sequences = await kitsu.shot.allSequencesForEpisode({
      id: EPISODE_ID
    })
    expect(sequences.map(sequence => sequence.name)).toEqual(SORTED_NAMES)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/episodes/${EPISODE_ID}/sequences`
    })
  })

  it('allEpisodesForProject lists the episodes sorted by name', async () => {
    fake.reply(200, UNSORTED)
    const episodes = await kitsu.shot.allEpisodesForProject({ id: PROJECT_ID })
    expect(episodes.map(episode => episode.name)).toEqual(SORTED_NAMES)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/episodes`
    })
  })

  it('getEpisode accepts an object or an id and returns null on 404', async () => {
    fake.reply(200, { id: EPISODE_ID }).reply(404, {})
    expect(await kitsu.shot.getEpisode({ id: EPISODE_ID })).toEqual({
      id: EPISODE_ID
    })
    expect(await kitsu.shot.getEpisode(EPISODE_ID)).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/episodes/${EPISODE_ID}`
    })
  })

  it('getEpisodeByName filters by project and name', async () => {
    fake.reply(200, [{ id: EPISODE_ID, name: 'E01' }]).reply(200, [])
    expect(
      await kitsu.shot.getEpisodeByName({ id: PROJECT_ID }, 'E01')
    ).toMatchObject({ id: EPISODE_ID })
    expect(await kitsu.shot.getEpisodeByName(PROJECT_ID, 'nope')).toBeNull()
    expect(fake.calls[0].path).toBe('/data/episodes')
    expect(fake.calls[0].query.get('project_id')).toBe(PROJECT_ID)
    expect(fake.calls[0].query.get('name')).toBe('E01')
  })

  it('getEpisodeFromSequence fetches the parent episode', async () => {
    fake.reply(200, { id: EPISODE_ID })
    const sequence = { id: SEQUENCE_ID, parent_id: EPISODE_ID }
    expect(await kitsu.shot.getEpisodeFromSequence(sequence)).toEqual({
      id: EPISODE_ID
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/episodes/${EPISODE_ID}`
    })
  })

  it('getEpisodeFromSequence returns null without a parent', async () => {
    const sequence = { id: SEQUENCE_ID, parent_id: null }
    expect(await kitsu.shot.getEpisodeFromSequence(sequence)).toBeNull()
    expect(fake.calls).toHaveLength(0)
  })

  it('getEpisodeFromSequence reads the sequence when given an id', async () => {
    fake
      .reply(200, { id: SEQUENCE_ID, parent_id: EPISODE_ID })
      .reply(200, { id: EPISODE_ID })
      .reply(404, {})
    expect(await kitsu.shot.getEpisodeFromSequence(SEQUENCE_ID)).toEqual({
      id: EPISODE_ID
    })
    expect(await kitsu.shot.getEpisodeFromSequence(SEQUENCE_ID)).toBeNull()
    expect(fake.calls.map(call => call.path)).toEqual([
      `/data/sequences/${SEQUENCE_ID}`,
      `/data/episodes/${EPISODE_ID}`,
      `/data/sequences/${SEQUENCE_ID}`
    ])
  })

  it('getSequence accepts an object or an id and returns null on 404', async () => {
    fake.reply(200, { id: SEQUENCE_ID }).reply(404, {})
    expect(await kitsu.shot.getSequence({ id: SEQUENCE_ID })).toEqual({
      id: SEQUENCE_ID
    })
    expect(await kitsu.shot.getSequence(SEQUENCE_ID)).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/sequences/${SEQUENCE_ID}`
    })
  })

  it('getSequenceByName filters by project, or by episode when given', async () => {
    fake.reply(200, [{ id: SEQUENCE_ID, name: 'SQ01' }]).reply(200, [])
    expect(
      await kitsu.shot.getSequenceByName({ id: PROJECT_ID }, 'SQ01')
    ).toMatchObject({ id: SEQUENCE_ID })
    expect(
      await kitsu.shot.getSequenceByName(PROJECT_ID, 'nope', {
        episode: { id: EPISODE_ID }
      })
    ).toBeNull()
    expect(fake.calls[0].path).toBe('/data/sequences')
    expect(fake.calls[0].query.get('project_id')).toBe(PROJECT_ID)
    expect(fake.calls[0].query.get('name')).toBe('SQ01')
    expect(fake.calls[0].query.has('episode_id')).toBe(false)
    expect(fake.calls[1].query.get('episode_id')).toBe(EPISODE_ID)
    expect(fake.calls[1].query.get('name')).toBe('nope')
    expect(fake.calls[1].query.has('project_id')).toBe(false)
  })

  it('getSequenceFromShot fetches the parent sequence', async () => {
    fake.reply(200, { id: SEQUENCE_ID })
    const shot = { id: SHOT_ID, parent_id: SEQUENCE_ID }
    expect(await kitsu.shot.getSequenceFromShot(shot)).toEqual({
      id: SEQUENCE_ID
    })
    expect(fake.calls).toHaveLength(1)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/sequences/${SEQUENCE_ID}`
    })
  })

  it('getSequenceFromShot reads the shot when given an id', async () => {
    fake
      .reply(200, { id: SHOT_ID, parent_id: SEQUENCE_ID })
      .reply(200, { id: SEQUENCE_ID })
      .reply(404, {})
    expect(await kitsu.shot.getSequenceFromShot(SHOT_ID)).toEqual({
      id: SEQUENCE_ID
    })
    expect(await kitsu.shot.getSequenceFromShot({ id: SHOT_ID })).toBeNull()
    expect(fake.calls.map(call => call.path)).toEqual([
      `/data/shots/${SHOT_ID}`,
      `/data/sequences/${SEQUENCE_ID}`,
      `/data/shots/${SHOT_ID}`
    ])
  })

  it('getShot accepts an object or an id and returns null on 404', async () => {
    fake.reply(200, { id: SHOT_ID }).reply(404, {})
    expect(await kitsu.shot.getShot({ id: SHOT_ID })).toEqual({ id: SHOT_ID })
    expect(await kitsu.shot.getShot(SHOT_ID)).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/shots/${SHOT_ID}`
    })
  })

  it('getAssetInstancesForShot lists the instances linked to a shot', async () => {
    fake.reply(200, [{ id: OTHER_ID }])
    expect(await kitsu.shot.getAssetInstancesForShot({ id: SHOT_ID })).toEqual([
      { id: OTHER_ID }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/shots/${SHOT_ID}/asset-instances`
    })
  })

  it('allAssetInstancesForShot is an alias of getAssetInstancesForShot', async () => {
    fake.reply(200, [{ id: OTHER_ID }])
    expect(await kitsu.shot.allAssetInstancesForShot(SHOT_ID)).toEqual([
      { id: OTHER_ID }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/shots/${SHOT_ID}/asset-instances`
    })
  })

  it('first-match lookups reject a blank filter before any request', async () => {
    const lookups = [
      () => kitsu.shot.getSequenceByName(PROJECT_ID, ''),
      () => kitsu.shot.getEpisodeByName(PROJECT_ID, undefined),
      () => kitsu.shot.getShotByName(SEQUENCE_ID, ''),
      () => kitsu.shot.newSequence(PROJECT_ID, ''),
      () => kitsu.shot.newEpisode(PROJECT_ID, '')
    ]
    const errors = await Promise.all(
      lookups.map(lookup => lookup().catch(err => err))
    )
    errors.forEach(err => expect(err).toBeInstanceOf(ParameterError))
    expect(fake.calls).toHaveLength(0)
  })
})
