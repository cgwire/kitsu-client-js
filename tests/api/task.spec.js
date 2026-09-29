import { beforeEach, describe, expect, it } from 'vitest'

import { NotFoundError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import {
  ASSET_ID,
  CONCEPT_ID,
  DEPARTMENT_ID,
  EDIT_ID,
  ENTITY_ID,
  EPISODE_ID,
  OTHER_ID,
  PERSON_ID,
  PROJECT_ID,
  SCENE_ID,
  SEQUENCE_ID,
  SHOT_ID,
  STUDIO_ID,
  TASK_ID,
  TASK_STATUS_ID,
  TASK_TYPE_ID
} from '../helpers/ids.js'

const UNSORTED = [{ name: 'main' }, { name: 'Alt' }, { name: 'extra' }]
const SORTED_NAMES = ['Alt', 'extra', 'main']

describe('task namespace: tasks, types and statuses', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('allTasksForShot lists the tasks of a shot, with relations on demand', async () => {
    fake.reply(200, [{ id: TASK_ID }]).reply(200, [])
    expect(await kitsu.task.allTasksForShot({ id: SHOT_ID })).toEqual([
      { id: TASK_ID }
    ])
    await kitsu.task.allTasksForShot(SHOT_ID, { relations: true })
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/shots/${SHOT_ID}/tasks`
    })
    expect(fake.calls[0].query.has('relations')).toBe(false)
    expect(fake.calls[1].query.get('relations')).toBe('true')
  })

  it.each([
    ['allTasksForConcept', CONCEPT_ID, `/data/concepts/${CONCEPT_ID}/tasks`],
    ['allTasksForEdit', EDIT_ID, `/data/edits/${EDIT_ID}/tasks`],
    [
      'allTasksForSequence',
      SEQUENCE_ID,
      `/data/sequences/${SEQUENCE_ID}/tasks`
    ],
    ['allTasksForScene', SCENE_ID, `/data/scenes/${SCENE_ID}/tasks`],
    ['allTasksForAsset', ASSET_ID, `/data/assets/${ASSET_ID}/tasks`],
    ['allTasksForEpisode', EPISODE_ID, `/data/episodes/${EPISODE_ID}/tasks`],
    [
      'allShotTasksForSequence',
      SEQUENCE_ID,
      `/data/sequences/${SEQUENCE_ID}/shot-tasks`
    ],
    [
      'allShotTasksForEpisode',
      EPISODE_ID,
      `/data/episodes/${EPISODE_ID}/shot-tasks`
    ],
    [
      'allAssetsTasksForEpisode',
      EPISODE_ID,
      `/data/episodes/${EPISODE_ID}/asset-tasks`
    ]
  ])(
    '%s lists sorted tasks, with relations on demand',
    async (name, id, path) => {
      fake.reply(200, UNSORTED).reply(200, [])
      const tasks = await kitsu.task[name]({ id })
      await kitsu.task[name](id, { relations: true })
      expect(tasks.map(task => task.name)).toEqual(SORTED_NAMES)
      expect(fake.calls[0]).toMatchObject({ method: 'GET', path })
      expect(fake.calls[0].query.has('relations')).toBe(false)
      expect(fake.calls[1].query.get('relations')).toBe('true')
    }
  )

  it('allTasksForShot sorts the tasks by name', async () => {
    fake.reply(200, UNSORTED)
    const tasks = await kitsu.task.allTasksForShot(SHOT_ID)
    expect(tasks.map(task => task.name)).toEqual(SORTED_NAMES)
  })

  it.each([
    ['allTaskStatuses', '/data/task-status'],
    ['allTaskTypes', '/data/task-types']
  ])('%s lists every entry sorted by name', async (name, path) => {
    fake.reply(200, UNSORTED)
    const entries = await kitsu.task[name]()
    expect(entries.map(entry => entry.name)).toEqual(SORTED_NAMES)
    expect(fake.calls[0]).toMatchObject({ method: 'GET', path })
  })

  it.each([
    [
      'allTaskTypesForProject',
      PROJECT_ID,
      `/data/projects/${PROJECT_ID}/task-types`
    ],
    [
      'allTaskStatusesForProject',
      PROJECT_ID,
      `/data/projects/${PROJECT_ID}/settings/task-status`
    ],
    ['allTaskTypesForShot', SHOT_ID, `/data/shots/${SHOT_ID}/task-types`],
    [
      'allTaskTypesForConcept',
      CONCEPT_ID,
      `/data/concepts/${CONCEPT_ID}/task-types`
    ],
    ['allTaskTypesForAsset', ASSET_ID, `/data/assets/${ASSET_ID}/task-types`],
    ['allTaskTypesForScene', SCENE_ID, `/data/scenes/${SCENE_ID}/task-types`],
    [
      'allTaskTypesForSequence',
      SEQUENCE_ID,
      `/data/sequences/${SEQUENCE_ID}/task-types`
    ],
    [
      'allTaskTypesForEpisode',
      EPISODE_ID,
      `/data/episodes/${EPISODE_ID}/task-types`
    ]
  ])(
    '%s lists the entries of the parent sorted by name',
    async (name, id, path) => {
      fake.reply(200, UNSORTED).reply(200, [])
      const entries = await kitsu.task[name]({ id })
      await kitsu.task[name](id)
      expect(entries.map(entry => entry.name)).toEqual(SORTED_NAMES)
      expect(fake.calls[0]).toMatchObject({ method: 'GET', path })
      expect(fake.calls[1].path).toBe(path)
    }
  )

  it('allTasksForTaskStatus filters by project, type and status', async () => {
    fake.reply(200, [{ id: TASK_ID }])
    const tasks = await kitsu.task.allTasksForTaskStatus(
      { id: PROJECT_ID },
      TASK_TYPE_ID,
      { id: TASK_STATUS_ID }
    )
    expect(tasks).toEqual([{ id: TASK_ID }])
    expect(fake.calls[0]).toMatchObject({ method: 'GET', path: '/data/tasks' })
    expect(Object.fromEntries(fake.calls[0].query)).toEqual({
      project_id: PROJECT_ID,
      task_type_id: TASK_TYPE_ID,
      task_status_id: TASK_STATUS_ID
    })
  })

  it('allTasksForTaskType filters by project and type, episode on demand', async () => {
    fake.reply(200, [{ id: TASK_ID }]).reply(200, [])
    await kitsu.task.allTasksForTaskType(PROJECT_ID, { id: TASK_TYPE_ID })
    await kitsu.task.allTasksForTaskType({ id: PROJECT_ID }, TASK_TYPE_ID, {
      episode: { id: EPISODE_ID }
    })
    expect(fake.calls[0]).toMatchObject({ method: 'GET', path: '/data/tasks' })
    expect(Object.fromEntries(fake.calls[0].query)).toEqual({
      project_id: PROJECT_ID,
      task_type_id: TASK_TYPE_ID
    })
    expect(fake.calls[1].query.get('episode_id')).toBe(EPISODE_ID)
  })

  it('allTasksForEntityAndTaskType lists the tasks of an entity for a type', async () => {
    fake.reply(200, [{ id: TASK_ID }])
    const tasks = await kitsu.task.allTasksForEntityAndTaskType(
      { id: ENTITY_ID },
      TASK_TYPE_ID
    )
    expect(tasks).toEqual([{ id: TASK_ID }])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/entities/${ENTITY_ID}/task-types/${TASK_TYPE_ID}/tasks`
    })
  })

  it.each([
    ['allTasksForPerson', `/data/persons/${PERSON_ID}/tasks`],
    ['allDoneTasksForPerson', `/data/persons/${PERSON_ID}/done-tasks`]
  ])('%s lists the tasks of a person', async (name, path) => {
    fake.reply(200, [{ id: TASK_ID }]).reply(200, [])
    expect(await kitsu.task[name]({ id: PERSON_ID })).toEqual([{ id: TASK_ID }])
    await kitsu.task[name](PERSON_ID)
    expect(fake.calls[0]).toMatchObject({ method: 'GET', path })
    expect(fake.calls[1].path).toBe(path)
  })

  it('allTasksForPersonAndType lists the tasks of a person for a type', async () => {
    fake.reply(200, [{ id: TASK_ID }])
    const tasks = await kitsu.task.allTasksForPersonAndType(
      { id: PERSON_ID },
      TASK_TYPE_ID
    )
    expect(tasks).toEqual([{ id: TASK_ID }])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/persons/${PERSON_ID}/related-tasks/${TASK_TYPE_ID}`
    })
  })

  it('allTasksForProject lists the tasks, filtered on demand', async () => {
    fake.reply(200, [{ id: TASK_ID }]).reply(200, [])
    expect(await kitsu.task.allTasksForProject({ id: PROJECT_ID })).toEqual([
      { id: TASK_ID }
    ])
    await kitsu.task.allTasksForProject(PROJECT_ID, {
      taskType: { id: TASK_TYPE_ID },
      episode: EPISODE_ID
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/tasks`
    })
    expect(Object.fromEntries(fake.calls[0].query)).toEqual({})
    expect(Object.fromEntries(fake.calls[1].query)).toEqual({
      task_type_id: TASK_TYPE_ID,
      episode_id: EPISODE_ID
    })
  })

  it('allOpenTasks returns the page of Zou, filtered', async () => {
    const page = { data: [{ id: TASK_ID }], is_more: false, page: 1 }
    fake.reply(200, page).reply(200, page).reply(200, page)
    expect(await kitsu.task.allOpenTasks()).toEqual(page)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/tasks/open-tasks'
    })
    expect(Object.fromEntries(fake.calls[0].query)).toEqual({})
    await kitsu.task.allOpenTasks({
      project: PROJECT_ID,
      taskType: { id: TASK_TYPE_ID },
      taskStatus: TASK_STATUS_ID,
      persons: [PERSON_ID, { id: OTHER_ID }],
      department: DEPARTMENT_ID,
      studio: STUDIO_ID,
      startDate: new Date(2026, 8, 1),
      dueDate: '2026-09-30',
      priority: 2,
      page: 2,
      limit: 20
    })
    expect(Object.fromEntries(fake.calls[1].query)).toEqual({
      project_id: PROJECT_ID,
      task_type_id: TASK_TYPE_ID,
      task_status_id: TASK_STATUS_ID,
      person_id: `${PERSON_ID},${OTHER_ID}`,
      department_id: DEPARTMENT_ID,
      studio_id: STUDIO_ID,
      start_date: '2026-09-01',
      due_date: '2026-09-30',
      priority: '2',
      page: '2',
      limit: '20'
    })
    await kitsu.task.allOpenTasks({ persons: 'unassigned' })
    expect(Object.fromEntries(fake.calls[2].query)).toEqual({
      person_id: 'unassigned'
    })
  })

  it.each([
    ['getOpenTasksStats', '/data/tasks/open-tasks/stats'],
    ['getPersonsTasksDates', '/data/persons/task-dates']
  ])('%s returns the payload, null on 404', async (name, path) => {
    fake.reply(200, { total: 3 }).reply(404, {})
    expect(await kitsu.task[name]()).toEqual({ total: 3 })
    expect(await kitsu.task[name]()).toBeNull()
    expect(fake.calls[0]).toMatchObject({ method: 'GET', path })
  })

  it('getTaskByEntity looks a task up by entity, type and name', async () => {
    fake.reply(200, [{ id: TASK_ID }]).reply(200, [])
    expect(
      await kitsu.task.getTaskByEntity({ id: ENTITY_ID }, TASK_TYPE_ID)
    ).toEqual({ id: TASK_ID })
    expect(
      await kitsu.task.getTaskByEntity(
        ENTITY_ID,
        { id: TASK_TYPE_ID },
        { name: 'alt' }
      )
    ).toBeNull()
    expect(fake.calls[0]).toMatchObject({ method: 'GET', path: '/data/tasks' })
    expect(Object.fromEntries(fake.calls[0].query)).toEqual({
      name: 'main',
      task_type_id: TASK_TYPE_ID,
      entity_id: ENTITY_ID
    })
    expect(fake.calls[1].query.get('name')).toBe('alt')
  })

  it('getTask returns the full task, null on 404', async () => {
    fake.reply(200, { id: TASK_ID }).reply(404, {})
    expect(await kitsu.task.getTask({ id: TASK_ID })).toEqual({ id: TASK_ID })
    expect(await kitsu.task.getTask(TASK_ID)).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/tasks/${TASK_ID}/full`
    })
  })

  it('getTask lets other errors through', async () => {
    fake.reply(500, {})
    await expect(kitsu.task.getTask(TASK_ID)).rejects.toMatchObject({
      status: 500
    })
  })

  it('newTask returns the existing task of the entity', async () => {
    fake.reply(200, [{ id: TASK_ID }])
    const entity = { id: ENTITY_ID, project_id: PROJECT_ID }
    expect(await kitsu.task.newTask(entity, TASK_TYPE_ID)).toEqual({
      id: TASK_ID
    })
    expect(fake.calls).toHaveLength(1)
    expect(Object.fromEntries(fake.calls[0].query)).toEqual({
      name: 'main',
      task_type_id: TASK_TYPE_ID,
      entity_id: ENTITY_ID
    })
  })

  it('newTask creates the task with the default status', async () => {
    fake
      .reply(200, [])
      .reply(200, [{ id: TASK_STATUS_ID }])
      .reply(201, { id: TASK_ID })
    const entity = { id: ENTITY_ID, project_id: PROJECT_ID }
    expect(await kitsu.task.newTask(entity, { id: TASK_TYPE_ID })).toEqual({
      id: TASK_ID
    })
    expect(fake.calls[1].path).toBe('/data/task-status')
    expect(fake.calls[1].query.get('is_default')).toBe('true')
    expect(fake.calls[2]).toMatchObject({ method: 'POST', path: '/data/tasks' })
    expect(fake.calls[2].body).toEqual({
      project_id: PROJECT_ID,
      entity_id: ENTITY_ID,
      task_type_id: TASK_TYPE_ID,
      task_status_id: TASK_STATUS_ID,
      assignees: [],
      name: 'main'
    })
  })

  it('newTask sends the given name, status, assigner and assignees', async () => {
    fake.reply(200, []).reply(201, { id: TASK_ID })
    const assignees = [{ id: PERSON_ID }, OTHER_ID]
    await kitsu.task.newTask(
      { id: ENTITY_ID, project_id: PROJECT_ID },
      TASK_TYPE_ID,
      {
        name: 'alt',
        taskStatus: { id: TASK_STATUS_ID },
        assigner: { id: OTHER_ID },
        assignees
      }
    )
    expect(fake.calls[0].query.get('name')).toBe('alt')
    expect(fake.calls[1].body).toEqual({
      project_id: PROJECT_ID,
      entity_id: ENTITY_ID,
      task_type_id: TASK_TYPE_ID,
      task_status_id: TASK_STATUS_ID,
      assignees: [PERSON_ID, OTHER_ID],
      name: 'alt',
      assigner_id: OTHER_ID
    })
    expect(assignees).toEqual([{ id: PERSON_ID }, OTHER_ID])
  })

  it('newTask fetches the entity when only its id is given', async () => {
    fake
      .reply(200, [])
      .reply(200, { id: ENTITY_ID, project_id: PROJECT_ID })
      .reply(201, { id: TASK_ID })
    await kitsu.task.newTask(ENTITY_ID, TASK_TYPE_ID, {
      taskStatus: TASK_STATUS_ID
    })
    expect(fake.calls[1].path).toBe(`/data/entities/${ENTITY_ID}`)
    expect(fake.calls[2].body.project_id).toBe(PROJECT_ID)
  })

  it('newTask fails without any default status', async () => {
    fake.reply(200, []).reply(200, [])
    await expect(
      kitsu.task.newTask(
        { id: ENTITY_ID, project_id: PROJECT_ID },
        TASK_TYPE_ID
      )
    ).rejects.toBeInstanceOf(NotFoundError)
    expect(fake.calls).toHaveLength(2)
  })

  it('removeTask always forces the deletion', async () => {
    fake.reply(204)
    await kitsu.task.removeTask({ id: TASK_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/tasks/${TASK_ID}`
    })
    expect(fake.calls[0].query.get('force')).toBe('true')
  })

  it('updateTask saves the task, assignees sent as ids', async () => {
    fake.reply(200, { id: TASK_ID }).reply(200, { id: TASK_ID })
    const task = { id: TASK_ID, assignees: [{ id: PERSON_ID }, OTHER_ID] }
    await kitsu.task.updateTask(task)
    await kitsu.task.updateTask({ id: TASK_ID, priority: 2 })
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/tasks/${TASK_ID}`,
      body: { id: TASK_ID, assignees: [PERSON_ID, OTHER_ID] }
    })
    expect(fake.calls[1].body).toEqual({ id: TASK_ID, priority: 2 })
    expect(task.assignees).toEqual([{ id: PERSON_ID }, OTHER_ID])
  })

  it('updateTask sends no assignee for null assignees', async () => {
    fake.reply(200, { id: TASK_ID })
    await kitsu.task.updateTask({ id: TASK_ID, assignees: null })
    expect(fake.calls[0].body).toEqual({ id: TASK_ID, assignees: [] })
  })

  it('updateTaskData merges the data over the stored ones', async () => {
    fake
      .reply(200, { id: TASK_ID, name: 'main', data: { a: 1, b: 2 } })
      .reply(200, { id: TASK_ID })
    const data = { b: 3 }
    expect(await kitsu.task.updateTaskData({ id: TASK_ID }, data)).toEqual({
      id: TASK_ID
    })
    expect(fake.calls[0].path).toBe(`/data/tasks/${TASK_ID}/full`)
    expect(fake.calls[1]).toMatchObject({
      method: 'PUT',
      path: `/data/tasks/${TASK_ID}`
    })
    expect(fake.calls[1].body).toEqual({ id: TASK_ID, data: { a: 1, b: 3 } })
    expect(data).toEqual({ b: 3 })
  })

  it('updateTaskData copes with a task without data', async () => {
    fake.reply(200, { id: TASK_ID, data: null }).reply(200, { id: TASK_ID })
    await kitsu.task.updateTaskData(TASK_ID, { a: 1 })
    expect(fake.calls[1].body).toEqual({ id: TASK_ID, data: { a: 1 } })
  })

  it('assignTask assigns one task to a person', async () => {
    fake.reply(200, [{ id: TASK_ID }])
    await kitsu.task.assignTask({ id: TASK_ID }, PERSON_ID)
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/actions/persons/${PERSON_ID}/assign`,
      body: { task_ids: [TASK_ID] }
    })
  })

  it('assignTasksToPerson assigns several tasks to a person', async () => {
    fake.reply(200, [{ id: TASK_ID }])
    await kitsu.task.assignTasksToPerson([{ id: TASK_ID }, OTHER_ID], {
      id: PERSON_ID
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/actions/persons/${PERSON_ID}/assign`,
      body: { task_ids: [TASK_ID, OTHER_ID] }
    })
  })

  it('clearAssignations clears one or several tasks, for a person on demand', async () => {
    fake.reply(200, [TASK_ID]).reply(200, [TASK_ID, OTHER_ID])
    expect(await kitsu.task.clearAssignations({ id: TASK_ID })).toEqual([
      TASK_ID
    ])
    await kitsu.task.clearAssignations([TASK_ID, { id: OTHER_ID }], {
      person: { id: PERSON_ID }
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: '/actions/tasks/clear-assignation'
    })
    expect(fake.calls[0].body).toEqual({ task_ids: [TASK_ID] })
    expect(fake.calls[1].body).toEqual({
      task_ids: [TASK_ID, OTHER_ID],
      person_id: PERSON_ID
    })
  })

  it('clearAssignations sends nothing for an empty list', async () => {
    expect(await kitsu.task.clearAssignations([])).toEqual([])
    expect(fake.calls).toHaveLength(0)
  })

  it('removeTasksForType deletes the tasks of a type in a project', async () => {
    fake.reply(204)
    await kitsu.task.removeTasksForType({ id: PROJECT_ID }, TASK_TYPE_ID)
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/actions/projects/${PROJECT_ID}/task-types/${TASK_TYPE_ID}/delete-tasks`
    })
  })

  it('removeTasksBatch deletes a batch of tasks of a project', async () => {
    fake.reply(200, [TASK_ID, OTHER_ID])
    const tasks = [{ id: TASK_ID }, OTHER_ID]
    await kitsu.task.removeTasksBatch(PROJECT_ID, tasks)
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/actions/projects/${PROJECT_ID}/delete-tasks`,
      body: [TASK_ID, OTHER_ID]
    })
    expect(tasks).toEqual([{ id: TASK_ID }, OTHER_ID])
  })

  it.each([
    ['createShotTasks', SHOT_ID],
    ['createAssetTasks', ASSET_ID],
    ['createEditTasks', EDIT_ID],
    ['createConceptTasks', CONCEPT_ID],
    ['createEntityTasks', ENTITY_ID]
  ])('%s creates one task per task type', async (name, id) => {
    fake.reply(201, [{ id: TASK_ID }])
    expect(
      await kitsu.task[name]({ id }, [{ id: TASK_TYPE_ID }, OTHER_ID])
    ).toEqual([{ id: TASK_ID }])
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/data/entities/${id}/tasks`,
      body: { task_type_ids: [TASK_TYPE_ID, OTHER_ID] }
    })
  })
})
