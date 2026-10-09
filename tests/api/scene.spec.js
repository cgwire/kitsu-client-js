import { beforeEach, describe, expect, it } from 'vitest'

import { ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import {
  ASSET_ID,
  ASSET_INSTANCE_ID,
  OTHER_ID,
  PROJECT_ID,
  SCENE_ID,
  SEQUENCE_ID,
  SHOT_ID
} from '../helpers/ids.js'

const UNSORTED = [{ name: 'sc030' }, { name: 'SC010' }, { name: 'sc020' }]
const SORTED_NAMES = ['SC010', 'sc020', 'sc030']

describe('scene namespace: reads', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('allScenes lists every scene sorted by name', async () => {
    fake.reply(200, UNSORTED)
    const scenes = await kitsu.scene.allScenes()
    expect(scenes.map(scene => scene.name)).toEqual(SORTED_NAMES)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/scenes/all'
    })
  })

  it('allScenes narrows the list to a project', async () => {
    fake.reply(200, UNSORTED)
    const scenes = await kitsu.scene.allScenes({ project: { id: PROJECT_ID } })
    expect(scenes.map(scene => scene.name)).toEqual(SORTED_NAMES)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/scenes`
    })
  })

  it('allScenesForProject lists the scenes sorted by name', async () => {
    fake.reply(200, UNSORTED)
    const scenes = await kitsu.scene.allScenesForProject(PROJECT_ID)
    expect(scenes.map(scene => scene.name)).toEqual(SORTED_NAMES)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/scenes`
    })
  })

  it('allScenesForProject rejects a missing project', async () => {
    await expect(kitsu.scene.allScenesForProject(null)).rejects.toBeInstanceOf(
      ParameterError
    )
    expect(fake.calls).toHaveLength(0)
  })

  it('allScenesForSequence lists the scenes sorted by name', async () => {
    fake.reply(200, UNSORTED)
    const scenes = await kitsu.scene.allScenesForSequence({ id: SEQUENCE_ID })
    expect(scenes.map(scene => scene.name)).toEqual(SORTED_NAMES)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/sequences/${SEQUENCE_ID}/scenes`
    })
  })

  it('getScene reads a scene and gives null on a 404', async () => {
    fake.reply(200, { id: SCENE_ID, name: 'SC010' }).reply(404, {})
    expect(await kitsu.scene.getScene(SCENE_ID)).toMatchObject({
      name: 'SC010'
    })
    expect(await kitsu.scene.getScene({ id: SCENE_ID })).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/scenes/${SCENE_ID}`
    })
  })

  it('getSceneByName looks a scene up inside its sequence', async () => {
    fake.reply(200, [{ id: SCENE_ID, name: 'SC010' }]).reply(200, [])
    expect(
      await kitsu.scene.getSceneByName({ id: SEQUENCE_ID }, 'SC010')
    ).toMatchObject({ id: SCENE_ID })
    expect(await kitsu.scene.getSceneByName(SEQUENCE_ID, 'nope')).toBeNull()
    expect(fake.calls[0].path).toBe('/data/scenes/all')
    expect(fake.calls[0].query.get('parent_id')).toBe(SEQUENCE_ID)
    expect(fake.calls[0].query.get('name')).toBe('SC010')
  })

  it('getSceneByName rejects a blank name', async () => {
    await expect(
      kitsu.scene.getSceneByName(SEQUENCE_ID, '')
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('allAssetInstancesForScene lists the instances of a scene', async () => {
    fake.reply(200, [{ id: ASSET_INSTANCE_ID }])
    expect(
      await kitsu.scene.allAssetInstancesForScene({ id: SCENE_ID })
    ).toEqual([{ id: ASSET_INSTANCE_ID }])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/scenes/${SCENE_ID}/asset-instances`
    })
  })

  it('getAssetInstanceByName looks an instance up inside its scene', async () => {
    fake.reply(200, [{ id: ASSET_INSTANCE_ID, name: 'chair_0001' }])
    fake.reply(200, [])
    expect(
      await kitsu.scene.getAssetInstanceByName({ id: SCENE_ID }, 'chair_0001')
    ).toMatchObject({ id: ASSET_INSTANCE_ID })
    expect(
      await kitsu.scene.getAssetInstanceByName(SCENE_ID, 'nope')
    ).toBeNull()
    expect(fake.calls[0].path).toBe('/data/asset-instances')
    expect(fake.calls[0].query.get('name')).toBe('chair_0001')
    expect(fake.calls[0].query.get('scene_id')).toBe(SCENE_ID)
  })

  it('getAssetInstanceByName rejects a blank name', async () => {
    await expect(
      kitsu.scene.getAssetInstanceByName(SCENE_ID, undefined)
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('allCameraInstancesForScene lists the cameras of a scene', async () => {
    fake.reply(200, [{ id: OTHER_ID }])
    expect(await kitsu.scene.allCameraInstancesForScene(SCENE_ID)).toEqual([
      { id: OTHER_ID }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/scenes/${SCENE_ID}/camera-instances`
    })
  })

  it('allShotsForScene lists the shots issued from a scene', async () => {
    fake.reply(200, [{ id: SHOT_ID }])
    expect(await kitsu.scene.allShotsForScene({ id: SCENE_ID })).toEqual([
      { id: SHOT_ID }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/scenes/${SCENE_ID}/shots`
    })
  })

  it('getSequenceFromScene reads the parent of a scene object', async () => {
    fake.reply(200, { id: SEQUENCE_ID, name: 'SQ01' })
    expect(
      await kitsu.scene.getSequenceFromScene({
        id: SCENE_ID,
        parent_id: SEQUENCE_ID
      })
    ).toMatchObject({ name: 'SQ01' })
    expect(fake.calls).toHaveLength(1)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/sequences/${SEQUENCE_ID}`
    })
  })

  it('getSequenceFromScene reads the scene first when given an id', async () => {
    fake
      .reply(200, { id: SCENE_ID, parent_id: SEQUENCE_ID })
      .reply(200, { id: SEQUENCE_ID })
    expect(await kitsu.scene.getSequenceFromScene(SCENE_ID)).toEqual({
      id: SEQUENCE_ID
    })
    expect(fake.calls.map(call => call.path)).toEqual([
      `/data/scenes/${SCENE_ID}`,
      `/data/sequences/${SEQUENCE_ID}`
    ])
  })

  it('getSequenceFromScene gives null for a missing scene', async () => {
    fake.reply(404, {})
    expect(await kitsu.scene.getSequenceFromScene(SCENE_ID)).toBeNull()
    expect(fake.calls).toHaveLength(1)
  })
})

describe('scene namespace: writes', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('newScene creates a scene in a sequence', async () => {
    fake.reply(201, { id: SCENE_ID, name: 'SC010' })
    expect(
      await kitsu.scene.newScene({ id: PROJECT_ID }, SEQUENCE_ID, 'SC010')
    ).toMatchObject({ id: SCENE_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/data/projects/${PROJECT_ID}/scenes`
    })
    expect(fake.calls[0].body).toEqual({
      name: 'SC010',
      sequence_id: SEQUENCE_ID
    })
  })

  it('updateScene saves the scene through the entity route', async () => {
    const scene = { id: SCENE_ID, name: 'SC011' }
    fake.reply(200, scene)
    expect(await kitsu.scene.updateScene(scene)).toEqual(scene)
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/entities/${SCENE_ID}`
    })
    expect(fake.calls[0].body).toEqual({ name: 'SC011' })
    expect(scene).toEqual({ id: SCENE_ID, name: 'SC011' })
  })

  it('newSceneAssetInstance instantiates an asset in a scene', async () => {
    fake.reply(201, { id: ASSET_INSTANCE_ID }).reply(201, {})
    expect(
      await kitsu.scene.newSceneAssetInstance({ id: SCENE_ID }, ASSET_ID)
    ).toEqual({ id: ASSET_INSTANCE_ID })
    await kitsu.scene.newSceneAssetInstance(
      SCENE_ID,
      { id: ASSET_ID },
      { description: 'left chair' }
    )
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/data/scenes/${SCENE_ID}/asset-instances`
    })
    expect(fake.calls[0].body).toEqual({ asset_id: ASSET_ID })
    expect(fake.calls[1].body).toEqual({
      asset_id: ASSET_ID,
      description: 'left chair'
    })
  })

  it('addShotToScene links a shot to a scene', async () => {
    fake.reply(201, { id: SHOT_ID })
    await kitsu.scene.addShotToScene({ id: SCENE_ID }, { id: SHOT_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/data/scenes/${SCENE_ID}/shots`
    })
    expect(fake.calls[0].body).toEqual({ shot_id: SHOT_ID })
  })

  it('removeShotFromScene unlinks a shot from a scene', async () => {
    fake.reply(204)
    await kitsu.scene.removeShotFromScene(SCENE_ID, { id: SHOT_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/scenes/${SCENE_ID}/shots/${SHOT_ID}`
    })
    expect(fake.calls[0].body).toBeUndefined()
  })

  it('removeShotFromScene forwards the signal instead of sending it', async () => {
    const controller = new AbortController()
    controller.abort()
    fake.reply(204)
    await kitsu.scene
      .removeShotFromScene(SCENE_ID, SHOT_ID, { signal: controller.signal })
      .catch(() => {})
    expect(fake.calls[0].body).toBeUndefined()
    expect(fake.calls[0].signal.aborted).toBe(true)
  })

  it('updateAssetInstanceName renames an asset instance', async () => {
    fake.reply(200, { id: ASSET_INSTANCE_ID, name: 'chair_0002' })
    expect(
      await kitsu.scene.updateAssetInstanceName(
        { id: ASSET_INSTANCE_ID },
        'chair_0002'
      )
    ).toMatchObject({ name: 'chair_0002' })
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/asset-instances/${ASSET_INSTANCE_ID}`
    })
    expect(fake.calls[0].body).toEqual({ name: 'chair_0002' })
  })

  it('updateAssetInstanceData replaces the data of an instance', async () => {
    const data = { translation: [0, 1, 0] }
    fake.reply(200, { id: ASSET_INSTANCE_ID, data })
    await kitsu.scene.updateAssetInstanceData(ASSET_INSTANCE_ID, data)
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/asset-instances/${ASSET_INSTANCE_ID}`
    })
    expect(fake.calls[0].body).toEqual({ data })
  })
})
