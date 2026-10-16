import { beforeEach, describe, expect, it } from 'vitest'

import { ParameterError } from '../../src/core/errors.js'
import { makeClient } from '../helpers/client.js'
import {
  DEPARTMENT_ID,
  FILTER_ID,
  FILTER_GROUP_ID,
  OTHER_ID,
  PROJECT_ID
} from '../helpers/ids.js'

describe('user namespace: filters', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  // Zou nests the filters by list type, then by project id or "all".
  it('allFilters lists the filters of the current user', async () => {
    const filters = {
      asset: {
        [PROJECT_ID]: [
          {
            id: FILTER_ID,
            name: 'Wip',
            search_query: 'status=wip',
            list_type: 'asset',
            project_id: PROJECT_ID
          }
        ]
      },
      todo: {
        all: [
          {
            id: OTHER_ID,
            name: 'Retakes',
            search_query: 'status=retake',
            list_type: 'todo',
            project_id: null
          }
        ]
      }
    }
    fake.reply(200, filters)
    expect(await kitsu.user.allFilters()).toEqual(filters)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/user/filters'
    })
  })

  it('newFilter posts the filter, project and entity type optional', async () => {
    fake.reply(201, { id: FILTER_ID }).reply(201, { id: FILTER_ID })
    expect(await kitsu.user.newFilter('Wip', 'status=wip', 'asset')).toEqual({
      id: FILTER_ID
    })
    await kitsu.user.newFilter('Wip', 'status=wip', 'shot', {
      project: { id: PROJECT_ID },
      entityType: 'Shot'
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: '/data/user/filters',
      body: {
        name: 'Wip',
        query: 'status=wip',
        list_type: 'asset',
        project_id: null,
        entity_type: null
      }
    })
    expect(fake.calls[1].body).toEqual({
      name: 'Wip',
      query: 'status=wip',
      list_type: 'shot',
      project_id: PROJECT_ID,
      entity_type: 'Shot'
    })
  })

  it('newFilter requires a name, a query and a list type', async () => {
    const { user } = kitsu
    await expect(user.newFilter()).rejects.toThrow(ParameterError)
    await expect(user.newFilter('Wip', '', 'asset')).rejects.toThrow(
      ParameterError
    )
    await expect(user.newFilter('Wip', 'status=wip')).rejects.toThrow(
      ParameterError
    )
    await expect(
      user.newFilter('Wip', 'status=wip', { project: PROJECT_ID })
    ).rejects.toThrow(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('removeFilter deletes the filter from an id or an object', async () => {
    fake.reply(204).reply(204)
    await kitsu.user.removeFilter(FILTER_ID)
    await kitsu.user.removeFilter({ id: FILTER_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/user/filters/${FILTER_ID}`
    })
    expect(fake.calls[1].path).toBe(`/data/user/filters/${FILTER_ID}`)
  })

  it('updateFilter puts the whole filter without mutating it', async () => {
    const filter = Object.freeze({ id: FILTER_ID, name: 'Retakes' })
    fake.reply(200, { id: FILTER_ID, name: 'Retakes' })
    expect(await kitsu.user.updateFilter(filter)).toMatchObject({
      name: 'Retakes'
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/user/filters/${FILTER_ID}`
    })
    expect(fake.calls[0].body).toEqual({ name: 'Retakes' })
  })

  it('allFilterGroups lists the filter groups of the current user', async () => {
    const groups = {
      shot: {
        [PROJECT_ID]: [
          {
            id: FILTER_GROUP_ID,
            name: 'Anim',
            color: '#00FF00',
            list_type: 'shot',
            project_id: PROJECT_ID
          }
        ]
      }
    }
    fake.reply(200, groups)
    expect(await kitsu.user.allFilterGroups()).toEqual(groups)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/user/filter-groups'
    })
  })

  it('newFilterGroup posts the group of a list, the rest optional', async () => {
    fake.reply(201, { id: FILTER_GROUP_ID }).reply(201, { id: FILTER_GROUP_ID })
    expect(await kitsu.user.newFilterGroup('Anim', 'todo')).toEqual({
      id: FILTER_GROUP_ID
    })
    await kitsu.user.newFilterGroup('Anim', 'shot', {
      project: PROJECT_ID,
      color: '#00FF00',
      isShared: true,
      department: { id: DEPARTMENT_ID },
      entityType: 'Shot'
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: '/data/user/filter-groups',
      body: {
        name: 'Anim',
        list_type: 'todo',
        color: '',
        is_shared: false,
        project_id: null,
        department_id: null,
        entity_type: null
      }
    })
    expect(fake.calls[1].body).toEqual({
      name: 'Anim',
      list_type: 'shot',
      color: '#00FF00',
      is_shared: true,
      project_id: PROJECT_ID,
      department_id: DEPARTMENT_ID,
      entity_type: 'Shot'
    })
  })

  // Zou would file the group under "todo" for good.
  it('newFilterGroup requires the list type before any request', async () => {
    await expect(kitsu.user.newFilterGroup('Anim')).rejects.toThrow(
      ParameterError
    )
    // The 0.2.0 call, the options in place of the list type.
    await expect(
      kitsu.user.newFilterGroup('Anim', { project: PROJECT_ID })
    ).rejects.toThrow(ParameterError)
    await expect(kitsu.user.newFilterGroup('', 'shot')).rejects.toThrow(
      ParameterError
    )
    expect(fake.calls).toHaveLength(0)
  })

  it('getFilterGroup returns the group, null on 404', async () => {
    fake.reply(200, { id: FILTER_GROUP_ID }).reply(404, {})
    expect(await kitsu.user.getFilterGroup({ id: FILTER_GROUP_ID })).toEqual({
      id: FILTER_GROUP_ID
    })
    expect(await kitsu.user.getFilterGroup(FILTER_GROUP_ID)).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/user/filter-groups/${FILTER_GROUP_ID}`
    })
  })

  it('updateFilterGroup puts the whole group', async () => {
    fake.reply(200, { id: FILTER_GROUP_ID, name: 'Layout' })
    expect(
      await kitsu.user.updateFilterGroup({
        id: FILTER_GROUP_ID,
        name: 'Layout'
      })
    ).toMatchObject({ name: 'Layout' })
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/user/filter-groups/${FILTER_GROUP_ID}`
    })
    expect(fake.calls[0].body).toEqual({ name: 'Layout' })
  })

  it('removeFilterGroup deletes the group from an id or an object', async () => {
    fake.reply(204).reply(204)
    await kitsu.user.removeFilterGroup(FILTER_GROUP_ID)
    await kitsu.user.removeFilterGroup({ id: FILTER_GROUP_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/user/filter-groups/${FILTER_GROUP_ID}`
    })
    expect(fake.calls[1].path).toBe(
      `/data/user/filter-groups/${FILTER_GROUP_ID}`
    )
  })

  it('update functions reject an entity without a valid id', async () => {
    await expect(kitsu.user.updateFilter({ id: '../admin' })).rejects.toThrow(
      'Wrong format'
    )
    await expect(
      kitsu.user.updateFilterGroup({ name: 'No id' })
    ).rejects.toThrow('Wrong format')
    expect(fake.calls).toHaveLength(0)
  })
})
