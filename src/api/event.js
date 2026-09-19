import { dateOf, idsOf, optionalIdOf } from '../core/params.js'

/**
 * @typedef {import('../core/params.js').Entity} Entity
 * @typedef {import('../core/params.js').Model} Model
 * @typedef {import('../core/params.js').RequestOptions} RequestOptions
 */

export const eventApi = http => ({
  /**
   * List the last events, most recent first. Managers only see the events
   * of their productions.
   * @param {{
   *   after?: Date|string,
   *   before?: Date|string,
   *   limit?: number,
   *   lastEvent?: Model,
   *   project?: Model,
   *   onlyFiles?: boolean,
   *   persons?: Model[],
   *   namePrefixes?: string[],
   *   nameSuffixes?: string[],
   *   signal?: AbortSignal
   * }} [options] lastEvent is the last event of the previous page (cursor
   *   pagination). The API caps limit at 1000.
   * @returns {Promise<Entity[]>}
   */
  allLastEvents: async ({
    after,
    before,
    limit,
    lastEvent,
    project,
    onlyFiles,
    persons,
    namePrefixes,
    nameSuffixes,
    signal
  } = {}) =>
    http.get(
      'data/events/last',
      {
        after: dateOf(after),
        before: dateOf(before),
        limit,
        cursor_event_id: optionalIdOf(lastEvent),
        project_id: optionalIdOf(project),
        only_files: onlyFiles ? true : null,
        person_ids: idsOf(persons),
        name_prefixes: namePrefixes,
        name_suffixes: nameSuffixes
      },
      { signal }
    ),

  /**
   * List the names of the events recorded by the API.
   * @param {RequestOptions} [options]
   * @returns {Promise<string[]>}
   */
  allEventNames: async ({ signal } = {}) =>
    http.get('data/events/names', {}, { signal }),

  /**
   * List the last login logs, most recent first. Admins only.
   * @param {{
   *   after?: Date|string,
   *   before?: Date|string,
   *   limit?: number,
   *   lastLoginLog?: Model,
   *   persons?: Model[],
   *   signal?: AbortSignal
   * }} [options] lastLoginLog is the last log of the previous page (cursor
   *   pagination). The API caps limit at 1000.
   * @returns {Promise<Entity[]>}
   */
  allLastLoginLogs: async ({
    after,
    before,
    limit,
    lastLoginLog,
    persons,
    signal
  } = {}) =>
    http.get(
      'data/events/login-logs/last',
      {
        after: dateOf(after),
        before: dateOf(before),
        limit,
        cursor_login_log_id: optionalIdOf(lastLoginLog),
        person_ids: idsOf(persons)
      },
      { signal }
    )
})
