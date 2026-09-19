import { idsOf, optionalIdOf, withoutNil } from '../core/params.js'

/**
 * @typedef {import('../core/params.js').Entity} Entity
 * @typedef {import('../core/params.js').Model} Model
 */

export const searchApi = http => ({
  /**
   * Search for entities matching the given query.
   * @param {string} query Search query string.
   * @param {{
   *   project?: Model,
   *   entityTypes?: Model[],
   *   signal?: AbortSignal
   * }} [options] project limits the search to one project, entityTypes
   *   filters by entity type.
   * @returns {Promise<Record<string, Entity[]>>} Matching entities grouped
   *   by index name ("persons", "assets", "shots").
   */
  searchEntities: async (query, { project, entityTypes, signal } = {}) =>
    http.post(
      'data/search',
      withoutNil({
        query,
        project_id: optionalIdOf(project),
        entity_types:
          entityTypes === null || entityTypes === undefined
            ? null
            : idsOf(entityTypes)
      }),
      { signal }
    )
})
