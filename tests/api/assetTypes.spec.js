import { beforeEach, describe, expect, it } from 'vitest'

import { ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import {
  ASSET_ID,
  ASSET_TYPE_ID,
  OTHER_ID,
  PROJECT_ID,
  SHOT_ID,
  TASK_TYPE_ID
} from '../helpers/ids.js'

const UNSORTED = [{ name: 'props' }, { name: 'Characters' }, { name: 'fx' }]
const SORTED_NAMES = ['Characters', 'fx', 'props']
const namesOf = entries => entries.map(entry => entry.name)

describe('asset namespace: asset types', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('allAssetTypes lists the asset types sorted by name', async () => {
    fake.reply(200, UNSORTED)
    expect(namesOf(await kitsu.asset.allAssetTypes())).toEqual(SORTED_NAMES)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/asset-types'
    })
  })

  it('allAssetTypesForProject lists the asset types of a project', async () => {
    fake.reply(200, UNSORTED)
    const types = await kitsu.asset.allAssetTypesForProject({ id: PROJECT_ID })
    expect(namesOf(types)).toEqual(SORTED_NAMES)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/asset-types`
    })
  })

  it('allAssetTypesForShot lists the asset types casted in a shot', async () => {
    fake.reply(200, UNSORTED)
    const types = await kitsu.asset.allAssetTypesForShot(SHOT_ID)
    expect(namesOf(types)).toEqual(SORTED_NAMES)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/shots/${SHOT_ID}/asset-types`
    })
  })

  it('getAssetType accepts an object or an id and returns null on 404', async () => {
    fake.reply(200, { id: ASSET_TYPE_ID }).reply(404, {})
    expect(await kitsu.asset.getAssetType({ id: ASSET_TYPE_ID })).toEqual({
      id: ASSET_TYPE_ID
    })
    expect(await kitsu.asset.getAssetType(ASSET_TYPE_ID)).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/asset-types/${ASSET_TYPE_ID}`
    })
  })

  // The entity types also hold the types of the shots, sequences, episodes,
  // edits, scenes and concepts: the asset types only are looked up.
  it('getAssetTypeByName filters the asset types by name', async () => {
    fake.reply(200, [{ id: ASSET_TYPE_ID, name: 'Props' }]).reply(200, [])
    expect(await kitsu.asset.getAssetTypeByName('Props')).toEqual({
      id: ASSET_TYPE_ID,
      name: 'Props'
    })
    expect(await kitsu.asset.getAssetTypeByName('Shot')).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/asset-types'
    })
    expect(fake.calls[0].query.get('name')).toBe('Props')
  })

  // Zou matches a name filter with ILIKE: any case, _ and % as wildcards.
  it('getAssetTypeByName keeps the exact name, the case aside', async () => {
    const types = [
      { id: OTHER_ID, name: 'Set-Dress' },
      { id: ASSET_TYPE_ID, name: 'Set_Dress' }
    ]
    fake.reply(200, types).reply(200, types)
    expect(await kitsu.asset.getAssetTypeByName('set_dress')).toEqual(types[1])
    expect(await kitsu.asset.getAssetTypeByName('Set%')).toBeNull()
  })

  it('newAssetType creates the type when the name is free', async () => {
    fake.reply(200, []).reply(201, { id: ASSET_TYPE_ID, name: 'Props' })
    expect(await kitsu.asset.newAssetType('Props')).toEqual({
      id: ASSET_TYPE_ID,
      name: 'Props'
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/asset-types'
    })
    expect(fake.calls[0].query.get('name')).toBe('Props')
    expect(fake.calls[1]).toMatchObject({
      method: 'POST',
      path: '/data/entity-types',
      body: { name: 'Props' }
    })
  })

  it('newAssetType sends the short name, the description and the task types', async () => {
    fake.reply(200, []).reply(201, { id: ASSET_TYPE_ID, name: 'Props' })
    await kitsu.asset.newAssetType('Props', {
      shortName: 'PRP',
      description: 'Movable objects',
      taskTypes: [{ id: TASK_TYPE_ID }, OTHER_ID]
    })
    expect(fake.calls[1]).toMatchObject({
      method: 'POST',
      path: '/data/entity-types',
      body: {
        name: 'Props',
        short_name: 'PRP',
        description: 'Movable objects',
        task_types: [TASK_TYPE_ID, OTHER_ID]
      }
    })
  })

  it('newAssetType rejects a malformed task type before any request', async () => {
    await expect(
      kitsu.asset.newAssetType('Props', { taskTypes: ['modeling'] })
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('newAssetType returns the existing type instead of creating it', async () => {
    fake.reply(200, [{ id: ASSET_TYPE_ID, name: 'Props' }])
    expect(await kitsu.asset.newAssetType('Props')).toEqual({
      id: ASSET_TYPE_ID,
      name: 'Props'
    })
    expect(fake.calls).toHaveLength(1)
  })

  it('updateAssetType saves the editable fields, through the entity types route', async () => {
    fake.reply(200, { id: ASSET_TYPE_ID, name: 'Props' })
    // An asset type as getAssetType reads it.
    await kitsu.asset.updateAssetType({
      id: ASSET_TYPE_ID,
      name: 'Props',
      short_name: 'PRP',
      description: null,
      task_types: [TASK_TYPE_ID],
      archived: false,
      type: 'AssetType',
      created_at: '2026-01-01T10:00:00'
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/entity-types/${ASSET_TYPE_ID}`
    })
    expect(fake.calls[0].body).toEqual({
      name: 'Props',
      short_name: 'PRP',
      description: null,
      task_types: [TASK_TYPE_ID],
      archived: false
    })
  })

  it('updateAssetType sends only the given fields, task types as ids', async () => {
    fake.reply(200, { id: ASSET_TYPE_ID }).reply(200, { id: ASSET_TYPE_ID })
    await kitsu.asset.updateAssetType({ id: ASSET_TYPE_ID, archived: true })
    await kitsu.asset.updateAssetType({
      id: ASSET_TYPE_ID,
      task_types: [{ id: TASK_TYPE_ID }]
    })
    expect(fake.calls.map(call => call.body)).toEqual([
      { archived: true },
      { task_types: [TASK_TYPE_ID] }
    ])
  })

  // Zou would apply an empty body and answer the type unchanged.
  it('updateAssetType rejects a type with nothing to save before any request', async () => {
    const wrongTypes = [
      ASSET_TYPE_ID,
      { id: ASSET_TYPE_ID },
      { id: ASSET_TYPE_ID, created_at: '2026-01-01T10:00:00' },
      { id: ASSET_TYPE_ID, name: '' },
      { id: ASSET_TYPE_ID, task_types: TASK_TYPE_ID }
    ]
    const errors = await Promise.all(
      wrongTypes.map(assetType =>
        kitsu.asset.updateAssetType(assetType).catch(err => err)
      )
    )
    errors.forEach(err => expect(err).toBeInstanceOf(ParameterError))
    expect(fake.calls).toHaveLength(0)
  })

  it('removeAssetType deletes the type through the entity types route', async () => {
    fake.reply(204)
    await kitsu.asset.removeAssetType({ id: ASSET_TYPE_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/entity-types/${ASSET_TYPE_ID}`
    })
  })

  // The rows of allAssetsWithTasks name the type asset_type_id.
  it('getAssetTypeFromAsset reads the type of a row of allAssetsWithTasks', async () => {
    fake.reply(200, { id: ASSET_TYPE_ID, name: 'Props' })
    await kitsu.asset.getAssetTypeFromAsset({
      id: ASSET_ID,
      asset_type_id: ASSET_TYPE_ID,
      asset_type_name: 'Props'
    })
    expect(fake.calls).toHaveLength(1)
    expect(fake.calls[0].path).toBe(`/data/asset-types/${ASSET_TYPE_ID}`)
  })

  it('getAssetTypeFromAsset reads the asset first when given an id', async () => {
    fake
      .reply(200, { id: ASSET_ID, entity_type_id: ASSET_TYPE_ID })
      .reply(200, { id: ASSET_TYPE_ID, name: 'Props' })
      .reply(404, { message: 'Asset not found' })
    expect(await kitsu.asset.getAssetTypeFromAsset(ASSET_ID)).toEqual({
      id: ASSET_TYPE_ID,
      name: 'Props'
    })
    expect(await kitsu.asset.getAssetTypeFromAsset({ id: ASSET_ID })).toBeNull()
    expect(fake.calls.map(call => call.path)).toEqual([
      `/data/assets/${ASSET_ID}`,
      `/data/asset-types/${ASSET_TYPE_ID}`,
      `/data/assets/${ASSET_ID}`
    ])
  })

  it('getAssetTypeFromAsset rejects a malformed asset before any request', async () => {
    const errors = await Promise.all(
      [null, 'Props', { name: 'Chair' }].map(asset =>
        kitsu.asset.getAssetTypeFromAsset(asset).catch(err => err)
      )
    )
    errors.forEach(err => expect(err).toBeInstanceOf(ParameterError))
    expect(fake.calls).toHaveLength(0)
  })

  it('getAssetTypeFromAsset fetches the type of the asset', async () => {
    fake.reply(200, { id: ASSET_TYPE_ID, name: 'Props' })
    const assetType = await kitsu.asset.getAssetTypeFromAsset({
      id: ASSET_ID,
      entity_type_id: ASSET_TYPE_ID
    })
    expect(assetType).toEqual({ id: ASSET_TYPE_ID, name: 'Props' })
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/asset-types/${ASSET_TYPE_ID}`
    })
  })
})
