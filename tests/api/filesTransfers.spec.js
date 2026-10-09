import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { NotFoundError, ParameterError } from '../../src/core/errors.js'
import { makeClient } from '../helpers/client.js'
import {
  OTHER_ID,
  PERSON_ID,
  PREVIEW_FILE_ID,
  PROJECT_ID,
  WORKING_FILE_ID
} from '../helpers/ids.js'

const ATTACHMENT_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'

const blob = new Blob(['pixels'], { type: 'image/png' })

const rawResponse = () => new Response('bytes')

// Minimal XMLHttpRequest double: records the request, lets the test drive it.
const installFakeXhr = () => {
  const instances = []
  globalThis.XMLHttpRequest = class {
    constructor() {
      this.upload = {}
      instances.push(this)
    }
    open(method, url) {
      Object.assign(this, { method, url })
    }
    setRequestHeader() {}
    send(body) {
      this.body = body
    }
    getResponseHeader() {
      return 'application/json'
    }
    respond(status, body) {
      this.status = status
      this.responseText = JSON.stringify(body)
      this.onload()
    }
  }
  return instances
}

describe('files namespace: uploads', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })
  afterEach(() => {
    delete globalThis.XMLHttpRequest
    vi.unstubAllGlobals()
  })

  it('uploadWorkingFile posts the file as multipart', async () => {
    fake.reply(201, { id: WORKING_FILE_ID })
    expect(
      await kitsu.files.uploadWorkingFile({ id: WORKING_FILE_ID }, blob, {
        fileName: 'scene.blend'
      })
    ).toEqual({ id: WORKING_FILE_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/data/working-files/${WORKING_FILE_ID}/file`
    })
    const form = fake.calls[0].body
    expect(form).toBeInstanceOf(FormData)
    expect([...form.keys()]).toEqual(['file'])
    expect(form.get('file').name).toBe('scene.blend')
    expect(await form.get('file').text()).toBe('pixels')
  })

  it('uploadWorkingFile rejects without a file', async () => {
    await expect(
      kitsu.files.uploadWorkingFile(WORKING_FILE_ID)
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('uploadWorkingFile forwards the caller signal', async () => {
    fake.reply(201, { id: WORKING_FILE_ID })
    const controller = new AbortController()
    controller.abort()
    await kitsu.files
      .uploadWorkingFile(WORKING_FILE_ID, blob, { signal: controller.signal })
      .catch(() => {})
    expect(fake.calls[0].signal.aborted).toBe(true)
  })

  it('uploadWorkingFile reports the upload progress', async () => {
    ;({ kitsu, fake } = makeClient({ globalFetch: true }))
    const xhrs = installFakeXhr()
    const onProgress = vi.fn()
    const pending = kitsu.files.uploadWorkingFile(WORKING_FILE_ID, blob, {
      onProgress
    })
    await vi.waitFor(() => expect(xhrs).toHaveLength(1))
    xhrs[0].upload.onprogress({ loaded: 3, total: 6 })
    xhrs[0].respond(201, { id: WORKING_FILE_ID })
    expect(await pending).toEqual({ id: WORKING_FILE_ID })
    expect(onProgress).toHaveBeenCalledWith({ loaded: 3, total: 6 })
    expect(xhrs[0].url).toBe(
      `http://kitsu.test/api/data/working-files/${WORKING_FILE_ID}/file`
    )
    expect(xhrs[0].body.get('file')).toBeInstanceOf(Blob)
  })

  it.each([
    ['uploadPersonAvatar', 'persons', PERSON_ID],
    ['uploadProjectAvatar', 'projects', PROJECT_ID],
    ['uploadOrganisationAvatar', 'organisations', OTHER_ID]
  ])('%s posts the picture as multipart', async (name, kind, id) => {
    const thumbnail = { thumbnail_path: `/pictures/thumbnails/${kind}/x.png` }
    fake.reply(201, thumbnail)
    expect(
      await kitsu.files[name]({ id }, blob, { fileName: 'avatar.png' })
    ).toEqual(thumbnail)
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/pictures/thumbnails/${kind}/${id}`
    })
    const form = fake.calls[0].body
    expect(form).toBeInstanceOf(FormData)
    expect([...form.keys()]).toEqual(['file'])
    expect(form.get('file').name).toBe('avatar.png')
    expect(await form.get('file').text()).toBe('pixels')
  })

  it.each([
    ['uploadPersonAvatar', PERSON_ID],
    ['uploadProjectAvatar', PROJECT_ID],
    ['uploadOrganisationAvatar', OTHER_ID]
  ])('%s rejects without a file', async (name, id) => {
    await expect(kitsu.files[name](id)).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('uploadPersonAvatar reports the upload progress', async () => {
    ;({ kitsu, fake } = makeClient({ globalFetch: true }))
    const xhrs = installFakeXhr()
    const onProgress = vi.fn()
    const pending = kitsu.files.uploadPersonAvatar(PERSON_ID, blob, {
      onProgress
    })
    await vi.waitFor(() => expect(xhrs).toHaveLength(1))
    xhrs[0].upload.onprogress({ loaded: 6, total: 6 })
    xhrs[0].respond(201, { thumbnail_path: 'p.png' })
    expect(await pending).toEqual({ thumbnail_path: 'p.png' })
    expect(onProgress).toHaveBeenCalledWith({ loaded: 6, total: 6 })
  })
})

describe('files namespace: downloads', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('downloadWorkingFile returns the raw response', async () => {
    fake.on('GET', `/data/working-files/${WORKING_FILE_ID}/file`, rawResponse)
    const response = await kitsu.files.downloadWorkingFile({
      id: WORKING_FILE_ID
    })
    expect(response).toBeInstanceOf(Response)
    expect(await response.text()).toBe('bytes')
    expect(fake.calls).toHaveLength(1)
    expect(fake.calls[0].method).toBe('GET')
  })

  it('downloadPreviewFile reads a movie from the movie route', async () => {
    const path = `/movies/originals/preview-files/${PREVIEW_FILE_ID}.mp4`
    fake.reply(200, { id: PREVIEW_FILE_ID, extension: 'mp4' })
    fake.on('GET', path, rawResponse)
    const response = await kitsu.files.downloadPreviewFile({
      id: PREVIEW_FILE_ID
    })
    expect(await response.text()).toBe('bytes')
    expect(fake.calls.map(call => `${call.method} ${call.path}`)).toEqual([
      `GET /data/preview-files/${PREVIEW_FILE_ID}`,
      `GET ${path}`
    ])
  })

  it('downloadPreviewFile reads other files from the picture route', async () => {
    const path = `/pictures/originals/preview-files/${PREVIEW_FILE_ID}.png`
    fake.reply(200, { id: PREVIEW_FILE_ID, extension: 'png' })
    fake.on('GET', path, rawResponse)
    const response = await kitsu.files.downloadPreviewFile(PREVIEW_FILE_ID)
    expect(await response.text()).toBe('bytes')
    expect(fake.calls[1]).toMatchObject({ method: 'GET', path })
  })

  it('downloadPreviewFile rejects when the preview is missing', async () => {
    fake.reply(404, {})
    await expect(
      kitsu.files.downloadPreviewFile(PREVIEW_FILE_ID)
    ).rejects.toBeInstanceOf(NotFoundError)
    expect(fake.calls).toHaveLength(1)
  })

  it('downloadAttachmentFile reads the file under its name', async () => {
    const path = `/data/attachment-files/${ATTACHMENT_ID}/file/notes.pdf`
    fake.reply(200, { id: ATTACHMENT_ID, name: 'notes.pdf' })
    fake.on('GET', path, rawResponse)
    const response = await kitsu.files.downloadAttachmentFile({
      id: ATTACHMENT_ID
    })
    expect(await response.text()).toBe('bytes')
    expect(fake.calls.map(call => `${call.method} ${call.path}`)).toEqual([
      `GET /data/attachment-files/${ATTACHMENT_ID}`,
      `GET ${path}`
    ])
  })

  it('downloadAttachmentFile keeps a free-form name inside the path', async () => {
    fake.reply(200, { id: ATTACHMENT_ID, name: 'retake #2/final?.pdf' })
    fake.reply(200, {})
    await kitsu.files.downloadAttachmentFile(ATTACHMENT_ID)
    expect(fake.calls[1].path).toBe(
      `/data/attachment-files/${ATTACHMENT_ID}/file/retake%20%232%2Ffinal%3F.pdf`
    )
    expect([...fake.calls[1].query.keys()]).toEqual([])
  })

  it('downloadAttachmentFile rejects when the attachment is missing', async () => {
    fake.reply(404, {})
    await expect(
      kitsu.files.downloadAttachmentFile(ATTACHMENT_ID)
    ).rejects.toBeInstanceOf(NotFoundError)
    expect(fake.calls).toHaveLength(1)
  })

  it('downloadPreviewFileThumbnail returns the raw response', async () => {
    fake.on(
      'GET',
      `/pictures/thumbnails/preview-files/${PREVIEW_FILE_ID}.png`,
      rawResponse
    )
    const response = await kitsu.files.downloadPreviewFileThumbnail({
      id: PREVIEW_FILE_ID
    })
    expect(await response.text()).toBe('bytes')
    expect(fake.calls).toHaveLength(1)
  })

  it('downloadPreviewFileCover returns the raw response', async () => {
    fake.on(
      'GET',
      `/pictures/originals/preview-files/${PREVIEW_FILE_ID}.png`,
      rawResponse
    )
    const response = await kitsu.files.downloadPreviewFileCover(PREVIEW_FILE_ID)
    expect(await response.text()).toBe('bytes')
    expect(fake.calls).toHaveLength(1)
  })

  it.each([
    ['downloadPersonAvatar', 'persons', PERSON_ID],
    ['downloadProjectAvatar', 'projects', PROJECT_ID],
    ['downloadOrganisationAvatar', 'organisations', OTHER_ID]
  ])('%s returns the raw response', async (name, kind, id) => {
    fake.on('GET', `/pictures/thumbnails/${kind}/${id}.png`, rawResponse)
    const response = await kitsu.files[name]({ id })
    expect(response).toBeInstanceOf(Response)
    expect(await response.text()).toBe('bytes')
    expect(fake.calls).toHaveLength(1)
  })

  it('downloadPreviewMovie reads the original movie', async () => {
    const path = `/movies/originals/preview-files/${PREVIEW_FILE_ID}.mp4`
    fake.reply(200, { id: PREVIEW_FILE_ID, extension: 'mp4' })
    fake.on('GET', path, rawResponse)
    const response = await kitsu.files.downloadPreviewMovie({
      id: PREVIEW_FILE_ID
    })
    expect(await response.text()).toBe('bytes')
    expect(fake.calls.map(call => `${call.method} ${call.path}`)).toEqual([
      `GET /data/preview-files/${PREVIEW_FILE_ID}`,
      `GET ${path}`
    ])
  })

  it('downloadPreviewMovie rejects when the preview is missing', async () => {
    fake.reply(404, {})
    await expect(
      kitsu.files.downloadPreviewMovie(PREVIEW_FILE_ID)
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it('downloadPreviewLowdefMovie reads the low definition movie', async () => {
    fake.on(
      'GET',
      `/movies/low/preview-files/${PREVIEW_FILE_ID}.mp4`,
      rawResponse
    )
    const response =
      await kitsu.files.downloadPreviewLowdefMovie(PREVIEW_FILE_ID)
    expect(await response.text()).toBe('bytes')
    expect(fake.calls).toHaveLength(1)
  })

  it('downloadAttachmentThumbnail returns the raw response', async () => {
    fake.on(
      'GET',
      `/pictures/thumbnails/attachment-files/${ATTACHMENT_ID}.png`,
      rawResponse
    )
    const response = await kitsu.files.downloadAttachmentThumbnail({
      id: ATTACHMENT_ID
    })
    expect(await response.text()).toBe('bytes')
    expect(fake.calls).toHaveLength(1)
  })

  it('downloads forward the caller signal', async () => {
    fake.on(
      'GET',
      `/pictures/thumbnails/preview-files/${PREVIEW_FILE_ID}.png`,
      rawResponse
    )
    const controller = new AbortController()
    controller.abort()
    await kitsu.files
      .downloadPreviewFileThumbnail(PREVIEW_FILE_ID, {
        signal: controller.signal
      })
      .catch(() => {})
    expect(fake.calls[0].signal.aborted).toBe(true)
  })
})
