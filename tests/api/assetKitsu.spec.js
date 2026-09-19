import { beforeEach, describe, expect, it } from 'vitest'

import { ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import {
  ASSET_ID,
  ASSET_TYPE_ID,
  EPISODE_ID,
  PROJECT_ID
} from '../helpers/ids.js'

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
      await kitsu.asset.allAssetsWithTasks({
        project: { id: PROJECT_ID },
        episode: { id: EPISODE_ID }
      })
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

  it('allAssetsWithTasks works without any filter', async () => {
    fake.on('GET', '/data/assets/with-tasks', () =>
      ndjsonResponse([{ compact: false }, { id: ASSET_ID, tasks: [] }])
    )
    expect(await kitsu.asset.allAssetsWithTasks()).toEqual([
      { id: ASSET_ID, tasks: [] }
    ])
    expect([...fake.calls[0].query.keys()].sort()).toEqual([
      'compact',
      'stream'
    ])
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
    await kitsu.asset.shareAssets({ project: { id: PROJECT_ID } })
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
      kitsu.asset.shareAssets({ assetType: ASSET_TYPE_ID, assets: [ASSET_ID] })
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('shareAssets rejects a global call without assets', async () => {
    await expect(kitsu.asset.shareAssets()).rejects.toBeInstanceOf(
      ParameterError
    )
    expect(fake.calls).toHaveLength(0)
  })
})
