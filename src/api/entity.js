import {
  idOf,
  idsOf,
  optionalIdOf,
  requiredOf,
  sortedByName
} from '../core/params.js'

/**
 * @typedef {import('../core/params.js').Entity} Entity
 * @typedef {import('../core/params.js').Model} Model
 * @typedef {import('../core/params.js').RequestOptions} RequestOptions
 */

export const entityApi = http => ({
  /**
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} All entities of the database.
   */
  allEntities: async ({ signal } = {}) =>
    http.fetchAll('entities', {}, { signal }),

  /**
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} All entity types, sorted by name.
   */
  allEntityTypes: async ({ signal } = {}) =>
    http.fetchAll('entity-types', {}, { signal }).then(sortedByName),

  /**
   * @param {Model} entity
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity|null>} The entity, null when it does not exist.
   */
  getEntity: async (entity, { signal } = {}) =>
    http.fetchOne('entities', idOf(entity), { signal }),

  /**
   * @param {string} name
   * @param {{project?: Model, signal?: AbortSignal}} [options]
   * @returns {Promise<Entity|null>} First entity matching the name.
   */
  getEntityByName: async (name, { project, signal } = {}) =>
    http.fetchFirst(
      'entities',
      { name: requiredOf('name', name), project_id: optionalIdOf(project) },
      { signal }
    ),

  /**
   * @param {Model} entityType
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity|null>} The entity type, null when missing.
   */
  getEntityType: async (entityType, { signal } = {}) =>
    http.fetchOne('entity-types', idOf(entityType), { signal }),

  /**
   * @param {string} name
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity|null>} First entity type matching the name.
   */
  getEntityTypeByName: async (name, { signal } = {}) =>
    http.fetchFirst(
      'entity-types',
      { name: requiredOf('name', name) },
      { signal }
    ),

  /**
   * Find the entities a file path points to, from the project file tree.
   * @param {Model} project
   * @param {string} path
   * @param {{sep?: string, signal?: AbortSignal}} [options]
   * @returns {Promise<Entity[]>} The matching entities.
   */
  guessFromPath: async (project, path, { sep = '/', signal } = {}) =>
    http.post(
      'data/entities/guess_from_path',
      { project_id: idOf(project), file_path: path, sep },
      { signal }
    ),

  /**
   * @param {string} name
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The created entity type.
   */
  newEntityType: async (name, { signal } = {}) =>
    http.create('entity-types', { name }, { signal }),

  /**
   * @param {Model} entityType
   * @param {RequestOptions} [options]
   * @returns {Promise<null>}
   */
  removeEntityType: async (entityType, { signal } = {}) =>
    http.remove('entity-types', idOf(entityType), {}, { signal }),

  /**
   * @param {Model} entity
   * @param {{force?: boolean, signal?: AbortSignal}} [options] force also
   *   deletes the data linked to the entity.
   * @returns {Promise<null>}
   */
  removeEntity: async (entity, { force = false, signal } = {}) =>
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
  removeEntities: async (project, entities, { force = false, signal } = {}) =>
    http.request('POST', `actions/projects/${idOf(project)}/delete-entities`, {
      body: idsOf(entities),
      query: { force: force ? true : null },
      signal
    }),

  /**
   * @param {Model} entity
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} Entities linked to the entity, with tasks.
   */
  allEntitiesWithTasksLinkedToEntity: async (entity, { signal } = {}) =>
    http.fetchAll(
      `entities/${idOf(entity)}/entities-linked/with-tasks`,
      {},
      { signal }
    ),

  /**
   * @param {Model} entity
   * @param {RequestOptions} [options]
   * @returns {Promise<{data: Entity[], total: number, nb_pages: number,
   *   limit: number, offset: number, page: number}>} The news page of the
   *   entity: the API answers a page envelope, the news are in `data`.
   */
  allNewsForEntity: async (entity, { signal } = {}) =>
    http.get(`data/entities/${idOf(entity)}/news`, {}, { signal }),

  /**
   * @param {Model} entity
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} Preview files of every task of the entity,
   *   ordered by task type name, then by descending revision.
   */
  allPreviewFilesForEntity: async (entity, { signal } = {}) =>
    http.fetchAll(`entities/${idOf(entity)}/preview-files`, {}, { signal }),

  /**
   * @param {Model} entity
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} Time spents logged on the entity tasks.
   */
  allTimeSpentsForEntity: async (entity, { signal } = {}) =>
    http.fetchAll(`entities/${idOf(entity)}/time-spents`, {}, { signal })
})
