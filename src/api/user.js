import { ParameterError } from '../core/errors.js'
import {
  datetimeOf,
  dayOf,
  idOf,
  idsOf,
  optionalIdOf,
  orNull,
  refuseUnknownOptions,
  requiredOf,
  sortedByName
} from '../core/params.js'

/**
 * @typedef {import('../core/params.js').Entity} Entity
 * @typedef {import('../core/params.js').Model} Model
 * @typedef {import('../core/params.js').RequestOptions} RequestOptions
 */

const fetchSorted = (http, path, signal) =>
  http.fetchAll(path, {}, { signal }).then(sortedByName)

/**
 * The list a filter or a filter group shows on, which Zou never lets
 * change.
 * @param {string} listType
 * @returns {string}
 */
const listTypeOf = listType => {
  if (typeof requiredOf('listType', listType) === 'string') return listType
  throw new ParameterError(
    'Wrong format: listType must be a string such as "asset" or "todo"'
  )
}

export const userApi = http => ({
  /**
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} Open projects the user is in the team of
   *   (all of them for an admin), sorted by name.
   */
  allOpenProjects: async ({ signal } = {}) =>
    fetchSorted(http, 'user/projects/open', signal),

  /**
   * @param {Model} project
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} Asset types the user has a task assigned
   *   for in the project, sorted by name.
   */
  allAssetTypesForProject: async (project, { signal } = {}) =>
    fetchSorted(http, `user/projects/${idOf(project)}/asset-types`, signal),

  /**
   * @param {Model} project
   * @param {Model} assetType
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} Assets of the type the user has a task
   *   assigned for in the project, sorted by name.
   */
  allAssetsForAssetTypeAndProject: async (
    project,
    assetType,
    { signal } = {}
  ) =>
    fetchSorted(
      http,
      `user/projects/${idOf(project)}/asset-types/${idOf(assetType)}/assets`,
      signal
    ),

  /**
   * @param {Model} asset
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} Tasks of the user for the asset, sorted by
   *   name.
   */
  allTasksForAsset: async (asset, { signal } = {}) =>
    fetchSorted(http, `user/assets/${idOf(asset)}/tasks`, signal),

  /**
   * @param {Model} shot
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} Tasks of the user for the shot, sorted by
   *   name.
   */
  allTasksForShot: async (shot, { signal } = {}) =>
    fetchSorted(http, `user/shots/${idOf(shot)}/tasks`, signal),

  /**
   * @param {Model} scene
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} Tasks of the user for the scene, sorted by
   *   name.
   */
  allTasksForScene: async (scene, { signal } = {}) =>
    fetchSorted(http, `user/scenes/${idOf(scene)}/tasks`, signal),

  /**
   * @param {Model} sequence
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} Tasks of the user for the sequence, sorted
   *   by name.
   */
  allTasksForSequence: async (sequence, { signal } = {}) =>
    fetchSorted(http, `user/sequences/${idOf(sequence)}/tasks`, signal),

  /**
   * @param {Model} asset
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} Task types of the tasks of the user for the
   *   asset, sorted by name.
   */
  allTaskTypesForAsset: async (asset, { signal } = {}) =>
    fetchSorted(http, `user/assets/${idOf(asset)}/task-types`, signal),

  /**
   * @param {Model} shot
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} Task types of the tasks of the user for the
   *   shot, sorted by name.
   */
  allTaskTypesForShot: async (shot, { signal } = {}) =>
    fetchSorted(http, `user/shots/${idOf(shot)}/task-types`, signal),

  /**
   * @param {Model} scene
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} Task types of the tasks of the user for the
   *   scene, sorted by name.
   */
  allTaskTypesForScene: async (scene, { signal } = {}) =>
    fetchSorted(http, `user/scenes/${idOf(scene)}/task-types`, signal),

  /**
   * @param {Model} sequence
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} Task types of the tasks of the user for the
   *   sequence, sorted by name.
   */
  allTaskTypesForSequence: async (sequence, { signal } = {}) =>
    fetchSorted(http, `user/sequences/${idOf(sequence)}/task-types`, signal),

  /**
   * @param {Model} project
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} Sequences the user has tasks assigned for in
   *   the project, sorted by name.
   */
  allSequencesForProject: async (project, { signal } = {}) =>
    fetchSorted(http, `user/projects/${idOf(project)}/sequences`, signal),

  /**
   * @param {Model} project
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} Episodes the user has tasks assigned for in
   *   the project, sorted by name.
   */
  allEpisodesForProject: async (project, { signal } = {}) =>
    fetchSorted(http, `user/projects/${idOf(project)}/episodes`, signal),

  /**
   * @param {Model} sequence
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} Shots the user has tasks assigned for in the
   *   sequence, sorted by name.
   */
  allShotsForSequence: async (sequence, { signal } = {}) =>
    fetchSorted(http, `user/sequences/${idOf(sequence)}/shots`, signal),

  /**
   * @param {Model} sequence
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} Scenes the user has tasks assigned for in
   *   the sequence, sorted by name.
   */
  allScenesForSequence: async (sequence, { signal } = {}) =>
    fetchSorted(http, `user/sequences/${idOf(sequence)}/scenes`, signal),

  /**
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} Tasks assigned to the user that are not
   *   complete.
   */
  allTasksToDo: async ({ signal } = {}) =>
    http.fetchAll('user/tasks', {}, { signal }),

  /**
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} Tasks assigned to the user that are done.
   */
  allDoneTasks: async ({ signal } = {}) =>
    http.fetchAll('user/done-tasks', {}, { signal }),

  /**
   * @param {Date|string} startDate First day of the range ("YYYY-MM-DD").
   * @param {Date|string} endDate Last day of the range ("YYYY-MM-DD").
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]|null>} Time spents of the user in the range.
   */
  getTimespentsRange: async (startDate, endDate, { signal } = {}) =>
    orNull(
      http.get(
        'data/user/time-spents',
        // Both are required: without them, Zou answers an empty list.
        { start_date: dayOf(startDate), end_date: dayOf(endDate) },
        { signal }
      )
    ),

  /**
   * Log that the user opened a session on a desktop.
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The desktop login log entry.
   */
  logDesktopSessionLogIn: async ({ signal } = {}) =>
    http.post(
      'data/user/desktop-login-logs',
      // Zou stores naive UTC datetimes and does not parse the value.
      { date: new Date().toISOString().replace('Z', '') },
      { signal }
    ),

  /**
   * @param {RequestOptions} [options]
   * @returns {Promise<Record<string, Record<string, Entity[]>>>} Search
   *   filters of the user, and the ones shared with them, by list type
   *   ("asset", "shot", "todo"...), then by project id ("all" for the
   *   filters of no project).
   */
  allFilters: async ({ signal } = {}) =>
    http.fetchAll('user/filters', {}, { signal }),

  /**
   * @param {string} name
   * @param {string} query The search query the filter stores.
   * @param {string} listType "asset", "shot", "edit", "todo"...
   * @param {{project?: Model, entityType?: string|null,
   *   signal?: AbortSignal}} [options] entityType is "Asset", "Shot" or
   *   "Edit".
   * @returns {Promise<Entity>} The created filter.
   */
  newFilter: async (
    name,
    query,
    listType,
    { project, entityType = null, signal } = {}
  ) =>
    http.post(
      'data/user/filters',
      {
        name: requiredOf('name', name),
        query: requiredOf('query', query),
        list_type: listTypeOf(listType),
        project_id: optionalIdOf(project),
        entity_type: entityType
      },
      { signal }
    ),

  /**
   * Only reaches the filters of the user, any filter for an admin: another
   * one rejects with a NotFoundError.
   * @param {Model} filter
   * @param {RequestOptions} [options]
   * @returns {Promise<null>}
   */
  removeFilter: async (filter, { signal } = {}) =>
    http.remove('user/filters', idOf(filter), {}, { signal }),

  /**
   * Zou only changes name, search_query (the query given to newFilter),
   * search_filter_group_id, is_shared, project_id and department_id, and
   * ignores any other key: a query key changes nothing. A filter in a group
   * keeps the is_shared of the group (ParameterError otherwise). Only
   * reaches the filters of the user, any filter for an admin: another one
   * rejects with a NotFoundError.
   * @param {Entity} filter The filter to save, with its id.
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The updated filter.
   */
  updateFilter: async (filter, { signal } = {}) =>
    http.update('user/filters', idOf(filter), filter, { signal }),

  /**
   * @param {RequestOptions} [options]
   * @returns {Promise<Record<string, any>|null>} What an application needs
   *   to start: projects, task types, statuses, persons, filters and settings
   *   visible to the user, each under its own key (projects, task_types,
   *   task_status, persons, search_filters...).
   */
  getContext: async ({ signal } = {}) =>
    orNull(http.get('data/user/context', {}, { signal })),

  /**
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} Tasks waiting for a feedback from the user.
   */
  allTasksRequiringFeedback: async ({ signal } = {}) =>
    http.fetchAll('user/tasks-to-check', {}, { signal }),

  /**
   * @param {RequestOptions} [options]
   * @returns {Promise<Record<string, Record<string, Entity[]>>>} Filter
   *   groups of the user, and the ones shared with them, by list type, then
   *   by project id ("all" for the groups of no project).
   */
  allFilterGroups: async ({ signal } = {}) =>
    http.fetchAll('user/filter-groups', {}, { signal }),

  /**
   * The list type and the entity type of a group are set here only: Zou
   * cannot change them afterwards.
   * @param {string} name
   * @param {string} listType The list the group shows on: "asset", "shot",
   *   "edit", "breakdown", "todo"...
   * @param {{
   *   project?: Model,
   *   color?: string,
   *   isShared?: boolean,
   *   department?: Model,
   *   entityType?: string|null,
   *   signal?: AbortSignal
   * }} [options] color is a hex string such as "#00FF00". isShared shares
   *   the group with the team of the project: Zou turns it off unless the
   *   user manages that project. department keeps the group to the members
   *   of that department and the managers. entityType is "Asset", "Shot" or
   *   "Edit".
   * @returns {Promise<Entity>} The created filter group.
   */
  newFilterGroup: async (
    name,
    listType,
    {
      project,
      color = '',
      isShared = false,
      department,
      entityType = null,
      signal
    } = {}
  ) =>
    http.post(
      'data/user/filter-groups',
      {
        name: requiredOf('name', name),
        list_type: listTypeOf(listType),
        color,
        is_shared: isShared,
        project_id: optionalIdOf(project),
        department_id: optionalIdOf(department),
        entity_type: entityType
      },
      { signal }
    ),

  /**
   * Only reaches the groups of the user, any group for an admin.
   * @param {Model} filterGroup
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity|null>} The filter group, null when missing or
   *   when it belongs to someone else, shared or not.
   */
  getFilterGroup: async (filterGroup, { signal } = {}) =>
    http.fetchOne('user/filter-groups', idOf(filterGroup), { signal }),

  /**
   * Zou only changes name, color, is_shared, project_id and department_id:
   * the list type and the entity type stay. Only reaches the groups of the
   * user, any group for an admin: another one rejects with a NotFoundError.
   * @param {Entity} filterGroup The filter group to save, with its id.
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The updated filter group.
   */
  updateFilterGroup: async (filterGroup, { signal } = {}) =>
    http.update('user/filter-groups', idOf(filterGroup), filterGroup, {
      signal
    }),

  /**
   * Zou deletes the filters of the group with it, whoever they belong to.
   * Only reaches the groups of the user, any group for an admin: another
   * one rejects with a NotFoundError.
   * @param {Model} filterGroup
   * @param {RequestOptions} [options]
   * @returns {Promise<null>}
   */
  removeFilterGroup: async (filterGroup, { signal } = {}) =>
    http.remove('user/filter-groups', idOf(filterGroup), {}, { signal }),

  /**
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} Desktop login logs of the user.
   */
  allDesktopLoginLogs: async ({ signal } = {}) =>
    http.fetchAll('user/desktop-login-logs', {}, { signal }),

  /**
   * @param {Date|string} date The day ("YYYY-MM-DD").
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]|null>} Time spents of the user for the day.
   */
  getTimeSpentsByDate: async (date, { signal } = {}) =>
    orNull(http.get(`data/user/time-spents/${dayOf(date)}`, {}, { signal })),

  /**
   * @param {Model} task
   * @param {Date|string} date The day ("YYYY-MM-DD").
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity|null>} Time spent by the user on the task that
   *   day, null when there is none.
   */
  getTaskTimeSpent: async (task, date, { signal } = {}) => {
    const id = idOf(task)
    // The route of the task answers a 500 when nothing is logged on it that
    // day: the time spents of the day hold at most one per task.
    const timeSpents = await http.get(
      `data/user/time-spents/${dayOf(date)}`,
      {},
      { signal }
    )
    return timeSpents.find(timeSpent => timeSpent.task_id === id) || null
  },

  /**
   * @param {Date|string} date The day ("YYYY-MM-DD").
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity|null>} Day off of the user covering that day,
   *   null when there is none.
   */
  getDayOff: async (date, { signal } = {}) => {
    const dayOff = await http.get(
      `data/user/day-offs/${dayOf(date)}`,
      {},
      { signal }
    )
    // Zou answers an empty object when no day off covers the day.
    return dayOff && dayOff.id ? dayOff : null
  },

  /**
   * List the notifications of the user, most recent first, 100 at most. Zou
   * sorts and filters them to the microsecond but serves their created_at to
   * the second, in UTC without a Z: as before, the created_at of the last one
   * would skip the others of that second. To read the older ones, pass it
   * plus one second, `new Date(Date.parse(created_at + 'Z') + 1000)`, drop
   * the notifications already read, and stop at a page with no new one.
   * @param {{
   *   after?: Date|string,
   *   before?: Date|string,
   *   type?: string,
   *   taskType?: Model,
   *   taskStatus?: Model,
   *   read?: boolean,
   *   watching?: boolean,
   *   signal?: AbortSignal
   * }} [options] A Date for after or before is sent to the second, in UTC.
   *   type is comment, mention, assignation, reply, reply-mention or
   *   playlist-ready. read keeps the read (true) or unread (false) ones,
   *   watching the ones of the tasks the user is subscribed to (true) or
   *   not (false).
   * @returns {Promise<Entity[]>}
   */
  allNotifications: async ({
    after,
    before,
    type,
    taskType,
    taskStatus,
    read,
    watching,
    signal,
    ...others
  } = {}) => {
    refuseUnknownOptions(others)
    return http.fetchAll(
      'user/notifications',
      {
        after: datetimeOf(after),
        before: datetimeOf(before),
        type,
        task_type_id: optionalIdOf(taskType),
        task_status_id: optionalIdOf(taskStatus),
        read,
        watching
      },
      { signal }
    )
  },

  /**
   * @param {Model} notification
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity|null>} The notification, null when missing.
   */
  getNotification: async (notification, { signal } = {}) =>
    http.fetchOne('user/notifications', idOf(notification), { signal }),

  /**
   * @param {Entity} notification The notification to save, with its id.
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The updated notification.
   */
  updateNotification: async (notification, { signal } = {}) =>
    http.update('user/notifications', idOf(notification), notification, {
      signal
    }),

  /**
   * @param {Model} task
   * @param {RequestOptions} [options]
   * @returns {Promise<boolean>} True when the user is subscribed to the task.
   */
  checkTaskSubscription: async (task, { signal } = {}) =>
    http.get(`data/user/tasks/${idOf(task)}/subscribed`, {}, { signal }),

  /**
   * @param {Model} task
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The subscription.
   */
  subscribeToTask: async (task, { signal } = {}) =>
    http.post(`actions/user/tasks/${idOf(task)}/subscribe`, {}, { signal }),

  /**
   * @param {Model} task
   * @param {RequestOptions} [options]
   * @returns {Promise<null>}
   */
  unsubscribeFromTask: async (task, { signal } = {}) =>
    http.del(`actions/user/tasks/${idOf(task)}/unsubscribe`, undefined, {
      signal
    }),

  /**
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} Chats the user takes part in.
   */
  allChats: async ({ signal } = {}) =>
    http.fetchAll('user/chats', {}, { signal }),

  /**
   * @param {Model} entity The entity the chat is about: Zou keys the route
   *   by entity id, not by chat id (the "object_id" of a chat).
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The chat.
   */
  joinChat: async (entity, { signal } = {}) =>
    http.post(`actions/user/chats/${idOf(entity)}/join`, {}, { signal }),

  /**
   * @param {Model} entity The entity the chat is about (see joinChat).
   * @param {RequestOptions} [options]
   * @returns {Promise<null>}
   */
  leaveChat: async (entity, { signal } = {}) =>
    // Leaving is a DELETE on the join route.
    http.del(`actions/user/chats/${idOf(entity)}/join`, undefined, { signal }),

  /**
   * @param {Model} entity The entity the chat is about (see joinChat).
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity|null>} The chat of the entity, null when
   *   missing.
   */
  getChat: async (entity, { signal } = {}) =>
    orNull(http.get(`data/entities/${idOf(entity)}/chat`, {}, { signal })),

  /**
   * @param {Model} entity The entity the chat is about (see joinChat).
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} Messages of the chat of the entity.
   */
  allChatMessages: async (entity, { signal } = {}) =>
    http.get(`data/entities/${idOf(entity)}/chat/messages`, {}, { signal }),

  /**
   * Zou fails (ServerError) on a message that does not exist, and refuses
   * (NotAllowedError) a message of another chat.
   * @param {Model} entity The entity the chat is about (see joinChat).
   * @param {Model} chatMessage
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity|null>} The message, null when the entity does
   *   not exist.
   */
  getChatMessage: async (entity, chatMessage, { signal } = {}) =>
    orNull(
      http.get(
        `data/entities/${idOf(entity)}/chat/messages/${idOf(chatMessage)}`,
        {},
        { signal }
      )
    ),

  /**
   * Post a message in the chat of an entity. The user must have joined the
   * chat first.
   * @param {Model} entity The entity the chat is about (see joinChat).
   * @param {string} message May be empty when attachments are given.
   * @param {{attachments?: Blob|Blob[],
   *   fileName?: string,
   *   onProgress?: (progress: {loaded: number, total: number}) => void,
   *   signal?: AbortSignal}} [options] attachments is one file or a list of
   *   files: with them the message goes as a multipart form. fileName names
   *   the first file: Zou stores a bare Blob as "blob". onProgress only
   *   applies to attachments and needs XMLHttpRequest (browsers, webviews):
   *   fetch cannot report it. A client given its own fetch (Tauri) calls it
   *   only with xhrUploads: true, and a bearer client never for an upload to
   *   the origin of its page.
   * @returns {Promise<Entity>} The created message.
   */
  newChatMessage: async (
    entity,
    message,
    { attachments, fileName, onProgress, signal } = {}
  ) => {
    const path = `data/entities/${idOf(entity)}/chat/messages`
    // A single file has no length: listed, it is sent instead of dropped.
    const files = [].concat(attachments || [])
    // Kitsu and Zou accept a message made of attachments only.
    const isFileOnly = files.length > 0 && message === ''
    const fields = {
      message: isFileOnly ? '' : requiredOf('message', message)
    }
    return files.length
      ? http.upload(path, { file: files, fileName, fields, onProgress, signal })
      : http.post(path, fields, { signal })
  },

  /**
   * @param {Model} entity The entity the chat is about (see joinChat).
   * @param {Model} chatMessage
   * @param {RequestOptions} [options]
   * @returns {Promise<null>}
   */
  removeChatMessage: async (entity, chatMessage, { signal } = {}) =>
    http.del(
      `data/entities/${idOf(entity)}/chat/messages/${idOf(chatMessage)}`,
      undefined,
      { signal }
    ),

  /**
   * @param {RequestOptions} [options]
   * @returns {Promise<Record<string, string[]>|null>} Values available to
   *   filter the tasks waiting for a feedback from the user (see
   *   allTasksRequiringFeedback): the ids in project_ids, task_type_ids,
   *   task_status_ids, episode_ids and person_ids.
   */
  getTasksRequiringFeedbackFilterValues: async ({ signal } = {}) =>
    orNull(http.get('data/user/tasks-to-check/filter-values', {}, { signal })),

  /**
   * @param {Model[]} tasks
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} The subscriptions, one per task.
   */
  subscribeToTasks: async (tasks, { signal } = {}) =>
    http.post(
      'actions/user/tasks/subscribe',
      { task_ids: idsOf(tasks) },
      { signal }
    ),

  /**
   * @param {Model[]} tasks
   * @param {RequestOptions} [options]
   * @returns {Promise<string[]>} Ids of the tasks the user was unsubscribed
   *   from.
   */
  unsubscribeFromTasks: async (tasks, { signal } = {}) =>
    // Unlike unsubscribeFromTask, the bulk route is a POST.
    http.post(
      'actions/user/tasks/unsubscribe',
      { task_ids: idsOf(tasks) },
      { signal }
    ),

  /**
   * @param {RequestOptions} [options]
   * @returns {Promise<null>}
   */
  clearAvatar: async ({ signal } = {}) =>
    http.del('actions/user/clear-avatar', undefined, { signal }),

  /**
   * @param {RequestOptions} [options]
   * @returns {Promise<{success: boolean}>}
   */
  markAllNotificationsAsRead: async ({ signal } = {}) =>
    http.post('actions/user/notifications/mark-all-as-read', {}, { signal })
})
