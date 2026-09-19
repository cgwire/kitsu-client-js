import { beforeEach, describe, expect, it } from 'vitest'

import { ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import { ENTITY_ID, OTHER_ID, PROJECT_ID } from '../helpers/ids.js'

describe('entity namespace', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('allEntities lists every entity', async () => {
    fake.reply(200, [{ id: ENTITY_ID }])
    expect(await kitsu.entity.allEntities()).toEqual([{ id: ENTITY_ID }])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/entities'
    })
  })

  it('allEntityTypes lists the entity types sorted by name', async () => {
    fake.reply(200, [{ name: 'shot' }, { name: 'Asset' }, { name: 'edit' }])
    const types = await kitsu.entity.allEntityTypes()
    expect(types.map(type => type.name)).toEqual(['Asset', 'edit', 'shot'])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/entity-types'
    })
  })

  it('getEntity accepts an object or an id and returns null on 404', async () => {
    fake.reply(200, { id: ENTITY_ID }).reply(404, {})
    expect(await kitsu.entity.getEntity({ id: ENTITY_ID })).toEqual({
      id: ENTITY_ID
    })
    expect(await kitsu.entity.getEntity(ENTITY_ID)).toBeNull()
    expect(fake.calls[0].path).toBe(`/data/entities/${ENTITY_ID}`)
  })

  // The contract every namespace inherits: a wrong argument is a rejection
  // (never a synchronous throw), and nothing leaves the client.
  it('rejects a wrong or missing entity before any request', async () => {
    const guarded = Promise.all(
      ['not-a-uuid', undefined, null].map(entity =>
        kitsu.entity.getEntity(entity).catch(err => err)
      )
    )
    ;(await guarded).forEach(err => expect(err).toBeInstanceOf(ParameterError))
    await expect(kitsu.entity.removeEntity(undefined)).rejects.toBeInstanceOf(
      ParameterError
    )
    await expect(
      kitsu.entity.removeEntities(PROJECT_ID, [ENTITY_ID, undefined])
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('first-match lookups reject a blank name instead of returning any row', async () => {
    await expect(kitsu.entity.getEntityByName('')).rejects.toBeInstanceOf(
      ParameterError
    )
    await expect(
      kitsu.entity.getEntityTypeByName(undefined)
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('getEntityByName filters by name and returns the first match', async () => {
    fake.reply(200, [{ id: ENTITY_ID, name: 'Hero' }]).reply(200, [])
    expect(await kitsu.entity.getEntityByName('Hero')).toMatchObject({
      name: 'Hero'
    })
    expect(
      await kitsu.entity.getEntityByName('Nope', { project: PROJECT_ID })
    ).toBeNull()
    expect(fake.calls[0].path).toBe('/data/entities')
    expect(fake.calls[0].query.get('name')).toBe('Hero')
    expect(fake.calls[0].query.has('project_id')).toBe(false)
    expect(fake.calls[1].query.get('project_id')).toBe(PROJECT_ID)
  })

  it('getEntityType returns the type, null on 404', async () => {
    fake.reply(200, { id: OTHER_ID }).reply(404, {})
    expect(await kitsu.entity.getEntityType(OTHER_ID)).toEqual({ id: OTHER_ID })
    expect(await kitsu.entity.getEntityType({ id: OTHER_ID })).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/entity-types/${OTHER_ID}`
    })
  })

  it('getEntityTypeByName filters by name', async () => {
    fake.reply(200, [{ id: OTHER_ID, name: 'Shot' }])
    expect(await kitsu.entity.getEntityTypeByName('Shot')).toMatchObject({
      id: OTHER_ID
    })
    expect(fake.calls[0].path).toBe('/data/entity-types')
    expect(fake.calls[0].query.get('name')).toBe('Shot')
  })

  it('guessFromPath posts the path to match against the file tree', async () => {
    fake.reply(200, [{ id: ENTITY_ID }]).reply(200, [])
    await kitsu.entity.guessFromPath({ id: PROJECT_ID }, '/prod/shots/sh010')
    await kitsu.entity.guessFromPath(PROJECT_ID, 'C:\\prod\\sh010', {
      sep: '\\'
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: '/data/entities/guess_from_path',
      body: { project_id: PROJECT_ID, file_path: '/prod/shots/sh010', sep: '/' }
    })
    expect(fake.calls[1].body.sep).toBe('\\')
  })

  it('newEntityType creates a type from its name', async () => {
    fake.reply(201, { id: OTHER_ID, name: 'Prop' })
    expect(await kitsu.entity.newEntityType('Prop')).toMatchObject({
      name: 'Prop'
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: '/data/entity-types',
      body: { name: 'Prop' }
    })
  })

  it('removeEntityType deletes the type', async () => {
    fake.reply(204)
    await kitsu.entity.removeEntityType({ id: OTHER_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/entity-types/${OTHER_ID}`
    })
  })

  it('removeEntity deletes the entity, forcing on demand', async () => {
    fake.reply(204).reply(204)
    await kitsu.entity.removeEntity(ENTITY_ID)
    await kitsu.entity.removeEntity({ id: ENTITY_ID }, { force: true })
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/entities/${ENTITY_ID}`
    })
    expect(fake.calls[0].query.has('force')).toBe(false)
    expect(fake.calls[1].query.get('force')).toBe('true')
  })

  it('removeEntities deletes a batch of entities of a project', async () => {
    fake.reply(200, [ENTITY_ID, OTHER_ID]).reply(200, [])
    const entities = [{ id: ENTITY_ID }, OTHER_ID]
    await kitsu.entity.removeEntities({ id: PROJECT_ID }, entities)
    await kitsu.entity.removeEntities(PROJECT_ID, entities, { force: true })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/actions/projects/${PROJECT_ID}/delete-entities`,
      body: [ENTITY_ID, OTHER_ID]
    })
    expect(fake.calls[0].query.has('force')).toBe(false)
    expect(fake.calls[1].query.get('force')).toBe('true')
    expect(entities).toEqual([{ id: ENTITY_ID }, OTHER_ID])
  })

  it('allEntitiesWithTasksLinkedToEntity lists the linked entities', async () => {
    fake.reply(200, [{ id: OTHER_ID, tasks: [] }])
    const linked = await kitsu.entity.allEntitiesWithTasksLinkedToEntity({
      id: ENTITY_ID
    })
    expect(linked).toEqual([{ id: OTHER_ID, tasks: [] }])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/entities/${ENTITY_ID}/entities-linked/with-tasks`
    })
  })
})
