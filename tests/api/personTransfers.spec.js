import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ParameterError } from '../../src/core/errors.js'
import { makeClient } from '../helpers/client.js'
import { PERSON_ID } from '../helpers/ids.js'

const AVATAR_PATH = `/pictures/thumbnails/persons/${PERSON_ID}`
const avatar = new Blob(['pixels'], { type: 'image/png' })

describe('person namespace transfers', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  afterEach(() => {
    delete globalThis.XMLHttpRequest
    vi.unstubAllGlobals()
  })

  it('setAvatar uploads the picture in the file field', async () => {
    fake.reply(201, { thumbnail_path: `${AVATAR_PATH}.png` })
    const result = await kitsu.person.setAvatar({ id: PERSON_ID }, avatar)
    expect(result).toEqual({ thumbnail_path: `${AVATAR_PATH}.png` })
    expect(fake.calls).toHaveLength(1)
    expect(fake.calls[0]).toMatchObject({ method: 'POST', path: AVATAR_PATH })
    const form = fake.calls[0].body
    expect(form).toBeInstanceOf(FormData)
    expect([...form.keys()]).toEqual(['file'])
    expect(form.get('file').type).toBe('image/png')
    expect(await form.get('file').text()).toBe('pixels')
  })

  it('setAvatar accepts a person id and names the file', async () => {
    fake.reply(201, { thumbnail_path: `${AVATAR_PATH}.png` })
    await kitsu.person.setAvatar(PERSON_ID, avatar, { fileName: 'me.png' })
    expect(fake.calls[0].path).toBe(AVATAR_PATH)
    expect(fake.calls[0].body.get('file').name).toBe('me.png')
  })

  it('setAvatar reports the upload progress', async () => {
    ;({ kitsu, fake } = makeClient({ globalFetch: true }))
    const xhrs = []
    globalThis.XMLHttpRequest = class {
      constructor() {
        this.upload = {}
        xhrs.push(this)
      }
      open(method, url) {
        Object.assign(this, { method, url })
      }
      setRequestHeader() {}
      send(body) {
        this.body = body
      }
    }
    const onProgress = vi.fn()
    const pending = kitsu.person.setAvatar(PERSON_ID, avatar, { onProgress })
    await vi.waitFor(() => expect(xhrs).toHaveLength(1))
    xhrs[0].upload.onprogress({ loaded: 3, total: 6 })
    Object.assign(xhrs[0], { status: 201, responseText: '{"ok":true}' })
    xhrs[0].onload()

    expect(await pending).toEqual({ ok: true })
    expect(onProgress).toHaveBeenCalledWith({ loaded: 3, total: 6 })
    expect(xhrs[0].method).toBe('POST')
    expect(xhrs[0].url).toBe(`http://kitsu.test/api${AVATAR_PATH}`)
    expect(xhrs[0].body.get('file')).toBeInstanceOf(Blob)
    expect(fake.calls).toHaveLength(0)
  })

  it('setAvatar stops on an aborted signal', async () => {
    const controller = new AbortController()
    controller.abort()
    fake.on('POST', AVATAR_PATH, ({ signal }) =>
      signal.aborted
        ? Promise.reject(new DOMException('Aborted', 'AbortError'))
        : new Response('{}', { status: 201 })
    )
    await expect(
      kitsu.person.setAvatar(PERSON_ID, avatar, { signal: controller.signal })
    ).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('setAvatar rejects without a person or a picture', async () => {
    await expect(kitsu.person.setAvatar(null, avatar)).rejects.toBeInstanceOf(
      ParameterError
    )
    await expect(kitsu.person.setAvatar(PERSON_ID)).rejects.toBeInstanceOf(
      ParameterError
    )
    expect(fake.calls).toHaveLength(0)
  })
})
