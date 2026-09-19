import { optionalIdOf, requiredOf, withoutNil } from '../core/params.js'

/**
 * @typedef {import('../core/params.js').Entity} Entity
 * @typedef {import('../core/params.js').Model} Model
 */

export const searchApi = http => ({
  /**
   * Full text search. Zou keeps one index per kind of entity and searches
   * the ones named in indexNames.
   *
   * gazu's entity_types filter is not ported: Zou never read that key.
   * @param {string} query Search query string.
   * @param {{
   *   project?: Model,
   *   indexNames?: Array<'assets'|'shots'|'persons'>,
   *   limit?: number,
   *   offset?: number,
   *   signal?: AbortSignal
   * }} [options] project limits the search to one project. indexNames
   *   defaults to every index. limit is per index and defaults to 3 in Zou.
   * @returns {Promise<Record<string, Entity[]>>} Matching entities grouped
   *   by index name.
   */
  searchEntities: async (
    query,
    { project, indexNames, limit, offset, signal } = {}
  ) =>
    http.post(
      'data/search',
      withoutNil({
        query: requiredOf('query', query),
        project_id: optionalIdOf(project),
        index_names: indexNames ? [...indexNames] : null,
        limit,
        offset
      }),
      { signal }
    )
})
