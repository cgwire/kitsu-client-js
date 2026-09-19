import { beforeEach, describe, expect, it } from 'vitest'

import { ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import {
  EPISODE_ID,
  OTHER_ID,
  PROJECT_ID,
  SEQUENCE_ID,
  SHOT_ID,
  TASK_TYPE_ID
} from '../helpers/ids.js'

describe('shot namespace: Kitsu web app functions', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('allShotsWithTasks streams the shots of a project with their tasks', async () => {
    fake.on(
      'GET',
      '/data/shots/with-tasks',
      () =>
        new Response(
          [{ shot_fields: ['id', 'tasks'] }, { id: SHOT_ID, tasks: [] }]
            .map(line => JSON.stringify(line))
            .join('\n'),
          { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } }
        )
    )
    expect(
      await kitsu.shot.allShotsWithTasks({
        project: { id: PROJECT_ID },
        episode: EPISODE_ID
      })
    ).toEqual([{ id: SHOT_ID, tasks: [] }])
    expect(fake.calls).toHaveLength(1)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/shots/with-tasks'
    })
    expect(fake.calls[0].query.get('project_id')).toBe(PROJECT_ID)
    expect(fake.calls[0].query.get('episode_id')).toBe(EPISODE_ID)
    expect(fake.calls[0].query.get('stream')).toBe('true')
    expect(fake.calls[0].query.get('compact')).toBe('true')
  })

  it('allShotsWithTasks asks again when the answer is not a stream', async () => {
    fake.reply(200, []).reply(200, [{ id: SHOT_ID, tasks: [] }])
    expect(await kitsu.shot.allShotsWithTasks()).toEqual([
      { id: SHOT_ID, tasks: [] }
    ])
    expect(fake.calls[1].path).toBe('/data/shots/with-tasks')
    expect(fake.calls[1].query.has('stream')).toBe(false)
    expect(fake.calls[1].query.has('project_id')).toBe(false)
    expect(fake.calls[1].query.has('episode_id')).toBe(false)
  })

  it('allSequencesWithTasks lists the sequences of a project with their tasks', async () => {
    fake.reply(200, [{ id: SEQUENCE_ID, tasks: [] }]).reply(200, [])
    expect(await kitsu.shot.allSequencesWithTasks({ id: PROJECT_ID })).toEqual([
      { id: SEQUENCE_ID, tasks: [] }
    ])
    await kitsu.shot.allSequencesWithTasks(PROJECT_ID, {
      episode: { id: EPISODE_ID }
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/sequences/with-tasks'
    })
    expect(fake.calls[0].query.get('project_id')).toBe(PROJECT_ID)
    expect(fake.calls[0].query.has('episode_id')).toBe(false)
    expect(fake.calls[0].query.has('stream')).toBe(false)
    expect(fake.calls[1].query.get('project_id')).toBe(PROJECT_ID)
    expect(fake.calls[1].query.get('episode_id')).toBe(EPISODE_ID)
  })

  it('allEpisodesWithTasks lists the episodes of a project with their tasks', async () => {
    fake.reply(200, [{ id: EPISODE_ID, tasks: [] }])
    expect(await kitsu.shot.allEpisodesWithTasks({ id: PROJECT_ID })).toEqual([
      { id: EPISODE_ID, tasks: [] }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/episodes/with-tasks'
    })
    expect(fake.calls[0].query.get('project_id')).toBe(PROJECT_ID)
  })

  it('the with-tasks lists of a project reject without a project', async () => {
    await expect(kitsu.shot.allSequencesWithTasks()).rejects.toThrow(
      ParameterError
    )
    await expect(kitsu.shot.allEpisodesWithTasks(null)).rejects.toThrow(
      ParameterError
    )
    expect(fake.calls).toHaveLength(0)
  })

  it('getEpisodeStats reads the task status counts per episode', async () => {
    const stats = { [EPISODE_ID]: { all: {} } }
    fake.reply(200, stats)
    expect(await kitsu.shot.getEpisodeStats({ id: PROJECT_ID })).toEqual(stats)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/episodes/stats`
    })
  })

  it('getEpisodeRetakeStats reads the retake counts per episode', async () => {
    const stats = { [EPISODE_ID]: { all: {} } }
    fake.reply(200, stats)
    expect(await kitsu.shot.getEpisodeRetakeStats(PROJECT_ID)).toEqual(stats)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/episodes/retake-stats`
    })
  })

  it('allVersionsForShot lists the data history of a shot', async () => {
    fake.reply(200, [{ id: OTHER_ID, shot_id: SHOT_ID }])
    expect(await kitsu.shot.allVersionsForShot({ id: SHOT_ID })).toEqual([
      { id: OTHER_ID, shot_id: SHOT_ID }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/shots/${SHOT_ID}/versions`
    })
  })

  it('setNbFramesFromTaskTypePreviews posts without a body', async () => {
    fake.reply(200, [{ id: SHOT_ID, nb_frames: 24 }])
    expect(
      await kitsu.shot.setNbFramesFromTaskTypePreviews(
        { id: TASK_TYPE_ID },
        { id: PROJECT_ID }
      )
    ).toEqual([{ id: SHOT_ID, nb_frames: 24 }])
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path:
        `/actions/projects/${PROJECT_ID}/task-types/${TASK_TYPE_ID}` +
        '/set-shot-nb-frames'
    })
    expect(fake.calls[0].query.has('episode_id')).toBe(false)
    expect(fake.calls[0].body).toBeUndefined()
  })

  it('setNbFramesFromTaskTypePreviews can be scoped to an episode', async () => {
    fake.reply(200, [])
    await kitsu.shot.setNbFramesFromTaskTypePreviews(TASK_TYPE_ID, PROJECT_ID, {
      episode: { id: EPISODE_ID }
    })
    expect(fake.calls[0].method).toBe('POST')
    expect(fake.calls[0].query.get('episode_id')).toBe(EPISODE_ID)
  })
})
