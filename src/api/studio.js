import { idOf, requiredOf, sortedByName } from '../core/params.js'

/**
 * @typedef {import('../core/params.js').Entity} Entity
 * @typedef {import('../core/params.js').Model} Model
 * @typedef {import('../core/params.js').RequestOptions} RequestOptions
 */

/** @param {any} http */
export const studioApi = http => ({
  /**
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} All studios, sorted by name.
   */
  allStudios: async ({ signal } = {}) =>
    http.fetchAll('studios', {}, { signal }).then(sortedByName),

  /**
   * @param {Model} studio
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity|null>} The studio, null when it does not exist.
   */
  getStudio: async (studio, { signal } = {}) =>
    http.fetchOne('studios', idOf(studio), { signal }),

  /**
   * @param {string} name
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity|null>} First studio matching the name.
   */
  getStudioByName: async (name, { signal } = {}) =>
    http.fetchFirst('studios', { name: requiredOf('name', name) }, { signal }),

  /**
   * Studio names are unique: the API refuses a name already in use.
   * @param {string} name
   * @param {string} color Hexadecimal color, such as "#ff0000".
   * @param {{archived?: boolean, signal?: AbortSignal}} [options]
   * @returns {Promise<Entity>} The created studio.
   */
  newStudio: async (name, color, { archived = false, signal } = {}) =>
    http.create(
      'studios',
      {
        name: requiredOf('name', name),
        color: requiredOf('color', color),
        archived
      },
      { signal }
    ),

  /**
   * Save the studio. Its metadata are fully replaced by the given ones.
   * @param {{id: string}} studio
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The updated studio.
   */
  updateStudio: async (studio, { signal } = {}) =>
    http.update('studios', idOf(studio), studio, { signal }),

  /**
   * Without force, the deletion fails when records are linked to the studio.
   * @param {Model} studio
   * @param {{force?: boolean, signal?: AbortSignal}} [options] force also
   * deletes the linked records.
   * @returns {Promise<any>}
   */
  removeStudio: async (studio, { force = false, signal } = {}) =>
    http.remove(
      'studios',
      idOf(studio),
      { force: force ? true : null },
      { signal }
    )
})
