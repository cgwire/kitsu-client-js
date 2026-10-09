import {
  idOf,
  idsOf,
  requiredOf,
  sortedByName,
  withoutNil
} from '../core/params.js'

/**
 * @typedef {import('../core/params.js').Entity} Entity
 * @typedef {import('../core/params.js').Model} Model
 * @typedef {import('../core/params.js').RequestOptions} RequestOptions
 */

export const conceptApi = http => {
  const conceptByName = (project, name, signal) =>
    http.fetchFirst(
      'concepts',
      { project_id: idOf(project), name: requiredOf('name', name) },
      { signal }
    )

  return {
    /**
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} Every concept, sorted by name.
     */
    allConcepts: async ({ signal } = {}) =>
      http.fetchAll('concepts', {}, { signal }).then(sortedByName),

    /**
     * @param {Model} project
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} The concepts of the project, sorted by name.
     */
    allConceptsForProject: async (project, { signal } = {}) =>
      http
        .fetchAll(`projects/${idOf(project)}/concepts`, {}, { signal })
        .then(sortedByName),

    /**
     * @param {Model} project
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} The concepts of the project, each with its
     *   tasks.
     */
    allConceptsWithTasks: async (project, { signal } = {}) =>
      http.get(
        'data/concepts/with-tasks',
        { project_id: idOf(project) },
        { signal }
      ),

    /**
     * @param {Model} concept
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} The preview files of the concept.
     */
    allPreviewsForConcept: async (concept, { signal } = {}) =>
      http.fetchAll(`concepts/${idOf(concept)}/preview-files`, {}, { signal }),

    /**
     * Remove the concept. When tasks are linked to it, it is only marked as
     * canceled unless the deletion is forced.
     * @param {Model} concept
     * @param {{force?: boolean, signal?: AbortSignal}} [options] force deletes
     *   the concept even when tasks are linked to it.
     * @returns {Promise<null>}
     */
    removeConcept: async (concept, { force = false, signal } = {}) =>
      http.remove(
        'concepts',
        idOf(concept),
        { force: force ? true : null },
        { signal }
      ),

    /**
     * @param {Model} concept
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity|null>} The concept, null when it does not exist.
     */
    getConcept: async (concept, { signal } = {}) =>
      http.fetchOne('concepts', idOf(concept), { signal }),

    /**
     * @param {Model} project
     * @param {string} conceptName
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity|null>} The concept of the project with that name.
     */
    getConceptByName: async (project, conceptName, { signal } = {}) =>
      conceptByName(project, conceptName, signal),

    /**
     * Create a concept in the project, unless one already has that name.
     * @param {Model} project
     * @param {string} name
     * @param {{
     *   description?: string,
     *   data?: Record<string, any>,
     *   entityConceptLinks?: Model[],
     *   signal?: AbortSignal
     * }} [options] entityConceptLinks lists the entities to tag.
     * @returns {Promise<Entity>} The created concept, or the existing one.
     */
    newConcept: async (
      project,
      name,
      { description, data, entityConceptLinks, signal } = {}
    ) => {
      const body = {
        name,
        data: { ...data },
        entity_concept_links: idsOf(entityConceptLinks || []),
        ...withoutNil({ description })
      }
      const path = `data/projects/${idOf(project)}/concepts`
      const existing = await conceptByName(project, name, signal)
      return existing || http.post(path, body, { signal })
    },

    /**
     * Save the concept. Its metadata are fully replaced by the given ones.
     * @param {{id: string}} concept
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The updated concept.
     */
    updateConcept: async (concept, { signal } = {}) =>
      http.update('entities', idOf(concept), concept, { signal })
  }
}
