import { KitsuError, ParameterError } from '../core/errors.js'
import {
  dateOf,
  dayOf,
  idOf,
  idsOf,
  likeLiteralOf,
  optionalIdOf,
  requiredOf,
  sameNameOf,
  sortedByName,
  withoutNil,
  withoutUndefined
} from '../core/params.js'
import * as urls from '../utils/urls.js'

/**
 * @typedef {import('../core/params.js').Entity} Entity
 * @typedef {import('../core/params.js').Model} Model
 * @typedef {import('../core/params.js').RequestOptions} RequestOptions
 */

/**
 * @typedef {object} QuotaOptions
 * @property {string} [countMode] weighted (the default), weighteddone,
 *   feedback or done. The weighted modes spread the frames of a shot over
 *   the days spent on it, the others count them on one day. The done modes
 *   date a shot by its approval, the others by its first feedback request.
 * @property {Model} [studio] Keeps the shots assigned to members of that
 *   studio.
 * @property {AbortSignal} [signal]
 */

const LINK_FIELDS = ['team', 'asset_types', 'task_statuses', 'task_types']

// The choices of the out_field_type column of a status automation.
const OUT_FIELD_TYPES = ['status', 'ready_for']

// The choices of the position and seniority columns of a budget entry.
const POSITIONS = ['supervisor', 'lead', 'artist']
const SENIORITIES = ['senior', 'mid', 'junior']

// The choices of the board roles of a task status link.
const ROLES = ['user', 'admin', 'supervisor', 'manager', 'client', 'vendor']

// Zou stores any string in a choice column, then fails on every later read
// of the row: an unknown code is refused before the request.
const choiceOf = (label, choices, value) => {
  if (value === null || value === undefined || choices.includes(value)) {
    return value
  }
  throw new ParameterError(
    `Wrong format: ${label} must be one of ${choices.join(', ')}`
  )
}

const boardRolesOf = roles => {
  if (Array.isArray(roles) && roles.every(role => ROLES.includes(role))) {
    return roles
  }
  throw new ParameterError(
    `Wrong format: rolesForBoard must be a list of ${ROLES.join(', ')}`
  )
}

// The checks of newStatusAutomation, on the output fields an update gives.
// Zou stores them as they are: an unknown type breaks every later read of
// the automations, a status output without its status every comment that
// triggers it.
const checkOutputOf = automation => {
  if (typeof automation !== 'object' || automation === null) return
  // A field given as undefined is not given.
  const has = key => automation[key] !== undefined
  const { out_field_type: type, out_task_status_id: status } = automation
  if (has('out_field_type') && !OUT_FIELD_TYPES.includes(type)) {
    throw new ParameterError(
      `Wrong format: out_field_type must be one of ${OUT_FIELD_TYPES.join(', ')}`
    )
  }
  // The stored type is unknown here: a status cleared without a ready_for
  // type next to it could leave a status output without its status.
  const needsStatus =
    type === 'status' || (!has('out_field_type') && has('out_task_status_id'))
  if (needsStatus && (status === null || status === undefined)) {
    throw new ParameterError(
      'Missing parameter: out_task_status_id is required with status'
    )
  }
  if (
    type === 'ready_for' &&
    has('entity_type') &&
    automation.entity_type !== 'asset'
  ) {
    throw new ParameterError('Wrong format: ready_for only works on assets')
  }
}

// Zou expects model links as lists of ids, while a project read with its
// relations can carry them as dicts.
const withLinkIds = project =>
  LINK_FIELDS.filter(field => Array.isArray(project[field])).reduce(
    (result, field) => ({ ...result, [field]: idsOf(project[field]) }),
    project
  )

/**
 * Zou reads the type of a background from the name of its file, and only
 * takes hdr: for any other name, "blob" for a bare Blob, it deletes the
 * background and its stored files before refusing the upload. A file that is
 * not a Blob is left to the upload, which refuses it.
 * @param {Blob & {name?: string}} file
 * @param {string} [fileName]
 */
const checkHdrName = (file, fileName) => {
  if (!(file instanceof Blob) || /\.hdr$/i.test(fileName || file.name || '')) {
    return
  }
  throw new ParameterError(
    'Wrong format: the file name must end in .hdr (fileName names a bare Blob)'
  )
}

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

const fetchByName = (http, path, name, signal) =>
  http
    .fetchAll(path, { name: likeLiteralOf(name) }, { signal })
    .then(entries => sameNameOf(entries, name))

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
   * @returns {Promise<Entity|null>} The project status of that name, the case
   *   ignored but an exact match first, null when none.
   */
  getProjectStatusByName: async (projectStatusName, { signal } = {}) =>
    fetchByName(http, 'project-status', projectStatusName, signal),

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
   * @returns {Promise<Entity|null>} The project of that name, the case
   *   ignored but an exact match first, null when none.
   */
  getProjectByName: async (projectName, { signal } = {}) =>
    fetchByName(http, 'projects', projectName, signal),

  /**
   * Create a project, unless getProjectByName finds one with that name.
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
   * }} [options] productionType is short (the default), featurefilm or
   *   tvshow, and productionStyle is 2d3d by default. projectTemplate is
   *   applied after the creation: its production type and style apply unless
   *   productionType or productionStyle is given.
   * @returns {Promise<Entity>} The created project, or the existing one.
   */
  newProject: async (
    name,
    {
      productionType,
      team = [],
      assetTypes = [],
      taskStatuses = [],
      taskTypes = [],
      productionStyle,
      projectTemplate,
      signal
    } = {}
  ) => {
    // Checked before the lookup: a wrong option is reported even when the
    // project already exists.
    const links = {
      team: idsOf(team),
      asset_types: idsOf(assetTypes),
      task_statuses: idsOf(taskStatuses),
      task_types: idsOf(taskTypes)
    }
    const templateId = optionalIdOf(projectTemplate)
    const existing = await fetchByName(http, 'projects', name, signal)
    if (existing) return existing
    return http.create(
      'projects',
      {
        name,
        ...links,
        // Zou defaults to short and 2d3d. Any value sent overrides the one
        // of the template.
        ...withoutNil({
          production_type: productionType,
          production_style: productionStyle,
          project_template_id: templateId
        })
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
   * Merge data into the metadata of the project. Keys that are not given,
   * or given as undefined, are left unchanged.
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
    // Zou replaces the metadata of a project instead of merging them: the
    // merge is done here, and only the metadata go back, so the other fields
    // and links keep any change made since the read. A key given as
    // undefined is not given: JSON would drop the stored one.
    return http.update(
      'projects',
      idOf(project),
      { data: { ...current.data, ...withoutUndefined({ ...data }) } },
      { signal }
    )
  },

  /**
   * Give the project the closed status. Only the status is sent: the other
   * fields and links of a project object are not written back.
   * @param {Model} project
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The updated project.
   */
  closeProject: async (project, { signal } = {}) => {
    const id = idOf(project)
    const statuses = await http.fetchAll('project-status', {}, { signal })
    const closed = statuses.find(
      status => (status.name || '').toLowerCase() === 'closed'
    )
    if (!closed) throw new KitsuError('No closed project status found')
    // Zou replaces the links it is given: a project read earlier would drop
    // the ones added since, with their priorities and board roles.
    return http.update(
      'projects',
      id,
      { project_status_id: closed.id },
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
   * keeps its priority (updateTaskTypeLink or reorderTaskTypeLinks change
   * it) and only writes the bitrates, when one is given.
   * @param {Model} project
   * @param {Model} taskType
   * @param {number} priority
   * @param {{
   *   hdBitrateCompression?: number|null,
   *   ldBitrateCompression?: number|null,
   *   signal?: AbortSignal
   * }} [options] Bitrates in Mbit/s of the movies encoded for that task
   *   type in the project. Zou writes both as soon as one is given: a
   *   missing one goes back to null, which inherits the bitrate of the
   *   project. null resets one.
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
      {
        ...withoutNil({ task_type_id: idOf(taskType), priority }),
        // JSON leaves an undefined bitrate out, and sends a null one.
        hd_bitrate_compression: hdBitrateCompression,
        ld_bitrate_compression: ldBitrateCompression
      },
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
   *   taskType?: Model,
   *   signal?: AbortSignal
   * }} [options] choices stays empty for free values. taskType scopes the
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
      taskType,
      signal
    } = {}
  ) =>
    http.create(
      descriptorsOf(project),
      withoutNil({
        name: requiredOf('name', name),
        data_type: dataType,
        choices,
        for_client: forClient,
        // Zou would create an Asset descriptor without it.
        entity_type: requiredOf('entityType', entityType),
        departments: idsOf(departments),
        task_type_id: optionalIdOf(taskType)
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
   * @param {{
   *   entityType?: string,
   *   taskType?: Model,
   *   signal?: AbortSignal
   * }} [options] A field name is unique per entity type only, and per task
   *   type for Task: without entityType (and taskType for Task), the match is
   *   any of the descriptors sharing it. The casing of entityType matters.
   * @returns {Promise<Entity|null>} First metadata descriptor of the project
   *   matching the field name, with its departments.
   */
  getMetadataDescriptorByFieldName: async (
    project,
    fieldName,
    { entityType, taskType, signal } = {}
  ) =>
    http.fetchFirst(
      'metadata-descriptors',
      {
        project_id: idOf(project),
        field_name: requiredOf('fieldName', fieldName),
        entity_type: entityType,
        task_type_id: optionalIdOf(taskType),
        // A filtered list leaves the departments out without it.
        relations: true
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
   * Change fields of the descriptor. The others keep their value, as do
   * the fields given as undefined: the descriptor is read first and saved
   * with the given fields merged in. A new name also renames the field, and
   * its values move with it.
   * @param {Model} project
   * @param {{id: string, [field: string]: any}} metadataDescriptor The id
   *   and the fields to change: name, data_type, choices, for_client and
   *   departments (entities or ids).
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The updated metadata descriptor.
   */
  updateMetadataDescriptor: async (
    project,
    metadataDescriptor,
    { signal } = {}
  ) => {
    const id = idOf(metadataDescriptor)
    const current = await http.get(
      `data/${descriptorsOf(project)}/${id}`,
      {},
      { signal }
    )
    // Zou writes every field of the descriptor, its default for a missing
    // one: a partial body would reset the type, the choices, the departments
    // and the client visibility. The name is the exception: kept when it is
    // missing, and any name sent sets the field name from it. A field given
    // as undefined keeps its value too.
    const merged = { ...current, ...withoutUndefined(metadataDescriptor) }
    return http.update(
      descriptorsOf(project),
      id,
      withoutNil({
        name: metadataDescriptor.name,
        data_type: merged.data_type,
        choices: merged.choices,
        for_client: merged.for_client,
        departments: idsOf(merged.departments || [])
      }),
      { signal }
    )
  },

  /**
   * Remove the descriptor. Zou also erases the values of its field from
   * every entity of its type in the project (from the tasks of its task type
   * for a Task descriptor, from the project itself for a Project one).
   *
   * gazu's force is not ported: Zou never reads it on this route.
   * @param {Model} project
   * @param {Model} metadataDescriptor
   * @param {RequestOptions} [options]
   * @returns {Promise<null>}
   */
  removeMetadataDescriptor: async (
    project,
    metadataDescriptor,
    { signal } = {}
  ) =>
    http.remove(
      descriptorsOf(project),
      idOf(metadataDescriptor),
      {},
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
  updateTeamMemberRole: async (project, person, role, { signal } = {}) => {
    // A forgotten role would go out as none, which restores the global one.
    if (role === undefined) {
      throw new ParameterError(
        'Missing parameter: role is required, null restores the global role'
      )
    }
    return http.update(
      `projects/${idOf(project)}/team`,
      idOf(person),
      { role },
      { signal }
    )
  },

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
   * Link a status automation to the project, where it then runs.
   * @param {Model} project
   * @param {Model} automation
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The project.
   */
  addStatusAutomation: async (project, automation, { signal } = {}) =>
    http.create(
      settingsOf(project, 'status-automations'),
      { status_automation_id: idOf(automation) },
      { signal }
    ),

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
   * Link an existing preview background file to the project. This is a JSON
   * call, not an upload: the file itself is sent with
   * uploadPreviewBackgroundFile.
   * @param {Model} project
   * @param {Model} backgroundFile
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The project.
   */
  addPreviewBackgroundFile: async (project, backgroundFile, { signal } = {}) =>
    http.create(
      settingsOf(project, 'preview-background-files'),
      { preview_background_file_id: idOf(backgroundFile) },
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
   * @param {QuotaOptions} [options]
   * @returns {Promise<Record<string, any>>} The quotas of the task type by
   *   person id, plus a "total" key: frames, seconds, drawings and shot
   *   counts by day, week, month and year.
   */
  getProjectQuotas: async (
    project,
    taskType,
    { countMode, studio, signal } = {}
  ) =>
    http.fetchAll(
      `projects/${idOf(project)}/quotas/${idOf(taskType)}`,
      { count_mode: countMode, studio_id: optionalIdOf(studio) },
      { signal }
    ),

  /**
   * @param {Model} project
   * @param {Model} person
   * @param {QuotaOptions} [options]
   * @returns {Promise<Record<string, any>>} The quotas of the person by task
   *   type id, plus a "total" key, in the shape of getProjectQuotas.
   */
  getProjectPersonQuotas: async (
    project,
    person,
    { countMode, studio, signal } = {}
  ) =>
    http.fetchAll(
      `projects/${idOf(project)}/quotas/persons/${idOf(person)}`,
      { count_mode: countMode, studio_id: optionalIdOf(studio) },
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
   * Add a line to the budget: a person or a position of a department, paid
   * a daily salary over some months. gazu takes a name, a date and an
   * amount instead, which Zou does not read.
   * @param {Model} project
   * @param {Model} budget
   * @param {Model} department
   * @param {Date|string} startDate A Date object or a YYYY-MM-DD string.
   * @param {number} monthsDuration
   * @param {number} dailySalary
   * @param {{
   *   person?: Model,
   *   position?: string,
   *   seniority?: string,
   *   signal?: AbortSignal
   * }} [options] position is supervisor, lead or artist (the default),
   *   seniority is senior, mid (the default) or junior.
   * @returns {Promise<Entity>} The created budget entry.
   */
  createBudgetEntry: async (
    project,
    budget,
    department,
    startDate,
    monthsDuration,
    dailySalary,
    { person, position, seniority, signal } = {}
  ) =>
    http.create(
      entriesOf(project, budget),
      withoutNil({
        department_id: idOf(department),
        person_id: optionalIdOf(person),
        position: choiceOf('position', POSITIONS, position),
        seniority: choiceOf('seniority', SENIORITIES, seniority),
        // Zou cannot store an entry without them: it answers 500.
        start_date: dayOf(requiredOf('startDate', startDate)),
        months_duration: requiredOf('monthsDuration', monthsDuration),
        daily_salary: requiredOf('dailySalary', dailySalary)
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
   * Change fields of the budget entry. The others keep their value, as do
   * the fields given as undefined, while null clears a field: the entry is
   * read first and saved whole with the given fields merged in.
   * @param {Model} project
   * @param {Model} budget
   * @param {Model} entry
   * @param {Record<string, any>} data The fields to change: department_id,
   *   person_id, start_date (a Date object or a YYYY-MM-DD string),
   *   months_duration, daily_salary, position, seniority and exceptions (the
   *   whole map). position and seniority take the codes of
   *   createBudgetEntry.
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The updated budget entry.
   */
  updateBudgetEntry: async (project, budget, entry, data, { signal } = {}) => {
    const entries = entriesOf(project, budget)
    const id = idOf(entry)
    const { position, seniority } = data || {}
    choiceOf('position', POSITIONS, position)
    choiceOf('seniority', SENIORITIES, seniority)
    const current = await http.get(`data/${entries}/${id}`, {}, { signal })
    // Zou writes every field of the entry, null for a missing one: a partial
    // body would fail on the required ones and clear the person, the
    // position, the seniority and the exceptions. A field given as undefined
    // keeps its value too.
    const merged = { ...current, ...withoutUndefined({ ...data }) }
    return http.update(
      entries,
      id,
      {
        department_id: merged.department_id,
        person_id: merged.person_id,
        start_date: dateOf(merged.start_date),
        months_duration: merged.months_duration,
        daily_salary: merged.daily_salary,
        position: merged.position,
        seniority: merged.seniority,
        exceptions: merged.exceptions
      },
      { signal }
    )
  },

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
   * @param {string[]} rolesForBoard Roles seeing the status as a board
   *   column, among user, admin, supervisor, manager, client and vendor.
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
        roles_for_board: boardRolesOf(
          requiredOf('rolesForBoard', rolesForBoard)
        )
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
   * Create the descriptor on every open project the user manages (all of
   * them for an admin) that does not have the field yet.
   * @param {string} name
   * @param {string} entityType Asset, Shot, Edit, Episode, Sequence or
   *   Project.
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
   * Update the descriptors sharing a field name on every open project the
   * user manages (all of them for an admin).
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
  ) => {
    // A forgotten descriptor is reported as its missing entity_type.
    const descriptor = { ...data }
    return http.update(
      'metadata-descriptors/all-projects',
      fieldSegmentOf(fieldName),
      {
        ...descriptor,
        entity_type: requiredOf('entity_type', descriptor.entity_type),
        ...(Array.isArray(descriptor.departments)
          ? { departments: idsOf(descriptor.departments) }
          : {})
      },
      { signal }
    )
  },

  /**
   * Remove the descriptors sharing a field name from every open project the
   * user manages (all of them for an admin). Zou also erases the values of
   * the field from every entity of that type in those projects (from the
   * projects themselves for Project).
   * @param {string} fieldName
   * @param {string} entityType Asset, Shot, Edit, Episode, Sequence or
   *   Project.
   * @param {RequestOptions} [options]
   * @returns {Promise<string[]>} The ids of the removed descriptors.
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
   * project the user manages (all of them for an admin) from the order of
   * the given field names.
   * @param {string} entityType Asset, Shot, Edit, Episode, Sequence or
   *   Project.
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
   *   required with status, and ready_for only works on assets.
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
    // Zou would store all three: an unknown output type breaks every later
    // read of the automations, a status one without its status fails every
    // comment that triggers it, and a ready_for one only acts on assets.
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
    if (outFieldType === 'ready_for' && entityType !== 'asset') {
      throw new ParameterError('Wrong format: ready_for only works on assets')
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
   * Save the automation. The output fields it carries are checked like
   * newStatusAutomation checks them: out_field_type is status or ready_for,
   * a status output comes with its out_task_status_id, and ready_for only
   * works on assets.
   * @param {Entity} automation
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The updated status automation.
   */
  updateStatusAutomation: async (automation, { signal } = {}) => {
    const id = idOf(automation)
    checkOutputOf(automation)
    return http.update('status-automations', id, automation, { signal })
  },

  /**
   * Delete the automation itself. removeStatusAutomation only unlinks it
   * from a project. Zou refuses it (ParameterError) while a project or a
   * project template links the automation: unlink it first.
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
   * from a project. Zou refuses it (ParameterError) while a project or a
   * project template links the background or has it as its default: unlink
   * it first.
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
   * Send the HDR file of the background. Its name must end in .hdr: Zou
   * deletes the background, record and stored files, when it gets any other
   * name, so it is refused here.
   * @param {Model} backgroundFile
   * @param {Blob} file The HDR file, a Blob or a File. A bare Blob needs
   *   fileName.
   * @param {{
   *   fileName?: string,
   *   onProgress?: (progress: {loaded: number, total: number}) => void,
   *   signal?: AbortSignal
   * }} [options] fileName names the file in place of its own name.
   *   onProgress needs XMLHttpRequest (browsers, webviews): fetch cannot
   *   report it. A client given its own fetch (Tauri) calls it only with
   *   xhrUploads: true, and a bearer client never for an upload to the
   *   origin of its page.
   * @returns {Promise<Entity>} The preview background file.
   */
  uploadPreviewBackgroundFile: async (
    backgroundFile,
    file,
    { fileName, onProgress, signal } = {}
  ) => {
    checkHdrName(file, fileName)
    return http.upload(
      `pictures/preview-background-files/${idOf(backgroundFile)}`,
      { file, fileName, onProgress, signal }
    )
  },

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
