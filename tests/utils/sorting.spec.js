import { describe, expect, it } from 'vitest'

import {
  compareBy,
  sortAssets,
  sortByDate,
  sortByName,
  sortByPersonName,
  sortByValue,
  sortComments,
  sortEdits,
  sortPeople,
  sortProductions,
  sortRevisionPreviewFiles,
  sortSequences,
  sortShots,
  sortTaskNames,
  sortTaskStatuses,
  sortTaskTypes,
  sortTasks
} from '../../src/utils/sorting.js'

const taskTypeMap = new Map(
  Object.entries({
    'task-type-1': { id: 'task-type-1', priority: 1, name: 'Modeling' },
    'task-type-2': { id: 'task-type-2', priority: 1, name: 'Setup' },
    'task-type-3': { id: 'task-type-3', priority: 2, name: 'Texture' }
  })
)

const idsOf = entries => entries.map(entry => entry.id)

describe('compareBy', () => {
  it('chains comparators, the first non-zero result wins', () => {
    const rows = [
      { type: 'b', name: 'x' },
      { type: 'a', name: 'z' },
      { type: 'a', name: 'y' }
    ]
    const sorted = [...rows].sort(
      compareBy(
        (a, b) => a.type.localeCompare(b.type),
        (a, b) => a.name.localeCompare(b.name)
      )
    )
    expect(sorted.map(row => row.name)).toEqual(['y', 'z', 'x'])
  })

  it('returns 0 when every comparator does, or when there is none', () => {
    expect(compareBy(() => 0)({}, {})).toEqual(0)
    expect(compareBy()({}, {})).toEqual(0)
  })
})

describe('utils/sorting', () => {
  it('sortByName', () => {
    const entries = [
      { name: 'Zou', id: 3 },
      { name: 'Kitsu', id: 2 },
      { name: 'Gazu', id: 1 }
    ]
    let results = sortByName(entries)
    expect(results).toHaveLength(3)
    expect(results[0].id).toEqual(1)
    expect(results[1].id).toEqual(2)
    expect(results[2].id).toEqual(3)

    results = sortByName([])
    expect(results).toHaveLength(0)
  })

  it('sortByName compares numbers inside names numerically', () => {
    const entries = [{ name: 'SH10' }, { name: 'SH2' }, { name: 'SH1' }]
    expect(sortByName(entries).map(entry => entry.name)).toEqual([
      'SH1',
      'SH2',
      'SH10'
    ])
  })

  it('sortByValue', () => {
    const entries = [
      { value: 'wip', id: 3 },
      { value: 'done', id: 1 },
      { value: 'retake', id: 2 }
    ]
    expect(idsOf(sortByValue(entries))).toEqual([1, 2, 3])
    expect(sortByValue([])).toHaveLength(0)
  })

  it('sortAssets', () => {
    const entries = [
      {
        canceled: false,
        project_name: 'Big Buck Bunny',
        asset_type_name: 'Props',
        name: 'Tree',
        id: 4
      },
      {
        canceled: false,
        project_name: 'Big Buck Bunny',
        asset_type_name: 'Props',
        name: 'Table',
        id: 3
      },
      {
        canceled: false,
        project_name: 'Big Buck Bunny',
        asset_type_name: 'Props',
        name: 'Chair',
        id: 2
      },
      {
        canceled: false,
        project_name: 'Big Buck Bunny',
        asset_type_name: 'Characters',
        name: 'Bunny',
        id: 1
      }
    ]
    let results = sortAssets(entries)
    expect(results).toHaveLength(4)
    expect(results[0].id).toEqual(1)
    expect(results[1].id).toEqual(2)
    expect(results[2].id).toEqual(3)
    expect(results[3].id).toEqual(4)

    results = sortAssets([])
    expect(results).toHaveLength(0)
  })

  it('sortAssets puts canceled assets last and shared ones after the others', () => {
    const entries = [
      { canceled: true, asset_type_name: 'Characters', name: 'Alpha', id: 4 },
      { shared: true, asset_type_name: 'Props', name: 'Anvil', id: 3 },
      { shared: false, asset_type_name: 'Props', name: 'Zebra', id: 2 },
      { asset_type_name: 'Characters', name: 'Bunny', id: 1 }
    ]
    expect(idsOf(sortAssets(entries))).toEqual([1, 2, 3, 4])
  })

  it('sortShots', () => {
    const entries = [
      {
        canceled: false,
        episode_name: 'E01',
        sequence_name: 'SE02',
        name: 'SH03',
        id: 4
      },
      {
        canceled: false,
        episode_name: 'E01',
        sequence_name: 'SE02',
        name: 'SH02',
        id: 3
      },
      {
        canceled: false,
        episode_name: 'E01',
        sequence_name: 'SE02',
        name: 'SH01',
        id: 2
      },
      {
        canceled: true,
        episode_name: 'E01',
        sequence_name: 'SE03',
        name: 'SH01',
        id: 6
      },
      {
        canceled: false,
        episode_name: 'E01',
        sequence_name: 'SE01',
        name: 'SH01',
        id: 1
      },
      {
        canceled: false,
        episode_name: 'E02',
        sequence_name: 'SE01',
        name: 'SH01',
        id: 5
      }
    ]
    let results = sortShots(entries)

    expect(results).toHaveLength(6)
    expect(results[0].id).toEqual(1)
    expect(results[1].id).toEqual(2)
    expect(results[2].id).toEqual(3)
    expect(results[3].id).toEqual(4)
    expect(results[4].id).toEqual(5)
    expect(results[5].id).toEqual(6)

    results = sortShots([])
    expect(results).toHaveLength(0)
  })

  it('sortShots - without episodes', () => {
    const entries = [
      {
        canceled: false,
        sequence_name: 'SE02',
        name: 'SH01',
        id: 4
      },
      {
        canceled: false,
        sequence_name: 'SE03',
        name: 'SH02',
        id: 6
      },
      {
        canceled: false,
        sequence_name: 'SE01',
        name: 'SH01',
        id: 1
      },
      {
        canceled: false,
        sequence_name: 'SE03',
        name: 'SH01',
        id: 5
      },
      {
        canceled: true,
        sequence_name: 'SE01',
        name: 'SH04',
        id: 7
      },
      {
        canceled: false,
        sequence_name: 'SE01',
        name: 'SH02',
        id: 2
      },
      {
        canceled: false,
        sequence_name: 'SE01',
        name: 'SH03',
        id: 3
      }
    ]
    let results = sortShots(entries)

    expect(results).toHaveLength(7)
    expect(results[0].id).toEqual(1)
    expect(results[1].id).toEqual(2)
    expect(results[2].id).toEqual(3)
    expect(results[3].id).toEqual(4)
    expect(results[4].id).toEqual(5)
    expect(results[5].id).toEqual(6)
    expect(results[6].id).toEqual(7)

    results = sortShots([])
    expect(results).toHaveLength(0)
  })

  it('sortEdits', () => {
    const entries = [
      { canceled: false, episode_name: 'E02', name: 'Edit A', id: 4 },
      { canceled: true, episode_name: 'E01', name: 'Edit A', id: 5 },
      { canceled: false, episode_name: 'E01', name: 'Edit 10', id: 3 },
      { canceled: false, episode_name: 'E01', name: 'Edit 2', id: 2 },
      { canceled: false, episode_name: 'E01', name: 'Edit 1', id: 1 }
    ]
    expect(idsOf(sortEdits(entries))).toEqual([1, 2, 3, 4, 5])
    expect(sortEdits([])).toHaveLength(0)
  })

  it('sortEdits - without episodes', () => {
    const entries = [
      { canceled: true, name: 'Edit A', id: 3 },
      { canceled: false, name: 'Edit B', id: 2 },
      { canceled: false, name: 'Edit A', id: 1 }
    ]
    expect(idsOf(sortEdits(entries))).toEqual([1, 2, 3])
  })

  it('sortSequences', () => {
    const entries = [
      {
        canceled: false,
        episode_name: 'E02',
        name: 'SE02',
        id: 4
      },
      {
        canceled: false,
        episode_name: 'E02',
        name: 'SE01',
        id: 3
      },
      {
        canceled: true,
        episode_name: 'E01',
        name: 'SE03',
        id: 5
      },
      {
        canceled: false,
        episode_name: 'E01',
        name: 'SE01',
        id: 1
      },
      {
        canceled: false,
        episode_name: 'E01',
        name: 'SE02',
        id: 2
      }
    ]
    let results = sortSequences(entries)

    expect(results).toHaveLength(5)
    expect(results[0].id).toEqual(1)
    expect(results[1].id).toEqual(2)
    expect(results[2].id).toEqual(5)
    expect(results[3].id).toEqual(3)
    expect(results[4].id).toEqual(4)

    results = sortSequences([])
    expect(results).toHaveLength(0)
  })

  it('sortProductions', () => {
    const entries = [
      { project_status_name: 'Closed', name: 'Big Buck Bunny', id: 3 },
      { project_status_name: 'Open', name: 'Cosmos Landromat', id: 2 },
      { project_status_name: 'Open', name: 'Agent 327', id: 1 }
    ]
    let results = sortProductions(entries)
    expect(results).toHaveLength(3)
    expect(results[0].id).toEqual(1)
    expect(results[1].id).toEqual(2)
    expect(results[2].id).toEqual(3)

    results = sortProductions([])
    expect(results).toHaveLength(0)
  })

  it('sortTaskTypes', () => {
    const entries = [
      { for_entity: 'Asset', priority: 1, name: 'Modeling', id: 'task-type-2' },
      { for_entity: 'Asset', priority: 2, name: 'Setup', id: 'task-type-5' },
      {
        for_entity: 'Asset',
        priority: 1,
        name: 'Modeling Low',
        id: 'task-type-4'
      },
      {
        for_entity: 'Asset',
        priority: 1,
        name: 'Modeling Hi',
        id: 'task-type-3'
      },
      { for_entity: 'Shot', priority: 1, name: 'Animation', id: 'task-type-1' }
    ]
    const production = {
      task_types_priority: {
        'task-type-5': 5,
        'task-type-4': 1,
        'task-type-3': 4,
        'task-type-2': 3,
        'task-type-1': 2
      }
    }
    let results = sortTaskTypes(entries, production)
    expect(results).toHaveLength(5)
    expect(results[0].id).toEqual('task-type-4')
    expect(results[1].id).toEqual('task-type-2')
    expect(results[2].id).toEqual('task-type-3')
    expect(results[3].id).toEqual('task-type-5')
    expect(results[4].id).toEqual('task-type-1')

    results = sortTaskTypes([], production)
    expect(results).toHaveLength(0)
  })

  it('sortTaskTypes falls back to the task type priority, then the name', () => {
    const entries = [
      { for_entity: 'Asset', priority: 2, name: 'Setup', id: 'task-type-3' },
      { for_entity: 'Asset', priority: 1, name: 'Shading', id: 'task-type-2' },
      { for_entity: 'Asset', priority: 1, name: 'Modeling', id: 'task-type-1' }
    ]
    const expected = ['task-type-1', 'task-type-2', 'task-type-3']
    expect(idsOf(sortTaskTypes(entries))).toEqual(expected)
    expect(idsOf(sortTaskTypes(entries, {}))).toEqual(expected)
  })

  it('sortTaskStatuses', () => {
    const entries = [
      { priority: 1, name: 'Todo', id: 'task-status-1' },
      { priority: 2, name: 'Work in progress', id: 'task-status-2' },
      { priority: 3, name: 'Retake', id: 'task-status-4' },
      { priority: 3, name: 'Done', id: 'task-status-3' }
    ]
    expect(idsOf(sortTaskStatuses(entries))).toEqual([
      'task-status-1',
      'task-status-2',
      'task-status-3',
      'task-status-4'
    ])

    const production = {
      task_statuses_link: {
        'task-status-1': { priority: 4 },
        'task-status-2': { priority: 3 },
        'task-status-3': { priority: 1 },
        'task-status-4': { priority: 2 }
      }
    }
    expect(idsOf(sortTaskStatuses(entries, production))).toEqual([
      'task-status-3',
      'task-status-4',
      'task-status-2',
      'task-status-1'
    ])

    expect(sortTaskStatuses([], production)).toHaveLength(0)
  })

  it('sortTasks', () => {
    const entries = [
      {
        project_name: 'Big Buck Bunny',
        task_type_id: 'task-type-1',
        entity_name: 'Chair',
        full_entity_name: 'Props / Tree',
        priority: 3,
        id: 5
      },
      {
        project_name: 'Big Buck Bunny',
        task_type_id: 'task-type-1',
        entity_name: 'Tree',
        full_entity_name: 'Props / Tree',
        id: 4
      },
      {
        project_name: 'Agent 327',
        task_type_id: 'task-type-1',
        entity_name: 'Agent327',
        full_entity_name: 'Characters / Agent327',
        id: 1
      },
      {
        project_name: 'Agent 327',
        task_type_id: 'task-type-2',
        entity_name: 'Agent327',
        full_entity_name: 'Characters / Agent327',
        id: 3
      },
      {
        project_name: 'Agent 327',
        task_type_id: 'task-type-1',
        entity_name: 'SuperVilain',
        full_entity_name: 'Characters / SuperVilain',
        id: 2
      }
    ]
    let results = sortTasks(entries, taskTypeMap)
    expect(results).toHaveLength(5)
    expect(results[0].id).toEqual(5)
    expect(results[1].id).toEqual(1)
    expect(results[2].id).toEqual(2)
    expect(results[3].id).toEqual(3)
    expect(results[4].id).toEqual(4)

    results = sortTasks([], taskTypeMap)
    expect(results).toHaveLength(0)
  })

  it('sortTaskNames and sortTasks tolerate a task without entity names', () => {
    // A task populated from a sequence loaded without full_name carries
    // neither full_entity_name nor entity_name.
    const build = () => [
      { task_type_id: 'task-type-1', entity_name: 'Tree', priority: 0, id: 1 },
      { task_type_id: 'task-type-1', priority: 0, id: 2 },
      { task_type_id: 'task-type-1', entity_name: 'Chair', priority: 0, id: 3 }
    ]
    expect(sortTaskNames(build(), taskTypeMap).map(t => t.id)).toEqual([
      2, 3, 1
    ])
    expect(sortTasks(build(), taskTypeMap).map(t => t.id)).toEqual([2, 3, 1])
  })

  it('sortTaskNames sorts by task type name, then by entity name', () => {
    const entries = [
      { task_type_id: 'task-type-2', entity_name: 'Chair', id: 3 },
      { task_type_id: 'unknown', entity_name: 'Tree', id: 1 },
      { task_type_id: 'task-type-1', full_entity_name: 'Props / Tree', id: 2 }
    ]
    expect(idsOf(sortTaskNames(entries, taskTypeMap))).toEqual([1, 2, 3])
  })

  it('sortPeople', () => {
    const people = [
      { id: 1, first_name: 'Allen', last_name: 'Beard', active: false },
      { id: 2, first_name: 'John', last_name: 'Doe', active: false },
      { id: 3, first_name: 'Emma', last_name: 'Doe', active: false },
      { id: 4, first_name: 'John', last_name: 'Doe', active: true }
    ]

    const results = sortPeople(people)
    expect(results).toHaveLength(4)
    expect(results[0].id).toEqual(4)
    expect(results[1].id).toEqual(1)
    expect(results[2].id).toEqual(3)
    expect(results[3].id).toEqual(2)
  })

  it('sortPeople puts people without a first name first, consistently', () => {
    const anna = { id: 1, first_name: 'Anna', last_name: 'Doe', active: true }
    const bot = { id: 2, first_name: '', last_name: '', active: true }

    // The comparator must be antisymmetric: the result cannot depend on the
    // input order.
    expect(sortPeople([anna, bot]).map(p => p.id)).toEqual([2, 1])
    expect(sortPeople([bot, anna]).map(p => p.id)).toEqual([2, 1])
  })

  it('sortByDate', () => {
    const entries = [
      { id: 1, created_at: '2018-09-12-12:18:30' },
      { id: 2, created_at: '2018-09-18-16:22:00' },
      { id: 3, created_at: '2018-09-18-18:19:00' }
    ]
    const results = sortByDate(entries)
    expect(results).toHaveLength(3)
    expect(results[0].id).toEqual(3)
    expect(results[1].id).toEqual(2)
    expect(results[2].id).toEqual(1)
  })

  it('sortComments', () => {
    const entries = [
      { id: 1, created_at: '2018-09-12-12:18:30', pinned: false },
      { id: 2, created_at: '2018-09-18-16:22:00', pinned: false },
      { id: 3, created_at: '2018-09-18-18:18:00', pinned: true },
      { id: 4, created_at: '2018-09-18-18:19:00', pinned: true }
    ]
    const results = sortComments(entries)
    expect(results).toHaveLength(4)
    expect(results[0].id).toEqual(4)
    expect(results[1].id).toEqual(3)
    expect(results[2].id).toEqual(2)
    expect(results[3].id).toEqual(1)
  })

  it('sortRevisionPreviewFiles', () => {
    const entries = [
      { id: 1, created_at: '2018-09-18-16:22:00', position: 2 },
      { id: 2, created_at: '2018-09-12-12:18:30', position: 2 },
      { id: 3, created_at: '2018-09-18-18:19:00', position: 1 },
      { id: 4, created_at: '2018-09-18-18:18:00', position: 1 }
    ]
    const results = sortRevisionPreviewFiles(entries)
    expect(results).toHaveLength(4)
    expect(results[0].id).toEqual(4)
    expect(results[1].id).toEqual(3)
    expect(results[2].id).toEqual(2)
    expect(results[3].id).toEqual(1)
  })

  it('sortByPersonName', () => {
    const personMap = new Map(
      Object.entries({
        'person-1': { id: 'person-1', name: 'Charlie' },
        'person-2': { id: 'person-2', name: 'Alice' },
        'person-3': { id: 'person-3', name: 'Bob' }
      })
    )

    // sorts the ids alphabetically by the person's name
    const assignees = ['person-1', 'person-2', 'person-3']
    const sorted = sortByPersonName(assignees, personMap)
    expect(sorted).toEqual(['person-2', 'person-3', 'person-1'])

    // ids missing from the map sink to the end instead of throwing, so
    // assignees[0] keeps naming a person who resolved
    const withMissing = ['person-1', 'missing', 'person-3']
    expect(sortByPersonName(withMissing, personMap)).toEqual([
      'person-3',
      'person-1',
      'missing'
    ])

    // an id that resolves always wins the first slot over one that does not
    expect(sortByPersonName(['missing', 'person-1'], personMap)).toEqual([
      'person-1',
      'missing'
    ])

    // several holes keep the resolved names ordered ahead of them
    expect(
      sortByPersonName(['gone', 'person-1', 'missing', 'person-2'], personMap)
    ).toEqual(['person-2', 'person-1', 'gone', 'missing'])

    // nothing resolves: no throw, the list is left as is
    expect(sortByPersonName(['gone', 'missing'], personMap)).toEqual([
      'gone',
      'missing'
    ])
  })
})

// Deliberate change from Kitsu, which sorts in place.
describe('utils/sorting returns new arrays', () => {
  const expectUntouched = (entries, sort) => {
    const snapshot = [...entries]
    const results = sort(entries)
    expect(results).not.toBe(entries)
    expect(entries).toEqual(snapshot)
    expect(results).not.toEqual(snapshot)
  }

  it('entity sorts: sortAssets, sortShots, sortEdits, sortSequences', () => {
    const build = () => [
      { name: 'B', asset_type_name: 'Props', sequence_name: 'SE01', id: 2 },
      { name: 'A', asset_type_name: 'Props', sequence_name: 'SE01', id: 1 }
    ]
    expectUntouched(build(), sortAssets)
    expectUntouched(build(), sortShots)
    expectUntouched(build(), sortEdits)
    expectUntouched(build(), sortSequences)
  })

  it('sortProductions', () => {
    expectUntouched(
      [
        { project_status_name: 'Open', name: 'B', id: 2 },
        { project_status_name: 'Open', name: 'A', id: 1 }
      ],
      sortProductions
    )
  })

  it('task sorts: sortTaskNames, sortTasks', () => {
    const build = () => [
      { task_type_id: 'task-type-2', entity_name: 'Tree', id: 2 },
      { task_type_id: 'task-type-1', entity_name: 'Tree', id: 1 }
    ]
    expectUntouched(build(), tasks => sortTaskNames(tasks, taskTypeMap))
    expectUntouched(build(), tasks => sortTasks(tasks, taskTypeMap))
  })

  it('timeline sorts: sortComments, sortRevisionPreviewFiles, sortByDate', () => {
    const build = () => [
      { id: 1, created_at: '2018-09-12-12:18:30', position: 2 },
      { id: 2, created_at: '2018-09-18-16:22:00', position: 1 }
    ]
    expectUntouched(build(), sortComments)
    expectUntouched(build(), sortRevisionPreviewFiles)
    expectUntouched(build(), sortByDate)
  })

  it('production setting sorts: sortTaskStatuses, sortTaskTypes', () => {
    const build = () => [
      { for_entity: 'Asset', priority: 2, name: 'B', id: 'b' },
      { for_entity: 'Asset', priority: 1, name: 'A', id: 'a' }
    ]
    expectUntouched(build(), statuses => sortTaskStatuses(statuses, {}))
    expectUntouched(build(), taskTypes => sortTaskTypes(taskTypes, {}))
  })

  it('sortPeople', () => {
    expectUntouched(
      [
        { id: 2, first_name: 'John', last_name: 'Doe', active: true },
        { id: 1, first_name: 'Emma', last_name: 'Doe', active: true }
      ],
      sortPeople
    )
  })

  it('generic sorts: sortByName, sortByValue', () => {
    const build = () => [
      { name: 'b', value: 'b' },
      { name: 'a', value: 'a' }
    ]
    expectUntouched(build(), sortByName)
    expectUntouched(build(), sortByValue)
  })

  it('sortByPersonName', () => {
    const personMap = new Map([
      ['person-1', { name: 'Charlie' }],
      ['person-2', { name: 'Alice' }]
    ])
    expectUntouched(['person-1', 'person-2'], ids =>
      sortByPersonName(ids, personMap)
    )
  })
})
