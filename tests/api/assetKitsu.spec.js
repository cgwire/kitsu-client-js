import { beforeEach, describe, expect, it } from 'vitest'

import { ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import {
  ASSET_ID,
  ASSET_TYPE_ID,
  EPISODE_ID,
  PROJECT_ID
} from '../helpers/ids.js'

// The asset fields of the compact with-tasks rows, as Zou declares them.
const ASSET_FIELDS = [
  'id',
  'name',
  'preview_file_id',
  'description',
  'asset_type_name',
  'asset_type_id',
  'canceled',
  'ready_for',
  'episode_id',
  'casting_episode_ids',
  'is_casting_standby',
  'is_shared',
  'data',
  'tasks'
]

const ndjsonResponse = lines =>
  new Response(lines.map(line => JSON.stringify(line)).join('\n'), {
    status: 200,
    headers: { 'Content-Type': 'application/x-ndjson' }
  })

describe('asset namespace: Kitsu coverage', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('allAssets lists every asset, sorted by name, without any filter', async () => {
    fake.reply(200, [
      { id: ASSET_ID, name: 'Tree' },
      { id: ASSET_TYPE_ID, name: 'hero' }
    ])
    expect(await kitsu.asset.allAssets()).toEqual([
      { id: ASSET_TYPE_ID, name: 'hero' },
      { id: ASSET_ID, name: 'Tree' }
    ])
    expect(fake.calls[0]).toMatchObject({ method: 'GET', path: '/data/assets' })
    expect([...fake.calls[0].query.keys()]).toEqual([])
  })

  it('allAssets filters on the project, the episode and the shared flag', async () => {
    fake.reply(200, [])
    await kitsu.asset.allAssets({
      project: { id: PROJECT_ID },
      episode: EPISODE_ID,
      isShared: false
    })
    expect(fake.calls[0].path).toBe('/data/assets')
    expect(Object.fromEntries(fake.calls[0].query)).toEqual({
      project_id: PROJECT_ID,
      episode_id: EPISODE_ID,
      is_shared: 'false'
    })
  })

  it('allAssets rejects a malformed project without any request', async () => {
    await expect(
      kitsu.asset.allAssets({ project: 'not-an-id' })
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('allAssetsWithTasks streams the assets with their tasks', async () => {
    fake.on('GET', '/data/assets/with-tasks', () =>
      ndjsonResponse([
        { compact: true, asset_fields: ['id', 'tasks'], task_fields: ['id'] },
        [ASSET_ID, []]
      ])
    )
    expect(
      await kitsu.asset.allAssetsWithTasks(
        { id: PROJECT_ID },
        { episode: { id: EPISODE_ID } }
      )
    ).toEqual([{ id: ASSET_ID, tasks: [] }])
    expect(fake.calls).toHaveLength(1)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/assets/with-tasks'
    })
    expect(Object.fromEntries(fake.calls[0].query)).toEqual({
      project_id: PROJECT_ID,
      episode_id: EPISODE_ID,
      stream: 'true',
      compact: 'true'
    })
  })

  it('updateAsset saves back a row of allAssetsWithTasks', async () => {
    fake.on('GET', '/data/assets/with-tasks', () =>
      ndjsonResponse([
        { compact: true, asset_fields: ASSET_FIELDS, task_fields: ['id'] },
        [
          ASSET_ID,
          'Chair',
          '',
          '',
          'Props',
          ASSET_TYPE_ID,
          false,
          'None',
          '',
          [],
          false,
          false,
          {},
          []
        ]
      ])
    )
    fake.reply(200, { id: ASSET_ID })
    const [asset] = await kitsu.asset.allAssetsWithTasks(PROJECT_ID)
    await kitsu.asset.updateAsset(
      Object.freeze({ ...asset, description: 'A red chair' })
    )
    expect(fake.calls[1].body).toMatchObject({
      description: 'A red chair',
      preview_file_id: null,
      ready_for: null,
      source_id: null
    })
  })

  it('allAssetsWithTasks works without an episode', async () => {
    fake.on('GET', '/data/assets/with-tasks', () =>
      ndjsonResponse([{ compact: false }, { id: ASSET_ID, tasks: [] }])
    )
    expect(await kitsu.asset.allAssetsWithTasks(PROJECT_ID)).toEqual([
      { id: ASSET_ID, tasks: [] }
    ])
    expect([...fake.calls[0].query.keys()].sort()).toEqual([
      'compact',
      'project_id',
      'stream'
    ])
  })

  // Without a project, Zou lists every production to an admin.
  it('allAssetsWithTasks rejects a missing project before any request', async () => {
    const errors = await Promise.all(
      [
        kitsu.asset.allAssetsWithTasks(),
        // The options of the former call shape are not a project.
        kitsu.asset.allAssetsWithTasks({ project: PROJECT_ID })
      ].map(promise => promise.catch(err => err))
    )
    errors.forEach(err => expect(err).toBeInstanceOf(ParameterError))
    expect(fake.calls).toHaveLength(0)
  })

  it('allSharedAssetsUsedInProject lists the shared assets used in the project', async () => {
    fake.reply(200, [
      { id: ASSET_ID, name: 'Tree' },
      { id: ASSET_TYPE_ID, name: 'Hero' }
    ])
    expect(
      await kitsu.asset.allSharedAssetsUsedInProject({ id: PROJECT_ID })
    ).toEqual([
      { id: ASSET_TYPE_ID, name: 'Hero' },
      { id: ASSET_ID, name: 'Tree' }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/assets/shared-used`
    })
  })

  it('allSharedAssetsUsedInProject switches to the episode route', async () => {
    fake.reply(200, [])
    await kitsu.asset.allSharedAssetsUsedInProject(PROJECT_ID, {
      episode: { id: EPISODE_ID }
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/episodes/${EPISODE_ID}/assets/shared-used`
    })
  })

  it('shareAssets shares the given assets', async () => {
    fake.reply(200, [{ id: ASSET_ID, is_shared: true }])
    expect(
      await kitsu.asset.shareAssets({ assets: [{ id: ASSET_ID }] })
    ).toEqual([{ id: ASSET_ID, is_shared: true }])
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: '/actions/assets/share',
      body: { asset_ids: [ASSET_ID], is_shared: true }
    })
  })

  it('shareAssets shares or unshares assets of a project', async () => {
    fake.reply(200, []).reply(200, [])
    await kitsu.asset.shareAssets({ project: { id: PROJECT_ID }, all: true })
    await kitsu.asset.shareAssets({
      project: PROJECT_ID,
      assets: [ASSET_ID],
      isShared: false
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/actions/projects/${PROJECT_ID}/assets/share`,
      body: { is_shared: true }
    })
    expect(fake.calls[0].body).not.toHaveProperty('asset_ids')
    expect(fake.calls[1].body).toEqual({
      asset_ids: [ASSET_ID],
      is_shared: false
    })
  })

  it('shareAssets shares the assets of an asset type of a project', async () => {
    fake.reply(200, [])
    await kitsu.asset.shareAssets({
      project: PROJECT_ID,
      assetType: { id: ASSET_TYPE_ID }
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/actions/projects/${PROJECT_ID}/asset-types/${ASSET_TYPE_ID}/assets/share`,
      body: { is_shared: true }
    })
  })

  it('shareAssets rejects an asset type without its project', async () => {
    await expect(
      kitsu.asset.shareAssets({ assetType: ASSET_TYPE_ID })
    ).rejects.toThrow(/project is required with assetType/)
    expect(fake.calls).toHaveLength(0)
  })

  it('shareAssets rejects a global call without assets', async () => {
    await expect(kitsu.asset.shareAssets()).rejects.toBeInstanceOf(
      ParameterError
    )
    expect(fake.calls).toHaveLength(0)
  })

  // On the project route, Zou reads an empty list as every asset of the
  // project, and the asset type route ignores the list.
  it('shareAssets rejects an empty or ambiguous selection before any request', async () => {
    const calls = [
      { project: PROJECT_ID, assets: [], isShared: false },
      { assets: [], all: true },
      { project: PROJECT_ID },
      { project: PROJECT_ID, assets: ASSET_ID },
      { project: PROJECT_ID, assets: [ASSET_ID], assetType: ASSET_TYPE_ID },
      { project: PROJECT_ID, assets: [ASSET_ID], all: true },
      { project: PROJECT_ID, assetType: ASSET_TYPE_ID, all: true },
      { all: true }
    ]
    const errors = await Promise.all(
      calls.map(options => kitsu.asset.shareAssets(options).catch(err => err))
    )
    errors.forEach(err => expect(err).toBeInstanceOf(ParameterError))
    expect(fake.calls).toHaveLength(0)
  })

  // Without project, Zou shares none of an empty list and answers [].
  it('shareAssets resolves an empty list without project to [] without any request', async () => {
    expect(await kitsu.asset.shareAssets({ assets: [] })).toEqual([])
    expect(
      await kitsu.asset.shareAssets({ assets: [], isShared: false })
    ).toEqual([])
    expect(fake.calls).toHaveLength(0)
  })
})
