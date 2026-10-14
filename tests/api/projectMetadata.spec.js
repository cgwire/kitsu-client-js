import { beforeEach, describe, expect, it } from 'vitest'

import { NotFoundError } from '../../src/core/errors.js'
import { ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import {
  DEPARTMENT_ID,
  OTHER_ID,
  PROJECT_ID,
  TASK_TYPE_ID
} from '../helpers/ids.js'

const DESCRIPTOR_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

// A descriptor as the route of a project serves it, with its departments.
const STORED_DESCRIPTOR = {
  id: DESCRIPTOR_ID,
  project_id: PROJECT_ID,
  entity_type: 'Asset',
  task_type_id: null,
  name: 'Difficulty',
  field_name: 'difficulty',
  data_type: 'list',
  choices: ['easy', 'hard'],
  for_client: true,
  position: 1,
  departments: [DEPARTMENT_ID],
  created_at: '2026-10-01T09:00:00',
  updated_at: '2026-10-01T09:00:00',
  type: 'MetadataDescriptor'
}

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
      taskType: { id: TASK_TYPE_ID }
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

  // Zou would create an Asset descriptor without an entity type.
  it('addMetadataDescriptor rejects a missing name or entity type', async () => {
    await expect(
      kitsu.project.addMetadataDescriptor(PROJECT_ID, 'Difficulty')
    ).rejects.toBeInstanceOf(ParameterError)
    await expect(
      kitsu.project.addMetadataDescriptor(PROJECT_ID, '', 'Shot')
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
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
    fake.reply(200, [STORED_DESCRIPTOR]).reply(200, [])
    expect(
      await kitsu.project.getMetadataDescriptorByFieldName(
        { id: PROJECT_ID },
        'difficulty'
      )
    ).toEqual(STORED_DESCRIPTOR)
    expect(
      await kitsu.project.getMetadataDescriptorByFieldName(PROJECT_ID, 'nope')
    ).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/metadata-descriptors'
    })
    expect(fake.calls[0].query.get('project_id')).toBe(PROJECT_ID)
    expect(fake.calls[0].query.get('field_name')).toBe('difficulty')
    expect(fake.calls[0].query.has('entity_type')).toBe(false)
  })

  // A filtered list of Zou leaves the departments out unless relations is
  // set, and the field name is unique per entity type only.
  it('getMetadataDescriptorByFieldName reads the departments, for one entity type on demand', async () => {
    fake.reply(200, [STORED_DESCRIPTOR])
    await kitsu.project.getMetadataDescriptorByFieldName(
      PROJECT_ID,
      'difficulty',
      { entityType: 'Task', taskType: { id: TASK_TYPE_ID } }
    )
    expect(fake.calls[0].query.get('relations')).toBe('true')
    expect(fake.calls[0].query.get('entity_type')).toBe('Task')
    expect(fake.calls[0].query.get('task_type_id')).toBe(TASK_TYPE_ID)
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

  it('updateMetadataDescriptor merges the given fields into the descriptor', async () => {
    fake
      .reply(200, STORED_DESCRIPTOR)
      .reply(200, { ...STORED_DESCRIPTOR, departments: [OTHER_ID] })
    const descriptor = {
      id: DESCRIPTOR_ID,
      departments: [{ id: OTHER_ID }]
    }
    expect(
      await kitsu.project.updateMetadataDescriptor(PROJECT_ID, descriptor)
    ).toEqual({ ...STORED_DESCRIPTOR, departments: [OTHER_ID] })
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/metadata-descriptors/${DESCRIPTOR_ID}`
    })
    expect(fake.calls[1]).toMatchObject({
      method: 'PUT',
      path: `/data/projects/${PROJECT_ID}/metadata-descriptors/${DESCRIPTOR_ID}`
    })
    // Zou keeps the name it is not given, and sets the field name from any
    // name it is given.
    expect(fake.calls[1].body).toEqual({
      data_type: 'list',
      choices: ['easy', 'hard'],
      for_client: true,
      departments: [OTHER_ID]
    })
    expect(descriptor.departments).toEqual([{ id: OTHER_ID }])
  })

  // Zou resets every field left out of the body to its default.
  it('updateMetadataDescriptor keeps the fields it is not given', async () => {
    fake.reply(200, STORED_DESCRIPTOR).reply(200, {})
    await kitsu.project.updateMetadataDescriptor(
      { id: PROJECT_ID },
      { id: DESCRIPTOR_ID, name: 'Shot difficulty' }
    )
    expect(fake.calls[1].body).toEqual({
      name: 'Shot difficulty',
      data_type: 'list',
      choices: ['easy', 'hard'],
      for_client: true,
      departments: [DEPARTMENT_ID]
    })
  })

  // A form gives its untouched fields as undefined: JSON would drop them and
  // Zou reset them. A null still clears the departments.
  it('updateMetadataDescriptor keeps the fields given as undefined', async () => {
    fake
      .reply(200, STORED_DESCRIPTOR)
      .reply(200, {})
      .reply(200, STORED_DESCRIPTOR)
      .reply(200, {})
    await kitsu.project.updateMetadataDescriptor(PROJECT_ID, {
      id: DESCRIPTOR_ID,
      name: 'Level',
      data_type: undefined,
      choices: undefined,
      for_client: undefined,
      departments: undefined
    })
    await kitsu.project.updateMetadataDescriptor(PROJECT_ID, {
      id: DESCRIPTOR_ID,
      choices: undefined,
      departments: null
    })
    expect(fake.calls[1].body).toEqual({
      name: 'Level',
      data_type: 'list',
      choices: ['easy', 'hard'],
      for_client: true,
      departments: [DEPARTMENT_ID]
    })
    expect(fake.calls[3].body).toEqual({
      data_type: 'list',
      choices: ['easy', 'hard'],
      for_client: true,
      departments: []
    })
  })

  it('updateMetadataDescriptor rejects when the descriptor does not exist', async () => {
    fake.reply(404, { message: 'Metadata descriptor not found' })
    await expect(
      kitsu.project.updateMetadataDescriptor(PROJECT_ID, {
        id: DESCRIPTOR_ID,
        name: 'Renamed'
      })
    ).rejects.toBeInstanceOf(NotFoundError)
    expect(fake.calls).toHaveLength(1)
  })

  // Zou never reads force on this route: the former option sends nothing.
  it('removeMetadataDescriptor deletes the descriptor without any query', async () => {
    fake.reply(204).reply(204)
    await kitsu.project.removeMetadataDescriptor(PROJECT_ID, DESCRIPTOR_ID)
    await kitsu.project.removeMetadataDescriptor(
      { id: PROJECT_ID },
      { id: DESCRIPTOR_ID },
      { force: true }
    )
    fake.calls.forEach(call => {
      expect(call).toMatchObject({
        method: 'DELETE',
        path: `/data/projects/${PROJECT_ID}/metadata-descriptors/${DESCRIPTOR_ID}`
      })
      expect([...call.query.keys()]).toEqual([])
    })
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
