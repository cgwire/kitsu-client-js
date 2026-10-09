import { beforeEach, describe, expect, it } from 'vitest'

import { ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import {
  ASSET_TYPE_ID,
  DEPARTMENT_ID,
  OTHER_ID,
  PERSON_ID,
  PREVIEW_BACKGROUND_FILE_ID,
  PROJECT_ID,
  STATUS_AUTOMATION_ID,
  TASK_STATUS_ID,
  TASK_TYPE_ID
} from '../helpers/ids.js'

describe('project namespace: Kitsu store coverage', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  describe('preview background files', () => {
    it('allPreviewBackgroundFiles lists every background', async () => {
      fake.reply(200, [{ id: PREVIEW_BACKGROUND_FILE_ID }])
      expect(await kitsu.project.allPreviewBackgroundFiles()).toEqual([
        { id: PREVIEW_BACKGROUND_FILE_ID }
      ])
      expect(fake.calls[0]).toMatchObject({
        method: 'GET',
        path: '/data/preview-background-files'
      })
    })

    it('getPreviewBackgroundFile reads one background', async () => {
      fake.reply(200, { id: PREVIEW_BACKGROUND_FILE_ID })
      expect(
        await kitsu.project.getPreviewBackgroundFile({
          id: PREVIEW_BACKGROUND_FILE_ID
        })
      ).toEqual({ id: PREVIEW_BACKGROUND_FILE_ID })
      expect(fake.calls[0]).toMatchObject({
        method: 'GET',
        path: `/data/preview-background-files/${PREVIEW_BACKGROUND_FILE_ID}`
      })
    })

    it('getPreviewBackgroundFile returns null on a 404', async () => {
      fake.reply(404, {})
      expect(
        await kitsu.project.getPreviewBackgroundFile(PREVIEW_BACKGROUND_FILE_ID)
      ).toBeNull()
    })

    it('newPreviewBackgroundFile creates the background record', async () => {
      fake.reply(201, { id: PREVIEW_BACKGROUND_FILE_ID })
      expect(
        await kitsu.project.newPreviewBackgroundFile('Studio HDR', {
          isDefault: true
        })
      ).toEqual({ id: PREVIEW_BACKGROUND_FILE_ID })
      expect(fake.calls[0]).toMatchObject({
        method: 'POST',
        path: '/data/preview-background-files',
        body: { name: 'Studio HDR', archived: false, is_default: true }
      })
    })

    it('newPreviewBackgroundFile rejects a blank name', async () => {
      await expect(
        kitsu.project.newPreviewBackgroundFile('')
      ).rejects.toBeInstanceOf(ParameterError)
      expect(fake.calls).toHaveLength(0)
    })

    it('updatePreviewBackgroundFile saves the background', async () => {
      fake.reply(200, { id: PREVIEW_BACKGROUND_FILE_ID, name: 'Sky' })
      await kitsu.project.updatePreviewBackgroundFile({
        id: PREVIEW_BACKGROUND_FILE_ID,
        name: 'Sky'
      })
      expect(fake.calls[0]).toMatchObject({
        method: 'PUT',
        path: `/data/preview-background-files/${PREVIEW_BACKGROUND_FILE_ID}`,
        body: { id: PREVIEW_BACKGROUND_FILE_ID, name: 'Sky' }
      })
    })

    it('deletePreviewBackgroundFile deletes the background', async () => {
      fake.reply(204, '')
      await kitsu.project.deletePreviewBackgroundFile({
        id: PREVIEW_BACKGROUND_FILE_ID
      })
      expect(fake.calls[0]).toMatchObject({
        method: 'DELETE',
        path: `/data/preview-background-files/${PREVIEW_BACKGROUND_FILE_ID}`
      })
    })

    it('uploadPreviewBackgroundFile sends the HDR file', async () => {
      fake.reply(201, { id: PREVIEW_BACKGROUND_FILE_ID })
      await kitsu.project.uploadPreviewBackgroundFile(
        { id: PREVIEW_BACKGROUND_FILE_ID },
        new Blob(['hdr']),
        { fileName: 'sky.hdr' }
      )
      expect(fake.calls[0]).toMatchObject({
        method: 'POST',
        path: `/pictures/preview-background-files/${PREVIEW_BACKGROUND_FILE_ID}`
      })
      const { body } = fake.calls[0]
      expect(body).toBeInstanceOf(FormData)
      expect([...body.keys()]).toEqual(['file'])
      expect(body.get('file').name).toBe('sky.hdr')
    })

    it('uploadPreviewBackgroundFile rejects a missing file', async () => {
      await expect(
        kitsu.project.uploadPreviewBackgroundFile(PREVIEW_BACKGROUND_FILE_ID)
      ).rejects.toBeInstanceOf(ParameterError)
      expect(fake.calls).toHaveLength(0)
    })
  })

  describe('status automations', () => {
    it('allGlobalStatusAutomations lists every automation', async () => {
      fake.reply(200, [{ id: STATUS_AUTOMATION_ID }])
      expect(await kitsu.project.allGlobalStatusAutomations()).toEqual([
        { id: STATUS_AUTOMATION_ID }
      ])
      expect(fake.calls[0]).toMatchObject({
        method: 'GET',
        path: '/data/status-automations'
      })
    })

    it('getStatusAutomation reads one automation', async () => {
      fake.reply(200, { id: STATUS_AUTOMATION_ID })
      expect(
        await kitsu.project.getStatusAutomation({ id: STATUS_AUTOMATION_ID })
      ).toEqual({ id: STATUS_AUTOMATION_ID })
      expect(fake.calls[0]).toMatchObject({
        method: 'GET',
        path: `/data/status-automations/${STATUS_AUTOMATION_ID}`
      })
    })

    it('getStatusAutomation returns null on a 404', async () => {
      fake.reply(404, {})
      expect(
        await kitsu.project.getStatusAutomation(STATUS_AUTOMATION_ID)
      ).toBeNull()
    })

    it('newStatusAutomation posts the automation in snake case', async () => {
      fake.reply(201, { id: STATUS_AUTOMATION_ID })
      await kitsu.project.newStatusAutomation(
        { id: TASK_TYPE_ID },
        TASK_STATUS_ID,
        'status',
        OTHER_ID,
        {
          entityType: 'shot',
          outTaskStatus: { id: TASK_STATUS_ID },
          importLastRevision: true
        }
      )
      expect(fake.calls[0]).toMatchObject({
        method: 'POST',
        path: '/data/status-automations'
      })
      expect(fake.calls[0].body).toEqual({
        entity_type: 'shot',
        in_task_type_id: TASK_TYPE_ID,
        in_task_status_id: TASK_STATUS_ID,
        out_field_type: 'status',
        out_task_type_id: OTHER_ID,
        out_task_status_id: TASK_STATUS_ID,
        import_last_revision: true
      })
    })

    it('newStatusAutomation leaves the unset output out of the body', async () => {
      fake.reply(201, { id: STATUS_AUTOMATION_ID })
      await kitsu.project.newStatusAutomation(
        TASK_TYPE_ID,
        TASK_STATUS_ID,
        'ready_for',
        OTHER_ID
      )
      expect(fake.calls[0].body).toEqual({
        entity_type: 'asset',
        in_task_type_id: TASK_TYPE_ID,
        in_task_status_id: TASK_STATUS_ID,
        out_field_type: 'ready_for',
        out_task_type_id: OTHER_ID,
        import_last_revision: false
      })
    })

    it('newStatusAutomation rejects a missing input or output', async () => {
      await expect(kitsu.project.newStatusAutomation()).rejects.toBeInstanceOf(
        ParameterError
      )
      // Zou would store an automation that nothing triggers.
      await expect(
        kitsu.project.newStatusAutomation(
          undefined,
          TASK_STATUS_ID,
          'ready_for',
          OTHER_ID
        )
      ).rejects.toBeInstanceOf(ParameterError)
      await expect(
        kitsu.project.newStatusAutomation(
          TASK_TYPE_ID,
          undefined,
          'ready_for',
          OTHER_ID
        )
      ).rejects.toBeInstanceOf(ParameterError)
      await expect(
        kitsu.project.newStatusAutomation(
          TASK_TYPE_ID,
          TASK_STATUS_ID,
          '',
          OTHER_ID
        )
      ).rejects.toBeInstanceOf(ParameterError)
      await expect(
        kitsu.project.newStatusAutomation(
          TASK_TYPE_ID,
          TASK_STATUS_ID,
          'ready_for'
        )
      ).rejects.toBeInstanceOf(ParameterError)
      expect(fake.calls).toHaveLength(0)
    })

    it('newStatusAutomation rejects an unknown output type', async () => {
      await expect(
        kitsu.project.newStatusAutomation(
          TASK_TYPE_ID,
          TASK_STATUS_ID,
          'ready-for',
          OTHER_ID
        )
      ).rejects.toBeInstanceOf(ParameterError)
      expect(fake.calls).toHaveLength(0)
    })

    it('newStatusAutomation rejects a status output without its status', async () => {
      await expect(
        kitsu.project.newStatusAutomation(
          TASK_TYPE_ID,
          TASK_STATUS_ID,
          'status',
          OTHER_ID
        )
      ).rejects.toBeInstanceOf(ParameterError)
      expect(fake.calls).toHaveLength(0)
    })

    // Zou stores it, then ignores it: a shot is never ready for a task type.
    it('newStatusAutomation rejects a ready_for output on shots', async () => {
      await expect(
        kitsu.project.newStatusAutomation(
          TASK_TYPE_ID,
          TASK_STATUS_ID,
          'ready_for',
          OTHER_ID,
          { entityType: 'shot' }
        )
      ).rejects.toBeInstanceOf(ParameterError)
      expect(fake.calls).toHaveLength(0)
    })

    it('newStatusAutomation names its arguments to a 0.1.0 call', async () => {
      const err = await kitsu.project
        .newStatusAutomation({
          inTaskType: TASK_TYPE_ID,
          inTaskStatus: TASK_STATUS_ID,
          outFieldType: 'ready_for',
          outTaskType: OTHER_ID
        })
        .catch(e => e)
      expect(err).toBeInstanceOf(ParameterError)
      expect(err.message).toMatch(/positional arguments/)
      expect(fake.calls).toHaveLength(0)
    })

    it('updateStatusAutomation saves the automation', async () => {
      fake.reply(200, { id: STATUS_AUTOMATION_ID })
      await kitsu.project.updateStatusAutomation({
        id: STATUS_AUTOMATION_ID,
        archived: true
      })
      expect(fake.calls[0]).toMatchObject({
        method: 'PUT',
        path: `/data/status-automations/${STATUS_AUTOMATION_ID}`,
        body: { id: STATUS_AUTOMATION_ID, archived: true }
      })
    })

    it('deleteStatusAutomation deletes the automation', async () => {
      fake.reply(204, '')
      await kitsu.project.deleteStatusAutomation({ id: STATUS_AUTOMATION_ID })
      expect(fake.calls[0]).toMatchObject({
        method: 'DELETE',
        path: `/data/status-automations/${STATUS_AUTOMATION_ID}`
      })
    })
  })

  describe('time spents and days off', () => {
    it('getBudgetsTimeSpents reads the time spents of the budgets', async () => {
      fake.reply(200, { [PROJECT_ID]: {} })
      expect(
        await kitsu.project.getBudgetsTimeSpents({ id: PROJECT_ID })
      ).toEqual({ [PROJECT_ID]: {} })
      expect(fake.calls[0]).toMatchObject({
        method: 'GET',
        path: `/data/projects/${PROJECT_ID}/budgets/time-spents`
      })
    })

    it('getTaskTypeTimeSpents filters on a date range', async () => {
      const timeSpents = { [PERSON_ID]: [{ id: OTHER_ID, duration: 480 }] }
      fake.reply(200, timeSpents)
      const result = await kitsu.project.getTaskTypeTimeSpents(
        { id: PROJECT_ID },
        { id: TASK_TYPE_ID },
        { startDate: new Date(2026, 0, 5), endDate: '2026-01-31' }
      )
      expect(fake.calls[0]).toMatchObject({
        method: 'GET',
        path: `/data/projects/${PROJECT_ID}/task-types/${TASK_TYPE_ID}/time-spents`
      })
      expect(fake.calls[0].query.get('start_date')).toBe('2026-01-05')
      expect(fake.calls[0].query.get('end_date')).toBe('2026-01-31')
      expect(result).toEqual(timeSpents)
    })

    it('getTaskTypeTimeSpents sends no date by default', async () => {
      fake.reply(200, {})
      await kitsu.project.getTaskTypeTimeSpents(PROJECT_ID, TASK_TYPE_ID)
      expect([...fake.calls[0].query.keys()]).toEqual([])
    })

    it('allDayOffsForProject filters on a date range', async () => {
      const dayOffs = { [PERSON_ID]: [{ id: OTHER_ID, date: '2026-01-12' }] }
      fake.reply(200, dayOffs)
      const result = await kitsu.project.allDayOffsForProject(
        { id: PROJECT_ID },
        { startDate: '2026-01-01', endDate: new Date(2026, 0, 31) }
      )
      expect(fake.calls[0]).toMatchObject({
        method: 'GET',
        path: `/data/projects/${PROJECT_ID}/day-offs`
      })
      expect(fake.calls[0].query.get('start_date')).toBe('2026-01-01')
      expect(fake.calls[0].query.get('end_date')).toBe('2026-01-31')
      expect(result).toEqual(dayOffs)
    })
  })

  describe('project settings', () => {
    it('allProjectsWithAccess lists the projects the user can access', async () => {
      fake.reply(200, [
        { id: OTHER_ID, name: 'b' },
        { id: PROJECT_ID, name: 'A' }
      ])
      expect(await kitsu.project.allProjectsWithAccess()).toEqual([
        { id: PROJECT_ID, name: 'A' },
        { id: OTHER_ID, name: 'b' }
      ])
      expect(fake.calls[0]).toMatchObject({
        method: 'GET',
        path: '/data/projects/all'
      })
    })

    it('removeAssetType unlinks an asset type from the project', async () => {
      fake.reply(204, '')
      await kitsu.project.removeAssetType(
        { id: PROJECT_ID },
        { id: ASSET_TYPE_ID }
      )
      expect(fake.calls[0]).toMatchObject({
        method: 'DELETE',
        path: `/data/projects/${PROJECT_ID}/settings/asset-types/${ASSET_TYPE_ID}`
      })
    })

    it('addSettings links task types, statuses and asset types at once', async () => {
      fake.reply(201, { id: PROJECT_ID })
      await kitsu.project.addSettings(
        { id: PROJECT_ID },
        {
          taskTypes: [
            { taskType: { id: TASK_TYPE_ID }, priority: 2 },
            { taskType: OTHER_ID }
          ],
          taskStatuses: [{ id: TASK_STATUS_ID }],
          assetTypes: [ASSET_TYPE_ID],
          replaceTaskTypes: true
        }
      )
      expect(fake.calls[0]).toMatchObject({
        method: 'POST',
        path: `/data/projects/${PROJECT_ID}/settings/batch`
      })
      expect(fake.calls[0].body).toEqual({
        task_types: [
          { task_type_id: TASK_TYPE_ID, priority: 2 },
          { task_type_id: OTHER_ID, priority: null }
        ],
        task_status_ids: [TASK_STATUS_ID],
        asset_type_ids: [ASSET_TYPE_ID],
        replace_task_types: true
      })
    })

    it('addSettings sends empty lists by default', async () => {
      fake.reply(201, { id: PROJECT_ID })
      await kitsu.project.addSettings(PROJECT_ID)
      expect(fake.calls[0].body).toEqual({
        task_types: [],
        task_status_ids: [],
        asset_type_ids: [],
        replace_task_types: false
      })
    })

    it('updateTaskStatusLink sets the priority and the board roles', async () => {
      fake.reply(201, { id: OTHER_ID })
      await kitsu.project.updateTaskStatusLink(
        { id: PROJECT_ID },
        { id: TASK_STATUS_ID },
        3,
        ['admin', 'manager']
      )
      expect(fake.calls[0]).toMatchObject({
        method: 'POST',
        path: '/data/task-status-links'
      })
      expect(fake.calls[0].body).toEqual({
        project_id: PROJECT_ID,
        task_status_id: TASK_STATUS_ID,
        priority: 3,
        roles_for_board: ['admin', 'manager']
      })
    })

    it('updateTaskStatusLink accepts priority 0 and no board role', async () => {
      fake.reply(201, { id: OTHER_ID })
      await kitsu.project.updateTaskStatusLink(
        PROJECT_ID,
        TASK_STATUS_ID,
        0,
        []
      )
      expect(fake.calls[0].body).toEqual({
        project_id: PROJECT_ID,
        task_status_id: TASK_STATUS_ID,
        priority: 0,
        roles_for_board: []
      })
    })

    it('updateTaskStatusLink rejects a missing priority or board roles', async () => {
      await expect(
        kitsu.project.updateTaskStatusLink(PROJECT_ID, TASK_STATUS_ID)
      ).rejects.toBeInstanceOf(ParameterError)
      await expect(
        kitsu.project.updateTaskStatusLink(PROJECT_ID, TASK_STATUS_ID, 3)
      ).rejects.toBeInstanceOf(ParameterError)
      expect(fake.calls).toHaveLength(0)
    })

    it('reorderTaskStatusLinks sends the ordered task status ids', async () => {
      fake.reply(200, [])
      await kitsu.project.reorderTaskStatusLinks({ id: PROJECT_ID }, [
        { id: TASK_STATUS_ID },
        OTHER_ID
      ])
      expect(fake.calls[0]).toMatchObject({
        method: 'POST',
        path: `/actions/projects/${PROJECT_ID}/task-status-links/reorder`,
        body: { task_status_ids: [TASK_STATUS_ID, OTHER_ID] }
      })
    })

    it('updateTaskTypeLink sets the priority of the link', async () => {
      fake.reply(201, { id: OTHER_ID })
      await kitsu.project.updateTaskTypeLink(
        { id: PROJECT_ID },
        { id: TASK_TYPE_ID },
        4
      )
      expect(fake.calls[0]).toMatchObject({
        method: 'POST',
        path: '/data/task-type-links'
      })
      expect(fake.calls[0].body).toEqual({
        project_id: PROJECT_ID,
        task_type_id: TASK_TYPE_ID,
        priority: 4
      })
    })

    it('updateTaskTypeLink accepts priority 0', async () => {
      fake.reply(201, { id: OTHER_ID })
      await kitsu.project.updateTaskTypeLink(PROJECT_ID, TASK_TYPE_ID, 0)
      expect(fake.calls[0].body).toEqual({
        project_id: PROJECT_ID,
        task_type_id: TASK_TYPE_ID,
        priority: 0
      })
    })

    it('updateTaskTypeLink rejects a missing priority', async () => {
      await expect(
        kitsu.project.updateTaskTypeLink(PROJECT_ID, TASK_TYPE_ID)
      ).rejects.toBeInstanceOf(ParameterError)
      expect(fake.calls).toHaveLength(0)
    })

    it('reorderTaskTypeLinks sends the ordered task type ids', async () => {
      fake.reply(200, [])
      await kitsu.project.reorderTaskTypeLinks({ id: PROJECT_ID }, [
        { id: TASK_TYPE_ID },
        OTHER_ID
      ])
      expect(fake.calls[0]).toMatchObject({
        method: 'POST',
        path: `/actions/projects/${PROJECT_ID}/task-type-links/reorder`,
        body: { task_type_ids: [TASK_TYPE_ID, OTHER_ID] }
      })
    })
  })

  describe('metadata descriptors on all projects', () => {
    it('addMetadataDescriptorToAllProjects creates the descriptor', async () => {
      fake.reply(201, [{ id: OTHER_ID }])
      await kitsu.project.addMetadataDescriptorToAllProjects(
        'Difficulty',
        'Asset',
        {
          dataType: 'list',
          choices: ['easy', 'hard'],
          forClient: true,
          departments: [{ id: DEPARTMENT_ID }]
        }
      )
      expect(fake.calls[0]).toMatchObject({
        method: 'POST',
        path: '/data/metadata-descriptors/all-projects'
      })
      expect(fake.calls[0].body).toEqual({
        name: 'Difficulty',
        data_type: 'list',
        choices: ['easy', 'hard'],
        for_client: true,
        entity_type: 'Asset',
        departments: [DEPARTMENT_ID]
      })
    })

    it('updateMetadataDescriptorOnAllProjects targets the field name', async () => {
      fake.reply(200, [{ id: OTHER_ID }])
      await kitsu.project.updateMetadataDescriptorOnAllProjects('difficulty', {
        name: 'Level',
        entity_type: 'Asset',
        data_type: 'list',
        choices: ['easy', 'hard'],
        for_client: true,
        departments: [{ id: DEPARTMENT_ID }]
      })
      expect(fake.calls[0]).toMatchObject({
        method: 'PUT',
        path: '/data/metadata-descriptors/all-projects/difficulty'
      })
      expect(fake.calls[0].body).toEqual({
        name: 'Level',
        entity_type: 'Asset',
        data_type: 'list',
        choices: ['easy', 'hard'],
        for_client: true,
        departments: [DEPARTMENT_ID]
      })
    })

    it('updateMetadataDescriptorOnAllProjects rejects a missing entity type', async () => {
      await expect(
        kitsu.project.updateMetadataDescriptorOnAllProjects('difficulty', {
          name: 'Level',
          data_type: 'list'
        })
      ).rejects.toBeInstanceOf(ParameterError)
      expect(fake.calls).toHaveLength(0)
    })

    it('updateMetadataDescriptorOnAllProjects keeps the field name inside its path segment', async () => {
      fake.reply(200, [])
      await kitsu.project.updateMetadataDescriptorOnAllProjects('a/b', {
        entity_type: 'Asset'
      })
      expect(fake.calls[0].path).toBe(
        '/data/metadata-descriptors/all-projects/a%2Fb'
      )
    })

    it('updateMetadataDescriptorOnAllProjects rejects a blank field name', async () => {
      await expect(
        kitsu.project.updateMetadataDescriptorOnAllProjects('', {})
      ).rejects.toBeInstanceOf(ParameterError)
      expect(fake.calls).toHaveLength(0)
    })

    it('removeMetadataDescriptorOnAllProjects sends the entity type as a query', async () => {
      fake.reply(204, '')
      await kitsu.project.removeMetadataDescriptorOnAllProjects(
        'difficulty',
        'Asset'
      )
      expect(fake.calls[0]).toMatchObject({
        method: 'DELETE',
        path: '/data/metadata-descriptors/all-projects/difficulty'
      })
      expect(fake.calls[0].query.get('entity_type')).toBe('Asset')
    })

    it('reorderMetadataDescriptorsOnAllProjects sends the field names in order', async () => {
      fake.reply(200, [])
      await kitsu.project.reorderMetadataDescriptorsOnAllProjects('Asset', [
        'difficulty',
        'size'
      ])
      expect(fake.calls[0]).toMatchObject({
        method: 'POST',
        path: '/actions/metadata-descriptors/all-projects/reorder',
        body: { entity_type: 'Asset', field_order: ['difficulty', 'size'] }
      })
    })
  })
})
