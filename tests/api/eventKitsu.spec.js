import { beforeEach, describe, expect, it } from 'vitest'

import { ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import { OTHER_ID, PERSON_ID, PROJECT_ID } from '../helpers/ids.js'

describe('event namespace: Kitsu logs', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('allLastEvents lists the last events without any filter', async () => {
    fake.reply(200, [{ id: OTHER_ID, name: 'task:update' }])
    expect(await kitsu.event.allLastEvents()).toEqual([
      { id: OTHER_ID, name: 'task:update' }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/events/last'
    })
    expect(fake.calls[0].query.toString()).toBe('')
  })

  it('allLastEvents sends every filter under its wire name', async () => {
    fake.reply(200, [])
    await kitsu.event.allLastEvents({
      after: '2026-09-01T10:00:00',
      before: new Date(Date.UTC(2026, 8, 19, 8, 30, 15, 500)),
      limit: 50,
      lastEvent: { id: OTHER_ID },
      project: { id: PROJECT_ID },
      onlyFiles: true,
      persons: [{ id: PERSON_ID }, OTHER_ID],
      namePrefixes: ['task', 'comment'],
      nameSuffixes: ['new']
    })
    const { query } = fake.calls[0]
    expect(query.get('after')).toBe('2026-09-01T10:00:00')
    expect(query.get('before')).toBe('2026-09-19T08:30:15')
    expect(query.get('limit')).toBe('50')
    expect(query.get('cursor_event_id')).toBe(OTHER_ID)
    expect(query.get('project_id')).toBe(PROJECT_ID)
    expect(query.get('only_files')).toBe('true')
    expect(query.getAll('person_ids')).toEqual([PERSON_ID, OTHER_ID])
    expect(query.getAll('name_prefixes')).toEqual(['task', 'comment'])
    expect(query.getAll('name_suffixes')).toEqual(['new'])
  })

  it('allLastEvents keeps an unset onlyFiles flag off the wire', async () => {
    fake.reply(200, [])
    await kitsu.event.allLastEvents({ onlyFiles: false })
    expect(fake.calls[0].query.has('only_files')).toBe(false)
  })

  it('allLastEvents rejects a malformed project', async () => {
    await expect(
      kitsu.event.allLastEvents({ project: 'not-an-id' })
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('allEventNames lists the event names', async () => {
    fake.reply(200, ['asset:new', 'task:update'])
    expect(await kitsu.event.allEventNames()).toEqual([
      'asset:new',
      'task:update'
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/events/names'
    })
  })

  it('allLastLoginLogs lists the last login logs', async () => {
    fake.reply(200, [{ id: OTHER_ID, person_id: PERSON_ID }])
    expect(await kitsu.event.allLastLoginLogs()).toEqual([
      { id: OTHER_ID, person_id: PERSON_ID }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/events/login-logs/last'
    })
    expect(fake.calls[0].query.toString()).toBe('')
  })

  it('allLastLoginLogs sends every filter under its wire name', async () => {
    fake.reply(200, [])
    await kitsu.event.allLastLoginLogs({
      after: new Date(Date.UTC(2026, 8, 1)),
      before: '2026-09-19',
      limit: 200,
      lastLoginLog: OTHER_ID,
      persons: [{ id: PERSON_ID }]
    })
    const { query } = fake.calls[0]
    expect(query.get('after')).toBe('2026-09-01T00:00:00')
    expect(query.get('before')).toBe('2026-09-19')
    expect(query.get('limit')).toBe('200')
    expect(query.get('cursor_login_log_id')).toBe(OTHER_ID)
    expect(query.getAll('person_ids')).toEqual([PERSON_ID])
  })

  it('allLastLoginLogs rejects a malformed person', async () => {
    await expect(
      kitsu.event.allLastLoginLogs({ persons: ['nope'] })
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })
})
