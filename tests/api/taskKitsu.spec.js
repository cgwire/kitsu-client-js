import { beforeEach, describe, expect, it } from 'vitest'

import { ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import {
  ASSET_ID,
  COMMENT_ID,
  EPISODE_ID,
  OTHER_ID,
  PERSON_ID,
  PROJECT_ID,
  SHOT_ID,
  TASK_ID,
  TASK_STATUS_ID,
  TASK_TYPE_ID
} from '../helpers/ids.js'

const CSV = 'Parent;Entity;Estimation\nSQ01;SH01;2\n'
const CREATE_TASKS = `/actions/projects/${PROJECT_ID}/task-types/${TASK_TYPE_ID}`

describe('task namespace: Kitsu store API coverage', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('clearTimeSpent deletes the time logged by a person on a day', async () => {
    fake.reply(201, { id: OTHER_ID })
    expect(
      await kitsu.task.clearTimeSpent(
        { id: TASK_ID },
        { id: PERSON_ID },
        new Date(2026, 8, 19)
      )
    ).toEqual({ id: OTHER_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/actions/tasks/${TASK_ID}/time-spents/2026-09-19/persons/${PERSON_ID}`
    })
  })

  it('clearTimeSpent rejects a malformed day', async () => {
    await expect(
      kitsu.task.clearTimeSpent(TASK_ID, PERSON_ID, '2026/09/19')
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('allTasks sends the filters as the query', async () => {
    fake.reply(200, [{ id: TASK_ID }]).reply(200, [])
    expect(
      await kitsu.task.allTasks({
        filters: {
          project_id: PROJECT_ID,
          task_status_id: TASK_STATUS_ID,
          assigner_id: null
        }
      })
    ).toEqual([{ id: TASK_ID }])
    expect(await kitsu.task.allTasks()).toEqual([])
    expect(fake.calls[0]).toMatchObject({ method: 'GET', path: '/data/tasks' })
    expect(Object.fromEntries(fake.calls[0].query)).toEqual({
      project_id: PROJECT_ID,
      task_status_id: TASK_STATUS_ID
    })
    expect([...fake.calls[1].query.keys()]).toEqual([])
  })

  it('getOpenTasksBurndown sends the open tasks filters as the query', async () => {
    fake.reply(200, [{ date: '2026-09-19', open: 3 }]).reply(200, [])
    expect(
      await kitsu.task.getOpenTasksBurndown({
        filters: { project_id: PROJECT_ID, person_id: 'unassigned' }
      })
    ).toEqual([{ date: '2026-09-19', open: 3 }])
    await kitsu.task.getOpenTasksBurndown()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/tasks/open-tasks/burndown'
    })
    expect(Object.fromEntries(fake.calls[0].query)).toEqual({
      project_id: PROJECT_ID,
      person_id: 'unassigned'
    })
    expect([...fake.calls[1].query.keys()]).toEqual([])
  })

  it('removeTaskComment deletes the comment through its task', async () => {
    fake.reply(204)
    await kitsu.task.removeTaskComment({ id: TASK_ID }, { id: COMMENT_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/tasks/${TASK_ID}/comments/${COMMENT_ID}`
    })
  })

  it.each(['assets', 'shots', 'edits', 'concepts'])(
    'createTasks posts the entity ids on the %s route',
    async type => {
      fake.reply(201, [{ id: TASK_ID }])
      expect(
        await kitsu.task.createTasks(
          { id: PROJECT_ID },
          { id: TASK_TYPE_ID },
          type,
          { entities: [{ id: SHOT_ID }, ASSET_ID] }
        )
      ).toEqual([{ id: TASK_ID }])
      expect(fake.calls[0]).toMatchObject({
        method: 'POST',
        path: `${CREATE_TASKS}/${type}/create-tasks`,
        body: [SHOT_ID, ASSET_ID]
      })
      expect([...fake.calls[0].query.keys()]).toEqual([])
    }
  )

  it.each([
    ['episodes', 'episode'],
    ['sequences', 'sequence']
  ])(
    'createTasks names the entity type in the path for %s',
    async (type, entityType) => {
      fake.reply(201, []).reply(201, [])
      await kitsu.task.createTasks(PROJECT_ID, TASK_TYPE_ID, type, {
        entities: [EPISODE_ID]
      })
      await kitsu.task.createTasks(PROJECT_ID, TASK_TYPE_ID, type, {
        entity: { id: EPISODE_ID }
      })
      expect(fake.calls[0]).toMatchObject({
        method: 'POST',
        path: `${CREATE_TASKS}/create-tasks/${entityType}`,
        body: [EPISODE_ID]
      })
      // Zou reads no id parameter on this route: the body is the only way to
      // target one entity.
      expect(fake.calls[1].body).toEqual([EPISODE_ID])
      expect([...fake.calls[1].query.keys()]).toEqual([])
    }
  )

  it('createTasks sends a single entity as the id parameter', async () => {
    fake.reply(201, [{ id: TASK_ID }])
    await kitsu.task.createTasks(PROJECT_ID, TASK_TYPE_ID, 'shots', {
      entity: { id: SHOT_ID }
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `${CREATE_TASKS}/shots/create-tasks`,
      body: {}
    })
    expect(Object.fromEntries(fake.calls[0].query)).toEqual({ id: SHOT_ID })
  })

  it('createTasks targets every entity when none is given', async () => {
    fake.reply(201, [])
    await kitsu.task.createTasks(PROJECT_ID, TASK_TYPE_ID, 'assets')
    expect(fake.calls[0].body).toEqual([])
  })

  it.each([undefined, 'shot', 'persons', '../shots'])(
    'createTasks rejects the unknown type %s',
    async type => {
      await expect(
        kitsu.task.createTasks(PROJECT_ID, TASK_TYPE_ID, type)
      ).rejects.toBeInstanceOf(ParameterError)
      expect(fake.calls).toHaveLength(0)
    }
  )

  it('setTaskMainPreview uses the last preview as the entity thumbnail', async () => {
    fake.reply(200, { id: SHOT_ID })
    expect(await kitsu.task.setTaskMainPreview({ id: TASK_ID })).toEqual({
      id: SHOT_ID
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/actions/tasks/${TASK_ID}/set-main-preview`,
      body: {}
    })
  })

  it('setTasksMainPreview sends the task ids', async () => {
    fake.reply(200, [{ id: SHOT_ID }])
    expect(
      await kitsu.task.setTasksMainPreview([{ id: TASK_ID }, OTHER_ID])
    ).toEqual([{ id: SHOT_ID }])
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: '/actions/tasks/set-main-preview',
      body: { task_ids: [TASK_ID, OTHER_ID] }
    })
  })

  it('setTasksPriority sends the task ids and the priority', async () => {
    fake.reply(200, [{ id: TASK_ID, priority: 2 }])
    expect(
      await kitsu.task.setTasksPriority([{ id: TASK_ID }, OTHER_ID], 2)
    ).toEqual([{ id: TASK_ID, priority: 2 }])
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: '/actions/tasks/set-priority',
      body: { task_ids: [TASK_ID, OTHER_ID], priority: 2 }
    })
  })

  it('setTasksPriority accepts the priority 0 and rejects a missing one', async () => {
    fake.reply(200, [])
    await kitsu.task.setTasksPriority([TASK_ID], 0)
    expect(fake.calls[0].body.priority).toBe(0)
    await expect(kitsu.task.setTasksPriority([TASK_ID])).rejects.toBeInstanceOf(
      ParameterError
    )
    expect(fake.calls).toHaveLength(1)
  })

  it('reorderTaskTypes sends the task type ids in order', async () => {
    fake.reply(200, [{ id: OTHER_ID }, { id: TASK_TYPE_ID }])
    expect(
      await kitsu.task.reorderTaskTypes([OTHER_ID, { id: TASK_TYPE_ID }])
    ).toEqual([{ id: OTHER_ID }, { id: TASK_TYPE_ID }])
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: '/actions/task-types/reorder',
      body: { task_type_ids: [OTHER_ID, TASK_TYPE_ID] }
    })
  })

  it('importTaskTypeEstimationsWithCsv uploads the CSV in the file field', async () => {
    fake.reply(201, [{ id: TASK_ID }])
    expect(
      await kitsu.task.importTaskTypeEstimationsWithCsv(
        { id: PROJECT_ID },
        { id: TASK_TYPE_ID },
        new Blob([CSV], { type: 'text/csv' }),
        { fileName: 'estimations.csv' }
      )
    ).toEqual([{ id: TASK_ID }])
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/import/csv/projects/${PROJECT_ID}/task-types/${TASK_TYPE_ID}/estimations`
    })
    const form = fake.calls[0].body
    expect(form).toBeInstanceOf(FormData)
    expect([...form.keys()]).toEqual(['file'])
    expect(form.get('file').name).toBe('estimations.csv')
    expect(await form.get('file').text()).toBe(CSV)
  })

  it('importTaskTypeEstimationsWithCsv goes through the episode when given', async () => {
    fake.reply(201, [])
    const controller = new AbortController()
    controller.abort()
    await kitsu.task.importTaskTypeEstimationsWithCsv(
      PROJECT_ID,
      TASK_TYPE_ID,
      new Blob([CSV]),
      { episode: { id: EPISODE_ID }, signal: controller.signal }
    )
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/import/csv/projects/${PROJECT_ID}/episodes/${EPISODE_ID}/task-types/${TASK_TYPE_ID}/estimations`
    })
    expect(fake.calls[0].signal.aborted).toBe(true)
  })
})
