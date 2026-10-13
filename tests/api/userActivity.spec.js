import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ParameterError } from '../../src/core/errors.js'
import { makeClient } from '../helpers/client.js'
import {
  ENTITY_ID,
  NOTIFICATION_ID,
  OTHER_ID,
  PERSON_ID,
  TASK_ID
} from '../helpers/ids.js'

const LOG_ID = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd'
const DAY_OFF_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const TIME_SPENT_ID = 'e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1'

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

  // Without them, Zou answers an empty list, which reads as no time logged.
  it('getTimespentsRange requires both days before any request', async () => {
    const { user } = kitsu
    await expect(user.getTimespentsRange()).rejects.toThrow(ParameterError)
    await expect(user.getTimespentsRange('', '2026-09-30')).rejects.toThrow(
      ParameterError
    )
    await expect(
      user.getTimespentsRange('2026-09-01', undefined)
    ).rejects.toThrow(ParameterError)
    await expect(
      user.getTimespentsRange('2026-09-01', '30/09/2026')
    ).rejects.toThrow(ParameterError)
    expect(fake.calls).toHaveLength(0)
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

  // The route of a single task answers a 500 when nothing is logged: the
  // time spent is read from the time spents of the day.
  it('getTaskTimeSpent reads the time spent on a task, null when none', async () => {
    const timeSpent = {
      id: TIME_SPENT_ID,
      task_id: TASK_ID,
      person_id: PERSON_ID,
      date: '2026-09-19',
      duration: 120
    }
    const otherTask = { ...timeSpent, id: OTHER_ID, task_id: OTHER_ID }
    fake
      .reply(200, [otherTask, timeSpent])
      .reply(200, [{ ...otherTask, date: '2026-09-20' }])
    expect(
      await kitsu.user.getTaskTimeSpent({ id: TASK_ID }, '2026-09-19')
    ).toEqual(timeSpent)
    expect(
      await kitsu.user.getTaskTimeSpent(TASK_ID, new Date(2026, 8, 20))
    ).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/user/time-spents/2026-09-19'
    })
    expect(fake.calls[1].path).toBe('/data/user/time-spents/2026-09-20')
  })

  // Zou answers an empty object, never a 404, when no day off covers the day.
  it('getDayOff reads the day off of a date, null when there is none', async () => {
    const dayOff = {
      id: DAY_OFF_ID,
      date: '2026-09-18',
      end_date: '2026-09-21',
      person_id: PERSON_ID
    }
    fake.reply(200, dayOff).reply(200, {})
    expect(await kitsu.user.getDayOff('2026-09-19')).toEqual(dayOff)
    expect(await kitsu.user.getDayOff(new Date(2026, 8, 22))).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/user/day-offs/2026-09-19'
    })
    expect(fake.calls[1].path).toBe('/data/user/day-offs/2026-09-22')
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

  it('allNotifications sends the filters as Zou reads them', async () => {
    fake.reply(200, [])
    await kitsu.user.allNotifications({
      filters: {
        before: '2026-10-15T10:00:00',
        task_type_id: TASK_ID,
        type: 'mention',
        read: false,
        watching: true
      }
    })
    const { query } = fake.calls[0]
    expect(query.get('before')).toBe('2026-10-15T10:00:00')
    expect(query.get('task_type_id')).toBe(TASK_ID)
    expect(query.get('type')).toBe('mention')
    expect(query.get('read')).toBe('false')
    expect(query.get('watching')).toBe('true')
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
      path: `/data/user/notifications/${NOTIFICATION_ID}`
    })
    expect(fake.calls[0].body).toEqual({ read: true })
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
