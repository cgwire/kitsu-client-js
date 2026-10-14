import { ParameterError } from '../core/errors.js'
import {
  dateOf,
  idOf,
  idsOf,
  optionalIdOf,
  requiredOf,
  withoutNil,
  withoutUndefined
} from '../core/params.js'

/**
 * @typedef {import('../core/params.js').Entity} Entity
 * @typedef {import('../core/params.js').Model} Model
 * @typedef {import('../core/params.js').RequestOptions} RequestOptions
 * @typedef {'asset-types'|'sequences'|'edits'|'episodes'} ScheduleItemKind
 */

const SCHEDULE_ITEM_KINDS = ['asset-types', 'sequences', 'edits', 'episodes']

// The kind is a path segment: only the four routes Zou declares are allowed.
const kindOf = kind => {
  if (SCHEDULE_ITEM_KINDS.includes(kind)) return kind
  throw new ParameterError(
    `Wrong format: kind must be one of ${SCHEDULE_ITEM_KINDS.join(', ')}`
  )
}

const optionalIdsOf = models =>
  models === undefined || models === null ? models : idsOf(models)

// Up to 0.2.0 the changes were options: such a call would now save nothing.
const refuseOptionChanges = (options, names, saved) => {
  if (names.some(name => name in options)) {
    throw new ParameterError(
      `Wrong format: the changes are fields of the ${saved}, not options`
    )
  }
}

export const scheduleApi = http => ({
  /**
   * Create a milestone of a project.
   * @param {Model} project
   * @param {string} name
   * @param {Date|string} date A Date (its local day) or "YYYY-MM-DD".
   * @param {{taskType?: Model, signal?: AbortSignal}} [options]
   * @returns {Promise<Entity>}
   */
  newMilestone: async (project, name, date, { taskType, signal } = {}) =>
    http.create(
      'milestones',
      withoutNil({
        date: dateOf(requiredOf('date', date)),
        name: requiredOf('name', name),
        task_type_id: optionalIdOf(taskType),
        project_id: idOf(project)
      }),
      { signal }
    ),

  /**
   * Save the date, name and task_type_id of the milestone. A field missing
   * from the given object is left untouched, a null task_type_id clears the
   * task type.
   * @param {{
   *   id: string,
   *   date?: Date|string,
   *   name?: string,
   *   task_type_id?: string|null,
   *   [field: string]: any
   * }} milestone A Date gives its local day.
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>}
   */
  updateMilestone: async (milestone, options = {}) => {
    refuseOptionChanges(options, ['date', 'name', 'taskType'], 'milestone')
    return http.update(
      'milestones',
      idOf(milestone),
      withoutUndefined({
        date: dateOf(milestone.date),
        name: milestone.name,
        task_type_id: milestone.task_type_id
      }),
      { signal: options.signal }
    )
  },

  /**
   * Delete a milestone.
   * @param {Model} milestone
   * @param {RequestOptions} [options]
   * @returns {Promise<null>}
   */
  removeMilestone: async (milestone, { signal } = {}) =>
    http.remove('milestones', idOf(milestone), undefined, { signal }),

  /**
   * Schedule items of a project at the task type level. Zou creates the item
   * of each task type of the project that has none, from today to tomorrow,
   * and announces it with a schedule-item:new event.
   * @param {Model} project
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>}
   */
  allTaskTypeScheduleItems: async (project, { signal } = {}) =>
    http.get(
      `data/projects/${idOf(project)}/schedule-items/task-types`,
      undefined,
      { signal }
    ),

  /**
   * Every schedule item of a project.
   * @param {Model} project
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>}
   */
  allScheduleItems: async (project, { signal } = {}) =>
    http.get(`data/projects/${idOf(project)}/schedule-items`, undefined, {
      signal
    }),

  /**
   * Schedule items of a task type for one kind of entity. Zou creates the
   * item of each asset type, sequence, edit or episode that has none, from
   * today to tomorrow, and announces it with a schedule-item:new event.
   * @param {Model} project
   * @param {Model} taskType
   * @param {ScheduleItemKind} kind
   * @param {{episode?: Model, signal?: AbortSignal}} [options]
   * @returns {Promise<Entity[]>}
   */
  allEntityScheduleItems: async (
    project,
    taskType,
    kind,
    { episode, signal } = {}
  ) =>
    http.get(
      `data/projects/${idOf(project)}/schedule-items/${idOf(taskType)}/${kindOf(kind)}`,
      { episode_id: optionalIdOf(episode) },
      { signal }
    ),

  /**
   * Create a schedule item for a task type of a project. Zou keeps one such
   * item per task type and refuses a second one (ParameterError), and
   * allTaskTypeScheduleItems creates the missing ones: change an existing
   * item with updateScheduleItem.
   * @param {Model} project
   * @param {Model} taskType
   * @param {Date|string} startDate A Date (its local day) or "YYYY-MM-DD".
   * @param {Date|string} endDate A Date (its local day) or "YYYY-MM-DD".
   * @param {{manDays?: number, signal?: AbortSignal}} [options]
   * @returns {Promise<Entity>}
   */
  newScheduleItem: async (
    project,
    taskType,
    startDate,
    endDate,
    { manDays, signal } = {}
  ) =>
    http.create(
      'schedule-items',
      withoutNil({
        start_date: dateOf(requiredOf('startDate', startDate)),
        end_date: dateOf(requiredOf('endDate', endDate)),
        project_id: idOf(project),
        task_type_id: idOf(taskType),
        man_days: manDays
      }),
      { signal }
    ),

  /**
   * Save the start_date, end_date and man_days of the schedule item. A field
   * missing from the given object is left untouched.
   * @param {{
   *   id: string,
   *   start_date?: Date|string,
   *   end_date?: Date|string,
   *   man_days?: number|null,
   *   [field: string]: any
   * }} scheduleItem A Date gives its local day.
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>}
   */
  updateScheduleItem: async (scheduleItem, options = {}) => {
    refuseOptionChanges(
      options,
      ['startDate', 'endDate', 'manDays'],
      'schedule item'
    )
    return http.update(
      'schedule-items',
      idOf(scheduleItem),
      withoutUndefined({
        start_date: dateOf(scheduleItem.start_date),
        end_date: dateOf(scheduleItem.end_date),
        man_days: scheduleItem.man_days
      }),
      { signal: options.signal }
    )
  },

  /**
   * Delete a schedule item.
   * @param {Model} scheduleItem
   * @param {RequestOptions} [options]
   * @returns {Promise<null>}
   */
  removeScheduleItem: async (scheduleItem, { signal } = {}) =>
    http.remove('schedule-items', idOf(scheduleItem), undefined, { signal }),

  /**
   * Production schedule versions of a project.
   * @param {Model} project
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>}
   */
  allScheduleVersions: async (project, { signal } = {}) =>
    http.fetchAll(
      'production-schedule-versions',
      { project_id: idOf(project) },
      { signal }
    ),

  /**
   * @param {Model} version
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity|null>} null when the version does not exist.
   */
  getScheduleVersion: async (version, { signal } = {}) =>
    http.fetchOne('production-schedule-versions', idOf(version), { signal }),

  /**
   * Create a production schedule version. Its task links are filled
   * afterwards with setTaskLinksFromProduction or
   * setTaskLinksFromScheduleVersion.
   * @param {Model} project
   * @param {string} name
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>}
   */
  newScheduleVersion: async (project, name, { signal } = {}) =>
    http.create(
      'production-schedule-versions',
      { project_id: idOf(project), name: requiredOf('name', name) },
      { signal }
    ),

  /**
   * Save the name, canceled and locked fields of the production schedule
   * version. A field missing from the given object is left untouched.
   * @param {{
   *   id: string,
   *   name?: string,
   *   canceled?: boolean,
   *   locked?: boolean,
   *   [field: string]: any
   * }} version
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>}
   */
  updateScheduleVersion: async (version, options = {}) => {
    refuseOptionChanges(options, ['name', 'canceled', 'locked'], 'version')
    return http.update(
      'production-schedule-versions',
      idOf(version),
      withoutUndefined({
        name: version.name,
        canceled: version.canceled,
        locked: version.locked
      }),
      { signal: options.signal }
    )
  },

  /**
   * Delete a production schedule version.
   * @param {Model} version
   * @param {RequestOptions} [options]
   * @returns {Promise<null>}
   */
  removeScheduleVersion: async (version, { signal } = {}) =>
    http.remove('production-schedule-versions', idOf(version), undefined, {
      signal
    }),

  /**
   * Fill the task links of a version from the tasks of its production.
   * @param {Model} version
   * @param {RequestOptions} [options]
   * @returns {Promise<{success: boolean, task_link_count: number}>} The
   *   number of task links set.
   */
  setTaskLinksFromProduction: async (version, { signal } = {}) =>
    http.post(
      `actions/production-schedule-versions/${idOf(version)}/set-task-links-from-production`,
      undefined,
      { signal }
    ),

  /**
   * Fill the task links of a version from another version.
   * @param {Model} version
   * @param {Model} fromVersion The source version.
   * @param {RequestOptions} [options]
   * @returns {Promise<{success: boolean, task_link_count: number}>} The
   *   number of task links set.
   */
  setTaskLinksFromScheduleVersion: async (
    version,
    fromVersion,
    { signal } = {}
  ) =>
    http.post(
      `actions/production-schedule-versions/${idOf(version)}/set-task-links-from-production-schedule-version`,
      { production_schedule_version_id: idOf(fromVersion) },
      { signal }
    ),

  /**
   * Copy the start dates, due dates and estimations of the task links of a
   * version onto the tasks of its production (the assignees are not
   * applied), then lock the version and record it as the
   * from_schedule_version_id of the project.
   * @param {Model} version
   * @param {RequestOptions} [options]
   * @returns {Promise<{success: boolean, task_count: number}>} The number of
   *   tasks updated.
   */
  applyScheduleVersionToProduction: async (version, { signal } = {}) =>
    http.post(
      `actions/production-schedule-versions/${idOf(version)}/apply-to-production`,
      undefined,
      { signal }
    ),

  /**
   * Task links of a version, with their relations (assignees).
   * @param {Model} version
   * @param {{taskType?: Model, signal?: AbortSignal}} [options]
   * @returns {Promise<Entity[]>}
   */
  allScheduleVersionTaskLinks: async (version, { taskType, signal } = {}) =>
    http.get(
      `data/production-schedule-versions/${idOf(version)}/task-links`,
      { relations: true, task_type_id: optionalIdOf(taskType) },
      { signal }
    ),

  /**
   * @param {Model} taskLink
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity|null>} null when the task link does not exist.
   */
  getScheduleVersionTaskLink: async (taskLink, { signal } = {}) =>
    http.fetchOne('production-schedule-version-task-links', idOf(taskLink), {
      signal
    }),

  /**
   * Link a task to a production schedule version.
   * @param {Model} version
   * @param {Model} task
   * @param {{
   *   startDate?: Date|string,
   *   dueDate?: Date|string,
   *   estimation?: number,
   *   assignees?: Model[],
   *   signal?: AbortSignal
   * }} [options] A Date gives its local day.
   * @returns {Promise<Entity>}
   */
  newScheduleVersionTaskLink: async (
    version,
    task,
    { startDate, dueDate, estimation, assignees, signal } = {}
  ) =>
    http.create(
      'production-schedule-version-task-links',
      withoutNil({
        task_id: idOf(task),
        production_schedule_version_id: idOf(version),
        start_date: dateOf(startDate),
        due_date: dateOf(dueDate),
        estimation,
        assignees: optionalIdsOf(assignees)
      }),
      { signal }
    ),

  /**
   * Save the start_date, due_date, estimation and assignees of the task
   * link. A field missing from the given object is left untouched, a null
   * date clears it.
   * @param {{
   *   id: string,
   *   start_date?: Date|string|null,
   *   due_date?: Date|string|null,
   *   estimation?: number,
   *   assignees?: Model[],
   *   [field: string]: any
   * }} taskLink A Date gives its local day.
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>}
   */
  updateScheduleVersionTaskLink: async (taskLink, options = {}) => {
    refuseOptionChanges(
      options,
      ['startDate', 'dueDate', 'estimation', 'assignees'],
      'task link'
    )
    return http.update(
      'production-schedule-version-task-links',
      idOf(taskLink),
      withoutUndefined({
        start_date: dateOf(taskLink.start_date),
        due_date: dateOf(taskLink.due_date),
        estimation: taskLink.estimation,
        assignees: optionalIdsOf(taskLink.assignees)
      }),
      { signal: options.signal }
    )
  },

  /**
   * Delete a task link of a production schedule version.
   * @param {Model} taskLink
   * @param {RequestOptions} [options]
   * @returns {Promise<null>}
   */
  removeScheduleVersionTaskLink: async (taskLink, { signal } = {}) =>
    http.remove(
      'production-schedule-version-task-links',
      idOf(taskLink),
      undefined,
      { signal }
    )
})
