import { NetworkError, ParameterError, errorFromResponse } from './errors.js'
import { buildUrl } from './query.js'

/**
 * @typedef {object} UploadOptions
 * @property {Blob|Blob[]} file The file, or the files: the first one goes in
 *   the "file" field, the next ones in "file-1", "file-2", like gazu.
 * @property {Record<string, any>} [fields] Extra form fields. Objects and
 *   arrays are sent as JSON.
 * @property {string} [fileField] Name of the file field, "file" by default.
 * @property {string} [fileName] File name of the first file.
 * @property {Record<string, any>} [query] Query parameters of the URL.
 * @property {(progress: {loaded: number, total: number}) => void} [onProgress]
 *   Needs XMLHttpRequest (browsers, webviews): fetch cannot report it. A
 *   client given its own fetch (Tauri) uploads through it and never calls
 *   onProgress.
 * @property {AbortSignal} [signal]
 */

/** @param {UploadOptions} options */
const buildForm = ({ file, fields = {}, fileField = 'file', fileName }) => {
  const form = new FormData()
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      form.append(
        key,
        typeof value === 'object' ? JSON.stringify(value) : value
      )
    }
  })
  const files = Array.isArray(file) ? file : [file]
  // FormData turns anything else into text: a missing file would be sent as
  // the string "undefined".
  if (!files.length || !files.every(entry => entry instanceof Blob)) {
    throw new ParameterError('Missing parameter: file must be a Blob or a File')
  }
  files.forEach((entry, index) => {
    const field = index === 0 ? fileField : `${fileField}-${index}`
    if (fileName && index === 0) form.append(field, entry, fileName)
    else form.append(field, entry)
  })
  return form
}

const parseText = text => {
  try {
    return text ? JSON.parse(text) : null
  } catch {
    return text
  }
}

const abortError = () =>
  new DOMException('The operation was aborted', 'AbortError')

// fetch cannot report upload progress: XHR is the only way to get it.
const xhrUpload = ({
  url,
  form,
  headers,
  onProgress,
  signal,
  withCredentials,
  info
}) =>
  new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError())
      return
    }
    const xhr = new globalThis.XMLHttpRequest()
    const abort = () => xhr.abort()
    const settle = (settler, value) => {
      signal.removeEventListener('abort', abort)
      settler(value)
    }
    xhr.open('POST', url)
    if (withCredentials) xhr.withCredentials = true
    Object.entries({ Accept: 'application/json', ...headers }).forEach(
      ([name, value]) => xhr.setRequestHeader(name, value)
    )
    xhr.upload.onprogress = ({ loaded, total }) => onProgress({ loaded, total })
    xhr.onload = () => {
      const body = parseText(xhr.responseText)
      if (xhr.status >= 200 && xhr.status < 300) settle(resolve, body)
      else {
        settle(
          reject,
          errorFromResponse(xhr.status, { ...info, body: body || '' })
        )
      }
    }
    xhr.onerror = () =>
      settle(reject, new NetworkError(`POST ${info.path} failed`, info))
    xhr.onabort = () => settle(reject, abortError())
    signal.addEventListener('abort', abort)
    xhr.send(form)
  })

/**
 * @param {object} deps
 * @param {string} deps.host
 * @param {Function} deps.request The authenticated request of the http core.
 * @param {Function} deps.withAuthReplay
 * @param {(signal?: AbortSignal) => {signal: AbortSignal, release: () => void}} deps.track
 *   Registers an attempt among the in-flight requests of the instance, so
 *   close() aborts it like any other request.
 * @param {boolean} deps.withCredentials Cookie mode: the XHR sends cookies.
 * @param {boolean} [deps.globalFetch] The client runs on the global fetch.
 */
export const createUpload =
  ({ host, request, withAuthReplay, track, withCredentials, globalFetch }) =>
  /**
   * @param {string} path
   * @param {UploadOptions} options
   * @returns {Promise<any>} The parsed answer of the API.
   */
  async (path, options) => {
    const form = buildForm(options)
    const { query, onProgress, signal } = options
    // XHR goes out through the network stack of the page, like the global
    // fetch. An injected fetch (the Tauri http plugin, which escapes CORS,
    // or a wrapper adding headers) must not be bypassed: progress is lost.
    const useXhr =
      onProgress &&
      globalFetch &&
      typeof globalThis.XMLHttpRequest !== 'undefined'
    if (!useXhr) return request('POST', path, { body: form, query, signal })
    return withAuthReplay(headers => {
      const tracked = track(signal)
      return xhrUpload({
        url: buildUrl(host, path, query),
        form,
        headers,
        onProgress,
        signal: tracked.signal,
        withCredentials,
        info: { path, method: 'POST' }
      }).finally(tracked.release)
    })
  }
