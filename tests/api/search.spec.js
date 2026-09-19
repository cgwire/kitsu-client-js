import { beforeEach, describe, expect, it } from 'vitest'

import { ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import { ASSET_TYPE_ID, OTHER_ID, PROJECT_ID } from '../helpers/ids.js'

describe('search namespace', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('searchEntities posts the bare query', async () => {
    const results = { persons: [], assets: [{ id: OTHER_ID }], shots: [] }
    fake.reply(200, results)
    expect(await kitsu.search.searchEntities('hero')).toEqual(results)
    expect(fake.calls).toHaveLength(1)
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: '/data/search'
    })
    expect(fake.calls[0].body).toEqual({ query: 'hero' })
  })

  it('searchEntities limits the search to a project', async () => {
    fake.reply(200, {})
    await kitsu.search.searchEntities('hero', { project: { id: PROJECT_ID } })
    expect(fake.calls[0].body).toEqual({
      query: 'hero',
      project_id: PROJECT_ID
    })
  })

  it('searchEntities filters by entity types, objects or ids', async () => {
    fake.reply(200, {})
    await kitsu.search.searchEntities('hero', {
      project: PROJECT_ID,
      entityTypes: [{ id: ASSET_TYPE_ID }, OTHER_ID]
    })
    expect(fake.calls[0].body).toEqual({
      query: 'hero',
      project_id: PROJECT_ID,
      entity_types: [ASSET_TYPE_ID, OTHER_ID]
    })
  })

  it('searchEntities sends an empty entity type list as is', async () => {
    fake.reply(200, {})
    await kitsu.search.searchEntities('hero', { entityTypes: [] })
    expect(fake.calls[0].body).toEqual({ query: 'hero', entity_types: [] })
  })

  it('searchEntities rejects a malformed project or entity type', async () => {
    await expect(
      kitsu.search.searchEntities('hero', { project: 'not-an-id' })
    ).rejects.toBeInstanceOf(ParameterError)
    await expect(
      kitsu.search.searchEntities('hero', { entityTypes: ['not-an-id'] })
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('searchEntities forwards the abort signal', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      kitsu.search.searchEntities('hero', { signal: controller.signal })
    ).rejects.toMatchObject({ name: 'AbortError' })
  })
})
