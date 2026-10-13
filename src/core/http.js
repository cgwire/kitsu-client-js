import { parseBody } from './body.js'
import {
  KitsuError,
  NetworkError,
  NotAuthenticatedError,
  TimeoutError,
  errorFromResponse
} from './errors.js'
import { readNdjson } from './ndjson.js'
import { orNull } from './params.js'
import { buildUrl } from './query.js'
import { createUpload } from './upload.js'

const isFormData = body =>
  typeof FormData !== 'undefined' && body instanceof FormData

const encodeBody = body => {
  if (body === undefined || body === null) return {}
  if (isFormData(body)) return { body }
  return {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' }
  }
}

// The id of an update is in its path. Zou drops it from the body too, but
// only after comparing the body keys with what the role of the user may
// write (a supervisor on a task or an entity, anyone but its author on a
// comment): an id there turns an allowed write into a 403.
const withoutId = body =>
  body && typeof body === 'object' && 'id' in body
    ? Object.fromEntries(Object.entries(body).filter(([key]) => key !== 'id'))
    : body

// A JSON body can be a string too, hence the explicit flag.
const readBody = async response =>
  parseBody(
    response.status === 204 ? '' : await response.text(),
    response.headers.get('Content-Type') || ''
  )

// An answer of the API that is not the data asked for. The cause option of
// Error is ES2022: the parse failure is set by hand for the floor.
const notData = (info, status, detail, body, cause) =>
  Object.assign(
    new KitsuError(`${info.method} ${info.path} answered ${status} ${detail}`, {
      ...info,
      status,
      body
    }),
    cause && { cause }
  )

// undici rejects with "fetch failed" and keeps the reason (DNS, TLS, a
// refused connection) in its cause; the Tauri http plugin rejects with a
// string.
const reasonOf = err => {
  if (typeof err?.message !== 'string') return String(err)
  const cause = err.cause?.message
  return typeof cause === 'string' ? `${err.message}: ${cause}` : err.message
}

// Seconds to wait before asking again, when the answer tells it: Zou sends
// a number of seconds, HTTP also allows a date.
const retryAfterOf = response => {
  const value = (response.headers.get('Retry-After') || '').trim()
  if (/^\d+$/.test(value)) return Number(value)
  const date = Date.parse(value)
  return Number.isNaN(date)
    ? null
    : Math.max(0, Math.ceil((date - Date.now()) / 1000))
}

// The answer with a body that calls release once it ends, fails or is
// cancelled. A stream source of its own: browsers ignore the cancel hook of
// a transformer.
const releasing = (response, release) => {
  const reader = response.body.getReader()
  const body = new ReadableStream(
    {
      pull: stream =>
        reader.read().then(
          ({ done, value }) => {
            if (!done) return stream.enqueue(value)
            release()
            return stream.close()
          },
          err => {
            release()
            throw err
          }
        ),
      cancel: reason => {
        release()
        return reader.cancel(reason)
      }
    },
    { highWaterMark: 0 }
  )
  return new Response(body, response)
}

const NOT_STREAMED = Symbol('not streamed')

const isAuthFailure = err =>
  err instanceof NotAuthenticatedError ||
  (err instanceof KitsuError && err.status >= 400 && err.status < 500)

export const createHttp = (config, session) => {
  const { host, fetch: fetchImpl, timeout, credentials, xhrUploads } = config
  const inflight = new Set()

  // One network attempt. options.raw returns the Response untouched;
  // options.read(response) reads a successful body that is not JSON (NDJSON,
  // CSV) inside the attempt, so the deadline and the abort wiring cover it.
  // Not AbortSignal.timeout/any: both are above the browser floor.
  const send = async (method, path, options = {}) => {
    const { query, body, headers = {}, signal, raw = false, read } = options
    // Whatever can throw comes before anything is armed.
    const url = buildUrl(host, path, query)
    const encoded = encodeBody(body)
    const info = { path, method }
    const controller = new AbortController()
    const abortFromCaller = () => controller.abort()
    let timedOut = false
    const expire = () => {
      timedOut = true
      controller.abort()
    }
    const arm = delay =>
      Number.isFinite(delay) ? setTimeout(expire, delay) : null
    const release = () => {
      inflight.delete(controller)
      if (signal) signal.removeEventListener('abort', abortFromCaller)
    }
    inflight.add(controller)
    if (signal) {
      if (signal.aborted) controller.abort()
      else signal.addEventListener('abort', abortFromCaller)
    }
    // Transfers (FormData uploads, raw downloads) are unbounded past the
    // first byte: multi-GB movies are legitimate.
    const bounded = !raw && !isFormData(body)
    const responseTimer = isFormData(body) ? null : arm(timeout.response)
    const deadlineTimer = bounded ? arm(timeout.deadline) : null
    let streaming = false
    let status = null

    try {
      const response = await fetchImpl(url, {
        method,
        body: encoded.body,
        headers: { Accept: 'application/json', ...encoded.headers, ...headers },
        signal: controller.signal,
        credentials
      })
      clearTimeout(responseTimer)
      status = response.status
      if (!response.ok) {
        const { data } = await readBody(response).catch(() => ({ data: '' }))
        throw errorFromResponse(response.status, {
          ...info,
          body: data || '',
          retryAfter: retryAfterOf(response)
        })
      }
      // Asked for JSON, Zou answers 202 and when to come back for a preview
      // whose files it still builds: no file yet. Any other client gets a
      // 404, as for a missing file.
      if (raw && response.status === 202) {
        const { data } = await readBody(response).catch(() => ({ data: '' }))
        throw new KitsuError(
          `${method} ${path} answered 202: the file is not ready yet`,
          {
            ...info,
            status: 202,
            body: data || '',
            retryAfter: retryAfterOf(response)
          }
        )
      }
      if (raw && response.body) {
        // The body is still to be read by the caller: the abort wiring
        // stays until the body ends, fails or is cancelled, or an abort
        // (caller signal, abortAll) releases it.
        streaming = true
        controller.signal.addEventListener('abort', release, { once: true })
        return releasing(response, release)
      }
      if (raw) return response
      if (read) return await read(response)
      const { data, isJson, error } = await readBody(response)
      // A page served with a 2xx (host without "/api", SSO portal), or JSON
      // cut short, must not reach the caller as if it were data.
      if (!isJson) {
        const detail = error ? 'with malformed JSON' : 'without JSON'
        throw notData(info, response.status, detail, data, error)
      }
      return data
    } catch (err) {
      if (timedOut) throw new TimeoutError(`${method} ${path} timed out`, info)
      // Decided from the controller, not from the shape of the rejection:
      // injected fetches (Tauri) do not all reject with an AbortError.
      if (controller.signal.aborted) {
        throw err?.name === 'AbortError'
          ? err
          : new DOMException('The operation was aborted', 'AbortError')
      }
      if (err instanceof KitsuError) throw err
      // A body read by options.read that does not parse (NDJSON): the API
      // answered, so this is no transport failure.
      if (err instanceof SyntaxError) {
        throw notData(info, status, 'with a malformed body', '', err)
      }
      throw Object.assign(
        new NetworkError(`${method} ${path} failed: ${reasonOf(err)}`, info),
        { cause: err }
      )
    } finally {
      clearTimeout(responseTimer)
      clearTimeout(deadlineTimer)
      if (!streaming) release()
    }
  }

  const withAuthReplay = async attempt => {
    const generation = session.generation()
    const used = session.headers()
    // logIn, logOut or setToken happened since the request left: its 401
    // belongs to the former session, so it is neither replayed under another
    // identity nor reported as a lost session.
    const replaced = () => session.generation() !== generation
    try {
      return await attempt(used)
    } catch (err) {
      if (!(err instanceof NotAuthenticatedError) || replaced()) throw err
      // A late 401 can land after another request already renewed the
      // token: replay with it instead of refreshing again.
      const renewedMeanwhile =
        session.headers().Authorization !== used.Authorization
      if (!renewedMeanwhile) {
        const refreshError = session.canRefresh()
          ? await session.refresh(send).then(
              () => null,
              failure => failure
            )
          : err
        if (replaced()) throw err
        // Only an answer of the API tells the session is lost: a network
        // failure, a timeout or close() says nothing about the refresh token.
        if (refreshError && !isAuthFailure(refreshError)) throw refreshError
        if (refreshError) {
          session.onUnauthorized()
          throw err
        }
      }
      try {
        return await attempt(session.headers())
      } catch (replayErr) {
        if (replayErr instanceof NotAuthenticatedError && !replaced()) {
          session.onUnauthorized()
        }
        throw replayErr
      }
    }
  }

  const request = (method, path, options = {}) =>
    options.skipAuth
      ? send(method, path, options)
      : withAuthReplay(headers =>
          send(method, path, {
            ...options,
            headers: { ...headers, ...options.headers }
          })
        )

  const get = (path, query, options) =>
    request('GET', path, { ...options, query })
  const post = (path, body, options) =>
    request('POST', path, { ...options, body })
  const put = (path, body, options) =>
    request('PUT', path, { ...options, body })
  const del = (path, body, options) =>
    request('DELETE', path, { ...options, body })

  const readStream = async response => {
    const type = response.headers.get('Content-Type') || ''
    if (type.includes('ndjson')) return readNdjson(response)
    // An unread body holds its connection: release it before asking again.
    if (response.body) await response.body.cancel()
    return NOT_STREAMED
  }

  // The stream is read inside send, so the deadline, the caller signal and
  // abortAll cover it up to the last line. An answer of the API that is not
  // a stream (older Zou, proxy) is asked again as a plain request, which
  // raises the typed error if there is one; a transport failure is not.
  const getNdjson = async (path, query = {}, options = {}) => {
    try {
      const entities = await request('GET', path, {
        ...options,
        read: readStream,
        query: { ...query, stream: true, compact: true },
        headers: { Accept: 'application/x-ndjson' }
      })
      if (entities !== NOT_STREAMED) return entities
    } catch (err) {
      const answered =
        err instanceof KitsuError &&
        err.status &&
        !(err instanceof NotAuthenticatedError)
      if (!answered) throw err
    }
    return get(path, query, options)
  }

  // For transports that do not go through send (XHR uploads): they join the
  // in-flight set, so abortAll and close() reach them too.
  const track = signal => {
    const controller = new AbortController()
    const abortFromCaller = () => controller.abort()
    inflight.add(controller)
    if (signal) {
      if (signal.aborted) controller.abort()
      else signal.addEventListener('abort', abortFromCaller)
    }
    return {
      signal: controller.signal,
      release: () => {
        inflight.delete(controller)
        if (signal) signal.removeEventListener('abort', abortFromCaller)
      }
    }
  }

  const upload = createUpload({
    host,
    request,
    withAuthReplay,
    track,
    withCredentials: credentials === 'same-origin',
    xhrUploads
  })

  /**
   * A file Zou still builds (the pictures and movies of a new preview)
   * rejects with a KitsuError of status 202, whose retryAfter tells when
   * to ask again.
   * @param {string} path
   * @param {{query?: object, signal?: AbortSignal}} [options]
   * @returns {Promise<Response>} The raw response: the caller reads
   *   .blob() or .body, or cancels the body it does not want, which holds
   *   its connection until then. The client never writes to disk.
   */
  const download = (path, { query, signal } = {}) =>
    request('GET', path, { query, signal, raw: true })

  return {
    host,
    send,
    request,
    withAuthReplay,
    upload,
    download,
    get,
    getNdjson,
    post,
    put,
    del,
    fetchAll: (path, query, options) => get(`data/${path}`, query, options),
    fetchFirst: (path, query, options) =>
      orNull(get(`data/${path}`, query, options)).then(entries =>
        Array.isArray(entries) && entries.length > 0 ? entries[0] : null
      ),
    fetchOne: (model, id, options) =>
      orNull(get(`data/${model}/${id}`, {}, options)),
    create: (model, data, options) => post(`data/${model}`, data, options),
    update: (model, id, data, options) =>
      put(`data/${model}/${id}`, withoutId(data), options),
    remove: (model, id, query, options) =>
      request('DELETE', `data/${model}/${id}`, { ...options, query }),
    abortAll: () => inflight.forEach(controller => controller.abort())
  }
}
