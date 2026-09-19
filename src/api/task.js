import { NotFoundError, ParameterError } from '../core/errors.js'
import {
  dayOf,
  idOf,
  idsOf,
  optionalIdOf,
  orNull,
  requiredOf,
  sortedByName,
  withoutNil
} from '../core/params.js'
import * as urls from '../utils/urls.js'

/**
 * @typedef {import('../core/params.js').Entity} Entity
 * @typedef {import('../core/params.js').Model} Model
 * @typedef {import('../core/params.js').RequestOptions} RequestOptions
 * @typedef {{relations?: boolean, signal?: AbortSignal}} RelationsOptions
 * @typedef {{forEntity?: string, department?: Model,
 *   signal?: AbortSignal}} TaskTypeFilters
 * @typedef {{
 *   fileName?: string,
 *   onProgress?: (progress: {loaded: number, total: number}) => void,
 *   signal?: AbortSignal
 * }} TransferOptions fileName names the first file sent: a bare Blob has no
 *   name, and a preview needs one, Zou reads the preview type from the
 *   extension of the file name. onProgress needs XMLHttpRequest (browsers,
 *   webviews).
 * @typedef {{
 *   comment?: string,
 *   person?: Model,
 *   checklist?: object[],
 *   attachments?: Blob[],
 *   createdAt?: string,
 *   links?: string[]
 * }} CommentFields person is the author, checklist holds entries like
 *   {text: "Item 1", checked: false}, createdAt is the comment date.
 */

const HEX_COLOR = /^#[0-9a-fA-F]*$/

/**
 * FormData names a bare Blob "blob", and Zou reads the preview type from the
 * extension of the file name: it would refuse the upload, after the comment
 * and the preview entry were created. Same for a file that is not a Blob (a
 * path string, the gazu habit, or the null of canvas.toBlob): FormData would
 * refuse it that late too, whether a fileName is given or not.
 * @param {Blob & {name?: string}} file
 * @param {string} [fileName]
 * @returns {Blob}
 */
const namedPreviewOf = (file, fileName) => {
  const given = requiredOf('file', file)
  if (!(given instanceof Blob)) {
    throw new ParameterError('Wrong format: file must be a Blob or a File')
  }
  if (fileName || given.name) return given
  throw new ParameterError(
    'Missing parameter: fileName is required when the file has no name'
  )
}

export const taskApi = http => {
  /**
   * @param {Model} entity
   * @param {string} collection
   * @param {string} suffix
   * @param {RelationsOptions} [options]
   */
  const allTasksForEntity = (
    entity,
    collection,
    suffix,
    { relations = false, signal } = {}
  ) =>
    http
      .fetchAll(
        `${collection}/${idOf(entity)}/${suffix}`,
        { relations: relations ? true : null },
        { signal }
      )
      .then(sortedByName)

  /**
   * @param {Model} entity
   * @param {string} collection
   * @param {RequestOptions} [options]
   */
  const allTaskTypesForEntity = (entity, collection, { signal } = {}) =>
    http
      .fetchAll(`${collection}/${idOf(entity)}/task-types`, {}, { signal })
      .then(sortedByName)

  const commentPath = (prefix, task, comment) =>
    `${prefix}/tasks/${idOf(task)}/comments/${idOf(comment)}`

  /**
   * @param {Model} project
   * @param {string} suffix
   * @param {RequestOptions} [options]
   */
  const allForProject = (project, suffix, { signal } = {}) =>
    http.fetchAll(`projects/${idOf(project)}/${suffix}`, {}, { signal })

  const timeSpentPath = (task, person, date) =>
    `actions/tasks/${idOf(task)}/time-spents/${dayOf(date)}/persons/${idOf(person)}`

  /**
   * @param {Model} entity
   * @param {Model} taskType
   * @param {{name?: string, signal?: AbortSignal}} [options]
   * @returns {Promise<Entity|null>} The task of the entity for this task type
   *   and name, null when missing.
   */
  const getTaskByEntity = async (
    entity,
    taskType,
    { name = 'main', signal } = {}
  ) =>
    http.fetchFirst(
      'tasks',
      {
        name: requiredOf('name', name),
        task_type_id: idOf(taskType),
        entity_id: idOf(entity)
      },
      { signal }
    )

  /**
   * @param {string} name
   * @param {TaskTypeFilters} [options] forEntity is the entity type the task
   *   type applies to ("Asset", "Shot", ...).
   * @returns {Promise<Entity|null>} First task type matching the name.
   */
  const getTaskTypeByName = async (
    name,
    { forEntity, department, signal } = {}
  ) =>
    http.fetchFirst(
      'task-types',
      {
        name: requiredOf('name', name),
        for_entity: forEntity,
        department_id: optionalIdOf(department)
      },
      { signal }
    )

  /**
   * @param {RequestOptions} [options]
   * @returns {Promise<{id: string}|null>} The task status flagged as default.
   */
  const getDefaultTaskStatus = async ({ signal } = {}) =>
    http.fetchFirst('task-status', { is_default: true }, { signal })

  /**
   * @param {string} shortName
   * @param {RequestOptions} [options]
   * @returns {Promise<{id: string}|null>} First task status matching the
   *   short name.
   */
  const getTaskStatusByShortName = async (shortName, { signal } = {}) =>
    http.fetchFirst(
      'task-status',
      { short_name: requiredOf('shortName', shortName) },
      { signal }
    )

  /**
   * @param {Model} task
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity|null>} The task with its relations, null when it
   *   does not exist.
   */
  const getTask = async (task, { signal } = {}) =>
    orNull(http.get(`data/tasks/${idOf(task)}/full`, {}, { signal }))

  /**
   * Save the task. Its metadata are fully replaced by the given ones.
   * @param {{id: string, assignees?: Model[]|null, [field: string]: any}} task
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The updated task.
   */
  const updateTask = async (task, { signal } = {}) =>
    http.update(
      'tasks',
      idOf(task),
      'assignees' in task
        ? { ...task, assignees: idsOf(task.assignees || []) }
        : task,
      { signal }
    )

  /**
   * @param {Model} entity
   * @param {Model[]} taskTypes
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} The created tasks, one per task type.
   */
  const createEntityTasks = async (entity, taskTypes, { signal } = {}) =>
    http.post(
      `data/entities/${idOf(entity)}/tasks`,
      { task_type_ids: idsOf(taskTypes) },
      { signal }
    )

  /**
   * Comment the task: every comment sets the status of the task. The text
   * can be empty. Sent as JSON, or as a multipart form when there are
   * attachments.
   * @param {Model} task
   * @param {Model} taskStatus
   * @param {CommentFields & TransferOptions & {forClient?: boolean}} [options]
   *   forClient makes the comment visible to clients (managers only).
   * @returns {Promise<Entity>} The created comment.
   */
  const addComment = async (
    task,
    taskStatus,
    {
      comment = '',
      person,
      checklist = [],
      attachments,
      createdAt,
      links = [],
      forClient = false,
      fileName,
      onProgress,
      signal
    } = {}
  ) => {
    const path = `actions/tasks/${idOf(task)}/comment`
    const data = {
      task_status_id: idOf(taskStatus),
      comment,
      checklist,
      links,
      person_id: optionalIdOf(person),
      created_at: createdAt
    }
    if (!attachments || attachments.length === 0) {
      return http.post(path, withoutNil({ ...data, for_client: forClient }), {
        signal
      })
    }
    // Form parts are strings, and a Zou reading for_client with bool(str)
    // takes "false" as true: it is left out, the API defaults it to false.
    return http.upload(path, {
      file: attachments,
      fields: { ...data, for_client: forClient ? true : null },
      fileName,
      onProgress,
      signal
    })
  }

  /**
   * Create the preview file entry of a comment. Its content is uploaded
   * afterwards.
   * @param {Model} task
   * @param {Model} comment
   * @param {{revision?: number, signal?: AbortSignal}} [options]
   * @returns {Promise<Entity>} The created preview file.
   */
  const createPreview = async (task, comment, { revision, signal } = {}) =>
    http.post(
      `${commentPath('actions', task, comment)}/add-preview`,
      withoutNil({ revision }),
      { signal }
    )

  /**
   * Create one more preview file entry on a comment, sharing the revision
   * of the given preview file. Its content is uploaded afterwards.
   * @param {Model} task
   * @param {Model} comment
   * @param {Model} previewFile
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The created preview file.
   */
  const createExtraPreview = async (
    task,
    comment,
    previewFile,
    { signal } = {}
  ) =>
    http.post(
      `${commentPath('actions', task, comment)}/preview-files/${idOf(previewFile)}`,
      {},
      { signal }
    )

  /**
   * Use the preview as the thumbnail of its entity.
   * @param {Model} previewFile
   * @param {{frameNumber?: number, signal?: AbortSignal}} [options]
   *   frameNumber picks the frame of a movie preview.
   * @returns {Promise<Entity>} The preview file.
   */
  const setMainPreview = async (previewFile, { frameNumber, signal } = {}) =>
    http.put(
      `actions/preview-files/${idOf(previewFile)}/set-main-preview`,
      withoutNil({ frame_number: frameNumber }),
      { signal }
    )

  /**
   * Upload the content of a preview file entry (see createPreview).
   * @param {Model} previewFile
   * @param {Blob} file The picture, movie or any other file, a Blob or a
   *   File. A bare Blob needs fileName.
   * @param {TransferOptions & {normalizeMovie?: boolean}} [options]
   *   normalizeMovie set to false keeps the movie as it is on the server.
   * @returns {Promise<Entity>} The preview file.
   */
  const uploadPreviewFile = async (
    previewFile,
    file,
    { normalizeMovie = true, fileName, onProgress, signal } = {}
  ) =>
    http.upload(`pictures/preview-files/${idOf(previewFile)}`, {
      file: namedPreviewOf(file, fileName),
      fileName,
      query: { normalize: normalizeMovie ? null : false },
      onProgress,
      signal
    })

  /**
   * Add a preview to a comment: create the entry, then upload its content.
   * @param {Model} task
   * @param {Model} comment
   * @param {Blob} file The picture, movie or any other file, a Blob or a
   *   File. A bare Blob needs fileName.
   * @param {TransferOptions & {normalizeMovie?: boolean, revision?: number}}
   *   [options] normalizeMovie set to false keeps the movie as it is on the
   *   server.
   * @returns {Promise<Entity>} The created preview file.
   */
  const addPreview = async (
    task,
    comment,
    file,
    { normalizeMovie, revision, fileName, onProgress, signal } = {}
  ) => {
    namedPreviewOf(file, fileName)
    const created = await createPreview(task, comment, { revision, signal })
    return uploadPreviewFile(created, file, {
      normalizeMovie,
      fileName,
      onProgress,
      signal
    })
  }

  return {
    /**
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} All task statuses, sorted by name.
     */
    allTaskStatuses: async ({ signal } = {}) =>
      http.fetchAll('task-status', {}, { signal }).then(sortedByName),

    /**
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} All task types, sorted by name.
     */
    allTaskTypes: async ({ signal } = {}) =>
      http.fetchAll('task-types', {}, { signal }).then(sortedByName),

    /**
     * @param {Model} project
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} Task types of the project, sorted by name.
     */
    allTaskTypesForProject: async (project, options) =>
      allTaskTypesForEntity(project, 'projects', options),

    /**
     * @param {Model} project
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} Task statuses of the project, sorted by
     *   name.
     */
    allTaskStatusesForProject: async (project, { signal } = {}) =>
      http
        .fetchAll(
          `projects/${idOf(project)}/settings/task-status`,
          {},
          { signal }
        )
        .then(sortedByName),

    /**
     * @param {Model} shot
     * @param {RelationsOptions} [options]
     * @returns {Promise<Entity[]>} Tasks of the shot, sorted by name.
     */
    allTasksForShot: async (shot, options) =>
      allTasksForEntity(shot, 'shots', 'tasks', options),

    /**
     * @param {Model} concept
     * @param {RelationsOptions} [options]
     * @returns {Promise<Entity[]>} Tasks of the concept, sorted by name.
     */
    allTasksForConcept: async (concept, options) =>
      allTasksForEntity(concept, 'concepts', 'tasks', options),

    /**
     * @param {Model} edit
     * @param {RelationsOptions} [options]
     * @returns {Promise<Entity[]>} Tasks of the edit, sorted by name.
     */
    allTasksForEdit: async (edit, options) =>
      allTasksForEntity(edit, 'edits', 'tasks', options),

    /**
     * @param {Model} sequence
     * @param {RelationsOptions} [options]
     * @returns {Promise<Entity[]>} Tasks of the sequence, sorted by name.
     */
    allTasksForSequence: async (sequence, options) =>
      allTasksForEntity(sequence, 'sequences', 'tasks', options),

    /**
     * @param {Model} scene
     * @param {RelationsOptions} [options]
     * @returns {Promise<Entity[]>} Tasks of the scene, sorted by name.
     */
    allTasksForScene: async (scene, options) =>
      allTasksForEntity(scene, 'scenes', 'tasks', options),

    /**
     * @param {Model} asset
     * @param {RelationsOptions} [options]
     * @returns {Promise<Entity[]>} Tasks of the asset, sorted by name.
     */
    allTasksForAsset: async (asset, options) =>
      allTasksForEntity(asset, 'assets', 'tasks', options),

    /**
     * @param {Model} episode
     * @param {RelationsOptions} [options]
     * @returns {Promise<Entity[]>} Tasks of the episode, sorted by name.
     */
    allTasksForEpisode: async (episode, options) =>
      allTasksForEntity(episode, 'episodes', 'tasks', options),

    /**
     * @param {Model} sequence
     * @param {RelationsOptions} [options]
     * @returns {Promise<Entity[]>} Tasks of every shot of the sequence, sorted
     *   by name.
     */
    allShotTasksForSequence: async (sequence, options) =>
      allTasksForEntity(sequence, 'sequences', 'shot-tasks', options),

    /**
     * @param {Model} episode
     * @param {RelationsOptions} [options]
     * @returns {Promise<Entity[]>} Tasks of every shot of the episode, sorted
     *   by name.
     */
    allShotTasksForEpisode: async (episode, options) =>
      allTasksForEntity(episode, 'episodes', 'shot-tasks', options),

    /**
     * @param {Model} episode
     * @param {RelationsOptions} [options]
     * @returns {Promise<Entity[]>} Tasks of every asset of the episode, sorted
     *   by name.
     */
    allAssetsTasksForEpisode: async (episode, options) =>
      allTasksForEntity(episode, 'episodes', 'asset-tasks', options),

    /**
     * @param {Model} project
     * @param {Model} taskType
     * @param {Model} taskStatus
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} Tasks of the project set at this status for
     *   this task type.
     */
    allTasksForTaskStatus: async (
      project,
      taskType,
      taskStatus,
      { signal } = {}
    ) =>
      http.fetchAll(
        'tasks',
        {
          project_id: idOf(project),
          task_type_id: idOf(taskType),
          task_status_id: idOf(taskStatus)
        },
        { signal }
      ),

    /**
     * @param {Model} project
     * @param {Model} taskType
     * @param {{episode?: Model, signal?: AbortSignal}} [options]
     * @returns {Promise<Entity[]>} Tasks of the project for this task type.
     */
    allTasksForTaskType: async (project, taskType, { episode, signal } = {}) =>
      http.fetchAll(
        'tasks',
        {
          project_id: idOf(project),
          task_type_id: idOf(taskType),
          episode_id: optionalIdOf(episode)
        },
        { signal }
      ),

    /**
     * @param {Model} shot
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} Task types of the shot tasks, sorted by
     *   name.
     */
    allTaskTypesForShot: async (shot, options) =>
      allTaskTypesForEntity(shot, 'shots', options),

    /**
     * @param {Model} concept
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} Task types of the concept tasks, sorted by
     *   name.
     */
    allTaskTypesForConcept: async (concept, options) =>
      allTaskTypesForEntity(concept, 'concepts', options),

    /**
     * @param {Model} asset
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} Task types of the asset tasks, sorted by
     *   name.
     */
    allTaskTypesForAsset: async (asset, options) =>
      allTaskTypesForEntity(asset, 'assets', options),

    /**
     * @param {Model} scene
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} Task types of the scene tasks, sorted by
     *   name.
     */
    allTaskTypesForScene: async (scene, options) =>
      allTaskTypesForEntity(scene, 'scenes', options),

    /**
     * @param {Model} sequence
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} Task types of the sequence tasks, sorted by
     *   name.
     */
    allTaskTypesForSequence: async (sequence, options) =>
      allTaskTypesForEntity(sequence, 'sequences', options),

    /**
     * @param {Model} episode
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} Task types of the episode tasks, sorted by
     *   name.
     */
    allTaskTypesForEpisode: async (episode, options) =>
      allTaskTypesForEntity(episode, 'episodes', options),

    /**
     * @param {Model} entity
     * @param {Model} taskType
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} Tasks of the entity for this task type.
     */
    allTasksForEntityAndTaskType: async (entity, taskType, { signal } = {}) =>
      http.fetchAll(
        `entities/${idOf(entity)}/task-types/${idOf(taskType)}/tasks`,
        {},
        { signal }
      ),

    /**
     * @param {Model} person
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} Tasks of the person that are not done, in
     *   open projects only.
     */
    allTasksForPerson: async (person, { signal } = {}) =>
      http.fetchAll(`persons/${idOf(person)}/tasks`, {}, { signal }),

    /**
     * @param {Model} person
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} Tasks of the person that are done, in open
     *   projects only.
     */
    allDoneTasksForPerson: async (person, { signal } = {}) =>
      http.fetchAll(`persons/${idOf(person)}/done-tasks`, {}, { signal }),

    /**
     * @param {Model} person
     * @param {Model} taskType
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} Tasks of the person for this task type.
     */
    allTasksForPersonAndType: async (person, taskType, { signal } = {}) =>
      http.fetchAll(
        `persons/${idOf(person)}/related-tasks/${idOf(taskType)}`,
        {},
        { signal }
      ),

    /**
     * @param {Model} project
     * @param {{taskType?: Model, episode?: Model, signal?: AbortSignal}}
     *   [options]
     * @returns {Promise<Entity[]>} Tasks of the project.
     */
    allTasksForProject: async (project, { taskType, episode, signal } = {}) =>
      http.fetchAll(
        `projects/${idOf(project)}/tasks`,
        {
          task_type_id: optionalIdOf(taskType),
          episode_id: optionalIdOf(episode)
        },
        { signal }
      ),

    /**
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} All open tasks.
     */
    allOpenTasks: async ({ signal } = {}) =>
      http.fetchAll('tasks/open-tasks', {}, { signal }),

    /**
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity|null>} Statistics of the open tasks.
     */
    getOpenTasksStats: async ({ signal } = {}) =>
      orNull(http.get('data/tasks/open-tasks/stats', {}, { signal })),

    /**
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity|null>} For each person, the first and last task
     *   start and due dates.
     */
    getPersonsTasksDates: async ({ signal } = {}) =>
      orNull(http.get('data/persons/task-dates', {}, { signal })),

    getTaskByEntity,

    /**
     * @param {Model} taskType
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity|null>} The task type, null when missing.
     */
    getTaskType: async (taskType, { signal } = {}) =>
      http.fetchOne('task-types', idOf(taskType), { signal }),

    getTaskTypeByName,

    /**
     * @param {string} shortName
     * @param {TaskTypeFilters} [options]
     * @returns {Promise<Entity|null>} First task type matching the short name.
     */
    getTaskTypeByShortName: async (
      shortName,
      { forEntity, department, signal } = {}
    ) =>
      http.fetchFirst(
        'task-types',
        {
          short_name: requiredOf('shortName', shortName),
          for_entity: forEntity,
          department_id: optionalIdOf(department)
        },
        { signal }
      ),

    getDefaultTaskStatus,

    /**
     * @param {Model} taskStatus
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity|null>} The task status, null when missing.
     */
    getTaskStatus: async (taskStatus, { signal } = {}) =>
      http.fetchOne('task-status', idOf(taskStatus), { signal }),

    /**
     * @param {string} name
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity|null>} First task status matching the name.
     */
    getTaskStatusByName: async (name, { signal } = {}) =>
      http.fetchFirst(
        'task-status',
        { name: requiredOf('name', name) },
        { signal }
      ),

    getTaskStatusByShortName,

    /**
     * @param {Model} taskType
     * @param {{force?: boolean, signal?: AbortSignal}} [options] force deletes
     *   the type even when tasks use it. A type attached to a project must be
     *   detached first.
     * @returns {Promise<null>}
     */
    removeTaskType: async (taskType, { force = false, signal } = {}) =>
      http.remove(
        'task-types',
        idOf(taskType),
        { force: force ? true : null },
        { signal }
      ),

    /**
     * @param {Model} taskStatus
     * @param {RequestOptions} [options]
     * @returns {Promise<null>}
     */
    removeTaskStatus: async (taskStatus, { signal } = {}) =>
      http.remove('task-status', idOf(taskStatus), { force: true }, { signal }),

    /**
     * @param {{id: string}} taskType
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The updated task type.
     */
    updateTaskType: async (taskType, { signal } = {}) =>
      http.update('task-types', idOf(taskType), taskType, { signal }),

    /**
     * @param {{id: string}} taskStatus
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The updated task status.
     */
    updateTaskStatus: async (taskStatus, { signal } = {}) =>
      http.update('task-status', idOf(taskStatus), taskStatus, { signal }),

    getTask,

    /**
     * Create a task, or return the task that already exists for the same
     * entity, task type and name (its status and assignees are then left as
     * they are).
     * @param {string|{id: string, project_id?: string}} entity The entity is
     *   fetched when only its id is given: the task needs its project.
     * @param {Model} taskType
     * @param {{name?: string, taskStatus?: Model, assigner?: Model,
     *   assignees?: Model[], signal?: AbortSignal}} [options] taskStatus
     *   defaults to the default task status.
     * @returns {Promise<Entity>} The created or existing task.
     */
    newTask: async (
      entity,
      taskType,
      { name = 'main', taskStatus, assigner, assignees, signal } = {}
    ) => {
      const existing = await getTaskByEntity(entity, taskType, { name, signal })
      if (existing) return existing
      const { project_id } =
        typeof entity === 'object' && entity.project_id
          ? entity
          : await http.get(`data/entities/${idOf(entity)}`, {}, { signal })
      const status = taskStatus || (await getDefaultTaskStatus({ signal }))
      if (!status) {
        throw new NotFoundError(
          'No default task status: give one in the taskStatus option'
        )
      }
      return http.create(
        'tasks',
        withoutNil({
          project_id,
          entity_id: idOf(entity),
          task_type_id: idOf(taskType),
          task_status_id: idOf(status),
          assignees: idsOf(assignees),
          name,
          assigner_id: optionalIdOf(assigner)
        }),
        { signal }
      )
    },

    /**
     * @param {Model} task
     * @param {RequestOptions} [options]
     * @returns {Promise<null>}
     */
    removeTask: async (task, { signal } = {}) =>
      http.remove('tasks', idOf(task), { force: true }, { signal }),

    /**
     * Create a task type, or return the one that already has this name for
     * this entity type.
     * @param {string} name
     * @param {{color?: string, forEntity?: string, signal?: AbortSignal}}
     *   [options] color is hexadecimal with a leading # ("#00FF00").
     * @returns {Promise<Entity>} The created or existing task type.
     */
    newTaskType: async (
      name,
      { color = '#000000', forEntity = 'Asset', signal } = {}
    ) =>
      (await getTaskTypeByName(name, { forEntity, signal })) ||
      http.create(
        'task-types',
        { name, color, for_entity: forEntity },
        { signal }
      ),

    /**
     * @param {string} name
     * @param {string} shortName
     * @param {string} color Hexadecimal with a leading # ("#00FF00").
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The created task status.
     */
    newTaskStatus: async (name, shortName, color, { signal } = {}) => {
      if (typeof color !== 'string' || !HEX_COLOR.test(color)) {
        throw new ParameterError(
          "Color must be a hexadecimal string starting with '#', e.g. '#00FF00'"
        )
      }
      return http.create(
        'task-status',
        { name, short_name: shortName, color },
        { signal }
      )
    },

    updateTask,

    /**
     * Merge data into the metadata of the task: keys that are not given are
     * left unchanged.
     * @param {Model} task
     * @param {object} [data]
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The updated task.
     */
    updateTaskData: async (task, data = {}, { signal } = {}) => {
      const current = await http.get(
        `data/tasks/${idOf(task)}/full`,
        {},
        { signal }
      )
      return updateTask(
        { id: current.id, data: { ...current.data, ...data } },
        { signal }
      )
    },

    /**
     * @param {Model} task
     * @param {Model} person
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} The assigned tasks.
     */
    assignTask: async (task, person, { signal } = {}) =>
      http.put(
        `actions/persons/${idOf(person)}/assign`,
        { task_ids: [idOf(task)] },
        { signal }
      ),

    /**
     * @param {Model[]} tasks
     * @param {Model} person
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} The assigned tasks.
     */
    assignTasksToPerson: async (tasks, person, { signal } = {}) =>
      http.put(
        `actions/persons/${idOf(person)}/assign`,
        { task_ids: idsOf(tasks) },
        { signal }
      ),

    /**
     * @param {Model|Model[]} tasks One task or a list of tasks.
     * @param {{person?: Model, signal?: AbortSignal}} [options] Without
     *   person, every assignation of the tasks is cleared.
     * @returns {Promise<string[]>} Ids of the tasks that changed.
     */
    clearAssignations: async (tasks, { person, signal } = {}) => {
      const taskIds = idsOf(Array.isArray(tasks) ? tasks : [tasks])
      if (taskIds.length === 0) return []
      return http.put(
        'actions/tasks/clear-assignation',
        withoutNil({ task_ids: taskIds, person_id: optionalIdOf(person) }),
        { signal }
      )
    },

    /**
     * Delete every task of a task type in a project.
     * @param {Model} project
     * @param {Model} taskType
     * @param {RequestOptions} [options]
     * @returns {Promise<null>}
     */
    removeTasksForType: async (project, taskType, { signal } = {}) =>
      http.del(
        `actions/projects/${idOf(project)}/task-types/${idOf(taskType)}/delete-tasks`,
        undefined,
        { signal }
      ),

    /**
     * @param {Model} project
     * @param {Model[]} tasks
     * @param {RequestOptions} [options]
     * @returns {Promise<string[]>} Ids of the deleted tasks.
     */
    removeTasksBatch: async (project, tasks, { signal } = {}) =>
      http.post(
        `actions/projects/${idOf(project)}/delete-tasks`,
        idsOf(tasks),
        { signal }
      ),

    /**
     * @param {Model} shot
     * @param {Model[]} taskTypes
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} The created tasks, one per task type.
     */
    createShotTasks: async (shot, taskTypes, options) =>
      createEntityTasks(shot, taskTypes, options),

    /**
     * @param {Model} asset
     * @param {Model[]} taskTypes
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} The created tasks, one per task type.
     */
    createAssetTasks: async (asset, taskTypes, options) =>
      createEntityTasks(asset, taskTypes, options),

    /**
     * @param {Model} edit
     * @param {Model[]} taskTypes
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} The created tasks, one per task type.
     */
    createEditTasks: async (edit, taskTypes, options) =>
      createEntityTasks(edit, taskTypes, options),

    /**
     * @param {Model} concept
     * @param {Model[]} taskTypes
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} The created tasks, one per task type.
     */
    createConceptTasks: async (concept, taskTypes, options) =>
      createEntityTasks(concept, taskTypes, options),

    createEntityTasks,

    /**
     * Comment the task to set it to the started status and set its real start
     * date to now.
     * @param {Model} task
     * @param {{startedTaskStatus?: Model, person?: Model,
     *   signal?: AbortSignal}} [options] startedTaskStatus defaults to the
     *   status whose short name is "wip"; person is the comment author.
     * @returns {Promise<Entity>} The created comment.
     */
    startTask: async (task, { startedTaskStatus, person, signal } = {}) => {
      const status =
        startedTaskStatus || (await getTaskStatusByShortName('wip', { signal }))
      if (!status) {
        throw new NotFoundError(
          "No 'wip' task status: give one in the startedTaskStatus option"
        )
      }
      return addComment(task, status, { person, signal })
    },

    addComment,

    /**
     * @param {Model} task
     * @param {Model} comment
     * @param {Blob|Blob[]} attachments One file or a list of files.
     * @param {TransferOptions} [options]
     * @returns {Promise<Entity[]>} The added attachment files.
     */
    addAttachmentFilesToComment: async (
      task,
      comment,
      attachments,
      { fileName, onProgress, signal } = {}
    ) => {
      const files = [].concat(attachments || [])
      if (files.length === 0) {
        throw new ParameterError('The attachments list is empty')
      }
      return http.upload(
        `${commentPath('actions', task, comment)}/add-attachment`,
        { file: files, fileName, onProgress, signal }
      )
    },

    uploadPreviewFile,

    /**
     * @param {Model} task
     * @param {{date?: Date|string, signal?: AbortSignal}} [options] date is a
     *   Date or "YYYY-MM-DD".
     * @returns {Promise<Entity|null>} Time spent per person id, in minutes,
     *   with the total. Null when the task does not exist.
     */
    getTimeSpent: async (task, { date, signal } = {}) => {
      const path = `actions/tasks/${idOf(task)}/time-spents`
      return orNull(
        http.get(date ? `${path}/${dayOf(date)}` : path, {}, { signal })
      )
    },

    /**
     * @param {Model} task
     * @param {Date|string} date A Date or "YYYY-MM-DD".
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity|null>} Time spent on the task at this date.
     */
    getTaskTimeSpentForDate: async (task, date, { signal } = {}) =>
      orNull(
        http.get(
          `actions/tasks/${idOf(task)}/time-spents/${dayOf(date)}`,
          {},
          { signal }
        )
      ),

    /**
     * @param {Model} task
     * @param {Model} person
     * @param {Date|string} date A Date or "YYYY-MM-DD".
     * @param {number} duration In minutes.
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The time spent entry.
     */
    setTimeSpent: async (task, person, date, duration, { signal } = {}) =>
      http.post(timeSpentPath(task, person, date), { duration }, { signal }),

    /**
     * Add the duration to the time already logged at this date.
     * @param {Model} task
     * @param {Model} person
     * @param {Date|string} date A Date or "YYYY-MM-DD".
     * @param {number} duration In minutes.
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The updated time spent entry.
     */
    addTimeSpent: async (task, person, date, duration, { signal } = {}) =>
      http.post(
        `${timeSpentPath(task, person, date)}/add`,
        { duration },
        { signal }
      ),

    /**
     * @param {Model} timeSpent
     * @param {RequestOptions} [options]
     * @returns {Promise<null>}
     */
    removeTimeSpent: async (timeSpent, { signal } = {}) =>
      http.remove('time-spents', idOf(timeSpent), {}, { signal }),

    /**
     * @param {Model} comment
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity|null>} The comment, null when missing.
     */
    getComment: async (comment, { signal } = {}) =>
      http.fetchOne('comments', idOf(comment), { signal }),

    /**
     * Delete the comment with its previews, news and notifications.
     * @param {Model} comment
     * @param {RequestOptions} [options]
     * @returns {Promise<null>}
     */
    removeComment: async (comment, { signal } = {}) =>
      http.remove('comments', idOf(comment), {}, { signal }),

    /**
     * @param {{id: string}} comment
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The updated comment.
     */
    updateComment: async (comment, { signal } = {}) =>
      http.update('comments', idOf(comment), comment, { signal }),

    /**
     * @param {Model} task
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} Comments of the task, newest first.
     */
    allCommentsForTask: async (task, { signal } = {}) =>
      http.fetchAll(`tasks/${idOf(task)}/comments`, {}, { signal }),

    /**
     * @param {Model} task
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity|null>} Last comment posted on the task.
     */
    getLastCommentForTask: async (task, { signal } = {}) =>
      http.fetchFirst(`tasks/${idOf(task)}/comments`, {}, { signal }),

    /**
     * @param {Model} task
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} Previews of the task.
     */
    allPreviewsForTask: async (task, { signal } = {}) =>
      http.fetchAll(`tasks/${idOf(task)}/previews`, {}, { signal }),

    /**
     * @param {Model} project
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} Comments of the project.
     */
    allCommentsForProject: async (project, options) =>
      allForProject(project, 'comments', options),

    /**
     * @param {Model} project
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} Notifications of the project.
     */
    allNotificationsForProject: async (project, options) =>
      allForProject(project, 'notifications', options),

    /**
     * @param {Model} project
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} Preview files of the project.
     */
    allPreviewFilesForProject: async (project, options) =>
      allForProject(project, 'preview-files', options),

    /**
     * @param {Model} project
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} Subscriptions of the project.
     */
    allSubscriptionsForProject: async (project, options) =>
      allForProject(project, 'subscriptions', options),

    createPreview,

    createExtraPreview,

    addPreview,

    /**
     * Add one more preview to a comment: create the entry, which shares the
     * revision of the given preview file, then upload its content.
     * @param {Model} task
     * @param {Model} comment
     * @param {Model} previewFile The preview file whose revision is shared.
     * @param {Blob} file The picture, movie or any other file, a Blob or a
     *   File. A bare Blob needs fileName.
     * @param {TransferOptions & {normalizeMovie?: boolean}} [options]
     *   normalizeMovie set to false keeps the movie as it is on the server.
     * @returns {Promise<Entity>} The created preview file.
     */
    addExtraPreview: async (
      task,
      comment,
      previewFile,
      file,
      { normalizeMovie, fileName, onProgress, signal } = {}
    ) => {
      namedPreviewOf(file, fileName)
      const created = await createExtraPreview(task, comment, previewFile, {
        signal
      })
      return uploadPreviewFile(created, file, {
        normalizeMovie,
        fileName,
        onProgress,
        signal
      })
    },

    /**
     * Comment the task, which sets its status, then add the preview to the
     * comment.
     * @param {Model} task
     * @param {Model} taskStatus
     * @param {Blob} file The preview: a picture, a movie or any other file, a
     *   Blob or a File. A bare Blob needs fileName.
     * @param {CommentFields & TransferOptions & {normalizeMovie?: boolean,
     *   revision?: number, setThumbnail?: boolean}} [options] fileName and
     *   onProgress apply to the preview, not to the attachments.
     *   normalizeMovie set to false keeps the movie as it is on the server;
     *   setThumbnail uses the preview as the thumbnail of the entity.
     * @returns {Promise<{comment: Entity, preview_file: Entity}>} The created
     *   comment and the created preview file.
     */
    publishPreview: async (
      task,
      taskStatus,
      file,
      {
        comment,
        person,
        checklist,
        attachments,
        createdAt,
        links,
        normalizeMovie,
        revision,
        setThumbnail = false,
        fileName,
        onProgress,
        signal
      } = {}
    ) => {
      namedPreviewOf(file, fileName)
      const newComment = await addComment(task, taskStatus, {
        comment,
        person,
        checklist,
        attachments,
        createdAt,
        links,
        signal
      })
      const previewFile = await addPreview(task, newComment, file, {
        normalizeMovie,
        revision,
        fileName,
        onProgress,
        signal
      })
      if (setThumbnail) await setMainPreview(previewFile, { signal })
      return { comment: newComment, preview_file: previewFile }
    },

    /**
     * @param {Model} task
     * @param {Model} comment
     * @param {Model} previewFile
     * @param {RequestOptions} [options]
     * @returns {Promise<null>}
     */
    removePreviewFromComment: async (
      task,
      comment,
      previewFile,
      { signal } = {}
    ) =>
      http.del(
        `${commentPath('actions', task, comment)}/preview-files/${idOf(previewFile)}`,
        undefined,
        { signal }
      ),

    setMainPreview,

    /**
     * Publish several comments in one request. Without task, every comment
     * carries its own task_id.
     * @param {object[]} [comments]
     * @param {{task?: Model, signal?: AbortSignal}} [options]
     * @returns {Promise<Entity[]>} The created comments.
     */
    batchComments: async (comments = [], { task, signal } = {}) =>
      http.post(
        `actions/tasks/${task ? `${optionalIdOf(task)}/` : ''}batch-comment`,
        { comments },
        { signal }
      ),

    /**
     * Comment several tasks of a project in one request. Each comment sets
     * the status of its task. Entries without object_id, task_status_id or
     * comment are skipped by the API.
     * @param {Model} project
     * @param {{object_id: string, task_status_id: string, comment: string,
     *   links?: string[]}[]} [comments] object_id is the id of the task.
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} The created comments.
     */
    createMultipleComments: async (project, comments = [], { signal } = {}) =>
      http.post(
        `actions/projects/${idOf(project)}/tasks/comment-many`,
        comments,
        { signal }
      ),

    /**
     * Publish the same comment on several tasks in one request.
     * @param {Model[]} tasks
     * @param {object} commentsData Fields of the comment: at least text,
     *   task_status_id and person_id.
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} The created comments.
     */
    addTasksBatchComments: async (tasks, commentsData, { signal } = {}) =>
      http.post(
        'actions/tasks/batch-comment',
        {
          comments: idsOf(tasks).map(taskId => ({
            ...commentsData,
            task_id: taskId
          }))
        },
        { signal }
      ),

    /**
     * Move a comment to another task of the same entity. Reserved to
     * production managers and studio admins.
     * @param {Model} task The task holding the comment.
     * @param {Model} comment
     * @param {Model} targetTask
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The moved comment.
     */
    moveCommentToTask: async (task, comment, targetTask, { signal } = {}) =>
      http.post(
        `${commentPath('actions', task, comment)}/move`,
        { target_task_id: idOf(targetTask) },
        { signal }
      ),

    /**
     * Acknowledge the comment, or remove the acknowledgement when it is
     * already there.
     * @param {Model} task
     * @param {Model} comment
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The updated comment.
     */
    acknowledgeComment: async (task, comment, { signal } = {}) =>
      http.post(`${commentPath('data', task, comment)}/ack`, {}, { signal }),

    /**
     * @param {Model} task
     * @param {Model} comment
     * @param {string} text
     * @param {{person?: Model, signal?: AbortSignal}} [options] person is the
     *   author of the reply.
     * @returns {Promise<Entity>} The created reply.
     */
    replyToComment: async (task, comment, text, { person, signal } = {}) =>
      http.post(
        `${commentPath('data', task, comment)}/reply`,
        withoutNil({ text, person_id: optionalIdOf(person) }),
        { signal }
      ),

    /**
     * @param {Model} task
     * @param {Model} comment
     * @param {Model} attachmentFile
     * @param {RequestOptions} [options]
     * @returns {Promise<null>}
     */
    deleteCommentAttachment: async (
      task,
      comment,
      attachmentFile,
      { signal } = {}
    ) =>
      http.del(
        `${commentPath('data', task, comment)}/attachments/${idOf(attachmentFile)}`,
        undefined,
        { signal }
      ),

    /**
     * @param {Model} task
     * @param {Model} comment
     * @param {Model} reply
     * @param {RequestOptions} [options]
     * @returns {Promise<null>}
     */
    deleteCommentReply: async (task, comment, reply, { signal } = {}) =>
      http.del(
        `${commentPath('data', task, comment)}/reply/${idOf(reply)}`,
        undefined,
        { signal }
      ),

    /**
     * @param {Entity} task The task object: its project_id is needed.
     * @returns {Promise<string>} URL of the task page in the Kitsu web app.
     */
    getTaskUrl: async task => urls.getTaskUrl(urls.webHostOf(http.host), task)
  }
}
