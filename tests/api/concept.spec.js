import { beforeEach, describe, expect, it } from 'vitest'

import { ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import {
  ASSET_ID,
  CONCEPT_ID,
  OTHER_ID,
  PROJECT_ID,
  SHOT_ID
} from '../helpers/ids.js'

const UNSORTED = [{ name: 'ruins' }, { name: 'Castle' }, { name: 'forest' }]
const SORTED_NAMES = ['Castle', 'forest', 'ruins']

describe('concept namespace', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('allConcepts lists every concept sorted by name', async () => {
    fake.reply(200, UNSORTED)
    const concepts = await kitsu.concept.allConcepts()
    expect(concepts.map(concept => concept.name)).toEqual(SORTED_NAMES)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/concepts'
    })
  })

  it('allConceptsForProject lists the concepts sorted by name', async () => {
    fake.reply(200, UNSORTED)
    const concepts = await kitsu.concept.allConceptsForProject({
      id: PROJECT_ID
    })
    expect(concepts.map(concept => concept.name)).toEqual(SORTED_NAMES)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/concepts`
    })
  })

  it('allPreviewsForConcept lists the previews of a concept', async () => {
    fake.reply(200, [{ id: OTHER_ID }])
    expect(
      await kitsu.concept.allPreviewsForConcept({ id: CONCEPT_ID })
    ).toEqual([{ id: OTHER_ID }])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/concepts/${CONCEPT_ID}/preview-files`
    })
  })

  it('removeConcept deletes the concept without a force flag', async () => {
    fake.reply(204)
    await kitsu.concept.removeConcept({ id: CONCEPT_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/concepts/${CONCEPT_ID}`
    })
    expect(fake.calls[0].query.has('force')).toBe(false)
  })

  it('removeConcept forces the deletion on demand', async () => {
    fake.reply(204)
    await kitsu.concept.removeConcept(CONCEPT_ID, { force: true })
    expect(fake.calls[0].method).toBe('DELETE')
    expect(fake.calls[0].query.get('force')).toBe('true')
  })

  it('getConcept reads a concept and gives null on a 404', async () => {
    fake.reply(200, { id: CONCEPT_ID, name: 'Castle' }).reply(404, {})
    expect(await kitsu.concept.getConcept(CONCEPT_ID)).toEqual({
      id: CONCEPT_ID,
      name: 'Castle'
    })
    expect(await kitsu.concept.getConcept({ id: CONCEPT_ID })).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/concepts/${CONCEPT_ID}`
    })
  })

  it('getConceptByName looks a concept up inside its project', async () => {
    fake.reply(200, [{ id: CONCEPT_ID, name: 'Castle' }]).reply(200, [])
    expect(
      await kitsu.concept.getConceptByName({ id: PROJECT_ID }, 'Castle')
    ).toMatchObject({ id: CONCEPT_ID })
    expect(await kitsu.concept.getConceptByName(PROJECT_ID, 'nope')).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/concepts'
    })
    expect(fake.calls[0].query.get('project_id')).toBe(PROJECT_ID)
    expect(fake.calls[0].query.get('name')).toBe('Castle')
  })

  it('getConceptByName rejects a blank name before any request', async () => {
    await expect(
      kitsu.concept.getConceptByName(PROJECT_ID, '')
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('newConcept creates a bare concept when the name is free', async () => {
    fake.reply(200, []).reply(201, { id: CONCEPT_ID, name: 'Castle' })
    expect(
      await kitsu.concept.newConcept({ id: PROJECT_ID }, 'Castle')
    ).toMatchObject({ id: CONCEPT_ID })
    expect(fake.calls[0].path).toBe('/data/concepts')
    expect(fake.calls[0].query.get('project_id')).toBe(PROJECT_ID)
    expect(fake.calls[0].query.get('name')).toBe('Castle')
    expect(fake.calls[1]).toMatchObject({
      method: 'POST',
      path: `/data/projects/${PROJECT_ID}/concepts`
    })
    expect(fake.calls[1].body).toEqual({
      name: 'Castle',
      data: {},
      entity_concept_links: []
    })
  })

  it('newConcept sends description, metadata and linked entities', async () => {
    fake.reply(200, []).reply(201, { id: CONCEPT_ID })
    const data = { mood: 'dark' }
    await kitsu.concept.newConcept(PROJECT_ID, 'Castle', {
      description: 'North tower',
      data,
      entityConceptLinks: [{ id: ASSET_ID }, SHOT_ID]
    })
    expect(fake.calls[1].body).toEqual({
      name: 'Castle',
      data: { mood: 'dark' },
      entity_concept_links: [ASSET_ID, SHOT_ID],
      description: 'North tower'
    })
    expect(data).toEqual({ mood: 'dark' })
  })

  it('newConcept returns the existing concept instead of creating', async () => {
    fake.reply(200, [{ id: CONCEPT_ID, name: 'Castle' }])
    expect(await kitsu.concept.newConcept(PROJECT_ID, 'Castle')).toEqual({
      id: CONCEPT_ID,
      name: 'Castle'
    })
    expect(fake.calls).toHaveLength(1)
  })

  it('newConcept rejects a malformed link before any request', async () => {
    await expect(
      kitsu.concept.newConcept(PROJECT_ID, 'Castle', {
        entityConceptLinks: ['not-a-uuid']
      })
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('updateConcept saves the concept through the entity route', async () => {
    fake.reply(200, { id: CONCEPT_ID, name: 'Keep' })
    const concept = { id: CONCEPT_ID, name: 'Keep' }
    expect(await kitsu.concept.updateConcept(concept)).toEqual(concept)
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/entities/${CONCEPT_ID}`,
      body: { id: CONCEPT_ID, name: 'Keep' }
    })
  })
})
