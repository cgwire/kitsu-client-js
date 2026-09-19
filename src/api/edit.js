import { idOf, requiredOf, sortedByName, withoutNil } from '../core/params.js'
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
