import { describe, expect, it } from 'vitest'

import { createFakeFetch } from './fakeFetch.js'
import { HOST, SHOT_ID } from './ids.js'
import { isKnownRoute } from './routeGate.js'

describe('route gate', () => {
  it('accepts real routes and the auth allow-list', () => {
    expect(isKnownRoute('/data/tasks/open-tasks')).toBe(true)
    expect(isKnownRoute(`/data/shots/${SHOT_ID}/tasks`)).toBe(true)
    expect(isKnownRoute('/auth/login')).toBe(true)
  })

  it('rejects invented routes', () => {
    expect(isKnownRoute('/data/user/avatar')).toBe(false)
    expect(isKnownRoute('/data/comments/x/preview-files')).toBe(false)
  })
})

describe('fakeFetch', () => {
  it('records calls and serves queued replies in order', async () => {
    const fake = createFakeFetch()
      .reply(200, [{ id: 1 }])
      .reply(201, { id: 2 })
    const first = await fake(`${HOST}/data/projects/open?name=a&name=b`)
    const second = await fake(`${HOST}/data/projects`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Agent 327' })
    })
    expect(await first.json()).toEqual([{ id: 1 }])
    expect(second.status).toBe(201)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/projects/open'
    })
    expect(fake.calls[0].query.getAll('name')).toEqual(['a', 'b'])
    expect(fake.calls[1]).toMatchObject({
      method: 'POST',
      body: { name: 'Agent 327' }
    })
  })

  it('lets a route handler take precedence over the queue', async () => {
    const fake = createFakeFetch().on(
      'GET',
      '/data/persons',
      () => new Response('[]')
    )
    expect(await (await fake(`${HOST}/data/persons`)).text()).toBe('[]')
  })

  it('throws on a route Zou does not serve', async () => {
    const fake = createFakeFetch().reply(200, {})
    await expect(fake(`${HOST}/data/user/avatar`)).rejects.toThrow(
      /unknown Zou route/
    )
  })

  it('throws when nothing is programmed', async () => {
    await expect(createFakeFetch()(`${HOST}/data/persons`)).rejects.toThrow(
      /no response/
    )
  })
})
