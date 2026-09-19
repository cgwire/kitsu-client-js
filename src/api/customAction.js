import { idOf, requiredOf, sortedByName, withoutNil } from '../core/params.js'

/**
 * @typedef {import('../core/params.js').Entity} Entity
 * @typedef {import('../core/params.js').Model} Model
 * @typedef {import('../core/params.js').RequestOptions} RequestOptions
 */

/** @param {any} http */
export const customActionApi = http => ({
  /**
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} All custom actions, sorted by name.
   */
  allCustomActions: async ({ signal } = {}) =>
    http.fetchAll('custom-actions', {}, { signal }).then(sortedByName),

  /**
   * @param {string} name
   * @param {string} url Address the selection is posted to.
   * @param {{
   *   entityType?: string,
   *   isAjax?: boolean,
   *   signal?: AbortSignal
   * }} [options] entityType limits the action to one kind of entity ("all"
   * by default); isAjax posts in the background instead of opening the url.
   * @returns {Promise<Entity>} The created custom action.
   */
  newCustomAction: async (
    name,
    url,
    { entityType = 'all', isAjax = false, signal } = {}
  ) =>
    http.create(
      'custom-actions',
      {
        name: requiredOf('name', name),
        url: requiredOf('url', url),
        entity_type: entityType,
        is_ajax: isAjax
      },
      { signal }
    ),

  /**
   * Save the name, url, entity_type and is_ajax fields of the custom action.
   * @param {{id: string, [field: string]: any}} customAction
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The updated custom action.
   */
  updateCustomAction: async (customAction, { signal } = {}) => {
    const id = idOf(customAction)
    const { name, url, entity_type, is_ajax } = customAction
    return http.update(
      'custom-actions',
      id,
      withoutNil({ name, url, entity_type, is_ajax }),
      { signal }
    )
  },

  /**
   * @param {Model} customAction
   * @param {RequestOptions} [options]
   * @returns {Promise<any>}
   */
  removeCustomAction: async (customAction, { signal } = {}) =>
    http.remove('custom-actions', idOf(customAction), {}, { signal })
})
