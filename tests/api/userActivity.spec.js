import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { makeClient } from '../helpers/client.js'
import { ENTITY_ID, NOTIFICATION_ID, TASK_ID } from '../helpers/ids.js'

const LOG_ID = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd'

describe('user namespace: time, notifications, subscriptions, chats', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('getTimespentsRange filters by date range, null on 404', async () => {
    fake
      .reply(200, [{ duration: 60 }])
      .reply(200, [])
      .reply(404, {})
    expect(
      await kitsu.user.getTimespentsRange('2026-09-01', '2026-09-30')
    ).toEqual([{ duration: 60 }])
    await kitsu.user.getTimespentsRange(
      new Date(2026, 8, 1, 12),
      new Date(2026, 8, 30, 12)
    )
    expect(
      await kitsu.user.getTimespentsRange('2026-09-01', '2026-09-30')
    ).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/user/time-spents'
    })
    expect(fake.calls[0].query.get('start_date')).toBe('2026-09-01')
    expect(fake.calls[0].query.get('end_date')).toBe('2026-09-30')
    expect(fake.calls[1].query.get('start_date')).toBe('2026-09-01')
    expect(fake.calls[1].query.get('end_date')).toBe('2026-09-30')
  })

  it('logDesktopSessionLogIn posts the current UTC time', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-19T10:30:00.000Z'))
    fake.reply(201, { id: LOG_ID })
    expect(await kitsu.user.logDesktopSessionLogIn()).toEqual({ id: LOG_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: '/data/user/desktop-login-logs',
      body: { date: '2026-09-19T10:30:00.000' }
    })
  })

  it('allDesktopLoginLogs lists the desktop logins of the user', async () => {
    fake.reply(200, [{ id: LOG_ID }])
    expect(await kitsu.user.allDesktopLoginLogs()).toEqual([{ id: LOG_ID }])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/user/desktop-login-logs'
    })
  })

  it('getTimeSpentsByDate reads one day, null on 404', async () => {
    fake.reply(200, [{ duration: 30 }]).reply(404, {})
    expect(await kitsu.user.getTimeSpentsByDate('2026-09-19')).toEqual([
      { duration: 30 }
    ])
    expect(
      await kitsu.user.getTimeSpentsByDate(new Date(2026, 8, 20, 8))
    ).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/user/time-spents/2026-09-19'
    })
    expect(fake.calls[1].path).toBe('/data/user/time-spents/2026-09-20')
  })

  it('getTaskTimeSpent reads the time spent on a task, null on 404', async () => {
    fake.reply(200, { duration: 120 }).reply(404, {})
    expect(
      await kitsu.user.getTaskTimeSpent({ id: TASK_ID }, '2026-09-19')
    ).toEqual({ duration: 120 })
    expect(await kitsu.user.getTaskTimeSpent(TASK_ID, '2026-09-19')).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/user/tasks/${TASK_ID}/time-spents/2026-09-19`
    })
  })

  it('getDayOff reads the day off of a date, null on 404', async () => {
    fake.reply(200, { date: '2026-09-19' }).reply(404, {})
    expect(await kitsu.user.getDayOff('2026-09-19')).toEqual({
      date: '2026-09-19'
    })
    expect(await kitsu.user.getDayOff('2026-09-19')).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/user/day-offs/2026-09-19'
    })
  })

  it('date path functions reject anything but a day', async () => {
    await expect(kitsu.user.getTimeSpentsByDate('../context')).rejects.toThrow(
      'Wrong format'
    )
    await expect(kitsu.user.getTaskTimeSpent(TASK_ID, 'today')).rejects.toThrow(
      'Wrong format'
    )
    await expect(kitsu.user.getDayOff(undefined)).rejects.toThrow(
      'Wrong format'
    )
    expect(fake.calls).toHaveLength(0)
  })

  it('allNotifications lists the notifications of the user', async () => {
    fake.reply(200, [{ id: NOTIFICATION_ID }])
    expect(await kitsu.user.allNotifications()).toEqual([
      { id: NOTIFICATION_ID }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/user/notifications'
    })
  })

  it('getNotification returns the notification, null on 404', async () => {
    fake.reply(200, { id: NOTIFICATION_ID }).reply(404, {})
    expect(await kitsu.user.getNotification(NOTIFICATION_ID)).toEqual({
      id: NOTIFICATION_ID
    })
    expect(await kitsu.user.getNotification({ id: NOTIFICATION_ID })).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/user/notifications/${NOTIFICATION_ID}`
    })
  })

  it('updateNotification puts the whole notification', async () => {
    const notification = Object.freeze({ id: NOTIFICATION_ID, read: true })
    fake.reply(200, { id: NOTIFICATION_ID, read: true })
    expect(await kitsu.user.updateNotification(notification)).toMatchObject({
      read: true
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/user/notifications/${NOTIFICATION_ID}`,
      body: { id: NOTIFICATION_ID, read: true }
    })
  })

  it('markAllNotificationsAsRead posts an empty body', async () => {
    fake.reply(200, { success: true })
    expect(await kitsu.user.markAllNotificationsAsRead()).toEqual({
      success: true
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: '/actions/user/notifications/mark-all-as-read',
      body: {}
    })
  })

  it('checkTaskSubscription tells if the user follows the task', async () => {
    fake.reply(200, true)
    expect(await kitsu.user.checkTaskSubscription({ id: TASK_ID })).toBe(true)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/user/tasks/${TASK_ID}/subscribed`
    })
  })

  it('subscribeToTask posts an empty body', async () => {
    fake.reply(201, { task_id: TASK_ID })
    expect(await kitsu.user.subscribeToTask(TASK_ID)).toEqual({
      task_id: TASK_ID
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/actions/user/tasks/${TASK_ID}/subscribe`,
      body: {}
    })
  })

  it('unsubscribeFromTask deletes the subscription', async () => {
    fake.reply(204)
    expect(await kitsu.user.unsubscribeFromTask({ id: TASK_ID })).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/actions/user/tasks/${TASK_ID}/unsubscribe`
    })
  })

  it('allChats lists the chats the user takes part in', async () => {
    fake.reply(200, [{ object_id: ENTITY_ID }])
    expect(await kitsu.user.allChats()).toEqual([{ object_id: ENTITY_ID }])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/user/chats'
    })
  })

  it('joinChat posts on the join route of the entity', async () => {
    fake.reply(200, { object_id: ENTITY_ID })
    expect(await kitsu.user.joinChat({ id: ENTITY_ID })).toEqual({
      object_id: ENTITY_ID
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/actions/user/chats/${ENTITY_ID}/join`,
      body: {}
    })
  })

  it('leaveChat deletes on the join route of the entity', async () => {
    fake.reply(204)
    expect(await kitsu.user.leaveChat(ENTITY_ID)).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/actions/user/chats/${ENTITY_ID}/join`
    })
  })

  it('clearAvatar deletes the avatar of the user', async () => {
    fake.reply(204)
    expect(await kitsu.user.clearAvatar()).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: '/actions/user/clear-avatar'
    })
  })
})
