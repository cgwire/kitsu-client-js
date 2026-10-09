import {
  dateOf,
  dayOf,
  idOf,
  idsOf,
  optionalIdOf,
  orNull,
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
        { start_date: dateOf(startDate), end_date: dateOf(endDate) },
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
   * @returns {Promise<Entity[]>} Search filters of the user.
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
        name,
        query,
        list_type: listType,
        project_id: optionalIdOf(project),
        entity_type: entityType
      },
      { signal }
    ),

  /**
   * @param {Model} filter
   * @param {RequestOptions} [options]
   * @returns {Promise<null>}
   */
  removeFilter: async (filter, { signal } = {}) =>
    http.remove('user/filters', idOf(filter), {}, { signal }),

  /**
   * @param {Entity} filter The filter to save, with its id.
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The updated filter.
   */
  updateFilter: async (filter, { signal } = {}) =>
    http.update('user/filters', idOf(filter), filter, { signal }),

  /**
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity|null>} What an application needs to start:
   *   projects, task types, statuses, persons, filters and settings visible
   *   to the user.
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
   * @returns {Promise<Entity[]>} Filter groups of the user.
   */
  allFilterGroups: async ({ signal } = {}) =>
    http.fetchAll('user/filter-groups', {}, { signal }),

  /**
   * @param {string} name
   * @param {{project?: Model, signal?: AbortSignal}} [options]
   * @returns {Promise<Entity>} The created filter group.
   */
  newFilterGroup: async (name, { project, signal } = {}) =>
    http.post(
      'data/user/filter-groups',
      { name, project_id: optionalIdOf(project) },
      { signal }
    ),

  /**
   * @param {Model} filterGroup
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity|null>} The filter group, null when missing.
   */
  getFilterGroup: async (filterGroup, { signal } = {}) =>
    http.fetchOne('user/filter-groups', idOf(filterGroup), { signal }),

  /**
   * @param {Entity} filterGroup The filter group to save, with its id.
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The updated filter group.
   */
  updateFilterGroup: async (filterGroup, { signal } = {}) =>
    http.update('user/filter-groups', idOf(filterGroup), filterGroup, {
      signal
    }),

  /**
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
  getTaskTimeSpent: async (task, date, { signal } = {}) =>
    orNull(
      http.get(
        `data/user/tasks/${idOf(task)}/time-spents/${dayOf(date)}`,
        {},
        { signal }
      )
    ),

  /**
   * @param {Date|string} date The day ("YYYY-MM-DD").
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity|null>} Day off of the user covering that day,
   *   an empty object when there is none.
   */
  getDayOff: async (date, { signal } = {}) =>
    orNull(http.get(`data/user/day-offs/${dayOf(date)}`, {}, { signal })),

  /**
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} Last notifications of the user.
   */
  allNotifications: async ({ signal } = {}) =>
    http.fetchAll('user/notifications', {}, { signal }),

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
   * @param {Model} entity The entity the chat is about (see joinChat).
   * @param {Model} chatMessage
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity|null>} The message, null when missing.
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
   * @param {{attachments?: Blob[],
   *   onProgress?: (progress: {loaded: number, total: number}) => void,
   *   signal?: AbortSignal}} [options] With attachments the message goes as
   *   a multipart form. onProgress only applies to attachments and needs
   *   XMLHttpRequest (browsers, webviews): fetch cannot report it. A client
   *   given its own fetch (Tauri) uploads through it and never calls
   *   onProgress.
   * @returns {Promise<Entity>} The created message.
   */
  newChatMessage: async (
    entity,
    message,
    { attachments = [], onProgress, signal } = {}
  ) => {
    const path = `data/entities/${idOf(entity)}/chat/messages`
    // Kitsu and Zou accept a message made of attachments only.
    const isFileOnly = attachments.length > 0 && message === ''
    const fields = {
      message: isFileOnly ? '' : requiredOf('message', message)
    }
    return attachments.length
      ? http.upload(path, { file: attachments, fields, onProgress, signal })
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
   * @returns {Promise<Entity|null>} Values available to filter the tasks
   *   waiting for a feedback from the user (see allTasksRequiringFeedback).
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
