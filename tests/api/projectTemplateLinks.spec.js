import { beforeEach, describe, expect, it } from 'vitest'

import { ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import {
  ASSET_TYPE_ID,
  OTHER_ID,
  TASK_STATUS_ID,
  TASK_TYPE_ID
} from '../helpers/ids.js'

const TEMPLATE_ID = 'c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1'
const STATUS_AUTOMATION_ID = 'c2c2c2c2-c2c2-4c2c-8c2c-c2c2c2c2c2c2'
const BACKGROUND_ID = 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3'
const LINK_ID = 'c4c4c4c4-c4c4-4c4c-8c4c-c4c4c4c4c4c4'

const STAMPS = {
  created_at: '2026-10-01T09:00:00',
  updated_at: '2026-10-01T09:00:00'
}

// Zou answers the task type and task status routes with the link, and the
// other ones with the linked entity.
const LINKS = [
  {
    label: 'TaskType',
    plural: 'allTaskTypesForProjectTemplate',
    segment: 'task-types',
    key: 'task_type_id',
    id: TASK_TYPE_ID,
    answer: {
      id: LINK_ID,
      project_template_id: TEMPLATE_ID,
      task_type_id: TASK_TYPE_ID,
      priority: null,
      hd_bitrate_compression: null,
      ld_bitrate_compression: null,
      ...STAMPS,
      type: 'ProjectTemplateTaskTypeLink'
    }
  },
  {
    label: 'TaskStatus',
    plural: 'allTaskStatusesForProjectTemplate',
    segment: 'task-statuses',
    key: 'task_status_id',
    id: TASK_STATUS_ID,
    answer: {
      id: LINK_ID,
      project_template_id: TEMPLATE_ID,
      task_status_id: TASK_STATUS_ID,
      priority: null,
      roles_for_board: ['user', 'admin', 'supervisor', 'manager', 'vendor'],
      ...STAMPS,
      type: 'ProjectTemplateTaskStatusLink'
    }
  },
  {
    label: 'AssetType',
    plural: 'allAssetTypesForProjectTemplate',
    segment: 'asset-types',
    key: 'asset_type_id',
    id: ASSET_TYPE_ID,
    answer: { id: ASSET_TYPE_ID, name: 'Props' }
  },
  {
    label: 'StatusAutomation',
    plural: 'allStatusAutomationsForProjectTemplate',
    segment: 'status-automations',
    key: 'status_automation_id',
    id: STATUS_AUTOMATION_ID,
    answer: {
      id: STATUS_AUTOMATION_ID,
      entity_type: 'asset',
      in_task_type_id: TASK_TYPE_ID,
      in_task_status_id: TASK_STATUS_ID,
      out_field_type: 'ready_for',
      out_task_type_id: OTHER_ID,
      out_task_status_id: null,
      import_last_revision: false,
      archived: false,
      ...STAMPS,
      type: 'StatusAutomation'
    }
  },
  {
    label: 'PreviewBackgroundFile',
    plural: 'allPreviewBackgroundFilesForProjectTemplate',
    segment: 'preview-background-files',
    key: 'preview_background_file_id',
    id: BACKGROUND_ID,
    answer: { id: BACKGROUND_ID, name: 'Studio', is_default: false }
  }
]

describe('projectTemplate namespace: links', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  LINKS.forEach(({ label, plural, segment, key, id, answer }) => {
    it(`${plural} lists the links of a template`, async () => {
      fake.reply(200, [
        { id, name: 'b' },
        { id: OTHER_ID, name: 'a' }
      ])
      expect(await kitsu.projectTemplate[plural]({ id: TEMPLATE_ID })).toEqual([
        { id, name: 'b' },
        { id: OTHER_ID, name: 'a' }
      ])
      expect(fake.calls[0]).toMatchObject({
        method: 'GET',
        path: `/data/project-templates/${TEMPLATE_ID}/${segment}`
      })
    })

    it(`add${label}ToProjectTemplate attaches the link`, async () => {
      fake.reply(201, answer)
      expect(
        await kitsu.projectTemplate[`add${label}ToProjectTemplate`](
          TEMPLATE_ID,
          { id }
        )
      ).toEqual(answer)
      expect(fake.calls[0]).toMatchObject({
        method: 'POST',
        path: `/data/project-templates/${TEMPLATE_ID}/${segment}`
      })
      expect(fake.calls[0].body).toEqual({ [key]: id })
    })

    it(`remove${label}FromProjectTemplate detaches the link`, async () => {
      fake.reply(204)
      await kitsu.projectTemplate[`remove${label}FromProjectTemplate`](
        { id: TEMPLATE_ID },
        id
      )
      expect(fake.calls[0]).toMatchObject({
        method: 'DELETE',
        path: `/data/project-templates/${TEMPLATE_ID}/${segment}/${id}`
      })
    })

    it(`add${label}ToProjectTemplate rejects a missing link`, async () => {
      await expect(
        kitsu.projectTemplate[`add${label}ToProjectTemplate`](TEMPLATE_ID)
      ).rejects.toBeInstanceOf(ParameterError)
      expect(fake.calls).toHaveLength(0)
    })
  })

  it('addTaskTypeToProjectTemplate sends priority and bitrates', async () => {
    fake.reply(201, {})
    await kitsu.projectTemplate.addTaskTypeToProjectTemplate(
      TEMPLATE_ID,
      TASK_TYPE_ID,
      { priority: 0, hdBitrateCompression: 28, ldBitrateCompression: 6 }
    )
    expect(fake.calls[0].body).toEqual({
      task_type_id: TASK_TYPE_ID,
      priority: 0,
      hd_bitrate_compression: 28,
      ld_bitrate_compression: 6
    })
  })

  // Zou writes both bitrates as soon as one is given: null resets one to the
  // bitrate of the project.
  it('addTaskTypeToProjectTemplate sends the bitrates given, null included', async () => {
    fake.reply(201, {}).reply(201, {})
    await kitsu.projectTemplate.addTaskTypeToProjectTemplate(
      TEMPLATE_ID,
      TASK_TYPE_ID,
      { priority: 2 }
    )
    await kitsu.projectTemplate.addTaskTypeToProjectTemplate(
      TEMPLATE_ID,
      TASK_TYPE_ID,
      { hdBitrateCompression: null, ldBitrateCompression: 8 }
    )
    expect(fake.calls[0].body).toEqual({
      task_type_id: TASK_TYPE_ID,
      priority: 2
    })
    expect(fake.calls[1].body).toEqual({
      task_type_id: TASK_TYPE_ID,
      hd_bitrate_compression: null,
      ld_bitrate_compression: 8
    })
  })

  it('addTaskStatusToProjectTemplate sends priority and board roles', async () => {
    fake.reply(201, {})
    await kitsu.projectTemplate.addTaskStatusToProjectTemplate(
      TEMPLATE_ID,
      TASK_STATUS_ID,
      { priority: 2, rolesForBoard: ['admin', 'manager'] }
    )
    expect(fake.calls[0].body).toEqual({
      task_status_id: TASK_STATUS_ID,
      priority: 2,
      roles_for_board: ['admin', 'manager']
    })
  })

  it('setProjectTemplateDefaultPreviewBackgroundFile sets the default', async () => {
    fake.reply(200, { id: TEMPLATE_ID })
    expect(
      await kitsu.projectTemplate.setProjectTemplateDefaultPreviewBackgroundFile(
        { id: TEMPLATE_ID },
        { id: BACKGROUND_ID }
      )
    ).toEqual({ id: TEMPLATE_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/project-templates/${TEMPLATE_ID}/default-preview-background-file`
    })
    expect(fake.calls[0].body).toEqual({
      default_preview_background_file_id: BACKGROUND_ID
    })
  })

  it('setProjectTemplateDefaultPreviewBackgroundFile clears the default', async () => {
    fake.reply(200, { id: TEMPLATE_ID })
    await kitsu.projectTemplate.setProjectTemplateDefaultPreviewBackgroundFile(
      TEMPLATE_ID,
      null
    )
    expect(fake.calls[0].body).toEqual({
      default_preview_background_file_id: null
    })
  })
})
