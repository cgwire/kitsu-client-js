import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  NetworkError,
  NotAuthenticatedError,
  TimeoutError
} from '../../src/core/errors.js'
import { createHttp } from '../../src/core/http.js'
import { readNdjson } from '../../src/core/ndjson.js'
import { createFakeFetch, jsonResponse } from '../helpers/fakeFetch.js'
import { HOST } from '../helpers/ids.js'

const stubSession = {
  generation: () => 0,
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

  it('reports a malformed line as a SyntaxError and releases the stream', async () => {
    const cancel = vi.fn()
    const encoder = new TextEncoder()
    const body = new ReadableStream({
      start: stream =>
        stream.enqueue(encoder.encode('{"compact":false}\nnot json\n')),
      cancel
    })
    await expect(readNdjson(new Response(body))).rejects.toBeInstanceOf(
      SyntaxError
    )
    expect(cancel).toHaveBeenCalledTimes(1)
  })

  it('reports a row that does not match the header as a SyntaxError', async () => {
    const lines = [{ compact: true, task_fields: [] }, ['a1']]
    await expect(readNdjson(ndjsonResponse(lines))).rejects.toBeInstanceOf(
      SyntaxError
    )
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

describe('http.getNdjson lifecycle', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const PATH = 'data/assets/with-tasks'

  // Sends the header and one row, then stalls until the request is aborted.
  const stalledStream = async (url, init) => {
    const encoder = new TextEncoder()
    const body = new ReadableStream({
      start: stream => {
        stream.enqueue(encoder.encode('{"compact":false}\n{"id":"a1"}\n'))
        init.signal.addEventListener('abort', () =>
          stream.error(new DOMException('Aborted', 'AbortError'))
        )
      }
    })
    return new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'application/x-ndjson' }
    })
  }

  const settled = async (promise, delay) => {
    const timer = new Promise(resolve =>
      setTimeout(() => resolve('pending'), delay)
    )
    const raced = Promise.race([promise.catch(e => e), timer])
    await vi.advanceTimersByTimeAsync(delay)
    return raced
  }

  it('stays abortable by the caller while the body streams', async () => {
    const controller = new AbortController()
    const calls = []
    const fetch = (url, init) => {
      calls.push(url)
      return stalledStream(url, init)
    }
    const pending = makeHttp(fetch).getNdjson(
      PATH,
      {},
      { signal: controller.signal }
    )
    await vi.advanceTimersByTimeAsync(10)
    controller.abort()
    expect((await settled(pending, 50)).name).toBe('AbortError')
    expect(calls).toHaveLength(1)
  })

  it('stays abortable by abortAll while the body streams', async () => {
    const http = makeHttp(stalledStream)
    const pending = http.getNdjson(PATH)
    await vi.advanceTimersByTimeAsync(10)
    http.abortAll()
    expect((await settled(pending, 50)).name).toBe('AbortError')
  })

  it('applies the deadline to the whole stream', async () => {
    const pending = makeHttp(stalledStream).getNdjson(PATH)
    expect(await settled(pending, 5001)).toBeInstanceOf(TimeoutError)
  })

  it('does not ask a second time after a timeout', async () => {
    const calls = []
    const hanging = (url, init) => {
      calls.push(url)
      return new Promise((resolve, reject) => {
        init.signal.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError'))
        )
      })
    }
    const pending = makeHttp(hanging).getNdjson(PATH)
    expect(await settled(pending, 1001)).toBeInstanceOf(TimeoutError)
    expect(calls).toHaveLength(1)
  })

  it('does not ask a second time after a network failure', async () => {
    const calls = []
    const offline = async url => {
      calls.push(url)
      throw new TypeError('fetch failed')
    }
    await expect(makeHttp(offline).getNdjson(PATH)).rejects.toBeInstanceOf(
      NetworkError
    )
    expect(calls).toHaveLength(1)
  })

  it('releases the body of a non-streamed answer before falling back', async () => {
    const cancel = vi.fn()
    const answers = [
      () =>
        new Response(new ReadableStream({ cancel }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }),
      () => jsonResponse(200, [{ id: 'a1' }])
    ]
    const olderZou = async () => answers.shift()()
    expect(await makeHttp(olderZou).getNdjson(PATH)).toEqual([{ id: 'a1' }])
    expect(cancel).toHaveBeenCalledTimes(1)
  })

  it('falls back when the stream cannot be decoded', async () => {
    const answers = [
      () =>
        new Response('{"compact":false}\nnot json\n', {
          status: 200,
          headers: { 'Content-Type': 'application/x-ndjson' }
        }),
      () => jsonResponse(200, [{ id: 'a1' }])
    ]
    const broken = async () => answers.shift()()
    expect(await makeHttp(broken).getNdjson(PATH)).toEqual([{ id: 'a1' }])
  })
})
