import { ParameterError } from '../core/errors.js'
import {
  dateOf,
  idOf,
  idsOf,
  optionalIdOf,
  requiredOf,
  withoutNil
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

// An update sends null on purpose (it clears the field): only the keys left
// unset stay out of the body.
const withoutUndefined = data =>
  Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  )

const optionalIdsOf = models =>
  models === undefined || models === null ? models : idsOf(models)

const clearableIdOf = model =>
  model === undefined ? undefined : optionalIdOf(model)

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
   * Update a milestone. Only the given fields are sent; a null task type
   * clears it.
   * @param {Model} milestone
   * @param {{
   *   date?: Date|string,
   *   name?: string,
   *   taskType?: Model|null,
   *   signal?: AbortSignal
   * }} [options]
   * @returns {Promise<Entity>}
   */
  updateMilestone: async (milestone, { date, name, taskType, signal } = {}) =>
    http.update(
      'milestones',
      idOf(milestone),
      withoutUndefined({
        date: dateOf(date),
        name,
        task_type_id: clearableIdOf(taskType)
      }),
      { signal }
    ),

  /**
   * Delete a milestone.
   * @param {Model} milestone
   * @param {RequestOptions} [options]
   * @returns {Promise<any>}
   */
  removeMilestone: async (milestone, { signal } = {}) =>
    http.remove('milestones', idOf(milestone), undefined, { signal }),

  /**
   * Schedule items of a project at the task type level.
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
   * Schedule items of a task type for one kind of entity.
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
   * Create a schedule item for a task type of a project.
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
   * Update a schedule item. Only the given fields are sent.
   * @param {Model} scheduleItem
   * @param {{
   *   startDate?: Date|string,
   *   endDate?: Date|string,
   *   manDays?: number|null,
   *   signal?: AbortSignal
   * }} [options]
   * @returns {Promise<Entity>}
   */
  updateScheduleItem: async (
    scheduleItem,
    { startDate, endDate, manDays, signal } = {}
  ) =>
    http.update(
      'schedule-items',
      idOf(scheduleItem),
      withoutUndefined({
        start_date: dateOf(startDate),
        end_date: dateOf(endDate),
        man_days: manDays
      }),
      { signal }
    ),

  /**
   * Delete a schedule item.
   * @param {Model} scheduleItem
   * @param {RequestOptions} [options]
   * @returns {Promise<any>}
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
   * Update a production schedule version. Only the given fields are sent.
   * @param {Model} version
   * @param {{
   *   name?: string,
   *   canceled?: boolean,
   *   locked?: boolean,
   *   signal?: AbortSignal
   * }} [options]
   * @returns {Promise<Entity>}
   */
  updateScheduleVersion: async (
    version,
    { name, canceled, locked, signal } = {}
  ) =>
    http.update(
      'production-schedule-versions',
      idOf(version),
      withoutUndefined({ name, canceled, locked }),
      { signal }
    ),

  /**
   * Delete a production schedule version.
   * @param {Model} version
   * @param {RequestOptions} [options]
   * @returns {Promise<any>}
   */
  removeScheduleVersion: async (version, { signal } = {}) =>
    http.remove('production-schedule-versions', idOf(version), undefined, {
      signal
    }),

  /**
   * Fill the task links of a version from the tasks of its production.
   * @param {Model} version
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} The task links.
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
   * @returns {Promise<Entity[]>} The task links.
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
   * Apply the dates, estimations and assignees of a version to the tasks of
   * its production.
   * @param {Model} version
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} The updated tasks.
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
   * Update a task link. Only the given fields are sent; a null date clears
   * it.
   * @param {Model} taskLink
   * @param {{
   *   startDate?: Date|string|null,
   *   dueDate?: Date|string|null,
   *   estimation?: number,
   *   assignees?: Model[],
   *   signal?: AbortSignal
   * }} [options] A Date gives its local day.
   * @returns {Promise<Entity>}
   */
  updateScheduleVersionTaskLink: async (
    taskLink,
    { startDate, dueDate, estimation, assignees, signal } = {}
  ) =>
    http.update(
      'production-schedule-version-task-links',
      idOf(taskLink),
      withoutUndefined({
        start_date: dateOf(startDate),
        due_date: dateOf(dueDate),
        estimation,
        assignees: optionalIdsOf(assignees)
      }),
      { signal }
    ),

  /**
   * Delete a task link of a production schedule version.
   * @param {Model} taskLink
   * @param {RequestOptions} [options]
   * @returns {Promise<any>}
   */
  removeScheduleVersionTaskLink: async (taskLink, { signal } = {}) =>
    http.remove(
      'production-schedule-version-task-links',
      idOf(taskLink),
      undefined,
      { signal }
    )
})
