import { beforeEach, describe, expect, it } from 'vitest'

import { ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import { ASSET_ID, EPISODE_ID, PROJECT_ID, SHOT_ID } from '../helpers/ids.js'

describe('casting namespace: Kitsu parity', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('updateCastings replaces the casting of several entities at once', async () => {
    const castings = {
      [SHOT_ID]: [{ asset_id: ASSET_ID, nb_occurences: 2, label: 'fixed' }],
      [EPISODE_ID]: []
    }
    fake.reply(200, castings)
    expect(
      await kitsu.casting.updateCastings({ id: PROJECT_ID }, castings)
    ).toEqual(castings)
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/projects/${PROJECT_ID}/entities/casting`,
      body: castings
    })
    expect([...fake.calls[0].query.keys()]).toEqual([])
  })

  it('updateCastings rejects missing castings without any request', async () => {
    await expect(
      kitsu.casting.updateCastings(PROJECT_ID)
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('importCastingWithCsv uploads the CSV file of the project', async () => {
    fake.reply(201, [null])
    const csv = new Blob(['Parent;Name;Asset Type;Asset;Occurences'], {
      type: 'text/csv'
    })
    expect(
      await kitsu.casting.importCastingWithCsv({ id: PROJECT_ID }, csv)
    ).toEqual([null])
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/import/csv/projects/${PROJECT_ID}/casting`
    })
    const { body, query } = fake.calls[0]
    expect([...query.keys()]).toEqual([])
    expect(body).toBeInstanceOf(FormData)
    expect([...body.keys()]).toEqual(['file'])
    expect(await body.get('file').text()).toBe(
      'Parent;Name;Asset Type;Asset;Occurences'
    )
  })

  it('importCastingWithCsv names the uploaded file', async () => {
    fake.reply(201, [])
    await kitsu.casting.importCastingWithCsv(PROJECT_ID, new Blob(['a;b']), {
      fileName: 'casting.csv'
    })
    expect(fake.calls[0].body.get('file').name).toBe('casting.csv')
  })

  it('importCastingWithCsv rejects a missing file without any request', async () => {
    await expect(
      kitsu.casting.importCastingWithCsv(PROJECT_ID)
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it.each([
    ['updateCastings', [PROJECT_ID, {}]],
    ['importCastingWithCsv', [PROJECT_ID, new Blob(['a;b'])]]
  ])('%s forwards the caller signal', async (name, args) => {
    const controller = new AbortController()
    controller.abort()
    fake.reply(200, [])
    await kitsu.casting[name](...args, { signal: controller.signal })
    expect(fake.calls[0].signal.aborted).toBe(true)
  })
})
