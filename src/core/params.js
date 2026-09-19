import { ParameterError } from './errors.js'

/**
 * @typedef {string|{id: string}} Model An entity object or its id.
 * @typedef {{signal?: AbortSignal}} RequestOptions
 */

const UUID =
  /^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$/

/**
 * Normalize an entity argument to its id. Rejecting anything that is not a
 * UUID also keeps caller input out of request paths.
 * @param {Model|null|undefined} model
 * @returns {string|null}
 */
export const idOf = model => {
  if (model === null || model === undefined) return null
  const id = typeof model === 'object' ? model.id : model
  if (typeof id === 'string' && UUID.test(id)) return id
  throw new ParameterError(
    'Wrong format: expected an id string or an entity object'
  )
}

/**
 * @param {Model[]} [models]
 * @returns {string[]}
 */
export const idsOf = (models = []) => models.map(idOf)

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

/**
 * @param {Date|string|null|undefined} date
 * @returns {string|null|undefined} "YYYY-MM-DD" for a Date (UTC), the value
 *   itself otherwise.
 */
export const dateOf = date =>
  date instanceof Date ? date.toISOString().slice(0, 10) : date
