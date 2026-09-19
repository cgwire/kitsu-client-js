import { beforeEach, describe, expect, it } from 'vitest'

import { makeClient } from '../helpers/client.js'
import {
  ASSET_ID,
  ASSET_TYPE_ID,
  PROJECT_ID,
  SCENE_ID,
  SEQUENCE_ID,
  SHOT_ID
} from '../helpers/ids.js'

const SORTED_LISTS = [
  ['allOpenProjects', [], '/data/user/projects/open'],
  [
    'allAssetTypesForProject',
    [PROJECT_ID],
    `/data/user/projects/${PROJECT_ID}/asset-types`
  ],
  [
    'allAssetsForAssetTypeAndProject',
    [PROJECT_ID, ASSET_TYPE_ID],
    `/data/user/projects/${PROJECT_ID}/asset-types/${ASSET_TYPE_ID}/assets`
  ],
  ['allTasksForAsset', [ASSET_ID], `/data/user/assets/${ASSET_ID}/tasks`],
  ['allTasksForShot', [SHOT_ID], `/data/user/shots/${SHOT_ID}/tasks`],
  ['allTasksForScene', [SCENE_ID], `/data/user/scenes/${SCENE_ID}/tasks`],
  [
    'allTasksForSequence',
    [SEQUENCE_ID],
    `/data/user/sequences/${SEQUENCE_ID}/tasks`
  ],
  [
    'allTaskTypesForAsset',
    [ASSET_ID],
    `/data/user/assets/${ASSET_ID}/task-types`
  ],
  ['allTaskTypesForShot', [SHOT_ID], `/data/user/shots/${SHOT_ID}/task-types`],
  [
    'allTaskTypesForScene',
    [SCENE_ID],
    `/data/user/scenes/${SCENE_ID}/task-types`
  ],
  [
    'allTaskTypesForSequence',
    [SEQUENCE_ID],
    `/data/user/sequences/${SEQUENCE_ID}/task-types`
  ],
  [
    'allSequencesForProject',
    [PROJECT_ID],
    `/data/user/projects/${PROJECT_ID}/sequences`
  ],
  [
    'allEpisodesForProject',
    [PROJECT_ID],
    `/data/user/projects/${PROJECT_ID}/episodes`
  ],
  [
    'allShotsForSequence',
    [SEQUENCE_ID],
    `/data/user/sequences/${SEQUENCE_ID}/shots`
  ],
  [
    'allScenesForSequence',
    [SEQUENCE_ID],
    `/data/user/sequences/${SEQUENCE_ID}/scenes`
  ]
]

const RAW_LISTS = [
  ['allTasksToDo', '/data/user/tasks'],
  ['allDoneTasks', '/data/user/done-tasks'],
  ['allTasksRequiringFeedback', '/data/user/tasks-to-check']
]

describe('user namespace: data scoped to the current user', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('allOpenProjects lists the open projects of the current user', async () => {
    fake.reply(200, [{ id: PROJECT_ID }])
    expect(await kitsu.user.allOpenProjects()).toEqual([{ id: PROJECT_ID }])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/user/projects/open'
    })
  })

  it.each(SORTED_LISTS)(
    '%s accepts ids or objects and sorts by name',
    async (name, ids, path) => {
      const unsorted = [{ name: 'beta' }, { name: 'Alpha' }, { name: 'gamma' }]
      fake.reply(200, unsorted).reply(200, [])
      const entries = await kitsu.user[name](...ids)
      await kitsu.user[name](...ids.map(id => ({ id })))
      expect(entries.map(entry => entry.name)).toEqual([
        'Alpha',
        'beta',
        'gamma'
      ])
      expect(fake.calls[0]).toMatchObject({ method: 'GET', path })
      expect(fake.calls[1].path).toBe(path)
    }
  )

  it.each(RAW_LISTS)('%s keeps the order of the API', async (name, path) => {
    const tasks = [{ name: 'beta' }, { name: 'Alpha' }]
    fake.reply(200, tasks)
    expect(await kitsu.user[name]()).toEqual(tasks)
    expect(fake.calls[0]).toMatchObject({ method: 'GET', path })
  })

  it('getContext returns the user context, null on 404', async () => {
    fake.reply(200, { projects: [] }).reply(404, {})
    expect(await kitsu.user.getContext()).toEqual({ projects: [] })
    expect(await kitsu.user.getContext()).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/user/context'
    })
  })
})
