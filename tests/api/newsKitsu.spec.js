import { beforeEach, describe, expect, it } from 'vitest'

import { ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import {
  EPISODE_ID,
  OTHER_ID,
  PERSON_ID,
  PROJECT_ID,
  TASK_STATUS_ID,
  TASK_TYPE_ID
} from '../helpers/ids.js'

const FEED = { data: [{ id: OTHER_ID }], total: 1, stats: [] }

describe('news namespace: Kitsu coverage', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('allNews reads the studio wide feed without a project', async () => {
    fake.reply(200, FEED)
    expect(await kitsu.news.allNews()).toEqual(FEED)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/projects/news'
    })
    expect([...fake.calls[0].query.keys()]).toEqual([])
  })

  it('allNews reads the feed of a project', async () => {
    fake.reply(200, FEED)
    expect(await kitsu.news.allNews({ project: { id: PROJECT_ID } })).toEqual(
      FEED
    )
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/news`
    })
    expect(fake.calls[0].query.has('project_id')).toBe(false)
  })

  it('allNews sends its filters as the query', async () => {
    fake.reply(200, FEED)
    await kitsu.news.allNews({
      project: PROJECT_ID,
      onlyPreview: true,
      taskType: { id: TASK_TYPE_ID },
      taskStatus: TASK_STATUS_ID,
      person: { id: PERSON_ID },
      episode: EPISODE_ID,
      page: 2,
      limit: 6,
      after: '2026-09-01T00:00:00',
      before: '2026-09-19T00:00:00'
    })
    expect(Object.fromEntries(fake.calls[0].query)).toEqual({
      only_preview: 'true',
      task_type_id: TASK_TYPE_ID,
      task_status_id: TASK_STATUS_ID,
      person_id: PERSON_ID,
      episode_id: EPISODE_ID,
      page: '2',
      limit: '6',
      after: '2026-09-01T00:00:00',
      before: '2026-09-19T00:00:00'
    })
  })

  // Zou reads both bounds as naive UTC times, to the second.
  it('allNews sends a Date bound in UTC, to the second', async () => {
    fake.reply(200, FEED)
    await kitsu.news.allNews({
      after: new Date(Date.UTC(2026, 8, 1, 6, 30, 15, 500)),
      before: new Date(Date.UTC(2026, 8, 19))
    })
    expect(fake.calls[0].query.get('after')).toBe('2026-09-01T06:30:15')
    expect(fake.calls[0].query.get('before')).toBe('2026-09-19T00:00:00')
  })

  it('allNews rejects an invalid Date before any request', async () => {
    await expect(
      kitsu.news.allNews({ after: new Date('nope') })
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('allNews rejects a malformed filter', async () => {
    await expect(kitsu.news.allNews({ person: 'nope' })).rejects.toThrow(
      ParameterError
    )
    expect(fake.calls).toHaveLength(0)
  })

  it('getNews reads one news of a project', async () => {
    fake.reply(200, { id: OTHER_ID })
    expect(await kitsu.news.getNews({ id: PROJECT_ID }, OTHER_ID)).toEqual({
      id: OTHER_ID
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/news/${OTHER_ID}`
    })
  })

  it('getNews gives null on a 404', async () => {
    fake.reply(404, { message: 'not found' })
    expect(await kitsu.news.getNews(PROJECT_ID, { id: OTHER_ID })).toBeNull()
  })
})
