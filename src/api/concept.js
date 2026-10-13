import {
  idOf,
  idsOf,
  orNull,
  requiredOf,
  sortedByName,
  withoutNil
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

export const conceptApi = http => {
  const conceptByName = async (project, name, signal) => {
    const concepts = await orNull(
      http.fetchAll(
        'concepts',
        { project_id: idOf(project), name: requiredOf('name', name) },
        { signal }
      )
    )
    return findByName(concepts, name)
  }

  return {
    /**
     * Zou lists every concept to an admin only: anyone else gets a
     * NotAllowedError and reads the concepts of a project with
     * allConceptsForProject.
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
     * @returns {Promise<Record<string, Entity[]>>} The preview files of the
     *   concept: task type ids as keys, revisions as values.
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
     * @returns {Promise<Entity|null>} The concept of the project with that
     *   name (case-insensitive), null when there is none.
     */
    getConceptByName: async (project, conceptName, { signal } = {}) =>
      conceptByName(project, conceptName, signal),

    /**
     * Create a concept in the project, unless one already has that name
     * (case-insensitive).
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
        // Zou validates the links as dicts and reads the id of each: a list
        // of id strings is refused (400) and the concept is not created.
        entity_concept_links: idsOf(entityConceptLinks || []).map(id => ({
          id
        })),
        ...withoutNil({ description })
      }
      const path = `data/projects/${idOf(project)}/concepts`
      const existing = await conceptByName(project, name, signal)
      return existing || http.post(path, body, { signal })
    },

    /**
     * Save the concept. Zou merges the given metadata into the stored ones:
     * a key left out keeps its value, a key set to null is stored as null.
     * @param {Entity} concept
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The updated concept.
     */
    updateConcept: async (concept, { signal } = {}) =>
      http.update('entities', idOf(concept), concept, { signal })
  }
}
