import { beforeEach, describe, expect, it } from 'vitest'

import { ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import {
  ASSET_ID,
  ASSET_TYPE_ID,
  EPISODE_ID,
  OTHER_ID,
  PROJECT_ID,
  SEQUENCE_ID,
  SHOT_ID
} from '../helpers/ids.js'

const CASTING = [{ asset_id: ASSET_ID, nb_occurences: 3 }]
const ENTITY_CASTING_PATH = entityId =>
  `/data/projects/${PROJECT_ID}/entities/${entityId}/casting`

describe('casting namespace: reads', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('getAssetTypeCasting reads the casting of an asset type', async () => {
    fake.reply(200, { [ASSET_ID]: CASTING })
    expect(
      await kitsu.casting.getAssetTypeCasting(
        { id: PROJECT_ID },
        { id: ASSET_TYPE_ID }
      )
    ).toEqual({ [ASSET_ID]: CASTING })
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/asset-types/${ASSET_TYPE_ID}/casting`
    })
  })

  it('getSequenceCasting reads the project from the sequence', async () => {
    fake.reply(200, { [SHOT_ID]: CASTING })
    expect(
      await kitsu.casting.getSequenceCasting({
        id: SEQUENCE_ID,
        project_id: PROJECT_ID
      })
    ).toEqual({ [SHOT_ID]: CASTING })
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/sequences/${SEQUENCE_ID}/casting`
    })
  })

  it('getSequenceCasting rejects a sequence without its project', async () => {
    await expect(
      kitsu.casting.getSequenceCasting(SEQUENCE_ID)
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('getShotCasting reads the casting of a shot', async () => {
    fake.reply(200, CASTING)
    expect(
      await kitsu.casting.getShotCasting({
        id: SHOT_ID,
        project_id: PROJECT_ID
      })
    ).toEqual(CASTING)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: ENTITY_CASTING_PATH(SHOT_ID)
    })
  })

  it('getAssetCasting reads the casting of an asset', async () => {
    fake.reply(200, CASTING)
    expect(
      await kitsu.casting.getAssetCasting({
        id: ASSET_ID,
        project_id: PROJECT_ID
      })
    ).toEqual(CASTING)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: ENTITY_CASTING_PATH(ASSET_ID)
    })
  })

  it('getEpisodeCasting reads the casting of an episode', async () => {
    fake.reply(200, CASTING)
    expect(
      await kitsu.casting.getEpisodeCasting({
        id: EPISODE_ID,
        project_id: PROJECT_ID
      })
    ).toEqual(CASTING)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: ENTITY_CASTING_PATH(EPISODE_ID)
    })
  })

  it('every getter gives null on a 404', async () => {
    const entity = { id: SHOT_ID, project_id: PROJECT_ID }
    const reads = [
      () => kitsu.casting.getAssetTypeCasting(PROJECT_ID, ASSET_TYPE_ID),
      () => kitsu.casting.getSequenceCasting(entity),
      () => kitsu.casting.getShotCasting(entity),
      () => kitsu.casting.getAssetCasting(entity),
      () => kitsu.casting.getEpisodeCasting(entity),
      () => kitsu.casting.getAssetCastIn(ASSET_ID),
      () => kitsu.casting.getEpisodesCasting(PROJECT_ID),
      () => kitsu.casting.getSequenceShotsCasting(PROJECT_ID, SEQUENCE_ID),
      () => kitsu.casting.getEpisodeShotsCasting(PROJECT_ID, EPISODE_ID),
      () => kitsu.casting.getProjectShotsCasting(PROJECT_ID)
    ]
    reads.forEach(() => fake.reply(404, {}))
    const results = await reads.reduce(
      async (done, readCasting) => [...(await done), await readCasting()],
      Promise.resolve([])
    )
    expect(results).toEqual(reads.map(() => null))
  })

  it('entity casting getters reject an entity without its project', async () => {
    await expect(kitsu.casting.getShotCasting(SHOT_ID)).rejects.toBeInstanceOf(
      ParameterError
    )
    await expect(
      kitsu.casting.getAssetCasting({ id: ASSET_ID })
    ).rejects.toBeInstanceOf(ParameterError)
    await expect(kitsu.casting.getEpisodeCasting(null)).rejects.toBeInstanceOf(
      ParameterError
    )
    expect(fake.calls).toHaveLength(0)
  })

  it('getAssetCastIn lists the entities an asset is cast in', async () => {
    fake.reply(200, [{ id: SHOT_ID }])
    expect(await kitsu.casting.getAssetCastIn({ id: ASSET_ID })).toEqual([
      { id: SHOT_ID }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/assets/${ASSET_ID}/cast-in`
    })
  })

  it('allEntityLinksForProject lists every link by default', async () => {
    fake.reply(200, [{ id: OTHER_ID }])
    expect(
      await kitsu.casting.allEntityLinksForProject(PROJECT_ID, { limit: 10 })
    ).toEqual([{ id: OTHER_ID }])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/entity-links`
    })
    expect([...fake.calls[0].query.keys()]).toEqual([])
  })

  it('allEntityLinksForProject reads one page on request', async () => {
    fake.reply(200, { data: [], page: 2 }).reply(200, { data: [] })
    expect(
      await kitsu.casting.allEntityLinksForProject(
        { id: PROJECT_ID },
        { page: 2, limit: 10 }
      )
    ).toEqual({ data: [], page: 2 })
    expect(fake.calls[0].query.get('page')).toBe('2')
    expect(fake.calls[0].query.get('limit')).toBe('10')
    await kitsu.casting.allEntityLinksForProject(PROJECT_ID, { page: 1 })
    expect(fake.calls[1].query.get('page')).toBe('1')
    expect(fake.calls[1].query.has('limit')).toBe(false)
  })

  it('getEpisodesCasting reads the casting of every episode', async () => {
    fake.reply(200, { [EPISODE_ID]: CASTING })
    expect(await kitsu.casting.getEpisodesCasting({ id: PROJECT_ID })).toEqual({
      [EPISODE_ID]: CASTING
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/episodes/casting`
    })
  })

  it('getSequenceShotsCasting reads the shots of a sequence', async () => {
    fake.reply(200, { [SHOT_ID]: CASTING })
    expect(
      await kitsu.casting.getSequenceShotsCasting(PROJECT_ID, {
        id: SEQUENCE_ID
      })
    ).toEqual({ [SHOT_ID]: CASTING })
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/sequences/${SEQUENCE_ID}/casting`
    })
  })

  it('getEpisodeShotsCasting reads the shots of an episode', async () => {
    fake.reply(200, { [SHOT_ID]: CASTING })
    expect(
      await kitsu.casting.getEpisodeShotsCasting({ id: PROJECT_ID }, EPISODE_ID)
    ).toEqual({ [SHOT_ID]: CASTING })
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/episodes/${EPISODE_ID}/sequences/all/casting`
    })
  })

  it('getProjectShotsCasting reads the shots of a project', async () => {
    fake.reply(200, { [SHOT_ID]: CASTING })
    expect(await kitsu.casting.getProjectShotsCasting(PROJECT_ID)).toEqual({
      [SHOT_ID]: CASTING
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/sequences/all/casting`
    })
  })
})

describe('casting namespace: writes', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it.each([
    ['updateShotCasting', SHOT_ID],
    ['updateAssetCasting', ASSET_ID],
    ['updateEpisodeCasting', EPISODE_ID]
  ])('%s replaces the casting of the entity', async (name, entityId) => {
    fake.reply(200, { id: entityId })
    expect(
      await kitsu.casting[name]({ id: PROJECT_ID }, entityId, CASTING)
    ).toEqual({ id: entityId })
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: ENTITY_CASTING_PATH(entityId),
      body: CASTING
    })
  })

  it('castAsset sends only the entity ids by default', async () => {
    fake.reply(200, { [SHOT_ID]: CASTING })
    expect(
      await kitsu.casting.castAsset(
        PROJECT_ID,
        [{ id: SHOT_ID }, SEQUENCE_ID],
        { id: ASSET_ID }
      )
    ).toEqual({ [SHOT_ID]: CASTING })
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/projects/${PROJECT_ID}/entities/casting/assets/${ASSET_ID}`,
      body: { entity_ids: [SHOT_ID, SEQUENCE_ID] }
    })
    expect(Object.keys(fake.calls[0].body)).toEqual(['entity_ids'])
  })

  it('castAsset accepts a single entity, occurences and a label', async () => {
    fake.reply(200, {})
    await kitsu.casting.castAsset(
      { id: PROJECT_ID },
      { id: SHOT_ID },
      ASSET_ID,
      {
        nbOccurences: 0,
        label: 'fixed'
      }
    )
    expect(fake.calls[0].body).toEqual({
      entity_ids: [SHOT_ID],
      nb_occurences: 0,
      label: 'fixed'
    })
  })

  it('uncastAsset casts the asset with no occurence', async () => {
    fake.reply(200, { [SHOT_ID]: [] })
    expect(
      await kitsu.casting.uncastAsset(PROJECT_ID, [SHOT_ID], ASSET_ID)
    ).toEqual({ [SHOT_ID]: [] })
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/projects/${PROJECT_ID}/entities/casting/assets/${ASSET_ID}`,
      body: { entity_ids: [SHOT_ID], nb_occurences: 0 }
    })
  })

  it('deleteEntityLink removes the link and gives it back', async () => {
    fake.reply(204).reply(204)
    const link = { id: OTHER_ID, label: 'fixed' }
    expect(await kitsu.casting.deleteEntityLink(link)).toEqual(link)
    expect(await kitsu.casting.deleteEntityLink(OTHER_ID)).toEqual({
      id: OTHER_ID
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/entity-links/${OTHER_ID}`
    })
  })
})
