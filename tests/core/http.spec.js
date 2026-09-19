import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  NetworkError,
  NotFoundError,
  ServerError,
  TimeoutError
} from '../../src/core/errors.js'
import { createHttp } from '../../src/core/http.js'
import { createFakeFetch } from '../helpers/fakeFetch.js'
import { HOST, TASK_ID } from '../helpers/ids.js'

const stubSession = {
  headers: () => ({}),
  canRefresh: () => false,
  onUnauthorized: () => {}
}
const TIMEOUT = { response: 1000, deadline: 5000 }

const makeHttp = fetch =>
  createHttp({ host: HOST, fetch, timeout: TIMEOUT }, stubSession)

describe('http verbs', () => {
  it('GET sends the query and parses JSON', async () => {
    const fake = createFakeFetch().reply(200, [{ id: TASK_ID }])
    const tasks = await makeHttp(fake).get('data/tasks', {
      project_id: 'p',
      empty: ''
    })
    expect(tasks).toEqual([{ id: TASK_ID }])
    expect(fake.calls[0].method).toBe('GET')
    expect(fake.calls[0].query.toString()).toBe('project_id=p')
    expect(fake.calls[0].headers.Accept).toBe('application/json')
  })

  it('POST, PUT and DELETE send a JSON body', async () => {
    const fake = createFakeFetch()
      .reply(201, { id: 1 })
      .reply(200, { id: 1 })
      .reply(204)
    const http = makeHttp(fake)
    await http.post('data/tasks', { name: 'a' })
    await http.put(`data/tasks/${TASK_ID}`, { name: 'b' })
    expect(await http.del(`data/tasks/${TASK_ID}`)).toBeNull()
    expect(fake.calls.map(call => call.method)).toEqual([
      'POST',
      'PUT',
      'DELETE'
    ])
    expect(fake.calls[0].body).toEqual({ name: 'a' })
    expect(fake.calls[0].headers['Content-Type']).toBe('application/json')
  })

  it('does not JSON-encode a FormData body nor set its content type', async () => {
    const fake = createFakeFetch().reply(201, {})
    const form = new FormData()
    await makeHttp(fake).post('data/tasks', form)
    expect(fake.calls[0].body).toBe(form)
    expect(fake.calls[0].headers['Content-Type']).toBeUndefined()
  })

  it('returns the Response untouched in raw mode', async () => {
    const fake = createFakeFetch().reply(200, { ok: true })
    const response = await makeHttp(fake).request('GET', 'data/tasks', {
      raw: true
    })
    expect(response).toBeInstanceOf(Response)
  })
})

describe('http errors', () => {
  it('throws a typed error carrying status, path, method and body', async () => {
    const fake = createFakeFetch().reply(500, { message: 'boom' })
    const err = await makeHttp(fake)
      .get('data/tasks')
      .catch(e => e)
    expect(err).toBeInstanceOf(ServerError)
    expect(err).toMatchObject({
      status: 500,
      path: 'data/tasks',
      method: 'GET',
      body: { message: 'boom' }
    })
  })

  it('wraps a network failure', async () => {
    const failing = async () => {
      throw new TypeError('fetch failed')
    }
    await expect(makeHttp(failing).get('data/tasks')).rejects.toBeInstanceOf(
      NetworkError
    )
  })
})

describe('gazu helpers', () => {
  it('fetchAll prefixes data/', async () => {
    const fake = createFakeFetch().reply(200, [])
    await makeHttp(fake).fetchAll('projects/open')
    expect(fake.calls[0].path).toBe('/data/projects/open')
  })

  it('fetchFirst returns the first entry or null', async () => {
    const fake = createFakeFetch()
      .reply(200, [{ id: 1 }, { id: 2 }])
      .reply(200, [])
    const http = makeHttp(fake)
    expect(await http.fetchFirst('tasks')).toEqual({ id: 1 })
    expect(await http.fetchFirst('tasks')).toBeNull()
  })

  it('fetchOne returns null on 404 and rethrows anything else', async () => {
    const fake = createFakeFetch().reply(404, {}).reply(500, {})
    const http = makeHttp(fake)
    expect(await http.fetchOne('tasks', TASK_ID)).toBeNull()
    await expect(http.fetchOne('tasks', TASK_ID)).rejects.toBeInstanceOf(
      ServerError
    )
    expect(fake.calls[0].path).toBe(`/data/tasks/${TASK_ID}`)
  })

  it('create, update and remove target the CRUD routes', async () => {
    const fake = createFakeFetch().reply(201, {}).reply(200, {}).reply(204)
    const http = makeHttp(fake)
    await http.create('tasks', { name: 'a' })
    await http.update('tasks', TASK_ID, { name: 'b' })
    await http.remove('tasks', TASK_ID, { force: true })
    expect(fake.calls.map(call => `${call.method} ${call.path}`)).toEqual([
      'POST /data/tasks',
      `PUT /data/tasks/${TASK_ID}`,
      `DELETE /data/tasks/${TASK_ID}`
    ])
    expect(fake.calls[2].query.get('force')).toBe('true')
  })

  it('does not swallow a 404 outside get helpers', async () => {
    const fake = createFakeFetch().reply(404, {})
    await expect(makeHttp(fake).get('data/tasks')).rejects.toBeInstanceOf(
      NotFoundError
    )
  })
})

describe('timeouts and cancellation', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const hangingFetch = (url, init) =>
    new Promise((resolve, reject) => {
      init.signal.addEventListener('abort', () =>
        reject(new DOMException('Aborted', 'AbortError'))
      )
    })

  it('throws TimeoutError when the server does not answer in time', async () => {
    const pending = makeHttp(hangingFetch)
      .get('data/tasks')
      .catch(e => e)
    await vi.advanceTimersByTimeAsync(TIMEOUT.response + 1)
    expect(await pending).toBeInstanceOf(TimeoutError)
  })

  it('rethrows the native AbortError on caller cancellation', async () => {
    const controller = new AbortController()
    const pending = makeHttp(hangingFetch)
      .get('data/tasks', {}, { signal: controller.signal })
      .catch(e => e)
    controller.abort()
    expect((await pending).name).toBe('AbortError')
  })

  it('abortAll cancels every in-flight request', async () => {
    const http = makeHttp(hangingFetch)
    const pending = [http.get('data/tasks'), http.get('data/persons')].map(p =>
      p.catch(e => e)
    )
    http.abortAll()
    const errors = await Promise.all(pending)
    expect(errors.map(err => err.name)).toEqual(['AbortError', 'AbortError'])
  })
})
