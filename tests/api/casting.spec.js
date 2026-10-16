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

  it('getSequenceCasting reads a sequence given without its project', async () => {
    fake
      .reply(200, { id: SEQUENCE_ID, project_id: PROJECT_ID })
      .reply(200, { [SHOT_ID]: CASTING })
    expect(await kitsu.casting.getSequenceCasting(SEQUENCE_ID)).toEqual({
      [SHOT_ID]: CASTING
    })
    expect(fake.calls.map(call => call.path)).toEqual([
      `/data/sequences/${SEQUENCE_ID}`,
      `/data/projects/${PROJECT_ID}/sequences/${SEQUENCE_ID}/casting`
    ])
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

  // Entity arguments accept an id: the entity is then read for its project.
  it.each([
    ['getShotCasting', 'shots', SHOT_ID],
    ['getAssetCasting', 'assets', ASSET_ID],
    ['getEpisodeCasting', 'episodes', EPISODE_ID]
  ])(
    '%s reads an entity given without its project',
    async (name, model, entityId) => {
      fake
        .reply(200, { id: entityId, project_id: PROJECT_ID })
        .reply(200, CASTING)
        .reply(200, { id: entityId, project_id: PROJECT_ID })
        .reply(200, CASTING)
      expect(await kitsu.casting[name](entityId)).toEqual(CASTING)
      expect(await kitsu.casting[name]({ id: entityId })).toEqual(CASTING)
      expect(fake.calls.map(call => call.path)).toEqual([
        `/data/${model}/${entityId}`,
        ENTITY_CASTING_PATH(entityId),
        `/data/${model}/${entityId}`,
        ENTITY_CASTING_PATH(entityId)
      ])
    }
  )

  it('entity casting getters give null for a missing entity', async () => {
    fake.reply(404, {}).reply(404, {}).reply(404, {}).reply(404, {})
    expect(await kitsu.casting.getShotCasting(SHOT_ID)).toBeNull()
    expect(await kitsu.casting.getAssetCasting({ id: ASSET_ID })).toBeNull()
    expect(await kitsu.casting.getEpisodeCasting(EPISODE_ID)).toBeNull()
    expect(await kitsu.casting.getSequenceCasting(SEQUENCE_ID)).toBeNull()
    expect(fake.calls).toHaveLength(4)
  })

  it('entity casting getters reject a malformed entity before any request', async () => {
    const errors = await Promise.all(
      [
        kitsu.casting.getShotCasting('SH010'),
        kitsu.casting.getAssetCasting({ name: 'Chair' }),
        kitsu.casting.getEpisodeCasting(null),
        kitsu.casting.getSequenceCasting({ id: 'SQ01', project_id: PROJECT_ID })
      ].map(promise => promise.catch(err => err))
    )
    errors.forEach(err => expect(err).toBeInstanceOf(ParameterError))
    expect(fake.calls).toHaveLength(0)
  })

  it('getAssetCastIn lists the shots and the assets an asset is cast in', async () => {
    const castIn = [
      {
        shot_id: SHOT_ID,
        shot_name: 'SH010',
        sequence_name: 'SQ01',
        episode_id: 'None',
        episode_name: null,
        preview_file_id: null,
        nb_occurences: 2
      },
      {
        asset_id: OTHER_ID,
        asset_name: 'Castle',
        asset_type_name: 'Environment',
        preview_file_id: null,
        nb_occurences: 1
      }
    ]
    fake.reply(200, castIn)
    expect(await kitsu.casting.getAssetCastIn({ id: ASSET_ID })).toEqual(castIn)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/assets/${ASSET_ID}/cast-in`
    })
  })

  it('allEntityLinksForProject lists every link by default', async () => {
    const links = [
      {
        id: OTHER_ID,
        entity_in_id: SHOT_ID,
        entity_out_id: ASSET_ID,
        nb_occurences: 1,
        label: '',
        data: {},
        created_at: '2026-10-01T10:00:00.000',
        type: 'EntityLink'
      }
    ]
    fake.reply(200, links)
    expect(
      await kitsu.casting.allEntityLinksForProject(PROJECT_ID, { limit: 10 })
    ).toEqual(links)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/entity-links`
    })
    expect([...fake.calls[0].query.keys()]).toEqual([])
  })

  it('allEntityLinksForProject reads one page on request', async () => {
    const page = {
      data: [],
      total: 3,
      nb_pages: 1,
      limit: 10,
      offset: 10,
      page: 2
    }
    fake.reply(200, page).reply(200, { ...page, offset: 0, page: 1 })
    expect(
      await kitsu.casting.allEntityLinksForProject(
        { id: PROJECT_ID },
        { page: 2, limit: 10 }
      )
    ).toEqual(page)
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
    // Zou answers the casting it was sent, not the entity.
    fake.reply(200, CASTING)
    expect(
      await kitsu.casting[name]({ id: PROJECT_ID }, entityId, CASTING)
    ).toEqual(CASTING)
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: ENTITY_CASTING_PATH(entityId),
      body: CASTING
    })
  })

  // Zou empties the casting first, then only recreates the entries holding
  // an asset_id and a nb_occurences: an incomplete one drops its asset.
  it.each([
    ['updateShotCasting', SHOT_ID],
    ['updateAssetCasting', ASSET_ID],
    ['updateEpisodeCasting', EPISODE_ID]
  ])(
    '%s rejects an incomplete casting before any request',
    async (name, entityId) => {
      const wrongCastings = [
        undefined,
        { asset_id: ASSET_ID, nb_occurences: 1 },
        [{ asset_id: ASSET_ID }],
        [{ asset_id: ASSET_ID, nb_occurences: '2' }],
        [{ asset_id: ASSET_ID, nb_occurences: -1 }],
        [{ nb_occurences: 1 }],
        [{ asset_id: 'chair', nb_occurences: 1 }],
        [CASTING[0], null]
      ]
      const errors = await Promise.all(
        wrongCastings.map(casting =>
          kitsu.casting[name](PROJECT_ID, entityId, casting).catch(err => err)
        )
      )
      errors.forEach(err => expect(err).toBeInstanceOf(ParameterError))
      expect(fake.calls).toHaveLength(0)
    }
  )

  it('updateShotCasting sends back a casting read from Zou', async () => {
    const read = [
      {
        asset_id: ASSET_ID,
        asset_name: 'Chair',
        asset_type_name: 'Props',
        nb_occurences: 2,
        label: 'fixed',
        is_shared: false,
        project_id: PROJECT_ID
      }
    ]
    fake.reply(200, read).reply(200, read)
    const shot = { id: SHOT_ID, project_id: PROJECT_ID }
    const casting = await kitsu.casting.getShotCasting(shot)
    await kitsu.casting.updateShotCasting(PROJECT_ID, shot, casting)
    expect(fake.calls[1]).toMatchObject({
      method: 'PUT',
      path: ENTITY_CASTING_PATH(SHOT_ID),
      body: read
    })
  })

  it('updateEpisodeCasting accepts an empty casting, which removes every asset', async () => {
    fake.reply(200, [])
    expect(
      await kitsu.casting.updateEpisodeCasting(PROJECT_ID, EPISODE_ID, [])
    ).toEqual([])
    expect(fake.calls[0].body).toEqual([])
  })

  // Zou compares them as strings: on an episode, an asset id in uppercase
  // would be uncast from every shot of the episode.
  it('updateEpisodeCasting sends the asset ids in lowercase', async () => {
    const assetId = 'C46C80C6-AB12-4CDE-8F00-0A1B2C3D4E5F'
    const casting = [{ asset_id: assetId, nb_occurences: 1 }]
    fake.reply(200, [])
    await kitsu.casting.updateEpisodeCasting(PROJECT_ID, EPISODE_ID, casting)
    expect(fake.calls[0].body).toEqual([
      { asset_id: assetId.toLowerCase(), nb_occurences: 1 }
    ])
    expect(casting[0].asset_id).toBe(assetId)
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
