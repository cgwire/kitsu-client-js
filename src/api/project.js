import { KitsuError, ParameterError } from '../core/errors.js'
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

// The choices of the out_field_type column of a status automation.
const OUT_FIELD_TYPES = ['status', 'ready_for']

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

// A field name is caller input, unlike an id: encoding keeps it inside its
// path segment.
const fieldSegmentOf = fieldName =>
  encodeURIComponent(requiredOf('fieldName', fieldName))

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
    http.fetchAll(`projects/${idOf(project)}/task-types`, {}, { signal }),

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
   * @param {{currency?: string, signal?: AbortSignal}} [options] currency is
   *   a code such as USD or EUR.
   * @returns {Promise<Entity>} The created budget.
   */
  createBudget: async (project, name, { currency, signal } = {}) =>
    http.create(budgetsOf(project), withoutNil({ name, currency }), {
      signal
    }),

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
   * @param {Model} department
   * @param {{
   *   person?: Model,
   *   position?: string,
   *   seniority?: string,
   *   startDate?: Date|string,
   *   monthsDuration?: number,
   *   dailySalary?: number,
   *   signal?: AbortSignal
   * }} [options] startDate is a Date object or a YYYY-MM-DD string.
   * @returns {Promise<Entity>} The created budget entry.
   */
  createBudgetEntry: async (
    project,
    budget,
    department,
    {
      person,
      position,
      seniority,
      startDate,
      monthsDuration,
      dailySalary,
      signal
    } = {}
  ) =>
    http.create(
      entriesOf(project, budget),
      withoutNil({
        department_id: idOf(department),
        person_id: optionalIdOf(person),
        position,
        seniority,
        start_date: dateOf(startDate),
        months_duration: monthsDuration,
        daily_salary: dailySalary
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
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} The projects the logged-in user can access,
   *   sorted by name.
   */
  allProjectsWithAccess: async ({ signal } = {}) =>
    http.fetchAll('projects/all', {}, { signal }).then(sortedByName),

  /**
   * @param {Model} project
   * @param {Model} assetType
   * @param {RequestOptions} [options]
   * @returns {Promise<null>}
   */
  removeAssetType: async (project, assetType, { signal } = {}) =>
    http.remove(
      settingsOf(project, 'asset-types'),
      idOf(assetType),
      {},
      { signal }
    ),

  /**
   * Link task types, task statuses and asset types to the project in one
   * call.
   * @param {Model} project
   * @param {{
   *   taskTypes?: {taskType: Model, priority?: number|null}[],
   *   taskStatuses?: Model[],
   *   assetTypes?: Model[],
   *   replaceTaskTypes?: boolean,
   *   signal?: AbortSignal
   * }} [options] replaceTaskTypes unlinks the task types that are not in
   *   the list.
   * @returns {Promise<Entity>} The project.
   */
  addSettings: async (
    project,
    {
      taskTypes = [],
      taskStatuses = [],
      assetTypes = [],
      replaceTaskTypes = false,
      signal
    } = {}
  ) =>
    http.create(
      settingsOf(project, 'batch'),
      {
        task_types: taskTypes.map(({ taskType, priority = null }) => ({
          task_type_id: idOf(taskType),
          priority
        })),
        task_status_ids: idsOf(taskStatuses),
        asset_type_ids: idsOf(assetTypes),
        replace_task_types: replaceTaskTypes
      },
      { signal }
    ),

  /**
   * Create or update the link between a project and a task status. Zou
   * overwrites both fields of an existing link, and falls back to priority 1
   * and no board role for a missing one: both are required here.
   * @param {Model} project
   * @param {Model} taskStatus
   * @param {number} priority
   * @param {string[]} rolesForBoard Roles seeing the status as a board column.
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The task status link.
   */
  updateTaskStatusLink: async (
    project,
    taskStatus,
    priority,
    rolesForBoard,
    { signal } = {}
  ) =>
    http.create(
      'task-status-links',
      {
        project_id: idOf(project),
        task_status_id: idOf(taskStatus),
        priority: requiredOf('priority', priority),
        roles_for_board: requiredOf('rolesForBoard', rolesForBoard)
      },
      { signal }
    ),

  /**
   * Set the priority of the task status links of the project from the order
   * of the given list.
   * @param {Model} project
   * @param {Model[]} taskStatuses
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} The reordered task status links.
   */
  reorderTaskStatusLinks: async (project, taskStatuses, { signal } = {}) =>
    http.post(
      `actions/projects/${idOf(project)}/task-status-links/reorder`,
      { task_status_ids: idsOf(taskStatuses) },
      { signal }
    ),

  /**
   * Create or update the link between a project and a task type. Zou resets
   * an existing link to priority 1 when it is missing: it is required here.
   * @param {Model} project
   * @param {Model} taskType
   * @param {number} priority
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The task type link.
   */
  updateTaskTypeLink: async (project, taskType, priority, { signal } = {}) =>
    http.create(
      'task-type-links',
      {
        project_id: idOf(project),
        task_type_id: idOf(taskType),
        priority: requiredOf('priority', priority)
      },
      { signal }
    ),

  /**
   * Set the priority of the task type links of the project from the order of
   * the given list.
   * @param {Model} project
   * @param {Model[]} taskTypes
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} The reordered task type links.
   */
  reorderTaskTypeLinks: async (project, taskTypes, { signal } = {}) =>
    http.post(
      `actions/projects/${idOf(project)}/task-type-links/reorder`,
      { task_type_ids: idsOf(taskTypes) },
      { signal }
    ),

  /**
   * Create the descriptor on every open project.
   * @param {string} name
   * @param {string} entityType Asset, Shot, Edit, Episode or Sequence.
   * @param {{
   *   dataType?: string,
   *   choices?: string[],
   *   forClient?: boolean,
   *   departments?: Model[],
   *   signal?: AbortSignal
   * }} [options] choices stays empty for free values.
   * @returns {Promise<Entity[]>} The created metadata descriptors.
   */
  addMetadataDescriptorToAllProjects: async (
    name,
    entityType,
    {
      dataType = 'string',
      choices = [],
      forClient = false,
      departments = [],
      signal
    } = {}
  ) =>
    http.create(
      'metadata-descriptors/all-projects',
      {
        name: requiredOf('name', name),
        data_type: dataType,
        choices,
        for_client: forClient,
        entity_type: requiredOf('entityType', entityType),
        departments: idsOf(departments)
      },
      { signal }
    ),

  /**
   * Update the descriptors sharing a field name on every open project.
   * @param {string} fieldName
   * @param {{entity_type: string, [field: string]: any}} data The full
   *   descriptor, not a partial change: entity_type selects the descriptors
   *   and Zou resets data_type to "string", choices and departments to empty
   *   and for_client to false when they are absent. Only name is kept when
   *   omitted.
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} The updated metadata descriptors.
   */
  updateMetadataDescriptorOnAllProjects: async (
    fieldName,
    data,
    { signal } = {}
  ) =>
    http.update(
      'metadata-descriptors/all-projects',
      fieldSegmentOf(fieldName),
      {
        ...data,
        entity_type: requiredOf('entity_type', data.entity_type),
        ...(Array.isArray(data.departments)
          ? { departments: idsOf(data.departments) }
          : {})
      },
      { signal }
    ),

  /**
   * Remove the descriptors sharing a field name from every open project.
   * @param {string} fieldName
   * @param {string} entityType
   * @param {RequestOptions} [options]
   * @returns {Promise<null>}
   */
  removeMetadataDescriptorOnAllProjects: async (
    fieldName,
    entityType,
    { signal } = {}
  ) =>
    http.remove(
      'metadata-descriptors/all-projects',
      fieldSegmentOf(fieldName),
      { entity_type: requiredOf('entityType', entityType) },
      { signal }
    ),

  /**
   * Set the position of the descriptors of an entity type on every open
   * project from the order of the given field names.
   * @param {string} entityType
   * @param {string[]} fieldNames
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} The reordered metadata descriptors.
   */
  reorderMetadataDescriptorsOnAllProjects: async (
    entityType,
    fieldNames,
    { signal } = {}
  ) =>
    http.post(
      'actions/metadata-descriptors/all-projects/reorder',
      {
        entity_type: requiredOf('entityType', entityType),
        field_order: fieldNames
      },
      { signal }
    ),

  /**
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} Every status automation of the studio.
   *   allStatusAutomations lists the ones linked to a project.
   */
  allGlobalStatusAutomations: async ({ signal } = {}) =>
    http.fetchAll('status-automations', {}, { signal }),

  /**
   * @param {Model} automation
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity|null>} The status automation, null when it does
   *   not exist.
   */
  getStatusAutomation: async (automation, { signal } = {}) =>
    http.fetchOne('status-automations', idOf(automation), { signal }),

  /**
   * When a task of inTaskType gets inTaskStatus, the task of outTaskType on
   * the same entity gets outTaskStatus, or the asset becomes ready for
   * outTaskType. The automation only runs in the projects it is linked to
   * (addStatusAutomation).
   * @param {Model} inTaskType
   * @param {Model} inTaskStatus
   * @param {'status'|'ready_for'} outFieldType
   * @param {Model} outTaskType
   * @param {{
   *   entityType?: string,
   *   outTaskStatus?: Model,
   *   importLastRevision?: boolean,
   *   signal?: AbortSignal
   * }} [options] entityType is asset (default) or shot. outTaskStatus is
   *   required with status.
   * @returns {Promise<Entity>} The created status automation.
   */
  newStatusAutomation: async (
    inTaskType,
    inTaskStatus,
    outFieldType,
    outTaskType,
    {
      entityType = 'asset',
      outTaskStatus,
      importLastRevision = false,
      signal
    } = {}
  ) => {
    // 0.1.0 took a single object: name the arguments instead of reporting
    // a missing outFieldType.
    if (
      typeof inTaskType === 'object' &&
      inTaskType !== null &&
      ('inTaskType' in inTaskType || 'outFieldType' in inTaskType)
    ) {
      throw new ParameterError(
        'Wrong format: inTaskType, inTaskStatus, outFieldType and outTaskType are positional arguments'
      )
    }
    // Zou would store both: an unknown output type breaks every later read
    // of the automations, and a status one without its status fails every
    // comment that triggers it.
    if (!OUT_FIELD_TYPES.includes(outFieldType)) {
      throw new ParameterError(
        `Wrong format: outFieldType must be one of ${OUT_FIELD_TYPES.join(', ')}`
      )
    }
    if (outFieldType === 'status' && outTaskStatus == null) {
      throw new ParameterError(
        'Missing parameter: outTaskStatus is required with status'
      )
    }
    return http.create(
      'status-automations',
      withoutNil({
        entity_type: entityType,
        in_task_type_id: idOf(inTaskType),
        in_task_status_id: idOf(inTaskStatus),
        out_field_type: outFieldType,
        out_task_type_id: idOf(outTaskType),
        out_task_status_id: optionalIdOf(outTaskStatus),
        import_last_revision: importLastRevision
      }),
      { signal }
    )
  },

  /**
   * @param {Entity} automation
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The updated status automation.
   */
  updateStatusAutomation: async (automation, { signal } = {}) =>
    http.update('status-automations', idOf(automation), automation, {
      signal
    }),

  /**
   * Delete the automation itself. removeStatusAutomation only unlinks it
   * from a project.
   * @param {Model} automation
   * @param {RequestOptions} [options]
   * @returns {Promise<null>}
   */
  deleteStatusAutomation: async (automation, { signal } = {}) =>
    http.remove('status-automations', idOf(automation), {}, { signal }),

  /**
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} Every preview background file of the studio.
   *   getPreviewBackgroundFiles lists the ones linked to a project.
   */
  allPreviewBackgroundFiles: async ({ signal } = {}) =>
    http.fetchAll('preview-background-files', {}, { signal }),

  /**
   * @param {Model} backgroundFile
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity|null>} The preview background file, null when it
   *   does not exist.
   */
  getPreviewBackgroundFile: async (backgroundFile, { signal } = {}) =>
    http.fetchOne('preview-background-files', idOf(backgroundFile), {
      signal
    }),

  /**
   * Create the record of a background. Its HDR file is sent afterwards with
   * uploadPreviewBackgroundFile.
   * @param {string} name
   * @param {{
   *   archived?: boolean,
   *   isDefault?: boolean,
   *   signal?: AbortSignal
   * }} [options]
   * @returns {Promise<Entity>} The created preview background file.
   */
  newPreviewBackgroundFile: async (
    name,
    { archived = false, isDefault = false, signal } = {}
  ) =>
    http.create(
      'preview-background-files',
      { name: requiredOf('name', name), archived, is_default: isDefault },
      { signal }
    ),

  /**
   * @param {Entity} backgroundFile
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The updated preview background file.
   */
  updatePreviewBackgroundFile: async (backgroundFile, { signal } = {}) =>
    http.update(
      'preview-background-files',
      idOf(backgroundFile),
      backgroundFile,
      { signal }
    ),

  /**
   * Delete the background itself. removePreviewBackgroundFile only unlinks it
   * from a project.
   * @param {Model} backgroundFile
   * @param {RequestOptions} [options]
   * @returns {Promise<null>}
   */
  deletePreviewBackgroundFile: async (backgroundFile, { signal } = {}) =>
    http.remove(
      'preview-background-files',
      idOf(backgroundFile),
      {},
      { signal }
    ),

  /**
   * @param {Model} backgroundFile
   * @param {Blob} file The HDR file, a Blob or a File.
   * @param {{
   *   fileName?: string,
   *   onProgress?: (progress: {loaded: number, total: number}) => void,
   *   signal?: AbortSignal
   * }} [options] fileName names a Blob that has no name. onProgress needs
   *   XMLHttpRequest (browsers).
   * @returns {Promise<Entity>} The preview background file.
   */
  uploadPreviewBackgroundFile: async (
    backgroundFile,
    file,
    { fileName, onProgress, signal } = {}
  ) =>
    http.upload(`pictures/preview-background-files/${idOf(backgroundFile)}`, {
      file,
      fileName,
      onProgress,
      signal
    }),

  /**
   * @param {Model} project
   * @param {RequestOptions} [options]
   * @returns {Promise<Record<string, any>>} The time spent on the project, by
   *   department and person, to compare with the budgets.
   */
  getBudgetsTimeSpents: async (project, { signal } = {}) =>
    http.get(`data/${budgetsOf(project)}/time-spents`, {}, { signal }),

  /**
   * @param {Model} project
   * @param {Model} taskType
   * @param {{
   *   startDate?: Date|string,
   *   endDate?: Date|string,
   *   signal?: AbortSignal
   * }} [options] Dates are Date objects or YYYY-MM-DD strings.
   * @returns {Promise<Record<string, Entity[]>>} The time spents of the task
   *   type in the project, by person id.
   */
  getTaskTypeTimeSpents: async (
    project,
    taskType,
    { startDate, endDate, signal } = {}
  ) =>
    http.get(
      `data/projects/${idOf(project)}/task-types/${idOf(taskType)}/time-spents`,
      { start_date: dateOf(startDate), end_date: dateOf(endDate) },
      { signal }
    ),

  /**
   * @param {Model} project
   * @param {{
   *   startDate?: Date|string,
   *   endDate?: Date|string,
   *   signal?: AbortSignal
   * }} [options] Dates are Date objects or YYYY-MM-DD strings.
   * @returns {Promise<Record<string, Entity[]>>} The days off of the project
   *   team, by person id.
   */
  allDayOffsForProject: async (project, { startDate, endDate, signal } = {}) =>
    http.get(
      `data/projects/${idOf(project)}/day-offs`,
      { start_date: dateOf(startDate), end_date: dateOf(endDate) },
      { signal }
    ),

  /**
   * @param {Model} project
   * @param {{section?: string}} [options] "assets" by default.
   * @returns {Promise<string>} URL of the production in the Kitsu web app.
   */
  getProjectUrl: async (project, { section = 'assets' } = {}) =>
    urls.getProjectUrl(urls.webHostOf(http.host), project, section)
})
