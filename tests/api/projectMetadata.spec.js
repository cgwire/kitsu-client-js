import { beforeEach, describe, expect, it } from 'vitest'

import { makeClient } from '../helpers/client.js'
import {
  DEPARTMENT_ID,
  OTHER_ID,
  PROJECT_ID,
  TASK_TYPE_ID
} from '../helpers/ids.js'

const DESCRIPTOR_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

describe('project namespace: metadata descriptors', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('addMetadataDescriptor creates a descriptor with the defaults of gazu', async () => {
    fake.reply(201, { id: DESCRIPTOR_ID })
    expect(
      await kitsu.project.addMetadataDescriptor(
        { id: PROJECT_ID },
        'Difficulty',
        'Shot'
      )
    ).toEqual({ id: DESCRIPTOR_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/data/projects/${PROJECT_ID}/metadata-descriptors`
    })
    expect(fake.calls[0].body).toEqual({
      name: 'Difficulty',
      data_type: 'string',
      choices: [],
      for_client: false,
      entity_type: 'Shot',
      departments: []
    })
  })

  it('addMetadataDescriptor sends every option on the wire', async () => {
    fake.reply(201, { id: DESCRIPTOR_ID })
    await kitsu.project.addMetadataDescriptor(PROJECT_ID, 'Retake', 'Task', {
      dataType: 'list',
      choices: ['yes', 'no'],
      forClient: true,
      departments: [{ id: DEPARTMENT_ID }, OTHER_ID],
      taskTypeId: { id: TASK_TYPE_ID }
    })
    expect(fake.calls[0].body).toEqual({
      name: 'Retake',
      data_type: 'list',
      choices: ['yes', 'no'],
      for_client: true,
      entity_type: 'Task',
      departments: [DEPARTMENT_ID, OTHER_ID],
      task_type_id: TASK_TYPE_ID
    })
  })

  it('getMetadataDescriptor returns the descriptor, null on 404', async () => {
    fake.reply(200, { id: DESCRIPTOR_ID }).reply(404, {})
    expect(
      await kitsu.project.getMetadataDescriptor(PROJECT_ID, {
        id: DESCRIPTOR_ID
      })
    ).toEqual({ id: DESCRIPTOR_ID })
    expect(
      await kitsu.project.getMetadataDescriptor(
        { id: PROJECT_ID },
        DESCRIPTOR_ID
      )
    ).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/metadata-descriptors/${DESCRIPTOR_ID}`
    })
  })

  it('getMetadataDescriptorByFieldName filters by project and field', async () => {
    fake.reply(200, [{ id: DESCRIPTOR_ID }]).reply(200, [])
    expect(
      await kitsu.project.getMetadataDescriptorByFieldName(
        { id: PROJECT_ID },
        'difficulty'
      )
    ).toEqual({ id: DESCRIPTOR_ID })
    expect(
      await kitsu.project.getMetadataDescriptorByFieldName(PROJECT_ID, 'nope')
    ).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/metadata-descriptors'
    })
    expect(fake.calls[0].query.get('project_id')).toBe(PROJECT_ID)
    expect(fake.calls[0].query.get('field_name')).toBe('difficulty')
  })

  it('allMetadataDescriptors lists the descriptors of the project', async () => {
    const descriptors = [
      { id: DESCRIPTOR_ID, entity_type: 'Shot' },
      { id: OTHER_ID, entity_type: 'Asset' }
    ]
    fake.reply(200, descriptors)
    expect(await kitsu.project.allMetadataDescriptors(PROJECT_ID)).toEqual(
      descriptors
    )
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/metadata-descriptors`
    })
  })

  it('allMetadataDescriptors keeps one entity type on demand', async () => {
    fake.reply(200, [
      { id: DESCRIPTOR_ID, entity_type: 'Shot' },
      { id: OTHER_ID, entity_type: 'Asset' }
    ])
    expect(
      await kitsu.project.allMetadataDescriptors(
        { id: PROJECT_ID },
        { entityType: 'Asset' }
      )
    ).toEqual([{ id: OTHER_ID, entity_type: 'Asset' }])
    expect(fake.calls[0].query.has('entity_type')).toBe(false)
  })

  it('updateMetadataDescriptor saves the descriptor with department ids', async () => {
    fake.reply(200, { id: DESCRIPTOR_ID, name: 'Renamed' })
    const descriptor = {
      id: DESCRIPTOR_ID,
      name: 'Renamed',
      departments: [{ id: DEPARTMENT_ID }]
    }
    expect(
      await kitsu.project.updateMetadataDescriptor(PROJECT_ID, descriptor)
    ).toEqual({ id: DESCRIPTOR_ID, name: 'Renamed' })
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/projects/${PROJECT_ID}/metadata-descriptors/${DESCRIPTOR_ID}`
    })
    expect(fake.calls[0].body).toEqual({
      name: 'Renamed',
      departments: [DEPARTMENT_ID]
    })
    expect(descriptor.departments).toEqual([{ id: DEPARTMENT_ID }])
  })

  it('updateMetadataDescriptor leaves out missing departments', async () => {
    fake.reply(200, {})
    await kitsu.project.updateMetadataDescriptor(
      { id: PROJECT_ID },
      { id: DESCRIPTOR_ID, name: 'Renamed' }
    )
    expect(fake.calls[0].body).toEqual({ name: 'Renamed' })
  })

  it('removeMetadataDescriptor deletes the descriptor, forcing on demand', async () => {
    fake.reply(204).reply(204)
    await kitsu.project.removeMetadataDescriptor(PROJECT_ID, DESCRIPTOR_ID)
    await kitsu.project.removeMetadataDescriptor(
      { id: PROJECT_ID },
      { id: DESCRIPTOR_ID },
      { force: true }
    )
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/projects/${PROJECT_ID}/metadata-descriptors/${DESCRIPTOR_ID}`
    })
    expect(fake.calls[0].query.has('force')).toBe(false)
    expect(fake.calls[1].query.get('force')).toBe('true')
  })

  it('reorderMetadataDescriptors posts the ids in the wanted order', async () => {
    fake.reply(200, [{ id: OTHER_ID }, { id: DESCRIPTOR_ID }])
    expect(
      await kitsu.project.reorderMetadataDescriptors(PROJECT_ID, 'Asset', [
        { id: OTHER_ID },
        DESCRIPTOR_ID
      ])
    ).toEqual([{ id: OTHER_ID }, { id: DESCRIPTOR_ID }])
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/data/projects/${PROJECT_ID}/metadata-descriptors/reorder`
    })
    expect(fake.calls[0].body).toEqual({
      entity_type: 'Asset',
      descriptor_ids: [OTHER_ID, DESCRIPTOR_ID]
    })
  })
})
