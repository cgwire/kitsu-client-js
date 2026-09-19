import {
  KitsuError,
  NetworkError,
  NotAuthenticatedError,
  NotFoundError,
  TimeoutError,
  errorFromResponse
} from './errors.js'
import { buildUrl } from './query.js'

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

const parseBody = async response => {
  if (response.status === 204) return null
  const type = response.headers.get('Content-Type') || ''
  const text = await response.text()
  if (!text) return null
  return type.includes('json') ? JSON.parse(text) : text
}

const orNull = promise =>
  promise.catch(err => {
    if (err instanceof NotFoundError) return null
    throw err
  })

export const createHttp = (config, session) => {
  const { host, fetch: fetchImpl, timeout, credentials } = config
  const inflight = new Set()

  // Not AbortSignal.timeout/any: both are above the browser floor.
  const send = async (method, path, options = {}) => {
    const { query, body, headers = {}, signal, raw = false } = options
    const controller = new AbortController()
    const abortFromCaller = () => controller.abort()
    let timedOut = false
    const expire = () => {
      timedOut = true
      controller.abort()
    }
    inflight.add(controller)
    if (signal) {
      if (signal.aborted) controller.abort()
      else signal.addEventListener('abort', abortFromCaller)
    }
    // Transfers (FormData uploads, raw downloads) are unbounded past the
    // first byte: multi-GB movies are legitimate.
    const bounded = !raw && !isFormData(body)
    const responseTimer = isFormData(body)
      ? null
      : setTimeout(expire, timeout.response)
    const deadlineTimer = bounded ? setTimeout(expire, timeout.deadline) : null
    const encoded = encodeBody(body)
    const info = { path, method }

    try {
      const response = await fetchImpl(buildUrl(host, path, query), {
        method,
        body: encoded.body,
        headers: { Accept: 'application/json', ...encoded.headers, ...headers },
        signal: controller.signal,
        ...(credentials ? { credentials } : {})
      })
      clearTimeout(responseTimer)
      if (!response.ok) {
        const errorBody = await parseBody(response).catch(() => '')
        throw errorFromResponse(response.status, {
          ...info,
          body: errorBody || ''
        })
      }
      return raw ? response : await parseBody(response)
    } catch (err) {
      if (timedOut) throw new TimeoutError(`${method} ${path} timed out`, info)
      const passThrough =
        err.name === 'AbortError' ||
        err instanceof KitsuError ||
        err instanceof SyntaxError
      if (passThrough) throw err
      throw new NetworkError(`${method} ${path} failed: ${err.message}`, info)
    } finally {
      clearTimeout(responseTimer)
      clearTimeout(deadlineTimer)
      inflight.delete(controller)
      if (signal) signal.removeEventListener('abort', abortFromCaller)
    }
  }

  const withAuthReplay = async attempt => {
    const used = session.headers()
    try {
      return await attempt(used)
    } catch (err) {
      if (!(err instanceof NotAuthenticatedError)) throw err
      // A late 401 can land after another request already renewed the
      // token: replay with it instead of refreshing again.
      const renewedMeanwhile =
        session.headers().Authorization !== used.Authorization
      const refreshed =
        renewedMeanwhile ||
        (session.canRefresh() &&
          (await session.refresh(send).then(
            () => true,
            () => false
          )))
      if (!refreshed) {
        session.onUnauthorized()
        throw err
      }
      try {
        return await attempt(session.headers())
      } catch (replayErr) {
        if (replayErr instanceof NotAuthenticatedError) session.onUnauthorized()
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

  return {
    host,
    send,
    request,
    withAuthReplay,
    get,
    post,
    put,
    del,
    fetchAll: (path, query, options) => get(`data/${path}`, query, options),
    fetchFirst: (path, query, options) =>
      get(`data/${path}`, query, options).then(entries =>
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
