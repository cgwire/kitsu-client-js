import { beforeEach, describe, expect, it } from 'vitest'

import { ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import { STUDIO_ID } from '../helpers/ids.js'

describe('studio namespace, Kitsu functions', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('newStudio creates a studio, not archived by default', async () => {
    fake.reply(201, { id: STUDIO_ID, name: 'Angers' })
    expect(await kitsu.studio.newStudio('Angers', '#ff0000')).toMatchObject({
      id: STUDIO_ID
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: '/data/studios',
      body: { name: 'Angers', color: '#ff0000', archived: false }
    })
  })

  it('newStudio can create an archived studio', async () => {
    fake.reply(201, { id: STUDIO_ID })
    await kitsu.studio.newStudio('Angers', '#ff0000', { archived: true })
    expect(fake.calls[0].body).toEqual({
      name: 'Angers',
      color: '#ff0000',
      archived: true
    })
  })

  it('newStudio rejects a blank name or color', async () => {
    await expect(kitsu.studio.newStudio('', '#ff0000')).rejects.toThrow(
      ParameterError
    )
    await expect(kitsu.studio.newStudio('Angers')).rejects.toThrow(
      ParameterError
    )
    expect(fake.calls).toHaveLength(0)
  })
})
