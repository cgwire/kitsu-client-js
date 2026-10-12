import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import {
  OTHER_ID,
  PERSON_ID,
  PREVIEW_FILE_ID,
  PROJECT_ID,
  TASK_ID,
  TASK_STATUS_ID
} from '../helpers/ids.js'

const COMMENT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

const COMMENT_ROUTE = `/actions/tasks/${TASK_ID}/comment`
const ATTACHMENT_ROUTE = `/actions/tasks/${TASK_ID}/comments/${COMMENT_ID}/add-attachment`
const UPLOAD_ROUTE = `/pictures/preview-files/${PREVIEW_FILE_ID}`
const COMMENT_PATH = `/actions/tasks/${TASK_ID}/comments/${COMMENT_ID}`

const notes = new Blob(['notes'], { type: 'text/plain' })
const sketch = new Blob(['sketch'], { type: 'image/png' })
const movie = new Blob(['frames'], { type: 'video/mp4' })
const movieFile = new File(['frames'], 'shot.mp4', { type: 'video/mp4' })

// A path string is the gazu habit, null is what canvas.toBlob and an empty
// input.files[0] yield.
const NOT_A_FILE = [undefined, null, '/tmp/shot.mp4', { name: 'shot.mp4' }]

describe('task namespace transfers', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  afterEach(() => {
    delete globalThis.XMLHttpRequest
    vi.unstubAllGlobals()
  })

  it('addComment posts JSON without attachment', async () => {
    fake.reply(201, { id: COMMENT_ID })
    const comment = await kitsu.task.addComment(
      { id: TASK_ID },
      { id: TASK_STATUS_ID },
      { comment: 'wip' }
    )
    expect(comment).toEqual({ id: COMMENT_ID })
    expect(fake.calls).toHaveLength(1)
    expect(fake.calls[0]).toMatchObject({ method: 'POST', path: COMMENT_ROUTE })
    expect(fake.calls[0].body).toEqual({
      task_status_id: TASK_STATUS_ID,
      comment: 'wip',
      checklist: [],
      links: [],
      for_client: false
    })
  })

  it('addComment sends every optional field of the comment', async () => {
    fake.reply(201, { id: COMMENT_ID })
    await kitsu.task.addComment(TASK_ID, TASK_STATUS_ID, {
      person: { id: PERSON_ID },
      checklist: [{ text: 'Fix the rig', checked: false }],
      createdAt: '2026-09-19T10:00:00',
      links: ['https://example.com/ref'],
      forClient: true
    })
    expect(fake.calls[0].body).toEqual({
      task_status_id: TASK_STATUS_ID,
      comment: '',
      checklist: [{ text: 'Fix the rig', checked: false }],
      links: ['https://example.com/ref'],
      for_client: true,
      person_id: PERSON_ID,
      created_at: '2026-09-19T10:00:00'
    })
  })

  it('addComment sends multipart when attachments are given', async () => {
    fake.reply(201, { id: COMMENT_ID })
    const comment = await kitsu.task.addComment(
      { id: TASK_ID },
      TASK_STATUS_ID,
      {
        comment: 'see files',
        person: PERSON_ID,
        checklist: [{ text: 'Fix the rig', checked: false }],
        createdAt: '2026-09-19T10:00:00',
        links: ['https://example.com/ref'],
        attachments: [notes, sketch],
        fileName: 'notes.txt'
      }
    )
    expect(comment).toEqual({ id: COMMENT_ID })
    expect(fake.calls[0]).toMatchObject({ method: 'POST', path: COMMENT_ROUTE })
    const form = fake.calls[0].body
    expect(form).toBeInstanceOf(FormData)
    expect([...form.keys()].sort()).toEqual([
      'checklist',
      'comment',
      'created_at',
      'file',
      'file-1',
      'links',
      'person_id',
      'task_status_id'
    ])
    expect(form.get('task_status_id')).toBe(TASK_STATUS_ID)
    expect(form.get('comment')).toBe('see files')
    expect(form.get('person_id')).toBe(PERSON_ID)
    expect(form.get('created_at')).toBe('2026-09-19T10:00:00')
    expect(JSON.parse(form.get('checklist'))).toEqual([
      { text: 'Fix the rig', checked: false }
    ])
    expect(JSON.parse(form.get('links'))).toEqual(['https://example.com/ref'])
    expect(form.get('file').name).toBe('notes.txt')
    expect(await form.get('file').text()).toBe('notes')
    expect(await form.get('file-1').text()).toBe('sketch')
  })

  it('addComment sends for_client in a multipart form only when true', async () => {
    fake.reply(201, { id: COMMENT_ID }).reply(201, { id: COMMENT_ID })
    await kitsu.task.addComment(TASK_ID, TASK_STATUS_ID, {
      attachments: [notes]
    })
    await kitsu.task.addComment(TASK_ID, TASK_STATUS_ID, {
      attachments: [notes],
      forClient: true
    })
    expect(fake.calls[0].body.has('for_client')).toBe(false)
    expect(fake.calls[0].body.get('comment')).toBe('')
    expect(fake.calls[0].body.get('checklist')).toBe('[]')
    expect(fake.calls[0].body.get('links')).toBe('[]')
    expect(fake.calls[1].body.get('for_client')).toBe('true')
  })

  it('addComment rejects without a task or a task status', async () => {
    await expect(
      kitsu.task.addComment(null, TASK_STATUS_ID)
    ).rejects.toBeInstanceOf(ParameterError)
    await expect(
      kitsu.task.addComment(TASK_ID, undefined, { attachments: [notes] })
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('addAttachmentFilesToComment uploads one file', async () => {
    fake.reply(201, [{ id: 'a1' }])
    const files = await kitsu.task.addAttachmentFilesToComment(
      { id: TASK_ID },
      { id: COMMENT_ID },
      notes,
      { fileName: 'notes.txt' }
    )
    expect(files).toEqual([{ id: 'a1' }])
    expect(fake.calls).toHaveLength(1)
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: ATTACHMENT_ROUTE
    })
    const form = fake.calls[0].body
    expect(form).toBeInstanceOf(FormData)
    expect([...form.keys()]).toEqual(['file'])
    expect(form.get('file').name).toBe('notes.txt')
    expect(await form.get('file').text()).toBe('notes')
  })

  it('addAttachmentFilesToComment uploads several files', async () => {
    fake.reply(201, [{ id: 'a1' }, { id: 'a2' }])
    await kitsu.task.addAttachmentFilesToComment(TASK_ID, COMMENT_ID, [
      notes,
      sketch
    ])
    const form = fake.calls[0].body
    expect([...form.keys()]).toEqual(['file', 'file-1'])
    expect(await form.get('file').text()).toBe('notes')
    expect(await form.get('file-1').text()).toBe('sketch')
  })

  it('addAttachmentFilesToComment rejects without attachment', async () => {
    const { addAttachmentFilesToComment } = kitsu.task
    await expect(
      addAttachmentFilesToComment(TASK_ID, COMMENT_ID, [])
    ).rejects.toBeInstanceOf(ParameterError)
    await expect(
      addAttachmentFilesToComment(TASK_ID, COMMENT_ID)
    ).rejects.toBeInstanceOf(ParameterError)
    await expect(
      addAttachmentFilesToComment(TASK_ID, null, notes)
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('uploadPreviewFile uploads the content of a preview file', async () => {
    fake.reply(201, { id: PREVIEW_FILE_ID, extension: 'mp4' })
    const previewFile = await kitsu.task.uploadPreviewFile(
      { id: PREVIEW_FILE_ID },
      movie,
      { fileName: 'shot.mp4' }
    )
    expect(previewFile).toEqual({ id: PREVIEW_FILE_ID, extension: 'mp4' })
    expect(fake.calls).toHaveLength(1)
    expect(fake.calls[0]).toMatchObject({ method: 'POST', path: UPLOAD_ROUTE })
    expect(fake.calls[0].query.has('normalize')).toBe(false)
    const form = fake.calls[0].body
    expect(form).toBeInstanceOf(FormData)
    expect([...form.keys()]).toEqual(['file'])
    expect(form.get('file').name).toBe('shot.mp4')
    expect(form.get('file').type).toBe('video/mp4')
    expect(await form.get('file').text()).toBe('frames')
  })

  it('uploadPreviewFile can skip the movie normalization', async () => {
    fake.reply(201, { id: PREVIEW_FILE_ID })
    await kitsu.task.uploadPreviewFile(PREVIEW_FILE_ID, movie, {
      normalizeMovie: false,
      fileName: 'shot.mp4'
    })
    expect(fake.calls[0].path).toBe(UPLOAD_ROUTE)
    expect(fake.calls[0].query.get('normalize')).toBe('false')
    expect(fake.calls[0].body.get('file')).toBeInstanceOf(Blob)
  })

  it('uploadPreviewFile reports the upload progress', async () => {
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
      getResponseHeader() {
        return 'application/json'
      }
    }
    const onProgress = vi.fn()
    const pending = kitsu.task.uploadPreviewFile(PREVIEW_FILE_ID, movie, {
      normalizeMovie: false,
      fileName: 'shot.mp4',
      onProgress
    })
    await vi.waitFor(() => expect(xhrs).toHaveLength(1))
    xhrs[0].upload.onprogress({ loaded: 3, total: 6 })
    Object.assign(xhrs[0], { status: 201, responseText: '{"ok":true}' })
    xhrs[0].onload()

    expect(await pending).toEqual({ ok: true })
    expect(onProgress).toHaveBeenCalledWith({ loaded: 3, total: 6 })
    expect(xhrs[0].method).toBe('POST')
    expect(xhrs[0].url).toBe(
      `http://kitsu.test/api${UPLOAD_ROUTE}?normalize=false`
    )
    expect(xhrs[0].body.get('file')).toBeInstanceOf(Blob)
    expect(fake.calls).toHaveLength(0)
  })

  it('uploadPreviewFile stops on an aborted signal', async () => {
    const controller = new AbortController()
    controller.abort()
    fake.on('POST', UPLOAD_ROUTE, ({ signal }) =>
      signal.aborted
        ? Promise.reject(new DOMException('Aborted', 'AbortError'))
        : new Response('{}', { status: 201 })
    )
    await expect(
      kitsu.task.uploadPreviewFile(PREVIEW_FILE_ID, movie, {
        fileName: 'shot.mp4',
        signal: controller.signal
      })
    ).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('uploadPreviewFile rejects without a preview file or a file', async () => {
    await expect(
      kitsu.task.uploadPreviewFile(null, movie, { fileName: 'shot.mp4' })
    ).rejects.toBeInstanceOf(ParameterError)
    await expect(
      kitsu.task.uploadPreviewFile(PREVIEW_FILE_ID)
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('uploadPreviewFile rejects a missing file even with a file name', async () => {
    await Promise.all(
      NOT_A_FILE.map(file =>
        expect(
          kitsu.task.uploadPreviewFile(PREVIEW_FILE_ID, file, {
            fileName: 'shot.mp4'
          })
        ).rejects.toBeInstanceOf(ParameterError)
      )
    )
    expect(fake.calls).toHaveLength(0)
  })

  it('uploadPreviewFile rejects a bare Blob without file name', async () => {
    await expect(
      kitsu.task.uploadPreviewFile(PREVIEW_FILE_ID, movie)
    ).rejects.toBeInstanceOf(ParameterError)
    await expect(
      kitsu.task.uploadPreviewFile(PREVIEW_FILE_ID, new File(['frames'], ''))
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('uploadPreviewFile takes the name of a File', async () => {
    fake.reply(201, { id: PREVIEW_FILE_ID })
    await kitsu.task.uploadPreviewFile(PREVIEW_FILE_ID, movieFile)
    expect(fake.calls).toHaveLength(1)
    expect(fake.calls[0].body.get('file').name).toBe('shot.mp4')
  })

  it('addPreview creates the preview entry, then uploads its content', async () => {
    fake
      .reply(201, { id: PREVIEW_FILE_ID })
      .reply(201, { id: PREVIEW_FILE_ID, extension: 'mp4' })
    const previewFile = await kitsu.task.addPreview(
      { id: TASK_ID },
      { id: COMMENT_ID },
      movie,
      { revision: 3, fileName: 'shot.mp4' }
    )
    expect(previewFile).toEqual({ id: PREVIEW_FILE_ID, extension: 'mp4' })
    expect(fake.calls).toHaveLength(2)
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `${COMMENT_PATH}/add-preview`,
      body: { revision: 3 }
    })
    expect(fake.calls[1]).toMatchObject({ method: 'POST', path: UPLOAD_ROUTE })
    expect(fake.calls[1].query.has('normalize')).toBe(false)
    const form = fake.calls[1].body
    expect(form).toBeInstanceOf(FormData)
    expect([...form.keys()]).toEqual(['file'])
    expect(form.get('file').name).toBe('shot.mp4')
    expect(await form.get('file').text()).toBe('frames')
  })

  it('addPreview can skip the movie normalization', async () => {
    fake.reply(201, { id: PREVIEW_FILE_ID }).reply(201, { id: PREVIEW_FILE_ID })
    await kitsu.task.addPreview(TASK_ID, COMMENT_ID, movieFile, {
      normalizeMovie: false
    })
    expect(fake.calls[0].body).toEqual({})
    expect(fake.calls[1].query.get('normalize')).toBe('false')
  })

  it('addPreview creates nothing without a file', async () => {
    await expect(
      kitsu.task.addPreview(TASK_ID, COMMENT_ID)
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('addPreview creates nothing for a missing file with a file name', async () => {
    await Promise.all(
      NOT_A_FILE.map(file =>
        expect(
          kitsu.task.addPreview(TASK_ID, COMMENT_ID, file, {
            fileName: 'shot.mp4'
          })
        ).rejects.toBeInstanceOf(ParameterError)
      )
    )
    expect(fake.calls).toHaveLength(0)
  })

  it('addPreview creates nothing for a bare Blob without file name', async () => {
    await expect(
      kitsu.task.addPreview(TASK_ID, COMMENT_ID, movie)
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('addExtraPreview creates the extra entry, then uploads its content', async () => {
    fake.reply(201, { id: OTHER_ID }).reply(201, { id: OTHER_ID, revision: 3 })
    const previewFile = await kitsu.task.addExtraPreview(
      { id: TASK_ID },
      { id: COMMENT_ID },
      { id: PREVIEW_FILE_ID },
      sketch,
      { normalizeMovie: false, fileName: 'sketch.png' }
    )
    expect(previewFile).toEqual({ id: OTHER_ID, revision: 3 })
    expect(fake.calls).toHaveLength(2)
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `${COMMENT_PATH}/preview-files/${PREVIEW_FILE_ID}`,
      body: {}
    })
    expect(fake.calls[1]).toMatchObject({
      method: 'POST',
      path: `/pictures/preview-files/${OTHER_ID}`
    })
    expect(fake.calls[1].query.get('normalize')).toBe('false')
    const form = fake.calls[1].body
    expect(form).toBeInstanceOf(FormData)
    expect(form.get('file').name).toBe('sketch.png')
    expect(await form.get('file').text()).toBe('sketch')
  })

  it('addExtraPreview creates nothing without a file', async () => {
    await expect(
      kitsu.task.addExtraPreview(TASK_ID, COMMENT_ID, PREVIEW_FILE_ID)
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('addExtraPreview creates nothing for a missing file with a file name', async () => {
    await Promise.all(
      NOT_A_FILE.map(file =>
        expect(
          kitsu.task.addExtraPreview(
            TASK_ID,
            COMMENT_ID,
            PREVIEW_FILE_ID,
            file,
            { fileName: 'sketch.png' }
          )
        ).rejects.toBeInstanceOf(ParameterError)
      )
    )
    expect(fake.calls).toHaveLength(0)
  })

  it('addExtraPreview creates nothing for a bare Blob without file name', async () => {
    await expect(
      kitsu.task.addExtraPreview(TASK_ID, COMMENT_ID, PREVIEW_FILE_ID, sketch)
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('publishPreview comments the task, then adds the preview', async () => {
    fake
      .reply(201, { id: COMMENT_ID })
      .reply(201, { id: PREVIEW_FILE_ID })
      .reply(201, { id: PREVIEW_FILE_ID, extension: 'mp4' })
    const result = await kitsu.task.publishPreview(
      { id: TASK_ID },
      { id: TASK_STATUS_ID },
      movie,
      {
        comment: 'first pass',
        person: PERSON_ID,
        checklist: [{ text: 'Fix the rig', checked: false }],
        createdAt: '2026-09-19T10:00:00',
        links: ['https://example.com/ref'],
        revision: 2,
        normalizeMovie: false,
        fileName: 'shot.mp4'
      }
    )
    expect(result).toEqual({
      comment: { id: COMMENT_ID },
      preview_file: { id: PREVIEW_FILE_ID, extension: 'mp4' }
    })
    expect(fake.calls).toHaveLength(3)
    expect(fake.calls[0]).toMatchObject({ method: 'POST', path: COMMENT_ROUTE })
    expect(fake.calls[0].body).toEqual({
      task_status_id: TASK_STATUS_ID,
      comment: 'first pass',
      checklist: [{ text: 'Fix the rig', checked: false }],
      links: ['https://example.com/ref'],
      for_client: false,
      person_id: PERSON_ID,
      created_at: '2026-09-19T10:00:00'
    })
    expect(fake.calls[1]).toMatchObject({
      method: 'POST',
      path: `${COMMENT_PATH}/add-preview`,
      body: { revision: 2 }
    })
    expect(fake.calls[2]).toMatchObject({ method: 'POST', path: UPLOAD_ROUTE })
    expect(fake.calls[2].query.get('normalize')).toBe('false')
    expect(fake.calls[2].body).toBeInstanceOf(FormData)
    expect(fake.calls[2].body.get('file').name).toBe('shot.mp4')
    expect(await fake.calls[2].body.get('file').text()).toBe('frames')
  })

  it('publishPreview sends the attachments with the comment', async () => {
    fake
      .reply(201, { id: COMMENT_ID })
      .reply(201, { id: PREVIEW_FILE_ID })
      .reply(201, { id: PREVIEW_FILE_ID })
    await kitsu.task.publishPreview(TASK_ID, TASK_STATUS_ID, movie, {
      attachments: [notes],
      fileName: 'shot.mp4'
    })
    const commentForm = fake.calls[0].body
    expect(commentForm).toBeInstanceOf(FormData)
    expect(await commentForm.get('file').text()).toBe('notes')
    expect(commentForm.get('file').name).not.toBe('shot.mp4')
    expect(fake.calls[2].body.get('file').name).toBe('shot.mp4')
  })

  it('publishPreview sets the preview as thumbnail on demand', async () => {
    fake
      .reply(201, { id: COMMENT_ID })
      .reply(201, { id: PREVIEW_FILE_ID })
      .reply(201, { id: PREVIEW_FILE_ID })
      .reply(200, { id: PREVIEW_FILE_ID })
    await kitsu.task.publishPreview(TASK_ID, TASK_STATUS_ID, movieFile, {
      setThumbnail: true
    })
    expect(fake.calls).toHaveLength(4)
    expect(fake.calls[3]).toMatchObject({
      method: 'PUT',
      path: `/actions/preview-files/${PREVIEW_FILE_ID}/set-main-preview`,
      body: {}
    })
  })

  // The Tauri setup of docs/files.md: the movie must not leave the injected
  // fetch for the XMLHttpRequest of the webview, which CORS blocks.
  it('publishPreview uploads through an injected fetch, without progress', async () => {
    const xhrs = []
    globalThis.XMLHttpRequest = class {
      constructor() {
        xhrs.push(this)
      }
    }
    fake
      .reply(201, { id: COMMENT_ID })
      .reply(201, { id: PREVIEW_FILE_ID })
      .reply(201, { id: PREVIEW_FILE_ID })
    const onProgress = vi.fn()
    await kitsu.task.publishPreview(TASK_ID, TASK_STATUS_ID, movieFile, {
      onProgress
    })
    expect(fake.calls).toHaveLength(3)
    expect(fake.calls[2]).toMatchObject({ method: 'POST', path: UPLOAD_ROUTE })
    expect(xhrs).toHaveLength(0)
    expect(onProgress).not.toHaveBeenCalled()
  })

  it('publishPreview comments nothing without a file', async () => {
    await expect(
      kitsu.task.publishPreview(TASK_ID, TASK_STATUS_ID)
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('publishPreview comments nothing for a missing file with a file name', async () => {
    await Promise.all(
      NOT_A_FILE.map(file =>
        expect(
          kitsu.task.publishPreview(TASK_ID, TASK_STATUS_ID, file, {
            comment: 'first pass',
            fileName: 'shot.mp4'
          })
        ).rejects.toBeInstanceOf(ParameterError)
      )
    )
    expect(fake.calls).toHaveLength(0)
  })

  it('publishPreview comments nothing for a bare Blob without file name', async () => {
    await expect(
      kitsu.task.publishPreview(TASK_ID, TASK_STATUS_ID, movie, {
        comment: 'first pass'
      })
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('createMultipleComments posts the comments of a project', async () => {
    const comments = [
      {
        object_id: TASK_ID,
        task_status_id: TASK_STATUS_ID,
        comment: 'Comment 1'
      },
      {
        object_id: OTHER_ID,
        task_status_id: TASK_STATUS_ID,
        comment: 'Comment 2',
        links: ['https://example.com/ref']
      }
    ]
    fake.reply(201, [{ id: COMMENT_ID }, { id: OTHER_ID }])
    const created = await kitsu.task.createMultipleComments(
      { id: PROJECT_ID },
      comments
    )
    expect(created).toEqual([{ id: COMMENT_ID }, { id: OTHER_ID }])
    expect(fake.calls).toHaveLength(1)
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/actions/projects/${PROJECT_ID}/tasks/comment-many`
    })
    expect(fake.calls[0].body).toEqual(comments)
  })

  it('createMultipleComments posts an empty list by default', async () => {
    fake.reply(201, [])
    expect(await kitsu.task.createMultipleComments(PROJECT_ID)).toEqual([])
    expect(fake.calls[0].body).toEqual([])
  })
})
