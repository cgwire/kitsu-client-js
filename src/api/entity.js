import {
  idOf,
  idsOf,
  optionalIdOf,
  orNull,
  requiredOf,
  sortedByName
} from '../core/params.js'

/**
 * @typedef {import('../core/params.js').Entity} Entity
 * @typedef {import('../core/params.js').Model} Model
 * @typedef {import('../core/params.js').RequestOptions} RequestOptions
 */

// Zou matches a name filter with ILIKE: any case, _ and % as wildcards. Like
// gazu the case is ignored, but the name must match, and the exact spelling
// wins over another case.
const findByName = (entries, name) => {
  const wanted = String(name)
  const matches = (Array.isArray(entries) ? entries : []).filter(
    entry =>
      typeof entry.name === 'string' &&
      entry.name.toLowerCase() === wanted.toLowerCase()
  )
  return matches.find(entry => entry.name === wanted) || matches[0] || null
}

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
   * @returns {Promise<Entity|null>} An entity with that name
   *   (case-insensitive), null when there is none.
   */
  getEntityByName: async (name, { project, signal } = {}) =>
    orNull(
      http.fetchAll(
        'entities',
        { name: requiredOf('name', name), project_id: optionalIdOf(project) },
        { signal }
      )
    ).then(entities => findByName(entities, name)),

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
   * @returns {Promise<Entity|null>} The entity type with that name
   *   (case-insensitive), null when there is none.
   */
  getEntityTypeByName: async (name, { signal } = {}) =>
    orNull(
      http.fetchAll(
        'entity-types',
        { name: requiredOf('name', name) },
        { signal }
      )
    ).then(entityTypes => findByName(entityTypes, name)),

  /**
   * Find the entities a file path points to, from the project file tree.
   * @param {Model} project
   * @param {string} path
   * @param {{sep?: string, signal?: AbortSignal}} [options]
   * @returns {Promise<Record<string, string>[]>} The templates of the file
   *   tree matching the path: each match names its Template and gives the
   *   value of every token of the path, an id for an entity token (Project,
   *   Asset, Sequence, Shot...). A match has no id of its own.
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
   * Delete the entity through the generic route. Zou refuses it (400) while
   * tasks or other records still point to the entity, but deletes its
   * casting and concept links before refusing. To delete an entity with its
   * tasks, use removeEntities or the remove function of its type, such as
   * removeShot or removeAsset, with force.
   *
   * gazu's force is not ported: Zou never reads it on this route.
   * @param {Model} entity
   * @param {RequestOptions} [options]
   * @returns {Promise<null>}
   */
  removeEntity: async (entity, { signal } = {}) =>
    http.remove('entities', idOf(entity), {}, { signal }),

  /**
   * Delete assets, shots, edits and concepts of the project: Zou skips the
   * entities of other types. Without force, an asset, a shot or an edit that
   * has tasks is only marked as canceled. One that is already canceled, and
   * every concept, is deleted with its tasks (removeConcept without force
   * only cancels a concept that has tasks).
   * @param {Model} project
   * @param {Model[]} entities
   * @param {{force?: boolean, signal?: AbortSignal}} [options] force also
   *   deletes the tasks of the entities.
   * @returns {Promise<string[]>} Ids of the entities deleted or canceled.
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
