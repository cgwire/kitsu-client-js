import { beforeEach, describe, expect, it } from 'vitest'

import { NotFoundError } from '../../src/core/errors.js'
import { makeClient } from '../helpers/client.js'
import {
  ASSET_ID,
  PERSON_ID,
  PROJECT_ID,
  TASK_STATUS_ID,
  TASK_TYPE_ID
} from '../helpers/ids.js'

const AUTOMATION_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const BACKGROUND_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

describe('project namespace: settings', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('addAssetType links an asset type to the project', async () => {
    fake.reply(201, { id: PROJECT_ID })
    expect(
      await kitsu.project.addAssetType({ id: PROJECT_ID }, { id: ASSET_ID })
    ).toEqual({ id: PROJECT_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/data/projects/${PROJECT_ID}/settings/asset-types`
    })
    expect(fake.calls[0].body).toEqual({ asset_type_id: ASSET_ID })
  })

  it('addTaskType links a task type with its priority', async () => {
    fake.reply(201, { id: PROJECT_ID })
    expect(
      await kitsu.project.addTaskType(PROJECT_ID, { id: TASK_TYPE_ID }, 3)
    ).toEqual({ id: PROJECT_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/data/projects/${PROJECT_ID}/settings/task-types`
    })
    expect(fake.calls[0].body).toEqual({
      task_type_id: TASK_TYPE_ID,
      priority: 3
    })
  })

  it('addTaskType sends the bitrates only when they are set', async () => {
    fake.reply(201, {}).reply(201, {})
    await kitsu.project.addTaskType(PROJECT_ID, TASK_TYPE_ID, 1, {
      hdBitrateCompression: 28,
      ldBitrateCompression: 6
    })
    await kitsu.project.addTaskType(PROJECT_ID, TASK_TYPE_ID, 1, {
      ldBitrateCompression: 0
    })
    expect(fake.calls[0].body).toEqual({
      task_type_id: TASK_TYPE_ID,
      priority: 1,
      hd_bitrate_compression: 28,
      ld_bitrate_compression: 6
    })
    expect(fake.calls[1].body).toEqual({
      task_type_id: TASK_TYPE_ID,
      priority: 1,
      ld_bitrate_compression: 0
    })
  })

  it('addTaskStatus links a task status to the project', async () => {
    fake.reply(201, { id: PROJECT_ID })
    await kitsu.project.addTaskStatus(PROJECT_ID, { id: TASK_STATUS_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/data/projects/${PROJECT_ID}/settings/task-status`
    })
    expect(fake.calls[0].body).toEqual({ task_status_id: TASK_STATUS_ID })
  })

  it('removeTaskType unlinks the task type', async () => {
    fake.reply(204)
    expect(
      await kitsu.project.removeTaskType({ id: PROJECT_ID }, TASK_TYPE_ID)
    ).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/projects/${PROJECT_ID}/settings/task-types/${TASK_TYPE_ID}`
    })
  })

  it('removeTaskStatus unlinks the task status', async () => {
    fake.reply(204)
    await kitsu.project.removeTaskStatus(PROJECT_ID, { id: TASK_STATUS_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/projects/${PROJECT_ID}/settings/task-status/${TASK_STATUS_ID}`
    })
  })

  it('getProjectTaskTypes lists the task types of the project', async () => {
    fake.reply(200, [{ id: TASK_TYPE_ID }])
    expect(await kitsu.project.getProjectTaskTypes({ id: PROJECT_ID })).toEqual(
      [{ id: TASK_TYPE_ID }]
    )
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/settings/task-types`
    })
  })

  it('getProjectTaskStatuses lists the task statuses of the project', async () => {
    fake.reply(200, [{ id: TASK_STATUS_ID }])
    expect(await kitsu.project.getProjectTaskStatuses(PROJECT_ID)).toEqual([
      { id: TASK_STATUS_ID }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/settings/task-status`
    })
  })

  it('list getters reject with NotFoundError on an unknown project', async () => {
    fake.reply(404, {})
    await expect(
      kitsu.project.getProjectTaskTypes(PROJECT_ID)
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it('allStatusAutomations lists the automations of the project', async () => {
    fake.reply(200, [{ id: AUTOMATION_ID }])
    expect(await kitsu.project.allStatusAutomations(PROJECT_ID)).toEqual([
      { id: AUTOMATION_ID }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/settings/status-automations`
    })
  })

  it('addStatusAutomation posts the automation payload as given', async () => {
    fake.reply(201, { id: PROJECT_ID })
    const automation = { status_automation_id: AUTOMATION_ID }
    await kitsu.project.addStatusAutomation({ id: PROJECT_ID }, automation)
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/data/projects/${PROJECT_ID}/settings/status-automations`
    })
    expect(fake.calls[0].body).toEqual({
      status_automation_id: AUTOMATION_ID
    })
  })

  it('removeStatusAutomation unlinks the automation', async () => {
    fake.reply(204)
    await kitsu.project.removeStatusAutomation(PROJECT_ID, {
      id: AUTOMATION_ID
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/projects/${PROJECT_ID}/settings/status-automations/${AUTOMATION_ID}`
    })
  })

  it('getPreviewBackgroundFiles lists the backgrounds of the project', async () => {
    fake.reply(200, [{ id: BACKGROUND_ID }])
    expect(await kitsu.project.getPreviewBackgroundFiles(PROJECT_ID)).toEqual([
      { id: BACKGROUND_ID }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/settings/preview-background-files`
    })
  })

  it('removePreviewBackgroundFile unlinks the background', async () => {
    fake.reply(204)
    await kitsu.project.removePreviewBackgroundFile(
      { id: PROJECT_ID },
      BACKGROUND_ID
    )
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/projects/${PROJECT_ID}/settings/preview-background-files/${BACKGROUND_ID}`
    })
  })
})

describe('project namespace: team, milestones and quotas', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('getTeam lists the persons of the project team', async () => {
    fake.reply(200, [{ id: PERSON_ID }])
    expect(await kitsu.project.getTeam({ id: PROJECT_ID })).toEqual([
      { id: PERSON_ID }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/team`
    })
  })

  it('addPersonToTeam adds the person, with a project role on demand', async () => {
    fake.reply(201, { id: PROJECT_ID }).reply(201, { id: PROJECT_ID })
    await kitsu.project.addPersonToTeam(PROJECT_ID, { id: PERSON_ID })
    await kitsu.project.addPersonToTeam({ id: PROJECT_ID }, PERSON_ID, {
      role: 'supervisor'
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/data/projects/${PROJECT_ID}/team`
    })
    expect(fake.calls[0].body).toEqual({ person_id: PERSON_ID })
    expect(fake.calls[1].body).toEqual({
      person_id: PERSON_ID,
      role: 'supervisor'
    })
  })

  it('updateTeamMemberRole sets the project role, null to inherit', async () => {
    fake.reply(200, { role: 'manager' }).reply(200, { role: null })
    expect(
      await kitsu.project.updateTeamMemberRole(PROJECT_ID, PERSON_ID, 'manager')
    ).toEqual({ role: 'manager' })
    await kitsu.project.updateTeamMemberRole(
      { id: PROJECT_ID },
      { id: PERSON_ID },
      null
    )
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/projects/${PROJECT_ID}/team/${PERSON_ID}`
    })
    expect(fake.calls[0].body).toEqual({ role: 'manager' })
    expect(fake.calls[1].body).toEqual({ role: null })
  })

  it('removePersonFromTeam removes the person from the team', async () => {
    fake.reply(204)
    await kitsu.project.removePersonFromTeam(PROJECT_ID, { id: PERSON_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/projects/${PROJECT_ID}/team/${PERSON_ID}`
    })
  })

  it('getMilestones lists the milestones of the project', async () => {
    fake.reply(200, [{ name: 'Animatic' }])
    expect(await kitsu.project.getMilestones(PROJECT_ID)).toEqual([
      { name: 'Animatic' }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/milestones`
    })
  })

  it('getProjectQuotas reads the quotas of a task type', async () => {
    fake.reply(200, { [PERSON_ID]: {} })
    expect(
      await kitsu.project.getProjectQuotas(PROJECT_ID, { id: TASK_TYPE_ID })
    ).toEqual({ [PERSON_ID]: {} })
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/quotas/${TASK_TYPE_ID}`
    })
  })

  it('getProjectPersonQuotas reads the quotas of a person', async () => {
    fake.reply(200, { [TASK_TYPE_ID]: {} })
    expect(
      await kitsu.project.getProjectPersonQuotas({ id: PROJECT_ID }, PERSON_ID)
    ).toEqual({ [TASK_TYPE_ID]: {} })
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/quotas/persons/${PERSON_ID}`
    })
  })
})
