import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  KitsuError,
  NetworkError,
  NotAuthenticatedError,
  NotFoundError,
  ServerError,
  TimeoutError
} from '../../src/core/errors.js'
import { createHttp } from '../../src/core/http.js'
import { createCore } from '../../src/core/index.js'
import { createSession } from '../../src/core/session.js'
import { createFakeFetch, jsonResponse } from '../helpers/fakeFetch.js'
import { HOST, PREVIEW_FILE_ID, TASK_ID } from '../helpers/ids.js'

const stubSession = {
  generation: () => 0,
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
      body: { message: 'boom' },
      retryAfter: null
    })
  })

  it('refuses a successful answer that is not JSON, such as the page of a wrong host', async () => {
    const html = '<!DOCTYPE html><html></html>'
    const page = async () =>
      new Response(html, {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      })
    const err = await makeHttp(page)
      .get('data/tasks')
      .catch(e => e)
    expect(err).toBeInstanceOf(KitsuError)
    expect(err).toMatchObject({
      status: 200,
      path: 'data/tasks',
      method: 'GET',
      body: html
    })
  })

  it('refuses a successful answer announced as JSON that does not parse', async () => {
    const text = '{"id": "66666666-6666'
    const cut = async () =>
      new Response(text, {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    const err = await makeHttp(cut)
      .get('data/tasks')
      .catch(e => e)
    expect(err).toBeInstanceOf(KitsuError)
    expect(err).toMatchObject({
      status: 200,
      path: 'data/tasks',
      method: 'GET',
      body: text
    })
    expect(err.cause).toBeInstanceOf(SyntaxError)
  })

  it('keeps the text of an error body announced as JSON that does not parse', async () => {
    const page = '<html>502 Bad Gateway</html>'
    const proxy = async () =>
      new Response(page, {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      })
    const err = await makeHttp(proxy)
      .get('data/tasks')
      .catch(e => e)
    expect(err).toBeInstanceOf(ServerError)
    expect(err.body).toBe(page)
  })

  it('refuses JSON that does not parse over XHR too', async () => {
    const text = '{"id": "66666666-6666'
    vi.stubGlobal(
      'XMLHttpRequest',
      class {
        constructor() {
          this.upload = {}
        }
        open() {}
        setRequestHeader() {}
        getResponseHeader(name) {
          return name === 'Content-Type' ? 'application/json' : null
        }
        send() {
          Object.assign(this, { status: 201, responseText: text })
          queueMicrotask(() => this.onload())
        }
      }
    )
    try {
      const http = createHttp(
        {
          host: HOST,
          fetch: createFakeFetch(),
          timeout: TIMEOUT,
          xhrUploads: true
        },
        stubSession
      )
      const err = await http
        .upload(`data/tasks/${TASK_ID}/comments`, {
          file: new Blob(['pixels']),
          onProgress: () => {}
        })
        .catch(e => e)
      expect(err).toBeInstanceOf(KitsuError)
      expect(err).toMatchObject({ status: 201, body: text })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('wraps a network failure', async () => {
    const failing = async () => {
      throw new TypeError('fetch failed')
    }
    await expect(makeHttp(failing).get('data/tasks')).rejects.toBeInstanceOf(
      NetworkError
    )
  })

  // undici always says "fetch failed": the reason is in its cause.
  it('keeps the failure of the fetch, and the reason undici gives, in a network error', async () => {
    const failure = Object.assign(new TypeError('fetch failed'), {
      cause: new Error('self-signed certificate')
    })
    const failing = async () => {
      throw failure
    }
    const err = await makeHttp(failing)
      .get('data/tasks')
      .catch(e => e)
    expect(err).toBeInstanceOf(NetworkError)
    expect(err.cause).toBe(failure)
    expect(err.message).toBe(
      'GET data/tasks failed: fetch failed: self-signed certificate'
    )
  })

  it('tells the reason of a fetch rejecting with a string, as the Tauri http plugin does', async () => {
    const reason = `error sending request for url (${HOST}/data/tasks)`
    const tauri = () => Promise.reject(reason)
    const err = await makeHttp(tauri)
      .get('data/tasks')
      .catch(e => e)
    expect(err).toBeInstanceOf(NetworkError)
    expect(err.message).toBe(`GET data/tasks failed: ${reason}`)
    expect(err.cause).toBe(reason)
  })
})

describe('downloads', () => {
  const PATH = `pictures/thumbnails/preview-files/${PREVIEW_FILE_ID}.png`

  it('rejects a file Zou still builds, telling when to ask again', async () => {
    const processing = {
      status: 'processing',
      preview_file_id: PREVIEW_FILE_ID
    }
    const fake = createFakeFetch().reply(202, processing, {
      'Retry-After': '5'
    })
    const http = makeHttp(fake)
    const err = await http.download(PATH).catch(e => e)
    expect(err.constructor).toBe(KitsuError)
    expect(err).toMatchObject({
      status: 202,
      path: PATH,
      method: 'GET',
      body: processing,
      retryAfter: 5
    })
    // Zou tells "still processing" from "missing" to a JSON client only.
    expect(fake.calls[0].headers.Accept).toBe('application/json')
    http.abortAll()
    expect(fake.calls[0].signal.aborted).toBe(false)
  })

  // Zou bounds the media requests it serves at once.
  it('tells when to ask again a busy Zou', async () => {
    const busy = {
      error: true,
      message: 'Too many media requests, retry later.'
    }
    const fake = createFakeFetch().reply(503, busy, { 'Retry-After': '5' })
    const err = await makeHttp(fake)
      .download(PATH)
      .catch(e => e)
    expect(err).toBeInstanceOf(ServerError)
    expect(err).toMatchObject({ status: 503, body: busy, retryAfter: 5 })
  })

  it('reads a Retry-After given as a date', async () => {
    const date = new Date(Date.now() + 30000).toUTCString()
    const fake = createFakeFetch().reply(503, {}, { 'Retry-After': date })
    const err = await makeHttp(fake)
      .download(PATH)
      .catch(e => e)
    expect(err.retryAfter).toBeGreaterThanOrEqual(29)
    expect(err.retryAfter).toBeLessThanOrEqual(30)
  })
})

// The answers of flask-jwt-extended for a token it cannot decode, which Zou
// keeps: 422, not 401.
describe('a token Zou cannot decode', () => {
  const formerKey = () =>
    jsonResponse(422, { msg: 'Signature verification failed' })
  const truncated = () => jsonResponse(422, { msg: 'Not enough segments' })

  const setup = (fake, onUnauthorized = () => {}) => {
    const session = createSession({
      auth: 'bearer',
      tokens: { access_token: 'old', refresh_token: 'refresh' },
      onUnauthorized
    })
    const http = createHttp(
      { host: HOST, fetch: fake, timeout: TIMEOUT },
      session
    )
    return { http, session }
  }

  it('refreshes the session and replays the request', async () => {
    const fake = createFakeFetch()
      .on('GET', '/data/persons', call =>
        call.headers.Authorization === 'Bearer new'
          ? jsonResponse(200, [])
          : truncated()
      )
      .on('GET', '/auth/refresh-token', () =>
        jsonResponse(200, { access_token: 'new' })
      )
    const { http, session } = setup(fake)
    expect(await http.get('data/persons')).toEqual([])
    expect(session.getTokens().access_token).toBe('new')
  })

  it('reports a lost session when the refresh token is refused too', async () => {
    const fake = createFakeFetch()
      .on('GET', '/data/persons', formerKey)
      .on('GET', '/auth/refresh-token', formerKey)
    const onUnauthorized = vi.fn()
    const { http } = setup(fake, onUnauthorized)
    const err = await http.get('data/persons').catch(e => e)
    expect(err).toBeInstanceOf(NotAuthenticatedError)
    expect(err).toMatchObject({
      status: 422,
      body: { msg: 'Signature verification failed' }
    })
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('makes isAuthenticated answer false', async () => {
    const fake = createFakeFetch().on('GET', '/auth/authenticated', formerKey)
    const onUnauthorized = vi.fn()
    const kitsu = createCore({
      host: HOST,
      fetch: fake,
      tokens: { access_token: 'old' },
      onUnauthorized
    })
    expect(await kitsu.isAuthenticated()).toBe(false)
    expect(onUnauthorized).not.toHaveBeenCalled()
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

  it('fetchFirst returns null on 404 and rethrows anything else', async () => {
    const fake = createFakeFetch().reply(404, {}).reply(500, {})
    const http = makeHttp(fake)
    expect(await http.fetchFirst('tasks')).toBeNull()
    await expect(http.fetchFirst('tasks')).rejects.toBeInstanceOf(ServerError)
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

  it('update sends the id in the path, not in the body', async () => {
    const fake = createFakeFetch().reply(200, {}).reply(200, {})
    const http = makeHttp(fake)
    const task = Object.freeze({ id: TASK_ID, priority: 2 })
    await http.update('tasks', TASK_ID, task)
    await http.update('tasks', TASK_ID, { priority: 3 })
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/tasks/${TASK_ID}`
    })
    expect(fake.calls[0].body).toEqual({ priority: 2 })
    expect(fake.calls[1].body).toEqual({ priority: 3 })
    expect(task).toEqual({ id: TASK_ID, priority: 2 })
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

  // A body that never ends and fails when the request is aborted, as the
  // body of a real fetch does.
  const stalledBody = signal =>
    new ReadableStream({
      start: stream =>
        signal.addEventListener('abort', () =>
          stream.error(new DOMException('Aborted', 'AbortError'))
        )
    })

  const stalledDownload = async (url, init) =>
    new Response(stalledBody(init.signal), { status: 200 })

  const settledWithin = (promise, delay) => {
    const timer = new Promise(resolve =>
      setTimeout(() => resolve('pending'), delay)
    )
    const raced = Promise.race([promise, timer])
    vi.advanceTimersByTimeAsync(delay)
    return raced
  }

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

  it('reports a caller abort as AbortError whatever the injected fetch rejects with', async () => {
    const cancelling = (url, init) =>
      new Promise((resolve, reject) => {
        init.signal.addEventListener('abort', () =>
          reject(new Error('Request cancelled'))
        )
      })
    const controller = new AbortController()
    const pending = makeHttp(cancelling)
      .get('data/tasks', {}, { signal: controller.signal })
      .catch(e => e)
    controller.abort()
    const err = await pending
    expect(err.name).toBe('AbortError')
    expect(err).not.toBeInstanceOf(NetworkError)
  })

  it('reports an abort landing while an error body is read as AbortError', async () => {
    const stalledError = async (url, init) =>
      new Response(stalledBody(init.signal), { status: 500 })
    const controller = new AbortController()
    const pending = makeHttp(stalledError)
      .get('data/tasks', {}, { signal: controller.signal })
      .catch(e => e)
    await vi.advanceTimersByTimeAsync(10)
    controller.abort()
    expect((await pending).name).toBe('AbortError')
  })

  it('leaves no timer nor listener behind when the body cannot be encoded', async () => {
    const circular = {}
    circular.self = circular
    const controller = new AbortController()
    const removed = vi.spyOn(controller.signal, 'removeEventListener')
    const added = vi.spyOn(controller.signal, 'addEventListener')
    const fake = createFakeFetch()

    await expect(
      makeHttp(fake).post('data/tasks', circular, { signal: controller.signal })
    ).rejects.toBeInstanceOf(TypeError)

    expect(fake.calls).toHaveLength(0)
    expect(vi.getTimerCount()).toBe(0)
    expect(added.mock.calls.length).toBe(removed.mock.calls.length)
  })

  it('keeps a raw response abortable by the caller after the headers', async () => {
    const controller = new AbortController()
    const response = await makeHttp(stalledDownload).request(
      'GET',
      'data/tasks',
      { raw: true, signal: controller.signal }
    )
    const reading = response.text().catch(e => e)
    controller.abort()
    expect((await settledWithin(reading, 50)).name).toBe('AbortError')
  })

  it('keeps a raw response abortable by abortAll after the headers', async () => {
    const http = makeHttp(stalledDownload)
    const response = await http.request('GET', 'data/tasks', { raw: true })
    const reading = response.text().catch(e => e)
    http.abortAll()
    expect((await settledWithin(reading, 50)).name).toBe('AbortError')
  })

  it('releases a raw response once its body is read to the end', async () => {
    const signals = []
    const http = makeHttp(async (url, init) => {
      signals.push(init.signal)
      return new Response('movie', { status: 200 })
    })
    const response = await http.request('GET', 'data/tasks', { raw: true })
    expect(await response.text()).toBe('movie')
    http.abortAll()
    expect(signals[0].aborted).toBe(false)
  })

  it('leaves a raw body unbounded once the headers arrived', async () => {
    const response = await makeHttp(stalledDownload).request(
      'GET',
      'data/tasks',
      { raw: true }
    )
    const reading = response.text().catch(e => e)
    expect(await settledWithin(reading, TIMEOUT.deadline + 1)).toBe('pending')
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
