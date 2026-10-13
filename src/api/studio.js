import { ParameterError } from '../core/errors.js'
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
   * Save the studio: its name, color and archived fields.
   * @param {Entity} studio
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The updated studio.
   */
  updateStudio: async (studio, { signal } = {}) => {
    const id = idOf(studio)
    // Its id alone would become the body, which Zou answers with a 500.
    if (typeof studio !== 'object') {
      throw new ParameterError('Wrong format: expected the studio, not its id')
    }
    return http.update('studios', id, studio, { signal })
  },

  /**
   * Zou refuses (400) to delete a studio that people still belong to: change
   * their studio_id first.
   *
   * gazu's force is not ported: Zou never reads it on this route.
   * @param {Model} studio
   * @param {RequestOptions} [options]
   * @returns {Promise<null>}
   */
  removeStudio: async (studio, { signal } = {}) =>
    http.remove('studios', idOf(studio), {}, { signal })
})
