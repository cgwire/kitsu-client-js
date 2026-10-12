import { beforeEach, describe, expect, it } from 'vitest'

import { NotFoundError, ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import {
  ASSET_ID,
  ASSET_INSTANCE_ID,
  EPISODE_ID,
  OTHER_ID,
  SHOT_ID
} from '../helpers/ids.js'

describe('asset namespace: asset instances', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('getAssetInstance accepts an object or an id and returns null on 404', async () => {
    fake.reply(200, { id: ASSET_INSTANCE_ID }).reply(404, {})
    expect(
      await kitsu.asset.getAssetInstance({ id: ASSET_INSTANCE_ID })
    ).toEqual({ id: ASSET_INSTANCE_ID })
    expect(await kitsu.asset.getAssetInstance(ASSET_INSTANCE_ID)).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/asset-instances/${ASSET_INSTANCE_ID}`
    })
  })

  it('allShotAssetInstancesForAsset lists the instances in shots', async () => {
    fake.reply(200, [{ id: ASSET_INSTANCE_ID }])
    expect(
      await kitsu.asset.allShotAssetInstancesForAsset({ id: ASSET_ID })
    ).toEqual([{ id: ASSET_INSTANCE_ID }])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/assets/${ASSET_ID}/shot-asset-instances`
    })
  })

  it('allSceneAssetInstancesForAsset lists the instances in scenes', async () => {
    fake.reply(200, [{ id: ASSET_INSTANCE_ID }])
    expect(await kitsu.asset.allSceneAssetInstancesForAsset(ASSET_ID)).toEqual([
      { id: ASSET_INSTANCE_ID }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/assets/${ASSET_ID}/scene-asset-instances`
    })
  })

  it('allAssetInstancesForShot lists the instances linked to a shot', async () => {
    fake.reply(200, [{ id: ASSET_INSTANCE_ID }])
    expect(await kitsu.asset.allAssetInstancesForShot({ id: SHOT_ID })).toEqual(
      [{ id: ASSET_INSTANCE_ID }]
    )
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/shots/${SHOT_ID}/asset-instances`
    })
  })

  it('allAssetInstancesForAsset lists the instances inside an asset', async () => {
    fake.reply(200, [{ id: ASSET_INSTANCE_ID }])
    expect(await kitsu.asset.allAssetInstancesForAsset(ASSET_ID)).toEqual([
      { id: ASSET_INSTANCE_ID }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/assets/${ASSET_ID}/asset-asset-instances`
    })
  })

  it('enableAssetInstance sets the active flag', async () => {
    fake.reply(200, { id: ASSET_INSTANCE_ID, active: true })
    expect(
      await kitsu.asset.enableAssetInstance({ id: ASSET_INSTANCE_ID })
    ).toEqual({ id: ASSET_INSTANCE_ID, active: true })
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/asset-instances/${ASSET_INSTANCE_ID}`
    })
    expect(fake.calls[0].body).toEqual({ active: true })
  })

  it('disableAssetInstance clears the active flag', async () => {
    fake.reply(200, { id: ASSET_INSTANCE_ID, active: false })
    await kitsu.asset.disableAssetInstance(ASSET_INSTANCE_ID)
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/asset-instances/${ASSET_INSTANCE_ID}`
    })
    expect(fake.calls[0].body).toEqual({ active: false })
  })

  it('newAssetAssetInstance instantiates an asset inside another', async () => {
    fake.reply(201, { id: ASSET_INSTANCE_ID }).reply(201, {})
    expect(
      await kitsu.asset.newAssetAssetInstance({ id: ASSET_ID }, OTHER_ID)
    ).toEqual({ id: ASSET_INSTANCE_ID })
    await kitsu.asset.newAssetAssetInstance(
      ASSET_ID,
      { id: OTHER_ID },
      { description: 'Second chair' }
    )
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/data/assets/${ASSET_ID}/asset-asset-instances`
    })
    expect(fake.calls[0].body).toEqual({ asset_to_instantiate_id: OTHER_ID })
    expect(fake.calls[1].body).toEqual({
      asset_to_instantiate_id: OTHER_ID,
      description: 'Second chair'
    })
  })

  it('getEpisodeFromAsset fetches the episode from source_id or episode_id', async () => {
    fake.reply(200, { id: EPISODE_ID }).reply(200, { id: OTHER_ID })
    expect(
      await kitsu.asset.getEpisodeFromAsset({
        id: ASSET_ID,
        source_id: EPISODE_ID,
        episode_id: OTHER_ID
      })
    ).toEqual({ id: EPISODE_ID })
    await kitsu.asset.getEpisodeFromAsset({
      id: ASSET_ID,
      episode_id: OTHER_ID
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/episodes/${EPISODE_ID}`
    })
    expect(fake.calls[1].path).toBe(`/data/episodes/${OTHER_ID}`)
  })

  it('getEpisodeFromAsset returns null without request for a main pack asset', async () => {
    fake.reply(404, {})
    expect(
      await kitsu.asset.getEpisodeFromAsset({ id: ASSET_ID, source_id: null })
    ).toBeNull()
    expect(fake.calls).toHaveLength(0)
    expect(
      await kitsu.asset.getEpisodeFromAsset({
        id: ASSET_ID,
        source_id: EPISODE_ID
      })
    ).toBeNull()
    expect(fake.calls).toHaveLength(1)
  })

  // getAsset and allAssetsWithTasks give no source_id and an empty
  // episode_id for a main pack asset.
  it('getEpisodeFromAsset returns null without request for an empty episode_id', async () => {
    expect(
      await kitsu.asset.getEpisodeFromAsset({ id: ASSET_ID, episode_id: '' })
    ).toBeNull()
    expect(fake.calls).toHaveLength(0)
  })

  // Neither an id nor a bare reference says whether the asset is in the
  // main pack.
  it('getEpisodeFromAsset reads the asset given as an id or without its episode', async () => {
    fake
      .reply(200, { id: ASSET_ID, episode_id: EPISODE_ID })
      .reply(200, { id: EPISODE_ID })
      .reply(200, { id: ASSET_ID, episode_id: '' })
    expect(await kitsu.asset.getEpisodeFromAsset(ASSET_ID)).toEqual({
      id: EPISODE_ID
    })
    expect(await kitsu.asset.getEpisodeFromAsset({ id: ASSET_ID })).toBeNull()
    expect(fake.calls.map(call => call.path)).toEqual([
      `/data/assets/${ASSET_ID}`,
      `/data/episodes/${EPISODE_ID}`,
      `/data/assets/${ASSET_ID}`
    ])
  })

  it('getEpisodeFromAsset rejects when the asset is missing', async () => {
    fake.reply(404, {})
    await expect(
      kitsu.asset.getEpisodeFromAsset(ASSET_ID)
    ).rejects.toBeInstanceOf(NotFoundError)
    expect(fake.calls).toHaveLength(1)
  })

  it('getEpisodeFromAsset rejects a malformed asset without any request', async () => {
    await expect(kitsu.asset.getEpisodeFromAsset(null)).rejects.toBeInstanceOf(
      ParameterError
    )
    await expect(
      kitsu.asset.getEpisodeFromAsset('Tree')
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })
})
