import { beforeEach, describe, expect, it } from 'vitest'

import { ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import {
  CHAT_MESSAGE_ID,
  ENTITY_ID,
  OTHER_ID,
  TASK_ID
} from '../helpers/ids.js'

describe('user namespace: Kitsu coverage', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('getChat reads the chat of an entity, null on 404', async () => {
    fake.reply(200, { object_id: ENTITY_ID }).reply(404, {})
    expect(await kitsu.user.getChat({ id: ENTITY_ID })).toEqual({
      object_id: ENTITY_ID
    })
    expect(await kitsu.user.getChat(ENTITY_ID)).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/entities/${ENTITY_ID}/chat`
    })
  })

  it('allChatMessages lists the messages of the chat of an entity', async () => {
    fake.reply(200, [{ id: CHAT_MESSAGE_ID }])
    expect(await kitsu.user.allChatMessages({ id: ENTITY_ID })).toEqual([
      { id: CHAT_MESSAGE_ID }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/entities/${ENTITY_ID}/chat/messages`
    })
  })

  it('getChatMessage reads one message, null on 404', async () => {
    fake.reply(200, { id: CHAT_MESSAGE_ID }).reply(404, {})
    expect(
      await kitsu.user.getChatMessage(
        { id: ENTITY_ID },
        { id: CHAT_MESSAGE_ID }
      )
    ).toEqual({ id: CHAT_MESSAGE_ID })
    expect(
      await kitsu.user.getChatMessage(ENTITY_ID, CHAT_MESSAGE_ID)
    ).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/entities/${ENTITY_ID}/chat/messages/${CHAT_MESSAGE_ID}`
    })
  })

  it('newChatMessage posts a JSON message without attachment', async () => {
    fake.reply(201, { id: CHAT_MESSAGE_ID })
    expect(await kitsu.user.newChatMessage({ id: ENTITY_ID }, 'Hello')).toEqual(
      { id: CHAT_MESSAGE_ID }
    )
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/data/entities/${ENTITY_ID}/chat/messages`,
      body: { message: 'Hello' }
    })
  })

  it('newChatMessage sends a multipart form with attachments', async () => {
    fake.reply(201, { id: CHAT_MESSAGE_ID })
    await kitsu.user.newChatMessage(ENTITY_ID, 'Look', {
      attachments: [new Blob(['one']), new Blob(['two'])]
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/data/entities/${ENTITY_ID}/chat/messages`
    })
    const { body } = fake.calls[0]
    expect(body).toBeInstanceOf(FormData)
    expect([...body.keys()].sort()).toEqual(['file', 'file-1', 'message'])
    expect(body.get('message')).toBe('Look')
    expect(await body.get('file').text()).toBe('one')
    expect(await body.get('file-1').text()).toBe('two')
  })

  it('newChatMessage forwards the caller signal with attachments', async () => {
    const controller = new AbortController()
    controller.abort()
    fake.reply(201, { id: CHAT_MESSAGE_ID })
    await kitsu.user
      .newChatMessage(ENTITY_ID, 'Look', {
        attachments: [new Blob(['one'])],
        signal: controller.signal
      })
      .catch(() => null)
    expect(fake.calls).toHaveLength(1)
    expect(fake.calls[0].signal.aborted).toBe(true)
  })

  it('newChatMessage sends an empty message with attachments', async () => {
    fake.reply(201, { id: CHAT_MESSAGE_ID })
    await kitsu.user.newChatMessage(ENTITY_ID, '', {
      attachments: [new Blob(['one'])]
    })
    const { body } = fake.calls[0]
    expect(body).toBeInstanceOf(FormData)
    expect(body.get('message')).toBe('')
    expect(await body.get('file').text()).toBe('one')
  })

  it('newChatMessage rejects a nil message even with attachments', async () => {
    await expect(
      kitsu.user.newChatMessage(ENTITY_ID, null, {
        attachments: [new Blob(['one'])]
      })
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('newChatMessage rejects an empty message without attachment', async () => {
    await expect(
      kitsu.user.newChatMessage(ENTITY_ID, '')
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('newChatMessage rejects a missing message without any request', async () => {
    await expect(kitsu.user.newChatMessage(ENTITY_ID)).rejects.toBeInstanceOf(
      ParameterError
    )
    expect(fake.calls).toHaveLength(0)
  })

  it('removeChatMessage deletes a message of the chat', async () => {
    fake.reply(204)
    expect(
      await kitsu.user.removeChatMessage(
        { id: ENTITY_ID },
        { id: CHAT_MESSAGE_ID }
      )
    ).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/entities/${ENTITY_ID}/chat/messages/${CHAT_MESSAGE_ID}`
    })
  })

  it('getTasksRequiringFeedbackFilterValues reads the filter values', async () => {
    fake.reply(200, { projects: [], task_types: [] }).reply(404, {})
    expect(await kitsu.user.getTasksRequiringFeedbackFilterValues()).toEqual({
      projects: [],
      task_types: []
    })
    expect(await kitsu.user.getTasksRequiringFeedbackFilterValues()).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/user/tasks-to-check/filter-values'
    })
  })

  it('subscribeToTasks posts the task ids', async () => {
    fake.reply(201, [{ task_id: TASK_ID }, { task_id: OTHER_ID }])
    expect(
      await kitsu.user.subscribeToTasks([{ id: TASK_ID }, OTHER_ID])
    ).toEqual([{ task_id: TASK_ID }, { task_id: OTHER_ID }])
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: '/actions/user/tasks/subscribe',
      body: { task_ids: [TASK_ID, OTHER_ID] }
    })
  })

  it('unsubscribeFromTasks posts the task ids', async () => {
    fake.reply(200, [TASK_ID, OTHER_ID])
    expect(
      await kitsu.user.unsubscribeFromTasks([{ id: TASK_ID }, OTHER_ID])
    ).toEqual([TASK_ID, OTHER_ID])
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: '/actions/user/tasks/unsubscribe',
      body: { task_ids: [TASK_ID, OTHER_ID] }
    })
  })
})
