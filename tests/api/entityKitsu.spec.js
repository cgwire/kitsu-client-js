import { beforeEach, describe, expect, it } from 'vitest'

import { ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import { ENTITY_ID, PREVIEW_FILE_ID, TASK_ID } from '../helpers/ids.js'

describe('entity namespace, Kitsu parity', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('allNewsForEntity returns the news page of an entity', async () => {
    const page = { data: [{ id: TASK_ID }], total: 1, nb_pages: 1 }
    fake.reply(200, page)
    expect(await kitsu.entity.allNewsForEntity({ id: ENTITY_ID })).toEqual(page)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/entities/${ENTITY_ID}/news`
    })
    expect([...fake.calls[0].query.keys()]).toEqual([])
  })

  it('allPreviewFilesForEntity lists the preview files of an entity', async () => {
    fake.reply(200, [{ id: PREVIEW_FILE_ID }])
    expect(await kitsu.entity.allPreviewFilesForEntity(ENTITY_ID)).toEqual([
      { id: PREVIEW_FILE_ID }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/entities/${ENTITY_ID}/preview-files`
    })
  })

  it('allTimeSpentsForEntity lists the time spents of an entity', async () => {
    fake.reply(200, [{ task_id: TASK_ID, duration: 60 }])
    expect(await kitsu.entity.allTimeSpentsForEntity(ENTITY_ID)).toEqual([
      { task_id: TASK_ID, duration: 60 }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/entities/${ENTITY_ID}/time-spents`
    })
  })

  it('rejects a missing entity before any request', async () => {
    const errors = await Promise.all(
      [
        kitsu.entity.allNewsForEntity(),
        kitsu.entity.allPreviewFilesForEntity(null),
        kitsu.entity.allTimeSpentsForEntity('not-a-uuid')
      ].map(promise => promise.catch(err => err))
    )
    errors.forEach(err => expect(err).toBeInstanceOf(ParameterError))
    expect(fake.calls).toHaveLength(0)
  })
})
