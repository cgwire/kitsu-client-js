import { beforeEach, describe, expect, it } from 'vitest'

import { ParameterError } from '../../src/core/errors.js'
import { makeClient } from '../helpers/client.js'
import {
  OTHER_ID,
  PERSON_ID,
  PROJECT_ID,
  STUDIO_ID,
  TASK_TYPE_ID
} from '../helpers/ids.js'

const CSV = 'First Name;Last Name\nAda;Lovelace\n'

const queryOf = call => Object.fromEntries(call.query)

describe('person namespace, Kitsu store coverage', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('updateOrganisation puts the organisation settings', async () => {
    fake.reply(200, { id: OTHER_ID, name: 'Studio' })
    const organisation = { id: OTHER_ID, name: 'Studio', hours_by_day: 7 }
    expect(await kitsu.person.updateOrganisation(organisation)).toEqual({
      id: OTHER_ID,
      name: 'Studio'
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/organisations/${OTHER_ID}`
    })
    expect(fake.calls[0].body).toEqual({ name: 'Studio', hours_by_day: 7 })
  })

  it('generateResetPasswordLink posts without a body', async () => {
    fake.reply(200, { reset_url: 'http://kitsu.test/reset' })
    expect(
      await kitsu.person.generateResetPasswordLink({ id: PERSON_ID })
    ).toEqual({ reset_url: 'http://kitsu.test/reset' })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/actions/persons/${PERSON_ID}/reset-password-link`
    })
    expect(fake.calls[0].body == null).toBe(true)
  })

  it('importPersonsWithCsv uploads the CSV in the file field', async () => {
    fake.reply(201, [{ id: PERSON_ID }])
    const csv = new Blob([CSV], { type: 'text/csv' })
    expect(
      await kitsu.person.importPersonsWithCsv(csv, { fileName: 'people.csv' })
    ).toEqual([{ id: PERSON_ID }])
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: '/import/csv/persons'
    })
    expect(queryOf(fake.calls[0])).toEqual({})
    const form = fake.calls[0].body
    expect(form).toBeInstanceOf(FormData)
    expect([...form.keys()]).toEqual(['file'])
    expect(form.get('file').name).toBe('people.csv')
    expect(await form.get('file').text()).toBe(CSV)
  })

  it('importPersonsWithCsv asks to update the existing persons', async () => {
    fake.reply(201, [])
    await kitsu.person.importPersonsWithCsv(new Blob([CSV]), { update: true })
    expect(queryOf(fake.calls[0])).toEqual({ update: 'true' })
  })

  it('importPersonsWithCsv rejects without a file', async () => {
    await expect(kitsu.person.importPersonsWithCsv()).rejects.toThrow(
      ParameterError
    )
    expect(fake.calls).toHaveLength(0)
  })

  it('allDayOffs reads every day off of the studio', async () => {
    fake.reply(200, [{ id: OTHER_ID }])
    expect(await kitsu.person.allDayOffs()).toEqual([{ id: OTHER_ID }])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/day-offs'
    })
  })

  it('allDayOffs narrows the day offs to a month', async () => {
    fake.reply(200, [{ id: OTHER_ID }])
    expect(await kitsu.person.allDayOffs({ year: 2026, month: 9 })).toEqual([
      { id: OTHER_ID }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/persons/day-offs/2026/9'
    })
  })

  it('allDayOffs rejects a year without a month', async () => {
    await expect(kitsu.person.allDayOffs({ year: 2026 })).rejects.toThrow(
      ParameterError
    )
    await expect(kitsu.person.allDayOffs({ month: 9 })).rejects.toThrow(
      ParameterError
    )
    expect(fake.calls).toHaveLength(0)
  })

  it('getDayOffByDate reads the day off of a person on a day', async () => {
    fake.reply(200, { id: OTHER_ID })
    expect(
      await kitsu.person.getDayOffByDate({ id: PERSON_ID }, '2026-09-19')
    ).toEqual({ id: OTHER_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/persons/${PERSON_ID}/day-offs/2026-09-19`
    })
  })

  it('getDayOffByDate returns null when the person does not exist', async () => {
    fake.reply(404, {})
    expect(
      await kitsu.person.getDayOffByDate(PERSON_ID, new Date(2026, 8, 19))
    ).toBeNull()
    expect(fake.calls[0].path).toBe(
      `/data/persons/${PERSON_ID}/day-offs/2026-09-19`
    )
  })

  it.each([
    ['getTimeSpentsDayTable', [2026, 9], 'day-table/2026/9'],
    ['getTimeSpentsWeekTable', [2026], 'week-table/2026'],
    ['getTimeSpentsMonthTable', [2026], 'month-table/2026'],
    ['getTimeSpentsYearTable', [], 'year-table']
  ])('%s reads the table, narrowed or not', async (name, args, suffix) => {
    fake.reply(200, { 9: {} }).reply(200, { 9: {} })
    expect(await kitsu.person[name](...args)).toEqual({ 9: {} })
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/persons/time-spents/${suffix}`
    })
    expect(queryOf(fake.calls[0])).toEqual({})
    await kitsu.person[name](...args, {
      project: { id: PROJECT_ID },
      studio: STUDIO_ID
    })
    expect(fake.calls[1].path).toBe(`/data/persons/time-spents/${suffix}`)
    expect(queryOf(fake.calls[1])).toEqual({
      project_id: PROJECT_ID,
      studio_id: STUDIO_ID
    })
  })

  it.each([
    ['getYearTimeSpents', [2026], 'year/2026'],
    ['getMonthTimeSpents', [2026, 9], 'month/2026/9'],
    ['getWeekTimeSpents', [2026, 38], 'week/2026/38'],
    ['getDayTimeSpents', [2026, 9, 19], 'day/2026/9/19']
  ])('%s reads the aggregate, narrowed or not', async (name, args, suffix) => {
    fake.reply(200, [{ duration: 60 }]).reply(200, [])
    expect(await kitsu.person[name]({ id: PERSON_ID }, ...args)).toEqual([
      { duration: 60 }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/persons/${PERSON_ID}/time-spents/${suffix}`
    })
    expect(queryOf(fake.calls[0])).toEqual({})
    await kitsu.person[name](PERSON_ID, ...args, { project: PROJECT_ID })
    expect(queryOf(fake.calls[1])).toEqual({ project_id: PROJECT_ID })
  })

  it.each([
    ['getMonthQuotaShots', [2026, 9], 'month/2026/9'],
    ['getWeekQuotaShots', [2026, 38], 'week/2026/38'],
    ['getDayQuotaShots', [2026, 9, 19], 'day/2026/9/19']
  ])('%s reads the quotas, narrowed or not', async (name, args, suffix) => {
    fake.reply(200, [{ id: OTHER_ID }]).reply(200, [])
    expect(await kitsu.person[name]({ id: PERSON_ID }, ...args)).toEqual([
      { id: OTHER_ID }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/persons/${PERSON_ID}/quota-shots/${suffix}`
    })
    expect(queryOf(fake.calls[0])).toEqual({})
    await kitsu.person[name](PERSON_ID, ...args, {
      project: { id: PROJECT_ID },
      taskType: TASK_TYPE_ID,
      countMode: 'weighteddone'
    })
    expect(queryOf(fake.calls[1])).toEqual({
      project_id: PROJECT_ID,
      task_type_id: TASK_TYPE_ID,
      count_mode: 'weighteddone'
    })
  })

  it.each([
    ['getMonthTimeSpents', [PERSON_ID, 2026, 9]],
    ['getDayTimeSpents', [PERSON_ID, 2026, 9, 19]],
    ['getMonthQuotaShots', [PERSON_ID, 2026, 9]],
    ['getWeekQuotaShots', [PERSON_ID, 2026, 38]],
    ['getDayQuotaShots', [PERSON_ID, 2026, 9, 19]]
  ])('%s returns null when the person does not exist', async (name, args) => {
    fake.reply(404, {})
    expect(await kitsu.person[name](...args)).toBeNull()
  })

  it('keeps malformed numbers out of the request paths', async () => {
    const { person } = kitsu
    await expect(person.getTimeSpentsDayTable(2026, '9/..')).rejects.toThrow(
      ParameterError
    )
    await expect(person.getTimeSpentsWeekTable('../auth')).rejects.toThrow(
      ParameterError
    )
    await expect(person.getTimeSpentsMonthTable()).rejects.toThrow(
      ParameterError
    )
    await expect(
      person.getDayTimeSpents(PERSON_ID, 2026, 9, '19/..')
    ).rejects.toThrow(ParameterError)
    await expect(
      person.getMonthQuotaShots(PERSON_ID, 2026, '9?x=1')
    ).rejects.toThrow(ParameterError)
    await expect(
      person.allDayOffs({ year: 2026, month: '../9' })
    ).rejects.toThrow(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('allSalaryScales reads the salary scales', async () => {
    fake.reply(200, [{ id: OTHER_ID, salary: 3000 }])
    expect(await kitsu.person.allSalaryScales()).toEqual([
      { id: OTHER_ID, salary: 3000 }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/salary-scales'
    })
  })

  it('updateSalaryScale puts the salary only', async () => {
    fake.reply(200, { id: OTHER_ID, salary: 3200 })
    expect(
      await kitsu.person.updateSalaryScale({
        id: OTHER_ID,
        salary: 3200,
        position: 'artist'
      })
    ).toEqual({ id: OTHER_ID, salary: 3200 })
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/salary-scales/${OTHER_ID}`,
      body: { salary: 3200 }
    })
  })
})
