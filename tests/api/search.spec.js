import { beforeEach, describe, expect, it } from 'vitest'

import { ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import { OTHER_ID, PROJECT_ID } from '../helpers/ids.js'

describe('search namespace', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('searchEntities posts the bare query and lets Zou apply its defaults', async () => {
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

  it('searchEntities picks the indexes and pages the results', async () => {
    fake.reply(200, {})
    const indexNames = ['assets', 'shots']
    await kitsu.search.searchEntities('hero', {
      indexNames,
      limit: 20,
      offset: 40
    })
    expect(fake.calls[0].body).toEqual({
      query: 'hero',
      index_names: ['assets', 'shots'],
      limit: 20,
      offset: 40
    })
    expect(indexNames).toEqual(['assets', 'shots'])
  })

  it('searchEntities keeps an offset of zero', async () => {
    fake.reply(200, {})
    await kitsu.search.searchEntities('hero', { limit: 5, offset: 0 })
    expect(fake.calls[0].body).toEqual({ query: 'hero', limit: 5, offset: 0 })
  })

  it('searchEntities does not send the entity type filter Zou ignores', async () => {
    fake.reply(200, {})
    // @ts-expect-error entityTypes is gazu's option: Zou never read it.
    await kitsu.search.searchEntities('hero', { entityTypes: [OTHER_ID] })
    expect(fake.calls[0].body).toEqual({ query: 'hero' })
  })

  it('searchEntities rejects a blank query or a malformed project', async () => {
    await expect(kitsu.search.searchEntities('')).rejects.toBeInstanceOf(
      ParameterError
    )
    await expect(
      kitsu.search.searchEntities('hero', { project: 'not-an-id' })
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
