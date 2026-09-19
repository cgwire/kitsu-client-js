import {
  idOf,
  optionalIdOf,
  requiredOf,
  sortedByName,
  withoutNil
} from '../core/params.js'
import { getEditUrl, webHostOf } from '../utils/urls.js'

/**
 * @typedef {import('../core/params.js').Entity} Entity
 * @typedef {import('../core/params.js').Model} Model
 * @typedef {import('../core/params.js').RequestOptions} RequestOptions
 */

export const editApi = http => {
  const editByName = (project, name, signal) =>
    http.fetchFirst(
      'edits/all',
      { project_id: idOf(project), name: requiredOf('name', name) },
      { signal }
    )

  // A plain get, not fetchOne: a missing edit must raise instead of giving
  // a broken URL or being merged as empty metadata.
  const readEdit = (edit, signal) =>
    http.get(`data/edits/${idOf(edit)}`, {}, { signal })

  // Edits are saved through the entity route.
  const saveEdit = (edit, signal) =>
    http.put(`data/entities/${idOf(edit)}`, edit, { signal })

  // Kitsu pseudo-episodes are not ids: 'main' keeps the edits out of any
  // episode, 'all' does not filter, so it is dropped as Kitsu does.
  const episodeFilterOf = episode => {
    const id = episode && typeof episode === 'object' ? episode.id : episode
    if (id === 'main') return id
    return id === 'all' ? null : optionalIdOf(episode)
  }

  return {
    /**
     * @param {Model} edit
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity|null>} The edit, null when it does not exist.
     */
    getEdit: async (edit, { signal } = {}) =>
      http.fetchOne('edits', idOf(edit), { signal }),

    /**
     * @param {Model} project
     * @param {string} editName
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity|null>} The edit of the project with that name.
     */
    getEditByName: async (project, editName, { signal } = {}) =>
      editByName(project, editName, signal),

    /**
     * @param {Model} edit
     * @param {RequestOptions} [options]
     * @returns {Promise<string>} URL of the edit page in the Kitsu web app.
     */
    getEditUrl: async (edit, { signal } = {}) =>
      getEditUrl(webHostOf(http.host), await readEdit(edit, signal)),

    /**
     * @param {Model} project
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} The edits of the project, sorted by name.
     */
    allEditsForProject: async (project, { signal } = {}) =>
      http
        .fetchAll(`projects/${idOf(project)}/edits`, {}, { signal })
        .then(sortedByName),

    /**
     * @param {Model} project
     * @param {{episode?: Model, signal?: AbortSignal}} [options] episode keeps
     *   the edits of that episode: an episode or its id. The pseudo-episodes
     *   of Kitsu are accepted too, as a string or as an id: 'main' keeps the
     *   edits out of any episode, 'all' does not filter.
     * @returns {Promise<Entity[]>} The edits of the project, each with its
     *   tasks.
     */
    allEditsWithTasks: async (project, { episode, signal } = {}) =>
      http.get(
        'data/edits/with-tasks',
        { project_id: idOf(project), episode_id: episodeFilterOf(episode) },
        { signal }
      ),

    /**
     * @param {Model} edit
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} The data history of the edit: one entry
     *   per saved version of its metadata.
     */
    allVersionsForEdit: async (edit, { signal } = {}) =>
      http.get(`data/edits/${idOf(edit)}/versions`, {}, { signal }),

    /**
     * @param {Model} edit
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} The preview files of the edit.
     */
    allPreviewsForEdit: async (edit, { signal } = {}) =>
      http.fetchAll(`edits/${idOf(edit)}/preview-files`, {}, { signal }),

    /**
     * Create an edit, unless one already has that name in the project: the
     * existing edit is then returned.
     * @param {Model} project
     * @param {string} name
     * @param {{
     *   description?: string,
     *   data?: object,
     *   episode?: Model,
     *   signal?: AbortSignal
     * }} [options] data is a free field for metadata of any kind.
     * @returns {Promise<Entity>} The created or existing edit.
     */
    newEdit: async (
      project,
      name,
      { description, data = {}, episode, signal } = {}
    ) => {
      const body = {
        name,
        data,
        ...withoutNil({
          parent_id: episode == null ? null : idOf(episode),
          description
        })
      }
      const path = `data/projects/${idOf(project)}/edits`
      const existing = await editByName(project, name, signal)
      return existing || http.post(path, body, { signal })
    },

    /**
     * Import the edits of a CSV file into the project.
     * @param {Model} project
     * @param {Blob} csvFile The CSV data, as a Blob or a File.
     * @param {{
     *   update?: boolean,
     *   fileName?: string,
     *   onProgress?: (progress: {loaded: number, total: number}) => void,
     *   signal?: AbortSignal
     * }} [options] update also updates the edits that already exist.
     *   fileName names the uploaded file when it is a plain Blob. onProgress
     *   needs XMLHttpRequest (browsers, webviews).
     * @returns {Promise<Entity[]>} The edits created or updated by the import.
     */
    importEditsWithCsv: async (
      project,
      csvFile,
      { update = false, fileName, onProgress, signal } = {}
    ) =>
      http.upload(`import/csv/projects/${idOf(project)}/edits`, {
        file: requiredOf('csvFile', csvFile),
        query: { update: update ? true : null },
        fileName,
        onProgress,
        signal
      }),

    /**
     * An edit with tasks is only marked as canceled, unless forced.
     * @param {Model} edit
     * @param {{force?: boolean, signal?: AbortSignal}} [options] force deletes
     *   the edit even when tasks are linked to it.
     * @returns {Promise<null>}
     */
    removeEdit: async (edit, { force = false, signal } = {}) =>
      http.remove(
        'edits',
        idOf(edit),
        { force: force ? true : null },
        { signal }
      ),

    /**
     * Save the edit. Its metadata are fully replaced by the given ones.
     * @param {{id: string}} edit
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The updated edit.
     */
    updateEdit: async (edit, { signal } = {}) => saveEdit(edit, signal),

    /**
     * Update the edit metadata. Keys that are not given are left unchanged.
     * @param {Model} edit
     * @param {object} [data]
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The updated edit.
     */
    updateEditData: async (edit, data = {}, { signal } = {}) => {
      const current = await readEdit(edit, signal)
      return saveEdit(
        { id: current.id, data: { ...(current.data || {}), ...data } },
        signal
      )
    }
  }
}
