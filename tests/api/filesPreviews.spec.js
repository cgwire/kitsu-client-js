import { beforeEach, describe, expect, it } from 'vitest'

import { ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import {
  OTHER_ID,
  PREVIEW_FILE_ID,
  PROJECT_ID,
  TASK_ID
} from '../helpers/ids.js'

const ATTACHMENT_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'

const pngResponse = () =>
  new Response('png-bytes', {
    status: 200,
    headers: { 'Content-Type': 'image/png' }
  })

describe('files namespace: preview and attachment files', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('getPreviewFile returns the preview file, null on 404', async () => {
    fake.reply(200, { id: PREVIEW_FILE_ID }).reply(404, {})
    expect(await kitsu.files.getPreviewFile(PREVIEW_FILE_ID)).toEqual({
      id: PREVIEW_FILE_ID
    })
    expect(await kitsu.files.getPreviewFile({ id: PREVIEW_FILE_ID })).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/preview-files/${PREVIEW_FILE_ID}`
    })
  })

  it('removePreviewFile deletes the preview, forcing on demand', async () => {
    fake.reply(204).reply(204)
    await kitsu.files.removePreviewFile(PREVIEW_FILE_ID)
    await kitsu.files.removePreviewFile(
      { id: PREVIEW_FILE_ID },
      { force: true }
    )
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/preview-files/${PREVIEW_FILE_ID}`
    })
    expect(fake.calls[0].query.has('force')).toBe(false)
    expect(fake.calls[1].query.get('force')).toBe('true')
  })

  it('getAllPreviewFilesForTask filters the previews by task', async () => {
    fake.reply(200, [{ id: PREVIEW_FILE_ID }])
    expect(
      await kitsu.files.getAllPreviewFilesForTask({ id: TASK_ID })
    ).toEqual([{ id: PREVIEW_FILE_ID }])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/preview-files'
    })
    expect(fake.calls[0].query.get('task_id')).toBe(TASK_ID)
  })

  it('getAllAttachmentFilesForTask lists the task attachments', async () => {
    fake.reply(200, [{ id: ATTACHMENT_ID }])
    expect(await kitsu.files.getAllAttachmentFilesForTask(TASK_ID)).toEqual([
      { id: ATTACHMENT_ID }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/tasks/${TASK_ID}/attachment-files`
    })
  })

  it('getAllAttachmentFilesForProject lists the project attachments', async () => {
    fake.reply(200, [{ id: ATTACHMENT_ID }])
    expect(
      await kitsu.files.getAllAttachmentFilesForProject({ id: PROJECT_ID })
    ).toEqual([{ id: ATTACHMENT_ID }])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/attachment-files`
    })
  })

  it('getAttachmentFile returns the attachment, null on 404', async () => {
    fake.reply(200, { id: ATTACHMENT_ID }).reply(404, {})
    expect(await kitsu.files.getAttachmentFile(ATTACHMENT_ID)).toEqual({
      id: ATTACHMENT_ID
    })
    expect(
      await kitsu.files.getAttachmentFile({ id: ATTACHMENT_ID })
    ).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/attachment-files/${ATTACHMENT_ID}`
    })
  })

  it('updatePreview saves the given data on the preview file', async () => {
    const data = { name: 'turntable' }
    fake.reply(200, { id: PREVIEW_FILE_ID, name: 'turntable' })
    expect(
      await kitsu.files.updatePreview({ id: PREVIEW_FILE_ID }, data)
    ).toMatchObject({ name: 'turntable' })
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/preview-files/${PREVIEW_FILE_ID}`,
      body: { name: 'turntable' }
    })
    expect(data).toEqual({ name: 'turntable' })
  })

  it('getRunningPreviewFiles lists the previews being processed', async () => {
    const running = {
      id: PREVIEW_FILE_ID,
      status: 'processing',
      project_id: PROJECT_ID,
      task_type_id: OTHER_ID,
      full_entity_name: 'SE01 / SH010'
    }
    fake.reply(200, [running])
    expect(await kitsu.files.getRunningPreviewFiles()).toEqual([running])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/playlists/preview-files/running'
    })
    expect([...fake.calls[0].query.keys()]).toEqual([])
  })

  it('getRunningPreviewFiles pages with a limit and a cursor', async () => {
    fake.reply(200, [])
    await kitsu.files.getRunningPreviewFiles({
      limit: 20,
      lastPreviewFile: { id: PREVIEW_FILE_ID }
    })
    expect(Object.fromEntries(fake.calls[0].query)).toEqual({
      limit: '20',
      cursor_preview_file_id: PREVIEW_FILE_ID
    })
  })

  it('getRunningPreviewFiles rejects a malformed cursor', async () => {
    await expect(
      kitsu.files.getRunningPreviewFiles({ lastPreviewFile: 'nope' })
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('extractFrameFromPreview returns the raw response of the frame', async () => {
    const path = `/actions/preview-files/${PREVIEW_FILE_ID}/extract-frame`
    fake.on('GET', path, pngResponse)
    const response = await kitsu.files.extractFrameFromPreview(
      PREVIEW_FILE_ID,
      12
    )
    expect(response).toBeInstanceOf(Response)
    expect(await response.text()).toBe('png-bytes')
    expect(fake.calls[0]).toMatchObject({ method: 'GET', path })
    expect(fake.calls[0].query.get('frame_number')).toBe('12')
  })

  // Zou seeks to (frame - 1) / fps and reads a missing frame number as 0.
  it('extractFrameFromPreview rejects a frame number below 1', async () => {
    const errors = await Promise.all(
      [0, -1, 1.5, undefined, '12'].map(frameNumber =>
        kitsu.files
          .extractFrameFromPreview(PREVIEW_FILE_ID, frameNumber)
          .catch(err => err)
      )
    )
    errors.forEach(err => expect(err).toBeInstanceOf(ParameterError))
    expect(fake.calls).toHaveLength(0)
  })

  it('extractTileFromPreview returns the raw response of the tile', async () => {
    const path = `/actions/preview-files/${PREVIEW_FILE_ID}/extract-tile`
    fake.on('GET', path, pngResponse)
    const response = await kitsu.files.extractTileFromPreview({
      id: PREVIEW_FILE_ID
    })
    expect(response).toBeInstanceOf(Response)
    expect(await response.text()).toBe('png-bytes')
    expect(fake.calls[0]).toMatchObject({ method: 'GET', path })
  })

  // Zou answers every preview of the revision, in the new order.
  it('updatePreviewPosition sets the order of the preview', async () => {
    const revision = [
      { id: OTHER_ID, revision: 3, position: 1 },
      { id: PREVIEW_FILE_ID, revision: 3, position: 2 }
    ]
    fake.reply(200, revision)
    expect(await kitsu.files.updatePreviewPosition(PREVIEW_FILE_ID, 2)).toEqual(
      revision
    )
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/actions/preview-files/${PREVIEW_FILE_ID}/update-position`,
      body: { position: 2 }
    })
  })

  // Zou moves a preview only to a position from 1 to the number of previews
  // of the revision, and answers 200 to any other without moving anything.
  it('updatePreviewPosition rejects a position below 1', async () => {
    const errors = await Promise.all(
      [0, -2, 2.5, undefined].map(position =>
        kitsu.files
          .updatePreviewPosition(PREVIEW_FILE_ID, position)
          .catch(err => err)
      )
    )
    errors.forEach(err => expect(err).toBeInstanceOf(ParameterError))
    expect(fake.calls).toHaveLength(0)
  })

  // Same shapes as Kitsu, at 25 fps: frames keyed by a time on the frame
  // grid, drawing objects by id.
  it('updatePreviewAnnotations only sends the given change lists', async () => {
    fake.reply(200, { id: PREVIEW_FILE_ID }).reply(200, { id: PREVIEW_FILE_ID })
    const stroke = { id: OTHER_ID, type: 'path', stroke: '#ff3860' }
    const additions = [
      { time: 0.48, frame: 13, drawing: { objects: [stroke] } }
    ]
    const updates = [
      { time: 0.48, frame: 13, drawing: { objects: [{ ...stroke, left: 40 }] } }
    ]
    const deletions = [{ time: 1.2, frame: 31, objects: [OTHER_ID] }]
    await kitsu.files.updatePreviewAnnotations(
      { id: PREVIEW_FILE_ID },
      { additions }
    )
    await kitsu.files.updatePreviewAnnotations(PREVIEW_FILE_ID, {
      updates,
      deletions
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/actions/preview-files/${PREVIEW_FILE_ID}/update-annotations`
    })
    expect(fake.calls[0].body).toEqual({ additions })
    expect(fake.calls[1].body).toEqual({ updates, deletions })
  })
})
