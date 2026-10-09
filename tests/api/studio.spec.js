import { beforeEach, describe, expect, it } from 'vitest'

import { ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import { STUDIO_ID } from '../helpers/ids.js'

describe('studio namespace', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('allStudios lists the studios sorted by name', async () => {
    fake.reply(200, [{ name: 'paris' }, { name: 'Angers' }, { name: 'lyon' }])
    const studios = await kitsu.studio.allStudios()
    expect(studios.map(studio => studio.name)).toEqual([
      'Angers',
      'lyon',
      'paris'
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/studios'
    })
  })

  it('getStudio returns the studio, or null on a 404', async () => {
    fake.reply(200, { id: STUDIO_ID, name: 'Angers' }).reply(404, {})
    expect(await kitsu.studio.getStudio(STUDIO_ID)).toMatchObject({
      name: 'Angers'
    })
    expect(await kitsu.studio.getStudio({ id: STUDIO_ID })).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/studios/${STUDIO_ID}`
    })
  })

  it('getStudioByName returns the first match, or null', async () => {
    fake.reply(200, [{ id: STUDIO_ID, name: 'Angers' }]).reply(200, [])
    expect(await kitsu.studio.getStudioByName('Angers')).toMatchObject({
      id: STUDIO_ID
    })
    expect(await kitsu.studio.getStudioByName('nope')).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/studios'
    })
    expect(fake.calls[0].query.get('name')).toBe('Angers')
  })

  it('getStudioByName rejects a blank name', async () => {
    await expect(kitsu.studio.getStudioByName('')).rejects.toThrow(
      ParameterError
    )
    expect(fake.calls).toHaveLength(0)
  })

  it('updateStudio saves the studio', async () => {
    const studio = { id: STUDIO_ID, name: 'Angers', color: '#ff0000' }
    fake.reply(200, studio)
    expect(await kitsu.studio.updateStudio(studio)).toEqual(studio)
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/studios/${STUDIO_ID}`,
      body: studio
    })
  })

  // Zou never reads force on this route: the former option sends nothing.
  it('removeStudio deletes the studio without any query', async () => {
    fake.reply(204).reply(204)
    expect(await kitsu.studio.removeStudio(STUDIO_ID)).toBeNull()
    await kitsu.studio.removeStudio({ id: STUDIO_ID }, { force: true })
    fake.calls.forEach(call => {
      expect(call).toMatchObject({
        method: 'DELETE',
        path: `/data/studios/${STUDIO_ID}`
      })
      expect([...call.query.keys()]).toEqual([])
    })
  })
})
