import { beforeEach, describe, expect, it } from 'vitest'

import { ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import {
  DEPARTMENT_ID,
  OTHER_ID,
  TASK_STATUS_ID,
  TASK_TYPE_ID
} from '../helpers/ids.js'

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
    ['getTaskTypeByName', 'name', 'Layout'],
    ['getTaskTypeByShortName', 'short_name', 'lay']
  ])(
    '%s filters the task types, entity type and department on demand',
    async (name, key, value) => {
      const layout = { id: TASK_TYPE_ID, name: 'Layout', short_name: 'lay' }
      fake.reply(200, [layout]).reply(200, [])
      expect(await kitsu.task[name](value)).toEqual(layout)
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
        [key]: value
      })
      expect(Object.fromEntries(fake.calls[1].query)).toEqual({
        [key]: 'Nope',
        for_entity: 'Shot',
        department_id: DEPARTMENT_ID
      })
    }
  )

  it('getDefaultTaskStatus returns the default status of the tasks', async () => {
    fake.reply(200, [{ id: TASK_STATUS_ID }]).reply(200, [])
    expect(await kitsu.task.getDefaultTaskStatus()).toEqual({
      id: TASK_STATUS_ID
    })
    expect(await kitsu.task.getDefaultTaskStatus()).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/task-status'
    })
    // Neutral, the default status of the concepts, is flagged too.
    expect(Object.fromEntries(fake.calls[0].query)).toEqual({
      is_default: 'true',
      for_concept: 'false'
    })
  })

  it.each([
    ['getTaskStatusByName', 'name', 'Work in progress'],
    ['getTaskStatusByShortName', 'short_name', 'wip']
  ])('%s filters the task statuses', async (name, key, value) => {
    const wip = {
      id: TASK_STATUS_ID,
      name: 'Work in progress',
      short_name: 'wip'
    }
    fake.reply(200, [wip]).reply(200, [])
    expect(await kitsu.task[name](value)).toEqual(wip)
    expect(await kitsu.task[name]('nope')).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/task-status'
    })
    expect(Object.fromEntries(fake.calls[0].query)).toEqual({ [key]: value })
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

  // Zou never reads force on this route.
  it('removeTaskStatus deletes the status without any query', async () => {
    fake.reply(204)
    await kitsu.task.removeTaskStatus({ id: TASK_STATUS_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/task-status/${TASK_STATUS_ID}`
    })
    expect([...fake.calls[0].query.keys()]).toEqual([])
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

  it('name lookups match the % and _ of a name literally', async () => {
    // Zou matches names with ILIKE: FX_Sim would find FX-Sim.
    fake.reply(200, []).reply(200, []).reply(200, [])
    await kitsu.task.getTaskTypeByName('FX_Sim\\1')
    await kitsu.task.getTaskStatusByName('100%')
    await kitsu.task.getTaskByEntity(TASK_TYPE_ID, TASK_TYPE_ID, {
      name: 'v_2'
    })
    expect(fake.calls.map(call => call.query.get('name'))).toEqual([
      'FX\\_Sim\\\\1',
      '100\\%',
      'v\\_2'
    ])
  })

  // PostgreSQL reads a backslash in a LIKE pattern as an escape: sent as
  // is, it hides the next character, and a trailing one fails the query.
  it('name lookups find a name holding a backslash', async () => {
    const comp = { id: TASK_TYPE_ID, name: 'Comp\\Paint', for_entity: 'Shot' }
    fake.reply(200, [comp])
    expect(await kitsu.task.getTaskTypeByName('Comp\\Paint')).toEqual(comp)
    expect(fake.calls[0].query.get('name')).toBe('Comp\\\\Paint')
  })

  // Zou keeps "DONE" and "Done" apart, and its ILIKE filter finds both.
  it('name lookups prefer the exact spelling over another case', async () => {
    const twins = [
      { id: OTHER_ID, name: 'DONE', short_name: 'dn' },
      { id: TASK_STATUS_ID, name: 'Done', short_name: 'done' }
    ]
    fake.reply(200, twins).reply(200, twins).reply(200, twins)
    expect(await kitsu.task.getTaskStatusByName('Done')).toEqual(twins[1])
    expect(await kitsu.task.getTaskStatusByName('DONE')).toEqual(twins[0])
    expect(await kitsu.task.getTaskStatusByName('done')).toEqual(twins[0])
  })

  it('newTaskType looks the name up literally and creates it as given', async () => {
    fake.reply(200, []).reply(201, { id: TASK_TYPE_ID, name: 'FX_Sim' })
    await kitsu.task.newTaskType('FX_Sim', { forEntity: 'Shot' })
    expect(fake.calls[0].query.get('name')).toBe('FX\\_Sim')
    expect(fake.calls[1].body.name).toBe('FX_Sim')
  })

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
