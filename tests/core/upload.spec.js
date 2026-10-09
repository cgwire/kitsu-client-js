import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  KitsuError,
  NetworkError,
  NotAllowedError,
  ParameterError
} from '../../src/core/errors.js'
import { createClient } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import { createFakeFetch, jsonResponse } from '../helpers/fakeFetch.js'
import { HOST, TASK_ID } from '../helpers/ids.js'

const PATH = `data/tasks/${TASK_ID}/comments`
const blob = new Blob(['pixels'], { type: 'image/png' })

// Minimal XMLHttpRequest double: records the request, lets the test drive it.
const installFakeXhr = () => {
  const instances = []
  globalThis.XMLHttpRequest = class {
    constructor() {
      this.headers = {}
      this.upload = {}
      instances.push(this)
    }
    open(method, url) {
      Object.assign(this, { method, url })
    }
    setRequestHeader(name, value) {
      this.headers[name] = value
    }
    send(body) {
      this.body = body
    }
    abort() {
      this.onabort()
    }
    getResponseHeader(name) {
      return name === 'Content-Type' ? this.contentType : null
    }
    respond(status, body, contentType = 'application/json') {
      this.status = status
      this.contentType = contentType
      this.responseText =
        contentType === 'application/json' ? JSON.stringify(body) : body
      this.onload()
    }
  }
  return instances
}

afterEach(() => {
  delete globalThis.XMLHttpRequest
  vi.unstubAllGlobals()
})

describe('http.upload over fetch', () => {
  it('posts a multipart form with the file and the fields', async () => {
    const { kitsu, fake } = makeClient()
    fake.reply(201, { id: 'c1' })
    const result = await kitsu.http.upload(PATH, {
      file: blob,
      fileName: 'frame.png',
      fields: { text: 'hello', checklist: [{ checked: true }] }
    })
    expect(result).toEqual({ id: 'c1' })
    const form = fake.calls[0].body
    expect(form).toBeInstanceOf(FormData)
    expect(form.get('text')).toBe('hello')
    expect(form.get('checklist')).toBe('[{"checked":true}]')
    expect(form.get('file').name).toBe('frame.png')
    expect(fake.calls[0].headers.Authorization).toBe('Bearer token')
  })

  it('sends the query next to the form', async () => {
    const { kitsu, fake } = makeClient()
    fake.reply(201, {})
    await kitsu.http.upload(PATH, {
      file: blob,
      query: { normalize: false, unset: null }
    })
    expect(fake.calls[0].query.toString()).toBe('normalize=false')
    expect(fake.calls[0].body).toBeInstanceOf(FormData)
  })

  it('rejects a missing file before any request', async () => {
    const { kitsu, fake } = makeClient()
    await expect(
      kitsu.http.upload(PATH, { file: undefined })
    ).rejects.toBeInstanceOf(ParameterError)
    await expect(
      kitsu.http.upload(PATH, { file: [blob, 'not a blob'] })
    ).rejects.toBeInstanceOf(ParameterError)
    await expect(kitsu.http.upload(PATH, { file: [] })).rejects.toBeInstanceOf(
      ParameterError
    )
    expect(fake.calls).toHaveLength(0)
  })
})

describe('http.upload over XHR', () => {
  it('puts the query in the URL', async () => {
    const xhrs = installFakeXhr()
    const { kitsu } = makeClient({ globalFetch: true })
    const pending = kitsu.http.upload(PATH, {
      file: blob,
      query: { normalize: false },
      onProgress: () => {}
    })
    await vi.waitFor(() => expect(xhrs).toHaveLength(1))
    xhrs[0].respond(201, {})
    await pending
    expect(xhrs[0].url).toBe(`http://kitsu.test/api/${PATH}?normalize=false`)
  })

  it('reports progress and resolves with the parsed body', async () => {
    const xhrs = installFakeXhr()
    const { kitsu } = makeClient({ globalFetch: true })
    const onProgress = vi.fn()
    const pending = kitsu.http.upload(PATH, { file: blob, onProgress })
    await vi.waitFor(() => expect(xhrs).toHaveLength(1))

    xhrs[0].upload.onprogress({ loaded: 3, total: 6 })
    xhrs[0].respond(201, { id: 'c1' })

    expect(await pending).toEqual({ id: 'c1' })
    expect(onProgress).toHaveBeenCalledWith({ loaded: 3, total: 6 })
    expect(xhrs[0].method).toBe('POST')
    expect(xhrs[0].url).toBe(`http://kitsu.test/api/${PATH}`)
    expect(xhrs[0].headers.Authorization).toBe('Bearer token')
  })

  it('maps an error status to the typed error', async () => {
    const xhrs = installFakeXhr()
    const { kitsu } = makeClient({ globalFetch: true })
    const pending = kitsu.http
      .upload(PATH, { file: blob, onProgress: () => {} })
      .catch(e => e)
    await vi.waitFor(() => expect(xhrs).toHaveLength(1))
    xhrs[0].respond(403, { message: 'no' })
    expect(await pending).toBeInstanceOf(NotAllowedError)
  })

  it('refuses a successful answer that is not JSON, like the fetch transport', async () => {
    const xhrs = installFakeXhr()
    const { kitsu } = makeClient({ globalFetch: true })
    const html = '<!DOCTYPE html><title>Sign in</title>'
    const pending = kitsu.http
      .upload(PATH, { file: blob, onProgress: () => {} })
      .catch(e => e)
    await vi.waitFor(() => expect(xhrs).toHaveLength(1))
    xhrs[0].respond(200, html, 'text/html')
    const err = await pending
    expect(err.constructor).toBe(KitsuError)
    expect(err).toMatchObject({
      status: 200,
      path: PATH,
      method: 'POST',
      body: html
    })
  })

  it('refreshes the token on a 401 and sends the upload again', async () => {
    const xhrs = installFakeXhr()
    const fake = createFakeFetch().on('GET', '/auth/refresh-token', () =>
      jsonResponse(200, { access_token: 'new' })
    )
    vi.stubGlobal('fetch', fake)
    const kitsu = createClient({
      host: HOST,
      tokens: { access_token: 'old', refresh_token: 'refresh' }
    })
    const pending = kitsu.http.upload(PATH, {
      file: blob,
      onProgress: () => {}
    })
    await vi.waitFor(() => expect(xhrs).toHaveLength(1))
    xhrs[0].respond(401, { msg: 'Token has expired' })
    await vi.waitFor(() => expect(xhrs).toHaveLength(2))
    xhrs[1].respond(201, { id: 'c1' })
    expect(await pending).toEqual({ id: 'c1' })
    expect(xhrs[0].headers.Authorization).toBe('Bearer old')
    expect(xhrs[1].headers.Authorization).toBe('Bearer new')
  })

  it('wraps a network failure', async () => {
    const xhrs = installFakeXhr()
    const { kitsu } = makeClient({ globalFetch: true })
    const pending = kitsu.http
      .upload(PATH, { file: blob, onProgress: () => {} })
      .catch(e => e)
    await vi.waitFor(() => expect(xhrs).toHaveLength(1))
    xhrs[0].onerror()
    expect(await pending).toBeInstanceOf(NetworkError)
  })

  it('sends nothing on a signal already aborted', async () => {
    const xhrs = installFakeXhr()
    const { kitsu } = makeClient({ globalFetch: true })
    const controller = new AbortController()
    controller.abort()
    const err = await kitsu.http
      .upload(PATH, {
        file: blob,
        onProgress: () => {},
        signal: controller.signal
      })
      .catch(e => e)
    expect(err.name).toBe('AbortError')
    expect(xhrs).toHaveLength(0)
  })

  it('aborts on the caller signal', async () => {
    const xhrs = installFakeXhr()
    const { kitsu } = makeClient({ globalFetch: true })
    const controller = new AbortController()
    const pending = kitsu.http
      .upload(PATH, {
        file: blob,
        onProgress: () => {},
        signal: controller.signal
      })
      .catch(e => e)
    await vi.waitFor(() => expect(xhrs).toHaveLength(1))
    controller.abort()
    expect((await pending).name).toBe('AbortError')
  })
})

describe('http.upload over XHR, instance wiring', () => {
  it('sends cookies in cookie mode', async () => {
    const xhrs = installFakeXhr()
    vi.stubGlobal('fetch', createFakeFetch())
    const kitsu = createClient({ host: HOST, auth: 'cookie' })
    const pending = kitsu.http.upload(PATH, {
      file: blob,
      onProgress: () => {}
    })
    await vi.waitFor(() => expect(xhrs).toHaveLength(1))
    xhrs[0].respond(201, {})
    await pending
    expect(xhrs[0].withCredentials).toBe(true)
    expect(xhrs[0].headers.Authorization).toBeUndefined()
  })

  it('is aborted by close() like any other request', async () => {
    const xhrs = installFakeXhr()
    const { kitsu } = makeClient({ globalFetch: true })
    const pending = kitsu.http
      .upload(PATH, { file: blob, onProgress: () => {} })
      .catch(e => e)
    await vi.waitFor(() => expect(xhrs).toHaveLength(1))
    kitsu.close()
    expect((await pending).name).toBe('AbortError')
  })

  // The Tauri http plugin escapes CORS, the XHR of the webview does not.
  it('keeps an injected fetch, without progress', async () => {
    const xhrs = installFakeXhr()
    const { kitsu, fake } = makeClient()
    fake.reply(201, { id: 'c1' })
    const onProgress = vi.fn()
    expect(await kitsu.http.upload(PATH, { file: blob, onProgress })).toEqual({
      id: 'c1'
    })
    expect(fake.calls).toHaveLength(1)
    expect(fake.calls[0].body).toBeInstanceOf(FormData)
    expect(xhrs).toHaveLength(0)
    expect(onProgress).not.toHaveBeenCalled()
  })

  // A fetch that only wraps the global one loses nothing to XHR.
  it('skips an injected fetch for progress with xhrUploads', async () => {
    const xhrs = installFakeXhr()
    const fake = createFakeFetch()
    const kitsu = createClient({
      host: HOST,
      fetch: fake,
      tokens: { access_token: 'token' },
      xhrUploads: true
    })
    const onProgress = vi.fn()
    const pending = kitsu.http.upload(PATH, { file: blob, onProgress })
    await vi.waitFor(() => expect(xhrs).toHaveLength(1))
    xhrs[0].upload.onprogress({ loaded: 3, total: 6 })
    xhrs[0].respond(201, { id: 'c1' })
    expect(await pending).toEqual({ id: 'c1' })
    expect(onProgress).toHaveBeenCalledWith({ loaded: 3, total: 6 })
    expect(fake.calls).toHaveLength(0)
  })

  it('never uploads over XHR with xhrUploads set to false', async () => {
    const xhrs = installFakeXhr()
    const fake = createFakeFetch().reply(201, { id: 'c1' })
    vi.stubGlobal('fetch', fake)
    const kitsu = createClient({
      host: HOST,
      tokens: { access_token: 'token' },
      xhrUploads: false
    })
    const onProgress = vi.fn()
    expect(await kitsu.http.upload(PATH, { file: blob, onProgress })).toEqual({
      id: 'c1'
    })
    expect(fake.calls).toHaveLength(1)
    expect(xhrs).toHaveLength(0)
    expect(onProgress).not.toHaveBeenCalled()
  })

  it('names extra files file-1, file-2 like gazu', async () => {
    const { kitsu, fake } = makeClient()
    fake.reply(201, {})
    await kitsu.http.upload(PATH, { file: [blob, blob, blob] })
    const form = fake.calls[0].body
    expect([...form.keys()]).toEqual(['file', 'file-1', 'file-2'])
  })
})

describe('http.download', () => {
  it('returns the raw response', async () => {
    const { kitsu, fake } = makeClient()
    fake.on(
      'GET',
      `/pictures/thumbnails/preview-files/${TASK_ID}.png`,
      () => new Response('png-bytes')
    )
    const response = await kitsu.http.download(
      `pictures/thumbnails/preview-files/${TASK_ID}.png`
    )
    expect(await response.text()).toBe('png-bytes')
  })
})
