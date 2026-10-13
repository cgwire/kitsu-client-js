import {
  idOf,
  idsOf,
  optionalIdOf,
  requiredOf,
  sortedByName,
  withoutNil
} from '../core/params.js'

/**
 * @typedef {import('../core/params.js').Entity} Entity
 * @typedef {import('../core/params.js').Model} Model
 * @typedef {import('../core/params.js').RequestOptions} RequestOptions
 */

// The link lists of a template read with its relations. Zou ignores them on
// an update, but for preview_background_files, which it takes as the whole
// list: a template read earlier would undo the links made since.
const LINK_FIELDS = [
  'task_types',
  'task_statuses',
  'asset_types',
  'status_automations',
  'preview_background_files'
]

const withoutLinks = template =>
  Object.fromEntries(
    Object.entries(template).filter(([key]) => !LINK_FIELDS.includes(key))
  )

export const projectTemplateApi = http => {
  const templatePath = projectTemplate =>
    `data/project-templates/${idOf(projectTemplate)}`

  const allLinks = (projectTemplate, segment, signal) =>
    http.get(`${templatePath(projectTemplate)}/${segment}`, {}, { signal })

  const addLink = (projectTemplate, segment, data, signal) =>
    http.post(`${templatePath(projectTemplate)}/${segment}`, data, { signal })

  const removeLink = (projectTemplate, segment, link, signal) =>
    http.del(
      `${templatePath(projectTemplate)}/${segment}/${idOf(link)}`,
      undefined,
      { signal }
    )

  const reorderLinks = (projectTemplate, segment, key, models, signal) =>
    http.post(
      `actions/project-templates/${idOf(projectTemplate)}/${segment}/reorder`,
      { [key]: idsOf(requiredOf(key, models)) },
      { signal }
    )

  return {
    /**
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} All the project templates, sorted by name.
     */
    allProjectTemplates: async ({ signal } = {}) =>
      http.fetchAll('project-templates', {}, { signal }).then(sortedByName),

    /**
     * @param {Model} projectTemplate
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity|null>} The project template, null when missing.
     */
    getProjectTemplate: async (projectTemplate, { signal } = {}) =>
      http.fetchOne('project-templates', idOf(projectTemplate), { signal }),

    /**
     * @param {string} name
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity|null>} The project template matching the name,
     *   null when missing.
     */
    getProjectTemplateByName: async (name, { signal } = {}) =>
      http.fetchFirst(
        'project-templates',
        { name: requiredOf('name', name) },
        { signal }
      ),

    /**
     * Create a project template without any link. The production settings
     * it is not given take the defaults of Zou (25 fps, 16:9, 1920x1080,
     * short, 2d3d, no retake limit, the assets homepage, every flag off),
     * which applyProjectTemplate writes to a project like the given ones.
     * @param {string} name Must be unique.
     * @param {{
     *   description?: string,
     *   fps?: string,
     *   ratio?: string,
     *   resolution?: string,
     *   productionType?: string,
     *   productionStyle?: string,
     *   signal?: AbortSignal
     * }} [options] Defaults given to the projects created from the template.
     * @returns {Promise<Entity>} The created project template.
     */
    newProjectTemplate: async (
      name,
      {
        description = null,
        fps,
        ratio,
        resolution,
        productionType,
        productionStyle,
        signal
      } = {}
    ) =>
      http.post(
        'data/project-templates',
        {
          name,
          description,
          ...withoutNil({
            fps,
            ratio,
            resolution,
            production_type: productionType,
            production_style: productionStyle
          })
        },
        { signal }
      ),

    /**
     * Save the template. Its link lists are not sent: the add and remove
     * functions of each link change them.
     * @param {Entity} projectTemplate
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The updated project template.
     */
    updateProjectTemplate: async (projectTemplate, { signal } = {}) =>
      http.update(
        'project-templates',
        idOf(projectTemplate),
        withoutLinks(projectTemplate),
        { signal }
      ),

    /**
     * @param {Model} projectTemplate
     * @param {RequestOptions} [options]
     * @returns {Promise<null>}
     */
    removeProjectTemplate: async (projectTemplate, { signal } = {}) =>
      http.del(templatePath(projectTemplate), undefined, { signal }),

    /**
     * Snapshot the configuration of a project into a new template: its
     * production settings, its file tree, its data (the values of its Project
     * metadata), its metadata descriptors, its default preview background
     * and its links to task types, task statuses, asset types, status
     * automations and preview backgrounds. The team, the dates and the
     * production data (assets, shots, tasks) are not copied.
     * @param {Model} project
     * @param {string} name
     * @param {{description?: string, signal?: AbortSignal}} [options]
     * @returns {Promise<Entity>} The created project template.
     */
    newProjectTemplateFromProject: async (
      project,
      name,
      { description = null, signal } = {}
    ) =>
      http.post(
        `data/project-templates/from-project/${idOf(project)}`,
        { name, description },
        { signal }
      ),

    /**
     * Apply the template to an existing project. Every production setting
     * the template has (fps, ratio, resolution, production type and style,
     * max retakes, homepage, client, preview and publish flags, movie
     * bitrates) overwrites the one of the project, and its file tree and
     * data, when it has them, replace the project's. Links and metadata
     * descriptors are only added, the existing ones are kept, and the
     * default background is set only when the project has none.
     * @param {Model} project
     * @param {Model} projectTemplate
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The updated project.
     */
    applyProjectTemplate: async (project, projectTemplate, { signal } = {}) =>
      http.post(
        `data/projects/${idOf(project)}/apply-template/${idOf(projectTemplate)}`,
        {},
        { signal }
      ),

    /**
     * @param {Model} projectTemplate
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} The task types attached to the template.
     */
    allTaskTypesForProjectTemplate: async (projectTemplate, { signal } = {}) =>
      allLinks(projectTemplate, 'task-types', signal),

    /**
     * @param {Model} projectTemplate
     * @param {Model} taskType
     * @param {{
     *   priority?: number,
     *   hdBitrateCompression?: number|null,
     *   ldBitrateCompression?: number|null,
     *   signal?: AbortSignal
     * }} [options] Bitrates are movie bitrates in Mbit/s for that task type.
     *   Zou writes both as soon as one is given: a missing one goes back to
     *   null, which inherits the bitrate of the project. null resets one.
     * @returns {Promise<Entity>} The created link.
     */
    addTaskTypeToProjectTemplate: async (
      projectTemplate,
      taskType,
      { priority, hdBitrateCompression, ldBitrateCompression, signal } = {}
    ) =>
      addLink(
        projectTemplate,
        'task-types',
        {
          ...withoutNil({ task_type_id: idOf(taskType), priority }),
          // JSON leaves an undefined bitrate out, and sends a null one.
          hd_bitrate_compression: hdBitrateCompression,
          ld_bitrate_compression: ldBitrateCompression
        },
        signal
      ),

    /**
     * @param {Model} projectTemplate
     * @param {Model} taskType
     * @param {RequestOptions} [options]
     * @returns {Promise<null>}
     */
    removeTaskTypeFromProjectTemplate: async (
      projectTemplate,
      taskType,
      { signal } = {}
    ) => removeLink(projectTemplate, 'task-types', taskType, signal),

    /**
     * @param {Model} projectTemplate
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} The task statuses attached to the template.
     */
    allTaskStatusesForProjectTemplate: async (
      projectTemplate,
      { signal } = {}
    ) => allLinks(projectTemplate, 'task-statuses', signal),

    /**
     * @param {Model} projectTemplate
     * @param {Model} taskStatus
     * @param {{
     *   priority?: number,
     *   rolesForBoard?: string[],
     *   signal?: AbortSignal
     * }} [options] rolesForBoard lists the roles allowed to see the status on
     *   the board.
     * @returns {Promise<Entity>} The created link.
     */
    addTaskStatusToProjectTemplate: async (
      projectTemplate,
      taskStatus,
      { priority, rolesForBoard, signal } = {}
    ) =>
      addLink(
        projectTemplate,
        'task-statuses',
        withoutNil({
          task_status_id: idOf(taskStatus),
          priority,
          roles_for_board: rolesForBoard
        }),
        signal
      ),

    /**
     * @param {Model} projectTemplate
     * @param {Model} taskStatus
     * @param {RequestOptions} [options]
     * @returns {Promise<null>}
     */
    removeTaskStatusFromProjectTemplate: async (
      projectTemplate,
      taskStatus,
      { signal } = {}
    ) => removeLink(projectTemplate, 'task-statuses', taskStatus, signal),

    /**
     * @param {Model} projectTemplate
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} The asset types attached to the template.
     */
    allAssetTypesForProjectTemplate: async (projectTemplate, { signal } = {}) =>
      allLinks(projectTemplate, 'asset-types', signal),

    /**
     * @param {Model} projectTemplate
     * @param {Model} assetType
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The created link.
     */
    addAssetTypeToProjectTemplate: async (
      projectTemplate,
      assetType,
      { signal } = {}
    ) =>
      addLink(
        projectTemplate,
        'asset-types',
        { asset_type_id: idOf(assetType) },
        signal
      ),

    /**
     * @param {Model} projectTemplate
     * @param {Model} assetType
     * @param {RequestOptions} [options]
     * @returns {Promise<null>}
     */
    removeAssetTypeFromProjectTemplate: async (
      projectTemplate,
      assetType,
      { signal } = {}
    ) => removeLink(projectTemplate, 'asset-types', assetType, signal),

    /**
     * @param {Model} projectTemplate
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} The status automations attached to the
     *   template.
     */
    allStatusAutomationsForProjectTemplate: async (
      projectTemplate,
      { signal } = {}
    ) => allLinks(projectTemplate, 'status-automations', signal),

    /**
     * @param {Model} projectTemplate
     * @param {Model} statusAutomation
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The created link.
     */
    addStatusAutomationToProjectTemplate: async (
      projectTemplate,
      statusAutomation,
      { signal } = {}
    ) =>
      addLink(
        projectTemplate,
        'status-automations',
        { status_automation_id: idOf(statusAutomation) },
        signal
      ),

    /**
     * @param {Model} projectTemplate
     * @param {Model} statusAutomation
     * @param {RequestOptions} [options]
     * @returns {Promise<null>}
     */
    removeStatusAutomationFromProjectTemplate: async (
      projectTemplate,
      statusAutomation,
      { signal } = {}
    ) =>
      removeLink(
        projectTemplate,
        'status-automations',
        statusAutomation,
        signal
      ),

    /**
     * @param {Model} projectTemplate
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} The preview background files attached to
     *   the template.
     */
    allPreviewBackgroundFilesForProjectTemplate: async (
      projectTemplate,
      { signal } = {}
    ) => allLinks(projectTemplate, 'preview-background-files', signal),

    /**
     * @param {Model} projectTemplate
     * @param {Model} previewBackgroundFile
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The created link.
     */
    addPreviewBackgroundFileToProjectTemplate: async (
      projectTemplate,
      previewBackgroundFile,
      { signal } = {}
    ) =>
      addLink(
        projectTemplate,
        'preview-background-files',
        { preview_background_file_id: idOf(previewBackgroundFile) },
        signal
      ),

    /**
     * @param {Model} projectTemplate
     * @param {Model} previewBackgroundFile
     * @param {RequestOptions} [options]
     * @returns {Promise<null>}
     */
    removePreviewBackgroundFileFromProjectTemplate: async (
      projectTemplate,
      previewBackgroundFile,
      { signal } = {}
    ) =>
      removeLink(
        projectTemplate,
        'preview-background-files',
        previewBackgroundFile,
        signal
      ),

    /**
     * @param {Model} projectTemplate
     * @param {Model|null} previewBackgroundFile null clears the default.
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The updated project template.
     */
    setProjectTemplateDefaultPreviewBackgroundFile: async (
      projectTemplate,
      previewBackgroundFile,
      { signal } = {}
    ) =>
      http.put(
        `${templatePath(projectTemplate)}/default-preview-background-file`,
        {
          default_preview_background_file_id: optionalIdOf(
            previewBackgroundFile
          )
        },
        { signal }
      ),

    /**
     * Replace the metadata descriptor snapshot of the template: the previous
     * one is not merged. Each descriptor has the shape materialized when the
     * template is applied: name, entity_type, data_type, choices, for_client,
     * departments, position.
     * @param {Model} projectTemplate
     * @param {object[]} descriptors
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The updated project template.
     */
    setProjectTemplateMetadataDescriptors: async (
      projectTemplate,
      descriptors,
      { signal } = {}
    ) =>
      http.put(
        `${templatePath(projectTemplate)}/metadata-descriptors`,
        { metadata_descriptors: descriptors },
        { signal }
      ),

    /**
     * Set the priority of every task type link of the template from the order
     * of the list, in one request.
     * @param {Model} projectTemplate
     * @param {Model[]} taskTypes Task types or ids, in their new order.
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} The updated task type links.
     */
    reorderTaskTypesForProjectTemplate: async (
      projectTemplate,
      taskTypes,
      { signal } = {}
    ) =>
      reorderLinks(
        projectTemplate,
        'task-types',
        'task_type_ids',
        taskTypes,
        signal
      ),

    /**
     * Set the priority of every task status link of the template from the
     * order of the list, in one request.
     * @param {Model} projectTemplate
     * @param {Model[]} taskStatuses Task statuses or ids, in their new order.
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} The updated task status links.
     */
    reorderTaskStatusesForProjectTemplate: async (
      projectTemplate,
      taskStatuses,
      { signal } = {}
    ) =>
      reorderLinks(
        projectTemplate,
        'task-statuses',
        'task_status_ids',
        taskStatuses,
        signal
      )
  }
}
