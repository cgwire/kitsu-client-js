import { NotFoundError, ParameterError } from './errors.js'

/**
 * @typedef {string|{id: string}} Model An entity object or its id.
 * @typedef {{id: string, [field: string]: any}} Entity A raw Zou dict.
 * @typedef {{signal?: AbortSignal}} RequestOptions
 * @typedef {{
 *   fileName?: string,
 *   onProgress?: (progress: {loaded: number, total: number}) => void,
 *   signal?: AbortSignal
 * }} TransferOptions fileName names the uploaded file when it is a plain
 *   Blob. onProgress needs XMLHttpRequest (browsers, webviews).
 */

const UUID =
  /^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$/

const DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * Normalize a required entity argument to its id. Rejecting anything that
 * is not a UUID keeps caller input, and a missing entity, out of request
 * paths. Optional filters go through optionalIdOf.
 * @param {Model} model
 * @returns {string}
 */
export const idOf = model => {
  const id = model && typeof model === 'object' ? model.id : model
  if (typeof id === 'string' && UUID.test(id)) return id
  throw new ParameterError(
    'Wrong format: expected an id string or an entity object'
  )
}

/**
 * Same as idOf for an optional entity: null and undefined give null, which
 * buildQuery drops from the query.
 * @param {Model|null|undefined} model
 * @returns {string|null}
 */
export const optionalIdOf = model =>
  model === null || model === undefined ? null : idOf(model)

/**
 * @param {Model[]} [models]
 * @returns {string[]}
 */
export const idsOf = (models = []) => models.map(idOf)

/**
 * Guard a required value used as a filter. buildQuery drops empty values: a
 * blank filter would list the whole table, and a first-match lookup would
 * return an arbitrary row.
 * @template T
 * @param {string} label Name of the parameter, for the error message.
 * @param {T} value
 * @returns {T}
 */
export const requiredOf = (label, value) => {
  if (value !== null && value !== undefined && value !== '') return value
  throw new ParameterError(`Missing parameter: ${label} is required`)
}

/**
 * Same as gazu's "if value is not None": an unset optional key never reaches
 * Zou.
 * @param {Record<string, any>} data
 * @returns {Record<string, any>} A copy without the null and undefined values.
 */
export const withoutNil = data =>
  Object.fromEntries(
    Object.entries(data).filter(
      ([, value]) => value !== null && value !== undefined
    )
  )

/**
 * For get* functions built on a plain http.get: null instead of a 404.
 * @template T
 * @param {Promise<T>} promise
 * @returns {Promise<T|null>}
 */
export const orNull = promise =>
  promise.catch(err => {
    if (err instanceof NotFoundError) return null
    throw err
  })

const nameKey = entry => (entry.name || '').toLowerCase()

/**
 * Same order as gazu's sort_by_name: lowercased name, missing names first.
 * @template T
 * @param {T[]} entries
 * @returns {T[]} A new sorted array.
 */
export const sortedByName = entries =>
  [...entries].sort((a, b) => {
    const [keyA, keyB] = [nameKey(a), nameKey(b)]
    if (keyA < keyB) return -1
    return keyA > keyB ? 1 : 0
  })

const twoDigits = value => String(value).padStart(2, '0')

/**
 * The day is the local one, like gazu's naive dates: a date picker or
 * new Date(y, m, d) gives local midnight, which is the day before in UTC for
 * anyone east of Greenwich.
 * @template T
 * @param {Date|T} date
 * @returns {string|T} "YYYY-MM-DD" for a Date, the value itself otherwise.
 */
export const dateOf = date => {
  if (!(date instanceof Date)) return date
  if (Number.isNaN(date.getTime())) {
    throw new ParameterError('Wrong format: invalid Date')
  }
  return [
    date.getFullYear(),
    twoDigits(date.getMonth() + 1),
    twoDigits(date.getDate())
  ].join('-')
}

/**
 * Zou stores event and log times as naive UTC and reads them to the second.
 * @template T
 * @param {Date|T} date
 * @returns {string|T} "YYYY-MM-DDTHH:MM:SS" in UTC for a Date, the value
 *   itself otherwise.
 */
export const datetimeOf = date => {
  if (!(date instanceof Date)) return date
  if (Number.isNaN(date.getTime())) {
    throw new ParameterError('Wrong format: invalid Date')
  }
  return date.toISOString().slice(0, 19)
}

/**
 * A day that lands in a request path is checked like ids are, so caller
 * input can never reshape the route.
 * @param {Date|string} date
 * @returns {string} "YYYY-MM-DD"
 */
export const dayOf = date => {
  const day = dateOf(date)
  if (typeof day === 'string' && DAY.test(day)) return day
  throw new ParameterError(
    'Wrong format: expected a Date or a "YYYY-MM-DD" string'
  )
}
