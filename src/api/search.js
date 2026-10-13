import { ParameterError } from '../core/errors.js'
import { optionalIdOf, requiredOf, withoutNil } from '../core/params.js'

/**
 * @typedef {import('../core/params.js').Entity} Entity
 * @typedef {import('../core/params.js').Model} Model
 */

// Zou answers {} to a shorter query, without any of the index keys. Python
// counts code points, as the spread does.
const queryOf = query => {
  const given = requiredOf('query', query)
  if (typeof given === 'string' && [...given].length >= 3) return given
  throw new ParameterError(
    'Wrong format: query must be a string of 3 characters or more'
  )
}

export const searchApi = http => ({
  /**
   * Full text search. Zou keeps one index per kind of entity and searches
   * the ones named in indexNames.
   *
   * gazu's entity_types filter is not ported: Zou never read that key.
   * @param {string} query Search query string, 3 characters or more: Zou
   *   searches nothing shorter.
   * @param {{
   *   project?: Model,
   *   indexNames?: Array<'assets'|'shots'|'persons'>,
   *   limit?: number,
   *   offset?: number,
   *   signal?: AbortSignal
   * }} [options] project limits the search to one open production of the
   *   user. For any other project, Zou searches the assets and shots of
   *   every production for an admin, of none for anyone else. indexNames
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
        query: queryOf(query),
        project_id: optionalIdOf(project),
        index_names: indexNames ? [...indexNames] : null,
        limit,
        offset
      }),
      { signal }
    )
})
