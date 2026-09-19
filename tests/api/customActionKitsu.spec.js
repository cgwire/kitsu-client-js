import { beforeEach, describe, expect, it } from 'vitest'

import { ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import { CUSTOM_ACTION_ID } from '../helpers/ids.js'

describe('customAction namespace', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('allCustomActions lists the custom actions sorted by name', async () => {
    fake.reply(200, [{ name: 'render' }, { name: 'Export' }])
    const actions = await kitsu.customAction.allCustomActions()
    expect(actions.map(action => action.name)).toEqual(['Export', 'render'])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/custom-actions'
    })
  })

  it('newCustomAction creates an action for all entities by default', async () => {
    fake.reply(201, { id: CUSTOM_ACTION_ID })
    expect(
      await kitsu.customAction.newCustomAction('Render', 'https://farm/render')
    ).toEqual({ id: CUSTOM_ACTION_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: '/data/custom-actions',
      body: {
        name: 'Render',
        url: 'https://farm/render',
        entity_type: 'all',
        is_ajax: false
      }
    })
  })

  it('newCustomAction sends the entity type and the ajax flag', async () => {
    fake.reply(201, { id: CUSTOM_ACTION_ID })
    await kitsu.customAction.newCustomAction('Render', 'https://farm/render', {
      entityType: 'shot',
      isAjax: true
    })
    expect(fake.calls[0].body).toEqual({
      name: 'Render',
      url: 'https://farm/render',
      entity_type: 'shot',
      is_ajax: true
    })
  })

  it('newCustomAction rejects a blank name or url', async () => {
    await expect(
      kitsu.customAction.newCustomAction('', 'https://farm/render')
    ).rejects.toThrow(ParameterError)
    await expect(kitsu.customAction.newCustomAction('Render')).rejects.toThrow(
      ParameterError
    )
    expect(fake.calls).toHaveLength(0)
  })

  it('updateCustomAction saves the editable fields only', async () => {
    const action = {
      id: CUSTOM_ACTION_ID,
      name: 'Render',
      url: 'https://farm/render',
      entity_type: 'asset',
      is_ajax: true,
      created_at: '2026-09-19T10:00:00'
    }
    fake.reply(200, action)
    expect(await kitsu.customAction.updateCustomAction(action)).toEqual(action)
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/custom-actions/${CUSTOM_ACTION_ID}`
    })
    expect(fake.calls[0].body).toEqual({
      name: 'Render',
      url: 'https://farm/render',
      entity_type: 'asset',
      is_ajax: true
    })
  })

  it('updateCustomAction leaves the unset fields out of the body', async () => {
    fake.reply(200, { id: CUSTOM_ACTION_ID })
    await kitsu.customAction.updateCustomAction({
      id: CUSTOM_ACTION_ID,
      name: 'Publish'
    })
    expect(fake.calls[0].body).toEqual({ name: 'Publish' })
  })

  it('removeCustomAction deletes the action', async () => {
    fake.reply(204).reply(204)
    await kitsu.customAction.removeCustomAction(CUSTOM_ACTION_ID)
    await kitsu.customAction.removeCustomAction({ id: CUSTOM_ACTION_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/custom-actions/${CUSTOM_ACTION_ID}`
    })
    expect(fake.calls[1].path).toBe(`/data/custom-actions/${CUSTOM_ACTION_ID}`)
  })

  it('rejects a missing custom action', async () => {
    await expect(kitsu.customAction.updateCustomAction()).rejects.toThrow(
      ParameterError
    )
    await expect(kitsu.customAction.removeCustomAction()).rejects.toThrow(
      ParameterError
    )
    expect(fake.calls).toHaveLength(0)
  })
})
