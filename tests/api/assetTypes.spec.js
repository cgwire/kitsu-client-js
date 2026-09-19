import { beforeEach, describe, expect, it } from 'vitest'

import { makeClient } from '../helpers/client.js'
import { ASSET_ID, ASSET_TYPE_ID, PROJECT_ID, SHOT_ID } from '../helpers/ids.js'

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

  it('getAssetTypeByName filters the entity types by name', async () => {
    fake.reply(200, [{ id: ASSET_TYPE_ID, name: 'Props' }]).reply(200, [])
    expect(await kitsu.asset.getAssetTypeByName('Props')).toEqual({
      id: ASSET_TYPE_ID,
      name: 'Props'
    })
    expect(await kitsu.asset.getAssetTypeByName('Nope')).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/entity-types'
    })
    expect(fake.calls[0].query.get('name')).toBe('Props')
  })

  it('newAssetType creates the type when the name is free', async () => {
    fake.reply(200, []).reply(201, { id: ASSET_TYPE_ID, name: 'Props' })
    expect(await kitsu.asset.newAssetType('Props')).toEqual({
      id: ASSET_TYPE_ID,
      name: 'Props'
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/entity-types'
    })
    expect(fake.calls[0].query.get('name')).toBe('Props')
    expect(fake.calls[1]).toMatchObject({
      method: 'POST',
      path: '/data/entity-types',
      body: { name: 'Props' }
    })
  })

  it('newAssetType returns the existing type instead of creating it', async () => {
    fake.reply(200, [{ id: ASSET_TYPE_ID, name: 'Props' }])
    expect(await kitsu.asset.newAssetType('Props')).toEqual({
      id: ASSET_TYPE_ID,
      name: 'Props'
    })
    expect(fake.calls).toHaveLength(1)
  })

  it('updateAssetType saves only the name, through the entity types route', async () => {
    fake.reply(200, { id: ASSET_TYPE_ID, name: 'Props' })
    await kitsu.asset.updateAssetType({
      id: ASSET_TYPE_ID,
      name: 'Props',
      created_at: '2026-01-01'
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/entity-types/${ASSET_TYPE_ID}`
    })
    expect(fake.calls[0].body).toEqual({ name: 'Props' })
  })

  it('removeAssetType deletes the type through the entity types route', async () => {
    fake.reply(204)
    await kitsu.asset.removeAssetType({ id: ASSET_TYPE_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/entity-types/${ASSET_TYPE_ID}`
    })
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
