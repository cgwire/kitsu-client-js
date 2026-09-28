import { beforeEach, describe, expect, it } from 'vitest'

import { NotFoundError, ParameterError } from '../../src/index.js'
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
const TIME_SPENT_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const ATTACHMENT_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff'

const COMMENT_PATH = `/tasks/${TASK_ID}/comments/${COMMENT_ID}`

describe('task namespace: comments, previews and time spent', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('startTask comments the task with the wip status', async () => {
    fake.reply(200, [{ id: TASK_STATUS_ID }]).reply(201, { id: COMMENT_ID })
    expect(await kitsu.task.startTask({ id: TASK_ID })).toEqual({
      id: COMMENT_ID
    })
    expect(fake.calls[0].path).toBe('/data/task-status')
    expect(fake.calls[0].query.get('short_name')).toBe('wip')
    expect(fake.calls[1]).toMatchObject({
      method: 'POST',
      path: `/actions/tasks/${TASK_ID}/comment`
    })
    expect(fake.calls[1].body).toEqual({
      task_status_id: TASK_STATUS_ID,
      comment: '',
      checklist: [],
      links: [],
      for_client: false
    })
  })

  it('startTask uses the given status and person', async () => {
    fake.reply(201, { id: COMMENT_ID })
    await kitsu.task.startTask(TASK_ID, {
      startedTaskStatus: { id: TASK_STATUS_ID },
      person: PERSON_ID
    })
    expect(fake.calls).toHaveLength(1)
    expect(fake.calls[0].body).toMatchObject({
      task_status_id: TASK_STATUS_ID,
      person_id: PERSON_ID
    })
  })

  it('startTask fails when the wip status does not exist', async () => {
    fake.reply(200, [])
    await expect(kitsu.task.startTask(TASK_ID)).rejects.toBeInstanceOf(
      NotFoundError
    )
    expect(fake.calls).toHaveLength(1)
  })

  it('getTimeSpent returns the time spent on a task, for a date on demand', async () => {
    fake.reply(200, { total: 60 }).reply(200, { total: 30 }).reply(404, {})
    expect(await kitsu.task.getTimeSpent({ id: TASK_ID })).toEqual({
      total: 60
    })
    await kitsu.task.getTimeSpent(TASK_ID, { date: '2026-09-19' })
    expect(await kitsu.task.getTimeSpent(TASK_ID)).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/actions/tasks/${TASK_ID}/time-spents`
    })
    expect(fake.calls[1].path).toBe(
      `/actions/tasks/${TASK_ID}/time-spents/2026-09-19`
    )
  })

  it('getTaskTimeSpentForDate returns the time spent at a date, null on 404', async () => {
    fake.reply(200, { total: 60 }).reply(404, {})
    expect(
      await kitsu.task.getTaskTimeSpentForDate(
        { id: TASK_ID },
        new Date(2026, 8, 19, 10)
      )
    ).toEqual({ total: 60 })
    expect(
      await kitsu.task.getTaskTimeSpentForDate(TASK_ID, '2026-09-20')
    ).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/actions/tasks/${TASK_ID}/time-spents/2026-09-19`
    })
    expect(fake.calls[1].path).toBe(
      `/actions/tasks/${TASK_ID}/time-spents/2026-09-20`
    )
  })

  it.each([
    ['setTimeSpent', ''],
    ['addTimeSpent', '/add']
  ])('%s posts the duration for a person and a date', async (name, suffix) => {
    fake.reply(201, { duration: 120 }).reply(201, { duration: 120 })
    expect(
      await kitsu.task[name]({ id: TASK_ID }, PERSON_ID, '2026-09-19', 120)
    ).toEqual({ duration: 120 })
    await kitsu.task[name](
      TASK_ID,
      { id: PERSON_ID },
      new Date(2026, 8, 20, 8),
      60
    )
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/actions/tasks/${TASK_ID}/time-spents/2026-09-19/persons/${PERSON_ID}${suffix}`,
      body: { duration: 120 }
    })
    expect(fake.calls[1].path).toBe(
      `/actions/tasks/${TASK_ID}/time-spents/2026-09-20/persons/${PERSON_ID}${suffix}`
    )
  })

  it('setTimeSpent keeps a crafted date out of the request path', async () => {
    await expect(
      kitsu.task.setTimeSpent(TASK_ID, PERSON_ID, '2026-09-19/../x', 1)
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('removeTimeSpent deletes the entry', async () => {
    fake.reply(204)
    await kitsu.task.removeTimeSpent({ id: TIME_SPENT_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/time-spents/${TIME_SPENT_ID}`
    })
  })

  it('getComment returns the comment, null on 404', async () => {
    fake.reply(200, { id: COMMENT_ID }).reply(404, {})
    expect(await kitsu.task.getComment(COMMENT_ID)).toEqual({ id: COMMENT_ID })
    expect(await kitsu.task.getComment({ id: COMMENT_ID })).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/comments/${COMMENT_ID}`
    })
  })

  it('removeComment deletes the comment', async () => {
    fake.reply(204)
    await kitsu.task.removeComment({ id: COMMENT_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/comments/${COMMENT_ID}`
    })
  })

  it('updateComment saves the whole comment', async () => {
    const comment = { id: COMMENT_ID, text: 'Edited' }
    fake.reply(200, comment)
    expect(await kitsu.task.updateComment(comment)).toEqual(comment)
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/comments/${COMMENT_ID}`,
      body: comment
    })
  })

  it('allCommentsForTask lists the comments of a task', async () => {
    fake.reply(200, [{ id: COMMENT_ID }])
    expect(await kitsu.task.allCommentsForTask({ id: TASK_ID })).toEqual([
      { id: COMMENT_ID }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/tasks/${TASK_ID}/comments`
    })
  })

  it('getLastCommentForTask returns the first comment listed, or null', async () => {
    fake
      .reply(200, [{ id: COMMENT_ID }, { id: OTHER_ID }])
      .reply(200, [])
      .reply(404, {})
    expect(await kitsu.task.getLastCommentForTask({ id: TASK_ID })).toEqual({
      id: COMMENT_ID
    })
    expect(await kitsu.task.getLastCommentForTask(TASK_ID)).toBeNull()
    expect(await kitsu.task.getLastCommentForTask(TASK_ID)).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/tasks/${TASK_ID}/comments`
    })
  })

  it('allPreviewsForTask lists the previews of a task', async () => {
    fake.reply(200, [{ id: PREVIEW_FILE_ID }])
    expect(await kitsu.task.allPreviewsForTask(TASK_ID)).toEqual([
      { id: PREVIEW_FILE_ID }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/tasks/${TASK_ID}/previews`
    })
  })

  it.each([
    ['allCommentsForProject', 'comments'],
    ['allNotificationsForProject', 'notifications'],
    ['allPreviewFilesForProject', 'preview-files'],
    ['allSubscriptionsForProject', 'subscriptions']
  ])('%s lists the entries of a project', async (name, suffix) => {
    fake.reply(200, [{ id: OTHER_ID }]).reply(200, [])
    expect(await kitsu.task[name]({ id: PROJECT_ID })).toEqual([
      { id: OTHER_ID }
    ])
    await kitsu.task[name](PROJECT_ID)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/${suffix}`
    })
  })

  it('createPreview adds a preview to a comment, revision on demand', async () => {
    fake.reply(201, { id: PREVIEW_FILE_ID }).reply(201, {})
    expect(
      await kitsu.task.createPreview({ id: TASK_ID }, { id: COMMENT_ID })
    ).toEqual({ id: PREVIEW_FILE_ID })
    await kitsu.task.createPreview(TASK_ID, COMMENT_ID, { revision: 3 })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/actions${COMMENT_PATH}/add-preview`
    })
    expect(fake.calls[0].body).toEqual({})
    expect(fake.calls[1].body).toEqual({ revision: 3 })
  })

  it('createExtraPreview adds a preview sharing the revision of another', async () => {
    fake.reply(201, { id: OTHER_ID })
    expect(
      await kitsu.task.createExtraPreview(TASK_ID, COMMENT_ID, {
        id: PREVIEW_FILE_ID
      })
    ).toEqual({ id: OTHER_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/actions${COMMENT_PATH}/preview-files/${PREVIEW_FILE_ID}`
    })
    expect(fake.calls[0].body).toEqual({})
  })

  it('removePreviewFromComment detaches the preview', async () => {
    fake.reply(204)
    await kitsu.task.removePreviewFromComment(
      { id: TASK_ID },
      { id: COMMENT_ID },
      { id: PREVIEW_FILE_ID }
    )
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/actions${COMMENT_PATH}/preview-files/${PREVIEW_FILE_ID}`
    })
  })

  it('setMainPreview sets the entity thumbnail, from a frame on demand', async () => {
    fake.reply(200, {}).reply(200, {})
    await kitsu.task.setMainPreview({ id: PREVIEW_FILE_ID })
    await kitsu.task.setMainPreview(PREVIEW_FILE_ID, { frameNumber: 0 })
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/actions/preview-files/${PREVIEW_FILE_ID}/set-main-preview`
    })
    expect(fake.calls[0].body).toEqual({})
    expect(fake.calls[1].body).toEqual({ frame_number: 0 })
  })

  it('batchComments posts comments carrying their own task', async () => {
    const comments = [{ task_id: TASK_ID, text: 'Good' }]
    fake.reply(201, [{ id: COMMENT_ID }])
    expect(await kitsu.task.batchComments(comments)).toEqual([
      { id: COMMENT_ID }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: '/actions/tasks/batch-comment',
      body: { comments }
    })
  })

  it('batchComments posts comments for one task', async () => {
    fake.reply(201, []).reply(201, [])
    await kitsu.task.batchComments([{ text: 'Good' }], {
      task: { id: TASK_ID }
    })
    await kitsu.task.batchComments()
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/actions/tasks/${TASK_ID}/batch-comment`,
      body: { comments: [{ text: 'Good' }] }
    })
    expect(fake.calls[1].body).toEqual({ comments: [] })
  })

  it('addTasksBatchComments posts the same comment on several tasks', async () => {
    const commentsData = { text: 'Good', task_status_id: TASK_STATUS_ID }
    fake.reply(201, [{ id: COMMENT_ID }])
    await kitsu.task.addTasksBatchComments(
      [{ id: TASK_ID }, OTHER_ID],
      commentsData
    )
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: '/actions/tasks/batch-comment',
      body: {
        comments: [
          { ...commentsData, task_id: TASK_ID },
          { ...commentsData, task_id: OTHER_ID }
        ]
      }
    })
    expect(commentsData).toEqual({
      text: 'Good',
      task_status_id: TASK_STATUS_ID
    })
  })

  it('moveCommentToTask moves the comment to another task', async () => {
    fake.reply(200, { id: COMMENT_ID, object_id: OTHER_ID })
    await kitsu.task.moveCommentToTask({ id: TASK_ID }, COMMENT_ID, {
      id: OTHER_ID
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/actions${COMMENT_PATH}/move`,
      body: { target_task_id: OTHER_ID }
    })
  })

  it('acknowledgeComment toggles the acknowledgement', async () => {
    fake.reply(200, { id: COMMENT_ID })
    await kitsu.task.acknowledgeComment(TASK_ID, { id: COMMENT_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/data${COMMENT_PATH}/ack`
    })
    expect(fake.calls[0].body).toEqual({})
  })

  it('replyToComment posts the reply', async () => {
    fake.reply(201, { id: OTHER_ID })
    expect(
      await kitsu.task.replyToComment({ id: TASK_ID }, COMMENT_ID, 'Thanks')
    ).toEqual({ id: OTHER_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/data${COMMENT_PATH}/reply`
    })
    expect(fake.calls[0].body).toEqual({ text: 'Thanks' })
  })

  it('deleteCommentAttachment deletes an attachment of a comment', async () => {
    fake.reply(204)
    await kitsu.task.deleteCommentAttachment(TASK_ID, COMMENT_ID, {
      id: ATTACHMENT_ID
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data${COMMENT_PATH}/attachments/${ATTACHMENT_ID}`
    })
  })

  it('deleteCommentReply deletes a reply of a comment', async () => {
    fake.reply(204)
    await kitsu.task.deleteCommentReply({ id: TASK_ID }, COMMENT_ID, OTHER_ID)
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data${COMMENT_PATH}/reply/${OTHER_ID}`
    })
  })
})
