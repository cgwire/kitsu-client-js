import { idOf, idsOf, sortedByName } from '../core/params.js'

/**
 * @typedef {import('../core/params.js').Model} Model
 * @typedef {import('../core/params.js').RequestOptions} RequestOptions
 */

export const entityApi = http => ({
  /**
   * @param {RequestOptions} [options]
   * @returns {Promise<object[]>} All entities of the database.
   */
  allEntities: ({ signal } = {}) => http.fetchAll('entities', {}, { signal }),

  /**
   * @param {RequestOptions} [options]
   * @returns {Promise<object[]>} All entity types, sorted by name.
   */
  allEntityTypes: ({ signal } = {}) =>
    http.fetchAll('entity-types', {}, { signal }).then(sortedByName),

  /**
   * @param {Model} entity
   * @param {RequestOptions} [options]
   * @returns {Promise<object|null>} The entity, null when it does not exist.
   */
  getEntity: (entity, { signal } = {}) =>
    http.fetchOne('entities', idOf(entity), { signal }),

  /**
   * @param {string} name
   * @param {{project?: Model, signal?: AbortSignal}} [options]
   * @returns {Promise<object|null>} First entity matching the name.
   */
  getEntityByName: (name, { project, signal } = {}) =>
    http.fetchFirst(
      'entities',
      { name, project_id: idOf(project) },
      { signal }
    ),

  /**
   * @param {Model} entityType
   * @param {RequestOptions} [options]
   * @returns {Promise<object|null>} The entity type, null when missing.
   */
  getEntityType: (entityType, { signal } = {}) =>
    http.fetchOne('entity-types', idOf(entityType), { signal }),

  /**
   * @param {string} name
   * @param {RequestOptions} [options]
   * @returns {Promise<object|null>} First entity type matching the name.
   */
  getEntityTypeByName: (name, { signal } = {}) =>
    http.fetchFirst('entity-types', { name }, { signal }),

  /**
   * Find the entities a file path points to, from the project file tree.
   * @param {Model} project
   * @param {string} path
   * @param {{sep?: string, signal?: AbortSignal}} [options]
   * @returns {Promise<object[]>} The matching entities.
   */
  guessFromPath: (project, path, { sep = '/', signal } = {}) =>
    http.post(
      'data/entities/guess_from_path',
      { project_id: idOf(project), file_path: path, sep },
      { signal }
    ),

  /**
   * @param {string} name
   * @param {RequestOptions} [options]
   * @returns {Promise<object>} The created entity type.
   */
  newEntityType: (name, { signal } = {}) =>
    http.create('entity-types', { name }, { signal }),

  /**
   * @param {Model} entityType
   * @param {RequestOptions} [options]
   * @returns {Promise<null>}
   */
  removeEntityType: (entityType, { signal } = {}) =>
    http.remove('entity-types', idOf(entityType), {}, { signal }),

  /**
   * @param {Model} entity
   * @param {{force?: boolean, signal?: AbortSignal}} [options] force also
   *   deletes the data linked to the entity.
   * @returns {Promise<null>}
   */
  removeEntity: (entity, { force = false, signal } = {}) =>
    http.remove(
      'entities',
      idOf(entity),
      { force: force ? true : null },
      { signal }
    ),

  /**
   * @param {Model} project
   * @param {Model[]} entities
   * @param {{force?: boolean, signal?: AbortSignal}} [options]
   * @returns {Promise<string[]>} Ids of the deleted entities.
   */
  removeEntities: (project, entities, { force = false, signal } = {}) =>
    http.request('POST', `actions/projects/${idOf(project)}/delete-entities`, {
      body: idsOf(entities),
      query: { force: force ? true : null },
      signal
    }),

  /**
   * @param {Model} entity
   * @param {RequestOptions} [options]
   * @returns {Promise<object[]>} Entities linked to the entity, with tasks.
   */
  allEntitiesWithTasksLinkedToEntity: (entity, { signal } = {}) =>
    http.fetchAll(
      `entities/${idOf(entity)}/entities-linked/with-tasks`,
      {},
      { signal }
    )
})
