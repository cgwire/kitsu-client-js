import { beforeEach, describe, expect, it } from 'vitest'

import { ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import {
  ENTITY_ID,
  EPISODE_ID,
  OTHER_ID,
  PERSON_ID,
  PROJECT_ID,
  TASK_ID,
  TASK_TYPE_ID
} from '../helpers/ids.js'

const MILESTONE_ID = ENTITY_ID
const ITEM_ID = ENTITY_ID
const VERSION_ID = ENTITY_ID
const LINK_ID = ENTITY_ID

describe('schedule namespace: milestones', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('newMilestone creates a milestone on a local day', async () => {
    fake.reply(201, { id: MILESTONE_ID })
    expect(
      await kitsu.schedule.newMilestone(
        { id: PROJECT_ID },
        'Delivery',
        new Date(2026, 8, 19),
        { taskType: { id: TASK_TYPE_ID } }
      )
    ).toEqual({ id: MILESTONE_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: '/data/milestones'
    })
    expect(fake.calls[0].body).toEqual({
      date: '2026-09-19',
      name: 'Delivery',
      task_type_id: TASK_TYPE_ID,
      project_id: PROJECT_ID
    })
  })

  it('newMilestone leaves the task type out when it is not given', async () => {
    fake.reply(201, { id: MILESTONE_ID })
    await kitsu.schedule.newMilestone(PROJECT_ID, 'Delivery', '2026-09-19')
    expect(fake.calls[0].body).toEqual({
      date: '2026-09-19',
      name: 'Delivery',
      project_id: PROJECT_ID
    })
  })

  it('newMilestone rejects a blank name', async () => {
    await expect(
      kitsu.schedule.newMilestone(PROJECT_ID, '', '2026-09-19')
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('updateMilestone saves the fields of the milestone', async () => {
    fake.reply(200, { id: MILESTONE_ID })
    await kitsu.schedule.updateMilestone({
      id: MILESTONE_ID,
      date: new Date(2026, 8, 20),
      name: 'Final',
      task_type_id: null
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/milestones/${MILESTONE_ID}`
    })
    expect(fake.calls[0].body).toEqual({
      date: '2026-09-20',
      name: 'Final',
      task_type_id: null
    })
  })

  it('updateMilestone saves the changes of a milestone read before', async () => {
    const milestone = {
      id: MILESTONE_ID,
      type: 'Milestone',
      date: '2026-09-19',
      name: 'Delivery',
      project_id: PROJECT_ID,
      task_type_id: TASK_TYPE_ID,
      created_at: '2026-09-01T10:00:00',
      updated_at: '2026-09-01T10:00:00'
    }
    fake.reply(200, milestone)
    await kitsu.schedule.updateMilestone({ ...milestone, name: 'Final' })
    expect(fake.calls[0].body).toEqual({
      date: '2026-09-19',
      name: 'Final',
      task_type_id: TASK_TYPE_ID
    })
  })

  it('updateMilestone keeps the missing fields out of the body', async () => {
    fake.reply(200, { id: MILESTONE_ID })
    await kitsu.schedule.updateMilestone({
      id: MILESTONE_ID,
      task_type_id: TASK_TYPE_ID
    })
    expect(fake.calls[0].body).toEqual({ task_type_id: TASK_TYPE_ID })
  })

  it('removeMilestone deletes the milestone', async () => {
    fake.reply(204)
    expect(
      await kitsu.schedule.removeMilestone({ id: MILESTONE_ID })
    ).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/milestones/${MILESTONE_ID}`
    })
  })
})

describe('schedule namespace: schedule items', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('allTaskTypeScheduleItems lists the task type level items', async () => {
    fake.reply(200, [{ id: ITEM_ID }])
    expect(
      await kitsu.schedule.allTaskTypeScheduleItems({ id: PROJECT_ID })
    ).toEqual([{ id: ITEM_ID }])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/schedule-items/task-types`
    })
  })

  it('allScheduleItems lists every schedule item of the project', async () => {
    fake.reply(200, [{ id: ITEM_ID }])
    expect(await kitsu.schedule.allScheduleItems(PROJECT_ID)).toEqual([
      { id: ITEM_ID }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/schedule-items`
    })
  })

  it.each(['asset-types', 'sequences', 'edits', 'episodes'])(
    'allEntityScheduleItems lists the %s items of a task type',
    async kind => {
      fake.reply(200, [{ id: ITEM_ID }])
      expect(
        await kitsu.schedule.allEntityScheduleItems(
          { id: PROJECT_ID },
          { id: TASK_TYPE_ID },
          kind
        )
      ).toEqual([{ id: ITEM_ID }])
      expect(fake.calls[0]).toMatchObject({
        method: 'GET',
        path: `/data/projects/${PROJECT_ID}/schedule-items/${TASK_TYPE_ID}/${kind}`
      })
      expect(fake.calls[0].query.has('episode_id')).toBe(false)
    }
  )

  it('allEntityScheduleItems filters on an episode', async () => {
    fake.reply(200, [])
    await kitsu.schedule.allEntityScheduleItems(
      PROJECT_ID,
      TASK_TYPE_ID,
      'sequences',
      { episode: { id: EPISODE_ID } }
    )
    expect(fake.calls[0].query.get('episode_id')).toBe(EPISODE_ID)
  })

  it('allEntityScheduleItems rejects an unknown kind', async () => {
    await expect(
      kitsu.schedule.allEntityScheduleItems(PROJECT_ID, TASK_TYPE_ID, 'shots')
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('newScheduleItem creates an item between two days', async () => {
    fake.reply(201, { id: ITEM_ID })
    expect(
      await kitsu.schedule.newScheduleItem(
        { id: PROJECT_ID },
        { id: TASK_TYPE_ID },
        new Date(2026, 8, 19),
        '2026-09-30',
        { manDays: 12 }
      )
    ).toEqual({ id: ITEM_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: '/data/schedule-items'
    })
    expect(fake.calls[0].body).toEqual({
      start_date: '2026-09-19',
      end_date: '2026-09-30',
      project_id: PROJECT_ID,
      task_type_id: TASK_TYPE_ID,
      man_days: 12
    })
  })

  it('newScheduleItem leaves man_days out when it is not given', async () => {
    fake.reply(201, { id: ITEM_ID })
    await kitsu.schedule.newScheduleItem(
      PROJECT_ID,
      TASK_TYPE_ID,
      '2026-09-19',
      '2026-09-20'
    )
    expect(fake.calls[0].body).toEqual({
      start_date: '2026-09-19',
      end_date: '2026-09-20',
      project_id: PROJECT_ID,
      task_type_id: TASK_TYPE_ID
    })
  })

  it('newScheduleItem rejects a missing end date', async () => {
    await expect(
      kitsu.schedule.newScheduleItem(PROJECT_ID, TASK_TYPE_ID, '2026-09-19')
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('updateScheduleItem saves the fields of the item', async () => {
    fake.reply(200, { id: ITEM_ID })
    await kitsu.schedule.updateScheduleItem({
      id: ITEM_ID,
      start_date: new Date(2026, 8, 19),
      end_date: '2026-09-25',
      man_days: 4
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/schedule-items/${ITEM_ID}`
    })
    expect(fake.calls[0].body).toEqual({
      start_date: '2026-09-19',
      end_date: '2026-09-25',
      man_days: 4
    })
  })

  // A row of allTaskTypeScheduleItems.
  it('updateScheduleItem saves the changes of an item read before', async () => {
    const item = {
      id: ITEM_ID,
      start_date: '2026-09-19',
      end_date: '2026-09-20',
      man_days: null,
      project_id: PROJECT_ID,
      task_type_id: TASK_TYPE_ID,
      object_id: null
    }
    fake.reply(200, item)
    await kitsu.schedule.updateScheduleItem({
      ...item,
      end_date: '2026-09-25'
    })
    expect(fake.calls[0].body).toEqual({
      start_date: '2026-09-19',
      end_date: '2026-09-25',
      man_days: null
    })
  })

  it('updateScheduleItem keeps the missing fields out of the body', async () => {
    fake.reply(200, { id: ITEM_ID })
    await kitsu.schedule.updateScheduleItem({
      id: ITEM_ID,
      end_date: '2026-09-25'
    })
    expect(fake.calls[0].body).toEqual({ end_date: '2026-09-25' })
  })

  it('removeScheduleItem deletes the schedule item', async () => {
    fake.reply(204)
    expect(await kitsu.schedule.removeScheduleItem({ id: ITEM_ID })).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/schedule-items/${ITEM_ID}`
    })
  })
})

describe('schedule namespace: schedule versions', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('allScheduleVersions lists the versions of a project', async () => {
    fake.reply(200, [{ id: VERSION_ID }])
    expect(
      await kitsu.schedule.allScheduleVersions({ id: PROJECT_ID })
    ).toEqual([{ id: VERSION_ID }])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/production-schedule-versions'
    })
    expect(fake.calls[0].query.get('project_id')).toBe(PROJECT_ID)
  })

  it('getScheduleVersion returns the version', async () => {
    fake.reply(200, { id: VERSION_ID })
    expect(await kitsu.schedule.getScheduleVersion({ id: VERSION_ID })).toEqual(
      { id: VERSION_ID }
    )
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/production-schedule-versions/${VERSION_ID}`
    })
  })

  it('getScheduleVersion returns null on a 404', async () => {
    fake.reply(404, { message: 'not found' })
    expect(await kitsu.schedule.getScheduleVersion(VERSION_ID)).toBeNull()
  })

  it('newScheduleVersion creates a named version', async () => {
    fake.reply(201, { id: VERSION_ID })
    expect(
      await kitsu.schedule.newScheduleVersion({ id: PROJECT_ID }, 'V2')
    ).toEqual({ id: VERSION_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: '/data/production-schedule-versions'
    })
    expect(fake.calls[0].body).toEqual({ project_id: PROJECT_ID, name: 'V2' })
  })

  // Zou has no "from" column: an unknown key makes the generic create
  // answer a 400. The source version goes through
  // setTaskLinksFromScheduleVersion instead.
  it('newScheduleVersion never sends a from key', async () => {
    fake.reply(201, { id: VERSION_ID })
    await kitsu.schedule.newScheduleVersion(PROJECT_ID, 'V2', {
      from: OTHER_ID
    })
    expect(fake.calls[0].body).toEqual({ project_id: PROJECT_ID, name: 'V2' })
  })

  it('newScheduleVersion rejects a blank name', async () => {
    await expect(
      kitsu.schedule.newScheduleVersion(PROJECT_ID, '')
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('updateScheduleVersion saves the changes of a version read before', async () => {
    const version = {
      id: VERSION_ID,
      type: 'ProductionScheduleVersion',
      name: 'V2',
      project_id: PROJECT_ID,
      production_schedule_from: null,
      locked: false,
      canceled: false,
      created_at: '2026-09-01T10:00:00',
      updated_at: '2026-09-01T10:00:00'
    }
    fake.reply(200, { ...version, locked: true })
    await kitsu.schedule.updateScheduleVersion({ ...version, locked: true })
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/production-schedule-versions/${VERSION_ID}`
    })
    expect(fake.calls[0].body).toEqual({
      name: 'V2',
      canceled: false,
      locked: true
    })
  })

  it('updateScheduleVersion keeps the missing fields out of the body', async () => {
    fake.reply(200, { id: VERSION_ID })
    await kitsu.schedule.updateScheduleVersion({ id: VERSION_ID, locked: true })
    expect(fake.calls[0].body).toEqual({ locked: true })
  })

  it('removeScheduleVersion deletes the version', async () => {
    fake.reply(204)
    expect(
      await kitsu.schedule.removeScheduleVersion({ id: VERSION_ID })
    ).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/production-schedule-versions/${VERSION_ID}`
    })
  })

  it('setTaskLinksFromProduction copies the production tasks', async () => {
    fake.reply(200, { success: true, task_link_count: 12 })
    expect(
      await kitsu.schedule.setTaskLinksFromProduction({ id: VERSION_ID })
    ).toEqual({ success: true, task_link_count: 12 })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/actions/production-schedule-versions/${VERSION_ID}/set-task-links-from-production`
    })
  })

  it('setTaskLinksFromScheduleVersion copies another version', async () => {
    fake.reply(200, { success: true, task_link_count: 12 })
    expect(
      await kitsu.schedule.setTaskLinksFromScheduleVersion(
        { id: VERSION_ID },
        { id: OTHER_ID }
      )
    ).toEqual({ success: true, task_link_count: 12 })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/actions/production-schedule-versions/${VERSION_ID}/set-task-links-from-production-schedule-version`
    })
    expect(fake.calls[0].body).toEqual({
      production_schedule_version_id: OTHER_ID
    })
  })

  it('applyScheduleVersionToProduction applies the version', async () => {
    fake.reply(200, { success: true, task_count: 12 })
    expect(
      await kitsu.schedule.applyScheduleVersionToProduction({ id: VERSION_ID })
    ).toEqual({ success: true, task_count: 12 })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/actions/production-schedule-versions/${VERSION_ID}/apply-to-production`
    })
  })
})

describe('schedule namespace: schedule version task links', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('allScheduleVersionTaskLinks always asks for the relations', async () => {
    fake.reply(200, [{ id: LINK_ID }])
    expect(
      await kitsu.schedule.allScheduleVersionTaskLinks({ id: VERSION_ID })
    ).toEqual([{ id: LINK_ID }])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/production-schedule-versions/${VERSION_ID}/task-links`
    })
    expect(fake.calls[0].query.get('relations')).toBe('true')
    expect(fake.calls[0].query.has('task_type_id')).toBe(false)
  })

  it('allScheduleVersionTaskLinks filters on a task type', async () => {
    fake.reply(200, [])
    await kitsu.schedule.allScheduleVersionTaskLinks(VERSION_ID, {
      taskType: { id: TASK_TYPE_ID }
    })
    expect(fake.calls[0].query.get('relations')).toBe('true')
    expect(fake.calls[0].query.get('task_type_id')).toBe(TASK_TYPE_ID)
  })

  it('getScheduleVersionTaskLink returns the task link', async () => {
    fake.reply(200, { id: LINK_ID })
    expect(
      await kitsu.schedule.getScheduleVersionTaskLink({ id: LINK_ID })
    ).toEqual({ id: LINK_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/production-schedule-version-task-links/${LINK_ID}`
    })
  })

  it('getScheduleVersionTaskLink returns null on a 404', async () => {
    fake.reply(404, { message: 'not found' })
    expect(await kitsu.schedule.getScheduleVersionTaskLink(LINK_ID)).toBeNull()
  })

  it('newScheduleVersionTaskLink links a task to a version', async () => {
    fake.reply(201, { id: LINK_ID })
    expect(
      await kitsu.schedule.newScheduleVersionTaskLink(
        { id: VERSION_ID },
        { id: TASK_ID },
        {
          startDate: new Date(2026, 8, 19),
          dueDate: '2026-09-25',
          estimation: 480,
          assignees: [{ id: PERSON_ID }]
        }
      )
    ).toEqual({ id: LINK_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: '/data/production-schedule-version-task-links'
    })
    expect(fake.calls[0].body).toEqual({
      task_id: TASK_ID,
      production_schedule_version_id: VERSION_ID,
      start_date: '2026-09-19',
      due_date: '2026-09-25',
      estimation: 480,
      assignees: [PERSON_ID]
    })
  })

  it('newScheduleVersionTaskLink sends the ids alone by default', async () => {
    fake.reply(201, { id: LINK_ID })
    await kitsu.schedule.newScheduleVersionTaskLink(VERSION_ID, TASK_ID)
    expect(fake.calls[0].body).toEqual({
      task_id: TASK_ID,
      production_schedule_version_id: VERSION_ID
    })
  })

  it('updateScheduleVersionTaskLink saves the fields of the task link', async () => {
    fake.reply(200, { id: LINK_ID })
    await kitsu.schedule.updateScheduleVersionTaskLink({
      id: LINK_ID,
      start_date: null,
      due_date: new Date(2026, 8, 25),
      estimation: 240,
      assignees: [{ id: PERSON_ID }]
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/production-schedule-version-task-links/${LINK_ID}`
    })
    expect(fake.calls[0].body).toEqual({
      start_date: null,
      due_date: '2026-09-25',
      estimation: 240,
      assignees: [PERSON_ID]
    })
  })

  // A row of allScheduleVersionTaskLinks, which asks for the relations.
  it('updateScheduleVersionTaskLink saves the changes of a link read before', async () => {
    const link = {
      id: LINK_ID,
      type: 'ProductionScheduleVersionTaskLink',
      production_schedule_version_id: VERSION_ID,
      task_id: TASK_ID,
      start_date: '2026-09-19T00:00:00',
      due_date: '2026-09-25T00:00:00',
      estimation: 240,
      assignees: [PERSON_ID],
      created_at: '2026-09-01T10:00:00',
      updated_at: '2026-09-01T10:00:00'
    }
    fake.reply(200, link)
    await kitsu.schedule.updateScheduleVersionTaskLink({
      ...link,
      estimation: 60
    })
    expect(fake.calls[0].body).toEqual({
      start_date: '2026-09-19T00:00:00',
      due_date: '2026-09-25T00:00:00',
      estimation: 60,
      assignees: [PERSON_ID]
    })
  })

  it('updateScheduleVersionTaskLink keeps the missing fields out', async () => {
    fake.reply(200, { id: LINK_ID })
    await kitsu.schedule.updateScheduleVersionTaskLink({
      id: LINK_ID,
      estimation: 60
    })
    expect(fake.calls[0].body).toEqual({ estimation: 60 })
  })

  it('removeScheduleVersionTaskLink deletes the task link', async () => {
    fake.reply(204)
    expect(
      await kitsu.schedule.removeScheduleVersionTaskLink({ id: LINK_ID })
    ).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/production-schedule-version-task-links/${LINK_ID}`
    })
  })
})

// 0.2.0 read the changes from the options: such a call would now save
// nothing.
describe('schedule namespace: updates', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it.each([
    ['updateMilestone', MILESTONE_ID, { name: 'Final' }],
    ['updateScheduleItem', ITEM_ID, { endDate: '2026-09-25' }],
    ['updateScheduleVersion', VERSION_ID, { locked: true }],
    ['updateScheduleVersionTaskLink', LINK_ID, { estimation: 60 }]
  ])('%s refuses the changes given as options', async (name, id, options) => {
    await expect(kitsu.schedule[name]({ id }, options)).rejects.toBeInstanceOf(
      ParameterError
    )
    expect(fake.calls).toHaveLength(0)
  })

  // An id holds nothing to save: Zou would answer the empty update with the
  // record, its updated_at bumped and an update event sent.
  it.each([
    ['updateMilestone', MILESTONE_ID],
    ['updateScheduleItem', ITEM_ID],
    ['updateScheduleVersion', VERSION_ID],
    ['updateScheduleVersionTaskLink', LINK_ID]
  ])('%s refuses an id given alone', async (name, id) => {
    await expect(kitsu.schedule[name](id)).rejects.toBeInstanceOf(
      ParameterError
    )
    expect(fake.calls).toHaveLength(0)
  })

  it.each([
    ['updateMilestone', MILESTONE_ID, { name: 'Final' }],
    ['updateScheduleItem', ITEM_ID, { man_days: 12 }],
    ['updateScheduleVersion', VERSION_ID, { locked: true }],
    ['updateScheduleVersionTaskLink', LINK_ID, { estimation: 60 }]
  ])('%s takes null options as none', async (name, id, fields) => {
    fake.reply(200, { id, ...fields })
    expect(await kitsu.schedule[name]({ id, ...fields }, null)).toEqual({
      id,
      ...fields
    })
    expect(fake.calls[0].body).toEqual(fields)
  })

  it('updateMilestone refuses an invalid Date', async () => {
    await expect(
      kitsu.schedule.updateMilestone({
        id: MILESTONE_ID,
        date: new Date('not a date')
      })
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  // The core aborts its own request signal as soon as the caller signal is
  // aborted: an aborted request signal proves the option went through.
  it.each([
    ['updateMilestone', MILESTONE_ID],
    ['updateScheduleItem', ITEM_ID],
    ['updateScheduleVersion', VERSION_ID],
    ['updateScheduleVersionTaskLink', LINK_ID]
  ])('%s forwards the caller signal', async (name, id) => {
    const controller = new AbortController()
    controller.abort()
    fake.reply(200, { id })
    await kitsu.schedule[name]({ id }, { signal: controller.signal })
    expect(fake.calls[0].signal.aborted).toBe(true)
  })
})
