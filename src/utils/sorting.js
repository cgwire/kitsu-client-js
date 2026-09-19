// localeCompare(x, undefined, { numeric: true }) builds a new Intl.Collator
// on every call: V8 only caches the collator when no options are passed.
const collator = new Intl.Collator(undefined, { numeric: true })

/**
 * Chain comparators: the first non-zero result wins.
 * @template T
 * @param {...((a: T, b: T) => number)} comparators
 * @returns {(a: T, b: T) => number}
 */
export const compareBy =
  (...comparators) =>
  (a, b) =>
    comparators.reduce((result, compare) => result || compare(a, b), 0)

// Kitsu sorted these keys through thenby's firstBy('key'): a falsy value
// counts as '' and values are compared with < and >, so false sorts before
// true and a missing number before any positive one.
const byKey =
  (key, direction = 1) =>
  (a, b) => {
    const valueA = a[key] || ''
    const valueB = b[key] || ''
    if (valueA < valueB) return -direction
    return valueA > valueB ? direction : 0
  }

const byCollated = key => (a, b) => collator.compare(a[key], b[key])

const byName = byCollated('name')

const byEpisode = (a, b) =>
  a.episode_name ? collator.compare(a.episode_name, b.episode_name) : 0

const byProject = (a, b) =>
  a.project_name ? collator.compare(a.project_name, b.project_name) : 0

const byTaskTypeName = taskTypeMap => (a, b) =>
  collator.compare(
    taskTypeMap.get(a.task_type_id)?.name || '',
    taskTypeMap.get(b.task_type_id)?.name || ''
  )

// A task populated before its entity carried a name (a freshly created
// sequence, a raw task from the creation API) has neither entity name.
const entityNameOf = task => task.full_entity_name || task.entity_name || ''

const byEntityName = (a, b) =>
  collator.compare(entityNameOf(a), entityNameOf(b))

const taskTypePriorityOf = (taskType, production) => {
  if (!taskType) return 1
  return production?.task_types_priority?.[taskType.id] || taskType.priority
}

const taskStatusPriorityOf = (taskStatus, production) => {
  if (!taskStatus) return 1
  return (
    production?.task_statuses_link?.[taskStatus.id]?.priority ||
    taskStatus.priority
  )
}

const byPriority = (priorityOf, production) => (a, b) =>
  priorityOf(a, production) - priorityOf(b, production)

const assetComparator = compareBy(
  byKey('canceled'),
  byCollated('asset_type_name'),
  byKey('shared'),
  byName
)

const shotComparator = compareBy(
  byKey('canceled'),
  byEpisode,
  byCollated('sequence_name'),
  byName
)

const editComparator = compareBy(byKey('canceled'), byEpisode, byName)

const sequenceComparator = compareBy(byEpisode, byName)

const productionComparator = (a, b) =>
  a.project_status_name === b.project_status_name
    ? collator.compare(a.name, b.name)
    : -1 * collator.compare(a.project_status_name, b.project_status_name)

const commentComparator = compareBy(
  byKey('pinned', -1),
  byKey('created_at', -1)
)

const previewFileComparator = compareBy(byKey('position'), byKey('created_at'))

const personComparator = compareBy(
  byKey('active', -1),
  (a, b) => (a.first_name || '').localeCompare(b.first_name || ''),
  (a, b) => (a.last_name || '').localeCompare(b.last_name || '')
)

/**
 * Sort assets: canceled last, then by asset type name, shared assets after
 * the project ones, then by name.
 * @template T
 * @param {T[]} assets
 * @returns {T[]} A new sorted array.
 */
export const sortAssets = assets => [...assets].sort(assetComparator)

/**
 * Sort shots: canceled last, then by episode, sequence and shot name.
 * @template T
 * @param {T[]} shots
 * @returns {T[]} A new sorted array.
 */
export const sortShots = shots => [...shots].sort(shotComparator)

/**
 * Sort edits: canceled last, then by episode and edit name.
 * @template T
 * @param {T[]} edits
 * @returns {T[]} A new sorted array.
 */
export const sortEdits = edits => [...edits].sort(editComparator)

/**
 * Sort sequences by episode name, then by sequence name.
 * @template T
 * @param {T[]} sequences
 * @returns {T[]} A new sorted array.
 */
export const sortSequences = sequences =>
  [...sequences].sort(sequenceComparator)

/**
 * Sort productions: open ones before closed ones, then by name.
 * @template T
 * @param {T[]} productions
 * @returns {T[]} A new sorted array.
 */
export const sortProductions = productions =>
  [...productions].sort(productionComparator)

/**
 * Sort tasks by task type name, then by entity name.
 * @template T
 * @param {T[]} tasks
 * @param {Map<string, {name?: string}>} taskTypeMap Task types indexed by id.
 * @returns {T[]} A new sorted array.
 */
export const sortTaskNames = (tasks, taskTypeMap) =>
  [...tasks].sort(compareBy(byTaskTypeName(taskTypeMap), byEntityName))

/**
 * Sort tasks: highest priority first, then by project name, task type name
 * and entity name.
 * @template T
 * @param {T[]} tasks
 * @param {Map<string, {name?: string}>} taskTypeMap Task types indexed by id.
 * @returns {T[]} A new sorted array.
 */
export const sortTasks = (tasks, taskTypeMap) =>
  [...tasks].sort(
    compareBy(
      byKey('priority', -1),
      byProject,
      byTaskTypeName(taskTypeMap),
      byEntityName
    )
  )

/**
 * Sort comments: pinned first, then newest first.
 * @template T
 * @param {T[]} comments
 * @returns {T[]} A new sorted array.
 */
export const sortComments = comments => [...comments].sort(commentComparator)

/**
 * Sort the preview files of a revision by position, then oldest first.
 * @template T
 * @param {T[]} previewFiles
 * @returns {T[]} A new sorted array.
 */
export const sortRevisionPreviewFiles = previewFiles =>
  [...previewFiles].sort(previewFileComparator)

/**
 * Sort task statuses by priority, the production override winning over the
 * status own priority, then by name.
 * @template T
 * @param {T[]} taskStatuses
 * @param {Record<string, any>} [production] The project dict, read for its
 *   `task_statuses_link` overrides.
 * @returns {T[]} A new sorted array.
 */
export const sortTaskStatuses = (taskStatuses, production) =>
  [...taskStatuses].sort(
    compareBy(byPriority(taskStatusPriorityOf, production), byKey('name'))
  )

/**
 * Sort task types by entity type, then by priority, the production override
 * winning over the task type own priority, then by name.
 * @template T
 * @param {T[]} taskTypes
 * @param {Record<string, any>} [production] The project dict, read for its
 *   `task_types_priority` overrides.
 * @returns {T[]} A new sorted array.
 */
export const sortTaskTypes = (taskTypes, production) =>
  [...taskTypes].sort(
    compareBy(
      byKey('for_entity'),
      byPriority(taskTypePriorityOf, production),
      byKey('name')
    )
  )

/**
 * Sort people: active first, then by first name and last name.
 * @template T
 * @param {T[]} people
 * @returns {T[]} A new sorted array.
 */
export const sortPeople = people => [...people].sort(personComparator)

/**
 * Sort entries by name, numbers inside names compared numerically.
 * @template T
 * @param {T[]} entries
 * @returns {T[]} A new sorted array.
 */
export const sortByName = entries => [...entries].sort(byName)

/**
 * Sort person ids alphabetically by the person's name. Ids missing from a
 * partially loaded map sink to the end rather than throwing: callers read the
 * first id as "the" assignee, so a hole must never displace a person who did
 * resolve.
 * @param {string[]} personIds
 * @param {Map<string, {name?: string}>} personMap People indexed by id.
 * @returns {string[]} A new sorted array.
 */
export const sortByPersonName = (personIds, personMap) =>
  [...personIds].sort((a, b) => {
    const nameA = personMap.get(a)?.name
    const nameB = personMap.get(b)?.name
    if (!nameA) return nameB ? 1 : 0
    if (!nameB) return -1
    return nameA.localeCompare(nameB)
  })

/**
 * Sort entries by their `value` field.
 * @template T
 * @param {T[]} entries
 * @returns {T[]} A new sorted array.
 */
export const sortByValue = entries => [...entries].sort(byCollated('value'))

/**
 * Sort entries by creation date, newest first.
 * @template T
 * @param {T[]} entries
 * @returns {T[]} A new sorted array.
 */
export const sortByDate = entries => [...entries].sort(byKey('created_at', -1))
