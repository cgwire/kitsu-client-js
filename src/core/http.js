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

// A JSON body can be a string too, hence the explicit flag.
const readBody = async response => {
  const type = response.headers.get('Content-Type') || ''
  const text = response.status === 204 ? '' : await response.text()
  if (!text) return { data: null, isJson: true }
  return type.includes('json')
    ? { data: JSON.parse(text), isJson: true }
    : { data: text, isJson: false }
}

const NOT_STREAMED = Symbol('not streamed')

const isAuthFailure = err =>
  err instanceof NotAuthenticatedError ||
  (err instanceof KitsuError && err.status >= 400 && err.status < 500)

export const createHttp = (config, session) => {
  const { host, fetch: fetchImpl, timeout, credentials } = config
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

    try {
      const response = await fetchImpl(url, {
        method,
        body: encoded.body,
        headers: { Accept: 'application/json', ...encoded.headers, ...headers },
        signal: controller.signal,
        credentials
      })
      clearTimeout(responseTimer)
      if (!response.ok) {
        const { data } = await readBody(response).catch(() => ({ data: '' }))
        throw errorFromResponse(response.status, { ...info, body: data || '' })
      }
      if (raw) {
        // The body is still to be read by the caller: the abort wiring
        // stays until an abort (caller signal, abortAll) releases it.
        streaming = true
        controller.signal.addEventListener('abort', release, { once: true })
        return response
      }
      if (read) return await read(response)
      const { data, isJson } = await readBody(response)
      // A page served with a 2xx (host without "/api", SSO portal) must not
      // reach the caller as if it were data.
      if (!isJson) {
        throw new KitsuError(
          `${method} ${path} answered ${response.status} without JSON`,
          { ...info, status: response.status, body: data }
        )
      }
      return data
    } catch (err) {
      if (timedOut) throw new TimeoutError(`${method} ${path} timed out`, info)
      // Decided from the controller, not from the shape of the rejection:
      // injected fetches (Tauri) do not all reject with an AbortError.
      if (controller.signal.aborted) {
        throw err.name === 'AbortError'
          ? err
          : new DOMException('The operation was aborted', 'AbortError')
      }
      if (err instanceof KitsuError || err instanceof SyntaxError) throw err
      throw new NetworkError(`${method} ${path} failed: ${err.message}`, info)
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
        err instanceof SyntaxError ||
        (err instanceof KitsuError &&
          err.status &&
          !(err instanceof NotAuthenticatedError))
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
    withCredentials: credentials === 'same-origin'
  })

  /**
   * @param {string} path
   * @param {{query?: object, signal?: AbortSignal}} [options]
   * @returns {Promise<Response>} The raw response: the caller reads
   *   .blob() or .body. The client never writes to disk.
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
      put(`data/${model}/${id}`, data, options),
    remove: (model, id, query, options) =>
      request('DELETE', `data/${model}/${id}`, { ...options, query }),
    abortAll: () => inflight.forEach(controller => controller.abort())
  }
}
