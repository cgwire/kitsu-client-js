import { beforeEach, describe, expect, it } from 'vitest'

import { ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import { DEPARTMENT_ID, TASK_STATUS_ID, TASK_TYPE_ID } from '../helpers/ids.js'

describe('task namespace: task types and task statuses', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it.each([
    ['getTaskType', TASK_TYPE_ID, `/data/task-types/${TASK_TYPE_ID}`],
    ['getTaskStatus', TASK_STATUS_ID, `/data/task-status/${TASK_STATUS_ID}`]
  ])('%s returns the entry, null on 404', async (name, id, path) => {
    fake.reply(200, { id }).reply(404, {})
    expect(await kitsu.task[name](id)).toEqual({ id })
    expect(await kitsu.task[name]({ id })).toBeNull()
    expect(fake.calls[0]).toMatchObject({ method: 'GET', path })
  })

  it.each([
    ['getTaskTypeByName', 'name'],
    ['getTaskTypeByShortName', 'short_name']
  ])(
    '%s filters the task types, entity type and department on demand',
    async (name, key) => {
      fake.reply(200, [{ id: TASK_TYPE_ID }]).reply(200, [])
      expect(await kitsu.task[name]('Layout')).toEqual({ id: TASK_TYPE_ID })
      expect(
        await kitsu.task[name]('Nope', {
          forEntity: 'Shot',
          department: { id: DEPARTMENT_ID }
        })
      ).toBeNull()
      expect(fake.calls[0]).toMatchObject({
        method: 'GET',
        path: '/data/task-types'
      })
      expect(Object.fromEntries(fake.calls[0].query)).toEqual({
        [key]: 'Layout'
      })
      expect(Object.fromEntries(fake.calls[1].query)).toEqual({
        [key]: 'Nope',
        for_entity: 'Shot',
        department_id: DEPARTMENT_ID
      })
    }
  )

  it('getDefaultTaskStatus returns the status flagged as default', async () => {
    fake.reply(200, [{ id: TASK_STATUS_ID }]).reply(200, [])
    expect(await kitsu.task.getDefaultTaskStatus()).toEqual({
      id: TASK_STATUS_ID
    })
    expect(await kitsu.task.getDefaultTaskStatus()).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/task-status'
    })
    expect(fake.calls[0].query.get('is_default')).toBe('true')
  })

  it.each([
    ['getTaskStatusByName', 'name'],
    ['getTaskStatusByShortName', 'short_name']
  ])('%s filters the task statuses', async (name, key) => {
    fake.reply(200, [{ id: TASK_STATUS_ID }]).reply(200, [])
    expect(await kitsu.task[name]('wip')).toEqual({ id: TASK_STATUS_ID })
    expect(await kitsu.task[name]('nope')).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/task-status'
    })
    expect(Object.fromEntries(fake.calls[0].query)).toEqual({ [key]: 'wip' })
  })

  it('removeTaskType deletes the type, forcing on demand', async () => {
    fake.reply(204).reply(204)
    await kitsu.task.removeTaskType(TASK_TYPE_ID)
    await kitsu.task.removeTaskType({ id: TASK_TYPE_ID }, { force: true })
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/task-types/${TASK_TYPE_ID}`
    })
    expect(fake.calls[0].query.has('force')).toBe(false)
    expect(fake.calls[1].query.get('force')).toBe('true')
  })

  it('removeTaskStatus always forces the deletion', async () => {
    fake.reply(204)
    await kitsu.task.removeTaskStatus({ id: TASK_STATUS_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/task-status/${TASK_STATUS_ID}`
    })
    expect(fake.calls[0].query.get('force')).toBe('true')
  })

  it.each([
    ['updateTaskType', TASK_TYPE_ID, `/data/task-types/${TASK_TYPE_ID}`],
    ['updateTaskStatus', TASK_STATUS_ID, `/data/task-status/${TASK_STATUS_ID}`]
  ])('%s saves the whole entry', async (name, id, path) => {
    const entry = { id, name: 'Renamed' }
    fake.reply(200, entry)
    expect(await kitsu.task[name](entry)).toEqual(entry)
    expect(fake.calls[0]).toMatchObject({ method: 'PUT', path })
    expect(fake.calls[0].body).toEqual({ name: 'Renamed' })
  })

  it('newTaskType returns the existing type with the same name', async () => {
    fake.reply(200, [{ id: TASK_TYPE_ID, name: 'Layout' }])
    expect(await kitsu.task.newTaskType('Layout')).toMatchObject({
      id: TASK_TYPE_ID
    })
    expect(fake.calls).toHaveLength(1)
    expect(Object.fromEntries(fake.calls[0].query)).toEqual({
      name: 'Layout',
      for_entity: 'Asset'
    })
  })

  it('newTaskType creates the type when it does not exist', async () => {
    fake.reply(200, []).reply(201, { id: TASK_TYPE_ID })
    fake.reply(200, []).reply(201, { id: TASK_TYPE_ID })
    expect(await kitsu.task.newTaskType('Layout')).toEqual({
      id: TASK_TYPE_ID
    })
    await kitsu.task.newTaskType('Anim', {
      color: '#00FF00',
      forEntity: 'Shot'
    })
    expect(fake.calls[1]).toMatchObject({
      method: 'POST',
      path: '/data/task-types',
      body: { name: 'Layout', color: '#000000', for_entity: 'Asset' }
    })
    expect(fake.calls[2].query.get('for_entity')).toBe('Shot')
    expect(fake.calls[3].body).toEqual({
      name: 'Anim',
      color: '#00FF00',
      for_entity: 'Shot'
    })
  })

  it('newTaskStatus creates a status', async () => {
    fake.reply(201, { id: TASK_STATUS_ID })
    expect(
      await kitsu.task.newTaskStatus('Work in progress', 'wip', '#3273dc')
    ).toEqual({ id: TASK_STATUS_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: '/data/task-status',
      body: { name: 'Work in progress', short_name: 'wip', color: '#3273dc' }
    })
  })

  it.each([['3273dc'], ['#zzz'], [''], [undefined]])(
    'newTaskStatus rejects the color %s without any request',
    async color => {
      await expect(
        kitsu.task.newTaskStatus('Todo', 'todo', color)
      ).rejects.toThrow(ParameterError)
      expect(fake.calls).toHaveLength(0)
    }
  )

  it('first-match lookups reject a blank filter before any request', async () => {
    const lookups = [
      () => kitsu.task.getTaskTypeByName(''),
      () => kitsu.task.getTaskTypeByShortName(undefined),
      () => kitsu.task.getTaskStatusByName(''),
      () => kitsu.task.getTaskStatusByShortName(''),
      () => kitsu.task.getTaskByEntity(TASK_TYPE_ID, TASK_TYPE_ID, { name: '' })
    ]
    const errors = await Promise.all(
      lookups.map(lookup => lookup().catch(err => err))
    )
    errors.forEach(err => expect(err).toBeInstanceOf(ParameterError))
    expect(fake.calls).toHaveLength(0)
  })
})
