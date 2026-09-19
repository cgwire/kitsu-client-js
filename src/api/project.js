import { KitsuError } from '../core/errors.js'
import {
  dateOf,
  idOf,
  idsOf,
  optionalIdOf,
  requiredOf,
  sortedByName,
  withoutNil
} from '../core/params.js'
import * as urls from '../utils/urls.js'

/**
 * @typedef {import('../core/params.js').Entity} Entity
 * @typedef {import('../core/params.js').Model} Model
 * @typedef {import('../core/params.js').RequestOptions} RequestOptions
 */

const LINK_FIELDS = ['team', 'asset_types', 'task_statuses', 'task_types']

// Zou expects model links as lists of ids, while a project read with its
// relations can carry them as dicts.
const withLinkIds = project =>
  LINK_FIELDS.filter(field => Array.isArray(project[field])).reduce(
    (result, field) => ({ ...result, [field]: idsOf(project[field]) }),
    project
  )

const settingsOf = (project, section) =>
  `projects/${idOf(project)}/settings/${section}`

const descriptorsOf = project =>
  `projects/${idOf(project)}/metadata-descriptors`

const budgetsOf = project => `projects/${idOf(project)}/budgets`

const entriesOf = (project, budget) =>
  `${budgetsOf(project)}/${idOf(budget)}/entries`

const saveProject = (http, project, options) =>
  http.update('projects', idOf(project), withLinkIds(project), options)

export const projectApi = http => ({
  /**
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} All project statuses, sorted by name.
   */
  allProjectStatus: async ({ signal } = {}) =>
    http.fetchAll('project-status', {}, { signal }).then(sortedByName),

  /**
   * @param {string} projectStatusName
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity|null>} First project status matching the name.
   */
  getProjectStatusByName: async (projectStatusName, { signal } = {}) =>
    http.fetchFirst(
      'project-status',
      { name: requiredOf('name', projectStatusName) },
      { signal }
    ),

  /**
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} All projects, sorted by name.
   */
  allProjects: async ({ signal } = {}) =>
    http.fetchAll('projects', {}, { signal }).then(sortedByName),

  /**
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} The open projects, sorted by name.
   */
  allOpenProjects: async ({ signal } = {}) =>
    http.fetchAll('projects/open', {}, { signal }).then(sortedByName),

  /**
   * @param {Model} project
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity|null>} The project, null when it does not exist.
   */
  getProject: async (project, { signal } = {}) =>
    http.fetchOne('projects', idOf(project), { signal }),

  /**
   * @param {string} projectName
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity|null>} First project matching the name.
   */
  getProjectByName: async (projectName, { signal } = {}) =>
    http.fetchFirst(
      'projects',
      { name: requiredOf('name', projectName) },
      { signal }
    ),

  /**
   * Create a project, unless a project with the same name already exists.
   * @param {string} name
   * @param {{
   *   productionType?: string,
   *   team?: Model[],
   *   assetTypes?: Model[],
   *   taskStatuses?: Model[],
   *   taskTypes?: Model[],
   *   productionStyle?: string,
   *   projectTemplate?: Model,
   *   signal?: AbortSignal
   * }} [options] productionType is short, featurefilm or tvshow.
   *   projectTemplate is applied after the creation.
   * @returns {Promise<Entity>} The created project, or the existing one.
   */
  newProject: async (
    name,
    {
      productionType = 'short',
      team = [],
      assetTypes = [],
      taskStatuses = [],
      taskTypes = [],
      productionStyle = '2d3d',
      projectTemplate,
      signal
    } = {}
  ) => {
    const existing = await http.fetchFirst(
      'projects',
      { name: requiredOf('name', name) },
      { signal }
    )
    if (existing) return existing
    const templateId = optionalIdOf(projectTemplate)
    return http.create(
      'projects',
      {
        name,
        production_type: productionType,
        team: idsOf(team),
        asset_types: idsOf(assetTypes),
        task_statuses: idsOf(taskStatuses),
        task_types: idsOf(taskTypes),
        production_style: productionStyle,
        ...(templateId ? { project_template_id: templateId } : {})
      },
      { signal }
    )
  },

  /**
   * Make sure no asset or shot is left in the project, or force the removal.
   * @param {Model} project
   * @param {{force?: boolean, signal?: AbortSignal}} [options] force also
   *   deletes the data linked to the project.
   * @returns {Promise<null>}
   */
  removeProject: async (project, { force = false, signal } = {}) =>
    http.remove(
      'projects',
      idOf(project),
      { force: force ? true : null },
      { signal }
    ),

  /**
   * Save the project. Its metadata are fully replaced by the given ones.
   * @param {Entity} project
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The updated project.
   */
  updateProject: async (project, { signal } = {}) =>
    saveProject(http, project, { signal }),

  /**
   * Merge data into the metadata of the project. Keys that are not given
   * are left unchanged.
   * @param {Model} project
   * @param {object} [data]
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The updated project.
   */
  updateProjectData: async (project, data = {}, { signal } = {}) => {
    const current = await http.get(
      `data/projects/${idOf(project)}`,
      {},
      { signal }
    )
    return saveProject(
      http,
      { ...current, data: { ...current.data, ...data } },
      { signal }
    )
  },

  /**
   * @param {Model} project
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The updated project.
   */
  closeProject: async (project, { signal } = {}) => {
    const statuses = await http.fetchAll('project-status', {}, { signal })
    const closed = statuses.find(
      status => (status.name || '').toLowerCase() === 'closed'
    )
    if (!closed) throw new KitsuError('No closed project status found')
    const base = typeof project === 'string' ? { id: project } : project
    return saveProject(
      http,
      { ...base, project_status_id: closed.id },
      { signal }
    )
  },

  /**
   * @param {Model} project
   * @param {Model} assetType
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The project.
   */
  addAssetType: async (project, assetType, { signal } = {}) =>
    http.create(
      settingsOf(project, 'asset-types'),
      { asset_type_id: idOf(assetType) },
      { signal }
    ),

  /**
   * Link a task type to the project. Calling it again on an existing link
   * updates its priority and bitrates.
   * @param {Model} project
   * @param {Model} taskType
   * @param {number} priority
   * @param {{
   *   hdBitrateCompression?: number,
   *   ldBitrateCompression?: number,
   *   signal?: AbortSignal
   * }} [options] Bitrates in Mbit/s of the movies encoded for that task
   *   type in the project.
   * @returns {Promise<Entity>} The project.
   */
  addTaskType: async (
    project,
    taskType,
    priority,
    { hdBitrateCompression, ldBitrateCompression, signal } = {}
  ) =>
    http.create(
      settingsOf(project, 'task-types'),
      withoutNil({
        task_type_id: idOf(taskType),
        priority,
        hd_bitrate_compression: hdBitrateCompression,
        ld_bitrate_compression: ldBitrateCompression
      }),
      { signal }
    ),

  /**
   * @param {Model} project
   * @param {Model} taskStatus
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The project.
   */
  addTaskStatus: async (project, taskStatus, { signal } = {}) =>
    http.create(
      settingsOf(project, 'task-status'),
      { task_status_id: idOf(taskStatus) },
      { signal }
    ),

  /**
   * @param {Model} project
   * @param {Model} taskType
   * @param {RequestOptions} [options]
   * @returns {Promise<null>}
   */
  removeTaskType: async (project, taskType, { signal } = {}) =>
    http.remove(
      settingsOf(project, 'task-types'),
      idOf(taskType),
      {},
      { signal }
    ),

  /**
   * @param {Model} project
   * @param {Model} taskStatus
   * @param {RequestOptions} [options]
   * @returns {Promise<null>}
   */
  removeTaskStatus: async (project, taskStatus, { signal } = {}) =>
    http.remove(
      settingsOf(project, 'task-status'),
      idOf(taskStatus),
      {},
      { signal }
    ),

  /**
   * @param {Model} project
   * @param {string} name
   * @param {string} entityType Asset, Shot, Edit, Episode, Sequence, Project
   *   or Task.
   * @param {{
   *   dataType?: string,
   *   choices?: string[],
   *   forClient?: boolean,
   *   departments?: Model[],
   *   taskTypeId?: Model,
   *   signal?: AbortSignal
   * }} [options] choices stays empty for free values. taskTypeId scopes the
   *   descriptor to a task type: required when entityType is Task, forbidden
   *   otherwise.
   * @returns {Promise<Entity>} The created metadata descriptor.
   */
  addMetadataDescriptor: async (
    project,
    name,
    entityType,
    {
      dataType = 'string',
      choices = [],
      forClient = false,
      departments = [],
      taskTypeId,
      signal
    } = {}
  ) =>
    http.create(
      descriptorsOf(project),
      withoutNil({
        name,
        data_type: dataType,
        choices,
        for_client: forClient,
        entity_type: entityType,
        departments: idsOf(departments),
        task_type_id: optionalIdOf(taskTypeId)
      }),
      { signal }
    ),

  /**
   * @param {Model} project
   * @param {Model} metadataDescriptor
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity|null>} The metadata descriptor, null when it
   *   does not exist.
   */
  getMetadataDescriptor: async (project, metadataDescriptor, { signal } = {}) =>
    http.fetchOne(descriptorsOf(project), idOf(metadataDescriptor), {
      signal
    }),

  /**
   * @param {Model} project
   * @param {string} fieldName
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity|null>} First metadata descriptor of the project
   *   matching the field name.
   */
  getMetadataDescriptorByFieldName: async (
    project,
    fieldName,
    { signal } = {}
  ) =>
    http.fetchFirst(
      'metadata-descriptors',
      {
        project_id: idOf(project),
        field_name: requiredOf('fieldName', fieldName)
      },
      { signal }
    ),

  /**
   * @param {Model} project
   * @param {{entityType?: string, signal?: AbortSignal}} [options]
   *   entityType keeps the descriptors of one model (Asset, Shot, ...). The
   *   casing matters.
   * @returns {Promise<Entity[]>} The metadata descriptors of the project.
   */
  allMetadataDescriptors: async (project, { entityType, signal } = {}) =>
    http
      .fetchAll(descriptorsOf(project), {}, { signal })
      .then(descriptors =>
        entityType === null || entityType === undefined
          ? descriptors
          : descriptors.filter(
              descriptor => descriptor.entity_type === entityType
            )
      ),

  /**
   * @param {Model} project
   * @param {{id: string, [field: string]: any}} metadataDescriptor
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The updated metadata descriptor.
   */
  updateMetadataDescriptor: async (
    project,
    metadataDescriptor,
    { signal } = {}
  ) =>
    http.update(
      descriptorsOf(project),
      idOf(metadataDescriptor),
      Array.isArray(metadataDescriptor.departments)
        ? {
            ...metadataDescriptor,
            departments: idsOf(metadataDescriptor.departments)
          }
        : metadataDescriptor,
      { signal }
    ),

  /**
   * @param {Model} project
   * @param {Model} metadataDescriptor
   * @param {{force?: boolean, signal?: AbortSignal}} [options]
   * @returns {Promise<null>}
   */
  removeMetadataDescriptor: async (
    project,
    metadataDescriptor,
    { force = false, signal } = {}
  ) =>
    http.remove(
      descriptorsOf(project),
      idOf(metadataDescriptor),
      { force: force ? true : null },
      { signal }
    ),

  /**
   * Set the position of the descriptors of an entity type from the order of
   * the given list.
   * @param {Model} project
   * @param {string} entityType Asset, Shot, Edit, Episode, Sequence or
   *   Project.
   * @param {Model[]} descriptors
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} The reordered metadata descriptors.
   */
  reorderMetadataDescriptors: async (
    project,
    entityType,
    descriptors,
    { signal } = {}
  ) =>
    http.create(
      `${descriptorsOf(project)}/reorder`,
      { entity_type: entityType, descriptor_ids: idsOf(descriptors) },
      { signal }
    ),

  /**
   * @param {Model} project
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} The persons of the project team.
   */
  getTeam: async (project, { signal } = {}) =>
    http.fetchAll(`projects/${idOf(project)}/team`, {}, { signal }),

  /**
   * @param {Model} project
   * @param {Model} person
   * @param {{role?: string, signal?: AbortSignal}} [options] role applies
   *   to this project only: user, supervisor, manager, client or vendor.
   *   Without it the person keeps their global role.
   * @returns {Promise<Entity>} The project.
   */
  addPersonToTeam: async (project, person, { role, signal } = {}) =>
    http.create(
      `projects/${idOf(project)}/team`,
      withoutNil({ person_id: idOf(person), role }),
      { signal }
    ),

  /**
   * Set the role a person has on this project only.
   * @param {Model} project
   * @param {Model} person
   * @param {string|null} role user, supervisor, manager, client or vendor.
   *   null restores the global role of the person.
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The team link: project_id, person_id, role.
   */
  updateTeamMemberRole: async (project, person, role, { signal } = {}) =>
    http.update(
      `projects/${idOf(project)}/team`,
      idOf(person),
      { role },
      { signal }
    ),

  /**
   * @param {Model} project
   * @param {Model} person
   * @param {RequestOptions} [options]
   * @returns {Promise<null>}
   */
  removePersonFromTeam: async (project, person, { signal } = {}) =>
    http.remove(`projects/${idOf(project)}/team`, idOf(person), {}, { signal }),

  /**
   * @param {Model} project
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} The task types configured for the project.
   */
  getProjectTaskTypes: async (project, { signal } = {}) =>
    http.fetchAll(settingsOf(project, 'task-types'), {}, { signal }),

  /**
   * @param {Model} project
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} The task statuses configured for the
   *   project.
   */
  getProjectTaskStatuses: async (project, { signal } = {}) =>
    http.fetchAll(settingsOf(project, 'task-status'), {}, { signal }),

  /**
   * @param {Model} project
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} The status automations configured for the
   *   project.
   */
  allStatusAutomations: async (project, { signal } = {}) =>
    http.fetchAll(settingsOf(project, 'status-automations'), {}, { signal }),

  /**
   * @param {Model} project
   * @param {{status_automation_id: string}} automation The payload Zou
   *   expects, sent as given.
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The project.
   */
  addStatusAutomation: async (project, automation, { signal } = {}) =>
    http.create(settingsOf(project, 'status-automations'), automation, {
      signal
    }),

  /**
   * @param {Model} project
   * @param {Model} automation
   * @param {RequestOptions} [options]
   * @returns {Promise<null>}
   */
  removeStatusAutomation: async (project, automation, { signal } = {}) =>
    http.remove(
      settingsOf(project, 'status-automations'),
      idOf(automation),
      {},
      { signal }
    ),

  /**
   * @param {Model} project
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} The preview background files configured
   *   for the project.
   */
  getPreviewBackgroundFiles: async (project, { signal } = {}) =>
    http.fetchAll(
      settingsOf(project, 'preview-background-files'),
      {},
      { signal }
    ),

  /**
   * Links an existing preview background file to the project. This is a JSON
   * call, not an upload: the file itself is sent when the background is
   * created.
   * @param {Model} project
   * @param {{preview_background_file_id: string}} backgroundFile The payload
   *   Zou expects, sent as given.
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The project.
   */
  addPreviewBackgroundFile: async (project, backgroundFile, { signal } = {}) =>
    http.create(
      settingsOf(project, 'preview-background-files'),
      backgroundFile,
      { signal }
    ),

  /**
   * @param {Model} project
   * @param {Model} backgroundFile
   * @param {RequestOptions} [options]
   * @returns {Promise<null>}
   */
  removePreviewBackgroundFile: async (
    project,
    backgroundFile,
    { signal } = {}
  ) =>
    http.remove(
      settingsOf(project, 'preview-background-files'),
      idOf(backgroundFile),
      {},
      { signal }
    ),

  /**
   * @param {Model} project
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} The milestones of the project.
   */
  getMilestones: async (project, { signal } = {}) =>
    http.fetchAll(`projects/${idOf(project)}/milestones`, {}, { signal }),

  /**
   * @param {Model} project
   * @param {Model} taskType
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The quotas of the task type, by person.
   */
  getProjectQuotas: async (project, taskType, { signal } = {}) =>
    http.fetchAll(
      `projects/${idOf(project)}/quotas/${idOf(taskType)}`,
      {},
      { signal }
    ),

  /**
   * @param {Model} project
   * @param {Model} person
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The quotas of the person, by task type.
   */
  getProjectPersonQuotas: async (project, person, { signal } = {}) =>
    http.fetchAll(
      `projects/${idOf(project)}/quotas/persons/${idOf(person)}`,
      {},
      { signal }
    ),

  /**
   * @param {Model} project
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} The budgets of the project.
   */
  getBudgets: async (project, { signal } = {}) =>
    http.fetchAll(budgetsOf(project), {}, { signal }),

  /**
   * @param {Model} project
   * @param {string} name
   * @param {{
   *   description?: string,
   *   currency?: string,
   *   startDate?: Date|string,
   *   endDate?: Date|string,
   *   amount?: number,
   *   signal?: AbortSignal
   * }} [options] currency is a code such as USD or EUR. Dates are Date
   *   objects or YYYY-MM-DD strings. amount is the overall budget.
   * @returns {Promise<Entity>} The created budget.
   */
  createBudget: async (
    project,
    name,
    { description, currency, startDate, endDate, amount, signal } = {}
  ) =>
    http.create(
      budgetsOf(project),
      withoutNil({
        name,
        description,
        currency,
        start_date: dateOf(startDate),
        end_date: dateOf(endDate),
        amount
      }),
      { signal }
    ),

  /**
   * @param {Model} project
   * @param {Model} budget
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity|null>} The budget, null when it does not exist.
   */
  getBudget: async (project, budget, { signal } = {}) =>
    http.fetchOne(budgetsOf(project), idOf(budget), { signal }),

  /**
   * @param {Model} project
   * @param {Model} budget
   * @param {object} data The fields to change.
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The updated budget.
   */
  updateBudget: async (project, budget, data, { signal } = {}) =>
    http.update(budgetsOf(project), idOf(budget), data, { signal }),

  /**
   * @param {Model} project
   * @param {Model} budget
   * @param {RequestOptions} [options]
   * @returns {Promise<null>}
   */
  removeBudget: async (project, budget, { signal } = {}) =>
    http.remove(budgetsOf(project), idOf(budget), {}, { signal }),

  /**
   * @param {Model} project
   * @param {Model} budget
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} The entries of the budget.
   */
  getBudgetEntries: async (project, budget, { signal } = {}) =>
    http.fetchAll(entriesOf(project, budget), {}, { signal }),

  /**
   * @param {Model} project
   * @param {Model} budget
   * @param {string} name
   * @param {{
   *   date?: Date|string,
   *   amount?: number,
   *   quantity?: number,
   *   unitPrice?: number,
   *   description?: string,
   *   category?: string,
   *   signal?: AbortSignal
   * }} [options] date is a Date object or a YYYY-MM-DD string. amount is
   *   the total of the entry, or quantity and unitPrice give it.
   * @returns {Promise<Entity>} The created budget entry.
   */
  createBudgetEntry: async (
    project,
    budget,
    name,
    { date, amount, quantity, unitPrice, description, category, signal } = {}
  ) =>
    http.create(
      entriesOf(project, budget),
      withoutNil({
        name,
        date: dateOf(date),
        amount,
        quantity,
        unit_price: unitPrice,
        description,
        category
      }),
      { signal }
    ),

  /**
   * @param {Model} project
   * @param {Model} budget
   * @param {Model} entry
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity|null>} The budget entry, null when it does not
   *   exist.
   */
  getBudgetEntry: async (project, budget, entry, { signal } = {}) =>
    http.fetchOne(entriesOf(project, budget), idOf(entry), { signal }),

  /**
   * @param {Model} project
   * @param {Model} budget
   * @param {Model} entry
   * @param {object} data The fields to change.
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The updated budget entry.
   */
  updateBudgetEntry: async (project, budget, entry, data, { signal } = {}) =>
    http.update(entriesOf(project, budget), idOf(entry), data, { signal }),

  /**
   * @param {Model} project
   * @param {Model} budget
   * @param {Model} entry
   * @param {RequestOptions} [options]
   * @returns {Promise<null>}
   */
  removeBudgetEntry: async (project, budget, entry, { signal } = {}) =>
    http.remove(entriesOf(project, budget), idOf(entry), {}, { signal }),

  /**
   * @param {Model} project
   * @param {{section?: string}} [options] "assets" by default.
   * @returns {Promise<string>} URL of the production in the Kitsu web app.
   */
  getProjectUrl: async (project, { section = 'assets' } = {}) =>
    urls.getProjectUrl(urls.webHostOf(http.host), project, section)
})
