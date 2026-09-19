import { describe, expect, it } from 'vitest'

import { NotAuthenticatedError } from '../../src/core/errors.js'
import { createHttp } from '../../src/core/http.js'
import { readNdjson } from '../../src/core/ndjson.js'
import { createFakeFetch, jsonResponse } from '../helpers/fakeFetch.js'
import { HOST } from '../helpers/ids.js'

const stubSession = {
  headers: () => ({}),
  canRefresh: () => false,
  onUnauthorized: () => {}
}
const makeHttp = fetch =>
  createHttp(
    { host: HOST, fetch, timeout: { response: 1000, deadline: 5000 } },
    stubSession
  )

const ndjsonResponse = lines =>
  new Response(lines.map(line => JSON.stringify(line)).join('\n'), {
    status: 200,
    headers: { 'Content-Type': 'application/x-ndjson' }
  })

const COMPACT = [
  {
    compact: true,
    asset_fields: ['id', 'name', 'tasks'],
    task_fields: ['id', 'assignees']
  },
  [
    'a1',
    'Hero',
    [
      ['t1', ['p1']],
      ['t2', null]
    ]
  ],
  ['a2', 'Tree', []]
]

describe('readNdjson', () => {
  it('maps compact rows by field name and defaults task assignees', async () => {
    expect(await readNdjson(ndjsonResponse(COMPACT))).toEqual([
      {
        id: 'a1',
        name: 'Hero',
        tasks: [
          { id: 't1', assignees: ['p1'] },
          { id: 't2', assignees: [] }
        ]
      },
      { id: 'a2', name: 'Tree', tasks: [] }
    ])
  })

  it('returns plain rows when the header is not compact', async () => {
    const lines = [{ compact: false, asset_fields: [] }, { id: 'a1' }]
    expect(await readNdjson(ndjsonResponse(lines))).toEqual([{ id: 'a1' }])
  })
})

describe('http.getNdjson', () => {
  it('asks for a compact stream and decodes it', async () => {
    const fake = createFakeFetch().on('GET', '/data/assets/with-tasks', () =>
      ndjsonResponse(COMPACT)
    )
    const assets = await makeHttp(fake).getNdjson('data/assets/with-tasks', {
      project_id: 'p'
    })
    expect(assets).toHaveLength(2)
    expect(fake.calls[0].query.toString()).toBe(
      'project_id=p&stream=true&compact=true'
    )
    expect(fake.calls[0].headers.Accept).toBe('application/x-ndjson')
  })

  it('falls back to plain JSON when the server does not stream', async () => {
    const fake = createFakeFetch()
      .reply(200, [{ id: 'a1' }])
      .reply(200, [{ id: 'a1' }])
    const assets = await makeHttp(fake).getNdjson('data/assets/with-tasks', {
      project_id: 'p'
    })
    expect(assets).toEqual([{ id: 'a1' }])
    expect(fake.calls[1].query.toString()).toBe('project_id=p')
  })

  it('falls back on an HTTP error so the plain request raises the typed error', async () => {
    const fake = createFakeFetch().reply(400, {}).reply(200, [])
    expect(await makeHttp(fake).getNdjson('data/assets/with-tasks')).toEqual([])
  })

  it('does not fall back on a 401', async () => {
    const fake = createFakeFetch().on('GET', '/data/assets/with-tasks', () =>
      jsonResponse(401, {})
    )
    await expect(
      makeHttp(fake).getNdjson('data/assets/with-tasks')
    ).rejects.toBeInstanceOf(NotAuthenticatedError)
    expect(fake.calls).toHaveLength(1)
  })
})
