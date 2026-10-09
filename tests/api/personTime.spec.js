import { beforeEach, describe, expect, it } from 'vitest'

import { NotAllowedError, ParameterError } from '../../src/core/errors.js'
import { makeClient } from '../helpers/client.js'
import { OTHER_ID, PERSON_ID } from '../helpers/ids.js'

const DAY_OFF_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

describe('person namespace: time spents', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('getTimeSpentsRange filters the time spents by date range', async () => {
    fake.reply(200, [{ duration: 60 }]).reply(200, [])
    expect(
      await kitsu.person.getTimeSpentsRange(
        { id: PERSON_ID },
        '2026-09-01',
        '2026-09-30'
      )
    ).toEqual([{ duration: 60 }])
    await kitsu.person.getTimeSpentsRange(
      PERSON_ID,
      new Date(2026, 8, 1),
      new Date(2026, 8, 30)
    )
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/persons/${PERSON_ID}/time-spents`
    })
    expect(Object.fromEntries(fake.calls[0].query)).toEqual({
      start_date: '2026-09-01',
      end_date: '2026-09-30'
    })
    expect(Object.fromEntries(fake.calls[1].query)).toEqual({
      start_date: '2026-09-01',
      end_date: '2026-09-30'
    })
  })

  it('getAllMonthTimeSpents reads the month of the given date', async () => {
    fake.reply(200, [{ duration: 60 }]).reply(200, [])
    expect(
      await kitsu.person.getAllMonthTimeSpents({ id: PERSON_ID }, '2026-03-15')
    ).toEqual([{ duration: 60 }])
    await kitsu.person.getAllMonthTimeSpents(
      PERSON_ID,
      new Date(2026, 10, 2, 12)
    )
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/persons/${PERSON_ID}/time-spents/month/all/2026/03`
    })
    expect(fake.calls[1].path).toBe(
      `/data/persons/${PERSON_ID}/time-spents/month/all/2026/11`
    )
  })

  it('getPresenceLog returns the CSV table of a month', async () => {
    fake.on(
      'GET',
      '/data/persons/presence-logs/2026-03',
      () =>
        new Response('2026;3;1\nJohn Doe;X', {
          status: 200,
          headers: { 'Content-Type': 'text/csv' }
        })
    )
    expect(await kitsu.person.getPresenceLog(2026, 3)).toBe(
      '2026;3;1\nJohn Doe;X'
    )
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/persons/presence-logs/2026-03'
    })
  })

  it('getTimeSpentsByDate reads the time spents of a day', async () => {
    fake.reply(200, [{ duration: 60 }]).reply(200, [])
    expect(
      await kitsu.person.getTimeSpentsByDate({ id: PERSON_ID }, '2026-09-19')
    ).toEqual([{ duration: 60 }])
    await kitsu.person.getTimeSpentsByDate(PERSON_ID, new Date(2026, 8, 20, 12))
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/persons/${PERSON_ID}/time-spents/2026-09-19`
    })
    expect(fake.calls[1].path).toBe(
      `/data/persons/${PERSON_ID}/time-spents/2026-09-20`
    )
  })

  it('getWeekTimeSpents reads the time spents of a week', async () => {
    fake.reply(200, [{ duration: 60 }])
    expect(
      await kitsu.person.getWeekTimeSpents({ id: PERSON_ID }, 2026, 38)
    ).toEqual([{ duration: 60 }])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/persons/${PERSON_ID}/time-spents/week/2026/38`
    })
  })

  it('getYearTimeSpents reads the time spents of a year', async () => {
    fake.reply(200, [{ duration: 60 }])
    expect(await kitsu.person.getYearTimeSpents(PERSON_ID, 2026)).toEqual([
      { duration: 60 }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/persons/${PERSON_ID}/time-spents/year/2026`
    })
  })

  it.each([
    ['getTimeSpentsRange', [PERSON_ID, '2026-09-01', '2026-09-30']],
    ['getAllMonthTimeSpents', [PERSON_ID, '2026-09-01']],
    ['getTimeSpentsByDate', [PERSON_ID, '2026-09-19']],
    ['getWeekTimeSpents', [PERSON_ID, 2026, 38]],
    ['getYearTimeSpents', [PERSON_ID, 2026]]
  ])('%s returns null when the person does not exist', async (name, args) => {
    fake.reply(404, {})
    expect(await kitsu.person[name](...args)).toBeNull()
  })

  it('rethrows anything that is not a 404', async () => {
    fake.reply(403, {})
    await expect(
      kitsu.person.getYearTimeSpents(PERSON_ID, 2026)
    ).rejects.toBeInstanceOf(NotAllowedError)
  })

  it('keeps malformed dates and numbers out of the request paths', async () => {
    const { person } = kitsu
    await expect(
      person.getTimeSpentsByDate(PERSON_ID, '../../auth')
    ).rejects.toThrow(ParameterError)
    await expect(
      person.getAllMonthTimeSpents(PERSON_ID, '2026-09')
    ).rejects.toThrow(ParameterError)
    await expect(
      person.getWeekTimeSpents(PERSON_ID, 2026, '38/..')
    ).rejects.toThrow(ParameterError)
    await expect(person.getYearTimeSpents(PERSON_ID, 20.5)).rejects.toThrow(
      ParameterError
    )
    await expect(person.getPresenceLog(2026, '../3')).rejects.toThrow(
      ParameterError
    )
    expect(fake.calls).toHaveLength(0)
  })
})

describe('person namespace: day offs', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('getDayOffs lists the day offs of a person', async () => {
    fake.reply(200, [{ id: DAY_OFF_ID }])
    expect(await kitsu.person.getDayOffs({ id: PERSON_ID })).toEqual([
      { id: DAY_OFF_ID }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/persons/${PERSON_ID}/day-offs`
    })
  })

  it('getWeekDayOffs lists the day offs of a week', async () => {
    fake.reply(200, [{ id: DAY_OFF_ID }])
    expect(await kitsu.person.getWeekDayOffs(PERSON_ID, 2026, 38)).toEqual([
      { id: DAY_OFF_ID }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/persons/${PERSON_ID}/day-offs/week/2026/38`
    })
  })

  it('getMonthDayOffs lists the day offs of a month, on two digits', async () => {
    fake.reply(200, [{ id: DAY_OFF_ID }]).reply(200, [])
    expect(
      await kitsu.person.getMonthDayOffs({ id: PERSON_ID }, 2026, 3)
    ).toEqual([{ id: DAY_OFF_ID }])
    await kitsu.person.getMonthDayOffs(PERSON_ID, 2026, 11)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/persons/${PERSON_ID}/day-offs/month/2026/03`
    })
    expect(fake.calls[1].path).toBe(
      `/data/persons/${PERSON_ID}/day-offs/month/2026/11`
    )
  })

  it('getYearDayOffs lists the day offs of a year', async () => {
    fake.reply(200, [{ id: DAY_OFF_ID }])
    expect(await kitsu.person.getYearDayOffs(PERSON_ID, 2026)).toEqual([
      { id: DAY_OFF_ID }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/persons/${PERSON_ID}/day-offs/year/2026`
    })
  })

  it('getDayOff returns the day off, null on 404', async () => {
    fake.reply(200, { id: DAY_OFF_ID }).reply(404, {})
    expect(await kitsu.person.getDayOff({ id: DAY_OFF_ID })).toEqual({
      id: DAY_OFF_ID
    })
    expect(await kitsu.person.getDayOff(DAY_OFF_ID)).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/day-offs/${DAY_OFF_ID}`
    })
  })

  it.each([
    ['getDayOffs', [PERSON_ID]],
    ['getWeekDayOffs', [PERSON_ID, 2026, 38]],
    ['getMonthDayOffs', [PERSON_ID, 2026, 9]],
    ['getYearDayOffs', [PERSON_ID, 2026]]
  ])('%s returns null when the person does not exist', async (name, args) => {
    fake.reply(404, {})
    expect(await kitsu.person[name](...args)).toBeNull()
  })

  it('keeps malformed numbers out of the day off paths', async () => {
    const { person } = kitsu
    await expect(
      person.getWeekDayOffs(PERSON_ID, '2026/..', 38)
    ).rejects.toThrow(ParameterError)
    await expect(person.getMonthDayOffs(PERSON_ID, 2026, '9')).rejects.toThrow(
      ParameterError
    )
    await expect(person.getYearDayOffs(PERSON_ID, null)).rejects.toThrow(
      ParameterError
    )
    expect(fake.calls).toHaveLength(0)
  })

  it('newDayOff creates a day off, the description only when given', async () => {
    fake.reply(201, { id: DAY_OFF_ID }).reply(201, { id: DAY_OFF_ID })
    expect(
      await kitsu.person.newDayOff(
        { id: PERSON_ID },
        '2026-04-10',
        '2026-04-12'
      )
    ).toEqual({ id: DAY_OFF_ID })
    await kitsu.person.newDayOff(
      PERSON_ID,
      new Date(2026, 3, 10),
      new Date(2026, 3, 12),
      { description: 'Holidays' }
    )
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: '/data/day-offs'
    })
    expect(fake.calls[0].body).toEqual({
      person_id: PERSON_ID,
      date: '2026-04-10',
      end_date: '2026-04-12'
    })
    expect(fake.calls[1].body).toEqual({
      person_id: PERSON_ID,
      date: '2026-04-10',
      end_date: '2026-04-12',
      description: 'Holidays'
    })
  })

  it('updateDayOff puts the day off', async () => {
    fake.reply(200, { id: DAY_OFF_ID })
    const dayOff = {
      id: DAY_OFF_ID,
      end_date: '2026-04-15',
      person_id: OTHER_ID
    }
    await kitsu.person.updateDayOff(dayOff)
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/day-offs/${DAY_OFF_ID}`
    })
    expect(fake.calls[0].body).toEqual({
      end_date: '2026-04-15',
      person_id: OTHER_ID
    })
  })

  it('removeDayOff deletes the day off', async () => {
    fake.reply(204).reply(204)
    await kitsu.person.removeDayOff({ id: DAY_OFF_ID })
    await kitsu.person.removeDayOff(DAY_OFF_ID)
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/day-offs/${DAY_OFF_ID}`
    })
    expect(fake.calls[1].path).toBe(`/data/day-offs/${DAY_OFF_ID}`)
  })
})
