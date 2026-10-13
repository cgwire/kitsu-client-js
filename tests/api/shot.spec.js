import { beforeEach, describe, expect, it } from 'vitest'

import { ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import {
  ASSET_ID,
  EPISODE_ID,
  OTHER_ID,
  PROJECT_ID,
  SEQUENCE_ID,
  SHOT_ID,
  TASK_TYPE_ID
} from '../helpers/ids.js'

const UNSORTED = [{ name: 'sh030' }, { name: 'SH010' }, { name: 'sh020' }]
const SORTED_NAMES = ['SH010', 'sh020', 'sh030']
const OTHER_EPISODE_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

describe('shot namespace: reads', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('getShotByName looks a shot up inside its sequence', async () => {
    fake
      .reply(200, [{ id: SHOT_ID, name: 'SH010', parent_id: SEQUENCE_ID }])
      .reply(200, [])
    expect(
      await kitsu.shot.getShotByName({ id: SEQUENCE_ID }, 'SH010')
    ).toMatchObject({ id: SHOT_ID })
    expect(await kitsu.shot.getShotByName(SEQUENCE_ID, 'nope')).toBeNull()
    expect(fake.calls[0].path).toBe('/data/shots/all')
    expect(fake.calls[0].query.get('sequence_id')).toBe(SEQUENCE_ID)
    expect(fake.calls[0].query.get('name')).toBe('SH010')
  })

  // Zou matches a name filter with ILIKE: any case, _ and % as wildcards.
  it('getShotByName keeps the exact name among the ILIKE matches', async () => {
    const nearName = { id: OTHER_ID, name: 'SH-010', parent_id: SEQUENCE_ID }
    fake
      .reply(200, [
        nearName,
        { id: SHOT_ID, name: 'SH_010', parent_id: SEQUENCE_ID }
      ])
      .reply(200, [nearName])
    expect(await kitsu.shot.getShotByName(SEQUENCE_ID, 'SH_010')).toMatchObject(
      { id: SHOT_ID }
    )
    expect(await kitsu.shot.getShotByName(SEQUENCE_ID, 'SH_010')).toBeNull()
  })

  it('getShotByName ignores the case like gazu, the exact spelling first', async () => {
    const upper = { id: SHOT_ID, name: 'SH010', parent_id: SEQUENCE_ID }
    const lower = { id: OTHER_ID, name: 'sh010', parent_id: SEQUENCE_ID }
    fake.reply(200, [upper]).reply(200, [upper, lower])
    expect(await kitsu.shot.getShotByName(SEQUENCE_ID, 'sh010')).toEqual(upper)
    expect(await kitsu.shot.getShotByName(SEQUENCE_ID, 'sh010')).toEqual(lower)
  })

  it('getShotByName keeps the shots of the sequence only', async () => {
    fake.reply(200, [{ id: OTHER_ID, name: 'SH010', parent_id: OTHER_ID }])
    expect(await kitsu.shot.getShotByName(SEQUENCE_ID, 'SH010')).toBeNull()
  })

  it('getShotByName gives null when the sequence does not exist', async () => {
    fake.reply(404, { message: 'Sequence not found' })
    expect(await kitsu.shot.getShotByName(SEQUENCE_ID, 'SH010')).toBeNull()
  })

  it('allPreviewsForShot groups the previews of a shot by task type', async () => {
    const previews = { [TASK_TYPE_ID]: [{ id: OTHER_ID, revision: 2 }] }
    fake.reply(200, previews).reply(200, {})
    expect(await kitsu.shot.allPreviewsForShot({ id: SHOT_ID })).toEqual(
      previews
    )
    // A shot without any preview: an empty dict, not a list.
    expect(await kitsu.shot.allPreviewsForShot(SHOT_ID)).toEqual({})
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

  // A vendor gets every episode they are assigned to, whatever the name.
  it('getEpisodeByName keeps only the episode with that name', async () => {
    fake.reply(200, [
      { id: OTHER_ID, name: 'E01', project_id: PROJECT_ID },
      { id: EPISODE_ID, name: 'E03', project_id: PROJECT_ID }
    ])
    expect(await kitsu.shot.getEpisodeByName(PROJECT_ID, 'E02')).toBeNull()
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
    fake
      .reply(200, [{ id: SEQUENCE_ID, name: 'SQ01', parent_id: null }])
      .reply(200, [])
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

  // A vendor gets every sequence they are assigned to, whatever the episode
  // and the name.
  it('getSequenceByName keeps the sequence of the given episode', async () => {
    fake.reply(200, [
      { id: OTHER_ID, name: 'SQ01', parent_id: OTHER_EPISODE_ID },
      { id: SEQUENCE_ID, name: 'SQ01', parent_id: EPISODE_ID },
      { id: SHOT_ID, name: 'SQ02', parent_id: EPISODE_ID }
    ])
    expect(
      await kitsu.shot.getSequenceByName(PROJECT_ID, 'SQ01', {
        episode: EPISODE_ID
      })
    ).toMatchObject({ id: SEQUENCE_ID })
  })

  // Zou looks for the same name outside any episode before creating one.
  it('getSequenceByName without episode matches a sequence outside any episode', async () => {
    const inEpisode = { id: OTHER_ID, name: 'SQ01', parent_id: EPISODE_ID }
    const outside = { id: SEQUENCE_ID, name: 'SQ01', parent_id: null }
    fake.reply(200, [inEpisode]).reply(200, [inEpisode, outside])
    expect(await kitsu.shot.getSequenceByName(PROJECT_ID, 'SQ01')).toBeNull()
    expect(await kitsu.shot.getSequenceByName(PROJECT_ID, 'SQ01')).toEqual(
      outside
    )
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

  it('getAssetInstancesForShot groups the instances of a shot by asset', async () => {
    const instances = { [ASSET_ID]: [{ id: OTHER_ID, asset_id: ASSET_ID }] }
    fake.reply(200, instances)
    expect(await kitsu.shot.getAssetInstancesForShot({ id: SHOT_ID })).toEqual(
      instances
    )
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/shots/${SHOT_ID}/asset-instances`
    })
  })

  it('allAssetInstancesForShot is an alias of getAssetInstancesForShot', async () => {
    const instances = { [ASSET_ID]: [{ id: OTHER_ID, asset_id: ASSET_ID }] }
    fake.reply(200, instances)
    expect(await kitsu.shot.allAssetInstancesForShot(SHOT_ID)).toEqual(
      instances
    )
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
      () => kitsu.shot.newEpisode(PROJECT_ID, ''),
      // A blank episode is not a missing one: it is no id.
      () => kitsu.shot.getSequenceByName(PROJECT_ID, 'SQ01', { episode: '' }),
      () => kitsu.shot.newSequence(PROJECT_ID, 'SQ01', { episode: '' })
    ]
    const errors = await Promise.all(
      lookups.map(lookup => lookup().catch(err => err))
    )
    errors.forEach(err => expect(err).toBeInstanceOf(ParameterError))
    expect(fake.calls).toHaveLength(0)
  })
})
