import { beforeEach, describe, expect, it } from 'vitest'

import { NotFoundError } from '../../src/core/errors.js'
import { ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import { jsonResponse } from '../helpers/fakeFetch.js'
import {
  ASSET_ID,
  ASSET_TYPE_ID,
  EPISODE_ID,
  OTHER_ID,
  PREVIEW_FILE_ID,
  PROJECT_ID,
  SHOT_ID,
  TASK_TYPE_ID
} from '../helpers/ids.js'

const UNSORTED = [{ name: 'tree' }, { name: 'Bunny' }, { name: 'lamp' }]
const SORTED_NAMES = ['Bunny', 'lamp', 'tree']
const namesOf = entries => entries.map(entry => entry.name)

describe('asset namespace: assets', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('allAssetsForProject lists the assets of a project', async () => {
    fake.reply(200, [{ id: ASSET_ID }])
    expect(await kitsu.asset.allAssetsForProject({ id: PROJECT_ID })).toEqual([
      { id: ASSET_ID }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/assets`
    })
  })

  it('allAssetsForProject sorts by name and lists everything without project', async () => {
    fake.reply(200, UNSORTED).reply(200, UNSORTED)
    expect(namesOf(await kitsu.asset.allAssetsForProject(PROJECT_ID))).toEqual(
      SORTED_NAMES
    )
    expect(namesOf(await kitsu.asset.allAssetsForProject(null))).toEqual(
      SORTED_NAMES
    )
    expect(fake.calls[1]).toMatchObject({
      method: 'GET',
      path: '/data/assets/all'
    })
  })

  it('allAssetsForOpenProjects gathers the assets of every open project', async () => {
    fake
      .on('GET', '/data/projects/open', () =>
        jsonResponse(200, [{ id: PROJECT_ID }, { id: OTHER_ID }])
      )
      .on('GET', `/data/projects/${PROJECT_ID}/assets`, () =>
        jsonResponse(200, [{ name: 'tree' }, { name: 'Bunny' }])
      )
      .on('GET', `/data/projects/${OTHER_ID}/assets`, () =>
        jsonResponse(200, [{ name: 'lamp' }])
      )
    const assets = await kitsu.asset.allAssetsForOpenProjects()
    expect(namesOf(assets)).toEqual(SORTED_NAMES)
    expect(fake.calls.map(call => call.path).sort()).toEqual([
      `/data/projects/${PROJECT_ID}/assets`,
      `/data/projects/${OTHER_ID}/assets`,
      '/data/projects/open'
    ])
  })

  it('allAssetsForEpisode filters the assets by source', async () => {
    fake.reply(200, UNSORTED)
    const assets = await kitsu.asset.allAssetsForEpisode({ id: EPISODE_ID })
    expect(namesOf(assets)).toEqual(SORTED_NAMES)
    expect(fake.calls[0]).toMatchObject({ method: 'GET', path: '/data/assets' })
    expect(fake.calls[0].query.get('source_id')).toBe(EPISODE_ID)
  })

  it('allAssetsForShot lists the assets casted in a shot', async () => {
    fake.reply(200, UNSORTED)
    expect(namesOf(await kitsu.asset.allAssetsForShot(SHOT_ID))).toEqual(
      SORTED_NAMES
    )
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/shots/${SHOT_ID}/assets`
    })
  })

  it('allAssetsForProjectAndType lists the assets of a type', async () => {
    fake.reply(200, UNSORTED)
    const assets = await kitsu.asset.allAssetsForProjectAndType(
      { id: PROJECT_ID },
      ASSET_TYPE_ID
    )
    expect(namesOf(assets)).toEqual(SORTED_NAMES)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/asset-types/${ASSET_TYPE_ID}/assets`
    })
  })

  it('getAssetByName filters by project, name and optional type', async () => {
    fake.reply(200, [{ id: ASSET_ID, name: 'Bunny' }]).reply(200, [])
    expect(
      await kitsu.asset.getAssetByName({ id: PROJECT_ID }, 'Bunny')
    ).toEqual({ id: ASSET_ID, name: 'Bunny' })
    expect(
      await kitsu.asset.getAssetByName(PROJECT_ID, 'Nope', {
        assetType: { id: ASSET_TYPE_ID }
      })
    ).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/assets/all'
    })
    expect(fake.calls[0].query.get('project_id')).toBe(PROJECT_ID)
    expect(fake.calls[0].query.get('name')).toBe('Bunny')
    expect(fake.calls[0].query.has('entity_type_id')).toBe(false)
    expect(fake.calls[1].query.get('entity_type_id')).toBe(ASSET_TYPE_ID)
  })

  it('getAsset accepts an object or an id and returns null on 404', async () => {
    fake.reply(200, { id: ASSET_ID }).reply(404, {})
    expect(await kitsu.asset.getAsset({ id: ASSET_ID })).toEqual({
      id: ASSET_ID
    })
    expect(await kitsu.asset.getAsset(ASSET_ID)).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/assets/${ASSET_ID}`
    })
  })

  it('newAsset creates the asset when the name is free', async () => {
    fake.reply(200, []).reply(201, { id: ASSET_ID, name: 'Bunny' })
    const asset = await kitsu.asset.newAsset(
      { id: PROJECT_ID },
      { id: ASSET_TYPE_ID },
      'Bunny'
    )
    expect(asset).toEqual({ id: ASSET_ID, name: 'Bunny' })
    expect(fake.calls[0].path).toBe('/data/assets/all')
    expect(fake.calls[0].query.get('project_id')).toBe(PROJECT_ID)
    expect(fake.calls[0].query.get('name')).toBe('Bunny')
    expect(fake.calls[0].query.get('entity_type_id')).toBe(ASSET_TYPE_ID)
    expect(fake.calls[1]).toMatchObject({
      method: 'POST',
      path: `/data/projects/${PROJECT_ID}/asset-types/${ASSET_TYPE_ID}/assets/new`
    })
    expect(fake.calls[1].body).toEqual({
      name: 'Bunny',
      data: {},
      is_shared: false
    })
  })

  it('newAsset sends the optional fields', async () => {
    fake.reply(200, []).reply(201, { id: ASSET_ID })
    await kitsu.asset.newAsset(PROJECT_ID, ASSET_TYPE_ID, 'Bunny', {
      description: 'A rabbit',
      extraData: { fur: true },
      episode: { id: EPISODE_ID },
      isShared: true
    })
    expect(fake.calls[1].body).toEqual({
      name: 'Bunny',
      data: { fur: true },
      is_shared: true,
      description: 'A rabbit',
      episode_id: EPISODE_ID
    })
  })

  it('newAsset returns the existing asset instead of creating it', async () => {
    fake.reply(200, [{ id: ASSET_ID, name: 'Bunny' }])
    const asset = await kitsu.asset.newAsset(PROJECT_ID, ASSET_TYPE_ID, 'Bunny')
    expect(asset).toEqual({ id: ASSET_ID, name: 'Bunny' })
    expect(fake.calls).toHaveLength(1)
  })

  it('updateAsset saves the asset through the entities route', async () => {
    fake.reply(200, { id: ASSET_ID, name: 'Bunny' })
    const asset = { id: ASSET_ID, name: 'Bunny' }
    expect(await kitsu.asset.updateAsset(asset)).toEqual(asset)
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/entities/${ASSET_ID}`
    })
    expect(fake.calls[0].body).toEqual({ name: 'Bunny' })
    expect(asset).toEqual({ id: ASSET_ID, name: 'Bunny' })
  })

  it('updateAsset maps episode_id to source_id without mutating', async () => {
    fake.reply(200, { id: ASSET_ID })
    const asset = { id: ASSET_ID, episode_id: EPISODE_ID }
    await kitsu.asset.updateAsset(asset)
    expect(fake.calls[0].body).toEqual({
      episode_id: EPISODE_ID,
      source_id: EPISODE_ID
    })
    expect(asset).toEqual({ id: ASSET_ID, episode_id: EPISODE_ID })
  })

  it('updateAsset sends null for the placeholders of getAsset', async () => {
    // A missing preview, ready_for or episode reads as '', 'None' and '':
    // Zou answers 400 when they are sent back.
    fake.reply(200, { id: ASSET_ID })
    const asset = Object.freeze({
      id: ASSET_ID,
      name: 'Chair',
      description: 'A red chair',
      preview_file_id: '',
      ready_for: 'None',
      episode_id: '',
      asset_type_name: 'Props'
    })
    await kitsu.asset.updateAsset(asset)
    expect(fake.calls[0].body).toEqual({
      name: 'Chair',
      description: 'A red chair',
      preview_file_id: null,
      ready_for: null,
      episode_id: '',
      source_id: null,
      asset_type_name: 'Props'
    })
  })

  it('updateAsset sends null for the placeholders without mutating', async () => {
    // Without episode_id, nothing copies the asset to add source_id: the
    // frozen asset throws if its placeholders are replaced in place.
    fake.reply(200, { id: ASSET_ID })
    const asset = Object.freeze({
      id: ASSET_ID,
      preview_file_id: '',
      ready_for: 'None'
    })
    await kitsu.asset.updateAsset(asset)
    expect(fake.calls[0].body).toEqual({
      preview_file_id: null,
      ready_for: null
    })
  })

  it('updateAsset keeps the ids of a preview, a ready_for and an episode', async () => {
    fake.reply(200, { id: ASSET_ID })
    await kitsu.asset.updateAsset({
      id: ASSET_ID,
      preview_file_id: PREVIEW_FILE_ID,
      ready_for: TASK_TYPE_ID,
      episode_id: EPISODE_ID
    })
    expect(fake.calls[0].body).toEqual({
      preview_file_id: PREVIEW_FILE_ID,
      ready_for: TASK_TYPE_ID,
      episode_id: EPISODE_ID,
      source_id: EPISODE_ID
    })
  })

  it('updateAssetData sends only the given keys, Zou merges them', async () => {
    fake.reply(200, { id: ASSET_ID, data: { fur: true, age: 3 } })
    const data = { age: 3 }
    const updated = await kitsu.asset.updateAssetData({ id: ASSET_ID }, data)
    expect(updated).toEqual({ id: ASSET_ID, data: { fur: true, age: 3 } })
    expect(fake.calls).toHaveLength(1)
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/entities/${ASSET_ID}`
    })
    expect(fake.calls[0].body).toEqual({ data: { age: 3 } })
    expect(data).toEqual({ age: 3 })
  })

  it('updateAssetData sends empty metadata when no data is given', async () => {
    fake.reply(200, { id: ASSET_ID })
    await kitsu.asset.updateAssetData(ASSET_ID, null)
    expect(fake.calls[0].body).toEqual({ data: {} })
  })

  it('updateAssetData rejects with NotFoundError on a missing asset', async () => {
    fake.reply(404, {})
    await expect(
      kitsu.asset.updateAssetData(ASSET_ID, { age: 3 })
    ).rejects.toBeInstanceOf(NotFoundError)
    expect(fake.calls).toHaveLength(1)
    expect(fake.calls[0].method).toBe('PUT')
  })

  it('removeAsset deletes the asset, forcing on demand', async () => {
    fake.reply(204).reply(204)
    await kitsu.asset.removeAsset(ASSET_ID)
    await kitsu.asset.removeAsset({ id: ASSET_ID }, { force: true })
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/assets/${ASSET_ID}`
    })
    expect(fake.calls[0].query.has('force')).toBe(false)
    expect(fake.calls[1].query.get('force')).toBe('true')
  })

  it('first-match lookups reject a blank filter before any request', async () => {
    const lookups = [
      () => kitsu.asset.getAssetByName(PROJECT_ID, ''),
      () => kitsu.asset.getAssetByName(PROJECT_ID, undefined),
      () => kitsu.asset.getAssetTypeByName(''),
      () => kitsu.asset.newAssetType('')
    ]
    const errors = await Promise.all(
      lookups.map(lookup => lookup().catch(err => err))
    )
    errors.forEach(err => expect(err).toBeInstanceOf(ParameterError))
    expect(fake.calls).toHaveLength(0)
  })
})
