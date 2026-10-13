import { beforeEach, describe, expect, it } from 'vitest'

import { ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import { DEPARTMENT_ID, PERSON_ID, PROJECT_ID } from '../helpers/ids.js'

const BUDGET_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const ENTRY_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

// A budget entry as Zou serializes it.
const ENTRY = {
  id: ENTRY_ID,
  budget_id: BUDGET_ID,
  department_id: DEPARTMENT_ID,
  person_id: null,
  start_date: '2026-03-01',
  months_duration: 3,
  daily_salary: 400,
  position: 'artist',
  seniority: 'mid',
  exceptions: {},
  created_at: '2026-02-20T10:00:00',
  updated_at: '2026-02-20T10:00:00',
  type: 'BudgetEntry'
}

describe('project namespace: budgets', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('getBudgets lists the budgets of the project', async () => {
    fake.reply(200, [{ id: BUDGET_ID }])
    expect(await kitsu.project.getBudgets({ id: PROJECT_ID })).toEqual([
      { id: BUDGET_ID }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/budgets`
    })
  })

  it('createBudget sends the name alone by default', async () => {
    fake.reply(201, { id: BUDGET_ID, name: 'Season 1' })
    expect(await kitsu.project.createBudget(PROJECT_ID, 'Season 1')).toEqual({
      id: BUDGET_ID,
      name: 'Season 1'
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/data/projects/${PROJECT_ID}/budgets`
    })
    expect(fake.calls[0].body).toEqual({ name: 'Season 1' })
  })

  it('createBudget sends the currency', async () => {
    fake.reply(201, { id: BUDGET_ID })
    await kitsu.project.createBudget({ id: PROJECT_ID }, 'Season 1', {
      currency: 'EUR'
    })
    expect(fake.calls[0].body).toEqual({ name: 'Season 1', currency: 'EUR' })
  })

  it('getBudget returns the budget, null on 404', async () => {
    fake.reply(200, { id: BUDGET_ID }).reply(404, {})
    expect(
      await kitsu.project.getBudget(PROJECT_ID, { id: BUDGET_ID })
    ).toEqual({ id: BUDGET_ID })
    expect(
      await kitsu.project.getBudget({ id: PROJECT_ID }, BUDGET_ID)
    ).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/budgets/${BUDGET_ID}`
    })
  })

  it('updateBudget saves the given payload', async () => {
    fake.reply(200, { id: BUDGET_ID, name: 'Season 2' })
    const budget = { id: BUDGET_ID }
    expect(
      await kitsu.project.updateBudget(PROJECT_ID, budget, { name: 'Season 2' })
    ).toEqual({ id: BUDGET_ID, name: 'Season 2' })
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/projects/${PROJECT_ID}/budgets/${BUDGET_ID}`
    })
    expect(fake.calls[0].body).toEqual({ name: 'Season 2' })
  })

  it('removeBudget deletes the budget', async () => {
    fake.reply(204)
    expect(
      await kitsu.project.removeBudget({ id: PROJECT_ID }, BUDGET_ID)
    ).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/projects/${PROJECT_ID}/budgets/${BUDGET_ID}`
    })
  })

  it('getBudgetEntries lists the entries of the budget', async () => {
    fake.reply(200, [{ id: ENTRY_ID }])
    expect(
      await kitsu.project.getBudgetEntries(PROJECT_ID, { id: BUDGET_ID })
    ).toEqual([{ id: ENTRY_ID }])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/budgets/${BUDGET_ID}/entries`
    })
  })

  it('createBudgetEntry sends the values Zou requires', async () => {
    fake.reply(201, ENTRY)
    expect(
      await kitsu.project.createBudgetEntry(
        PROJECT_ID,
        BUDGET_ID,
        DEPARTMENT_ID,
        '2026-03-01',
        3,
        400
      )
    ).toEqual(ENTRY)
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/data/projects/${PROJECT_ID}/budgets/${BUDGET_ID}/entries`
    })
    expect(fake.calls[0].body).toEqual({
      department_id: DEPARTMENT_ID,
      start_date: '2026-03-01',
      months_duration: 3,
      daily_salary: 400
    })
  })

  it('createBudgetEntry sends every option on the wire', async () => {
    fake.reply(201, ENTRY)
    await kitsu.project.createBudgetEntry(
      { id: PROJECT_ID },
      { id: BUDGET_ID },
      { id: DEPARTMENT_ID },
      new Date(2026, 2, 1),
      3,
      400,
      { person: { id: PERSON_ID }, position: 'artist', seniority: 'senior' }
    )
    expect(fake.calls[0].body).toEqual({
      department_id: DEPARTMENT_ID,
      person_id: PERSON_ID,
      position: 'artist',
      seniority: 'senior',
      start_date: '2026-03-01',
      months_duration: 3,
      daily_salary: 400
    })
  })

  it('createBudgetEntry rejects a missing department', async () => {
    await expect(
      kitsu.project.createBudgetEntry(PROJECT_ID, BUDGET_ID)
    ).rejects.toThrow('Wrong format')
    expect(fake.calls).toHaveLength(0)
  })

  // Zou cannot store an entry without them, and answers 500.
  it('createBudgetEntry rejects a missing start date, duration or salary', async () => {
    const calls = [
      [undefined, 3, 400],
      ['2026-03-01', undefined, 400],
      ['2026-03-01', 3, null]
    ]
    const errors = await Promise.all(
      calls.map(values =>
        kitsu.project
          .createBudgetEntry(PROJECT_ID, BUDGET_ID, DEPARTMENT_ID, ...values)
          .catch(err => err)
      )
    )
    errors.forEach(err => expect(err).toBeInstanceOf(ParameterError))
    expect(fake.calls).toHaveLength(0)
  })

  it('createBudgetEntry rejects the options object of 0.2.0', async () => {
    await expect(
      kitsu.project.createBudgetEntry(PROJECT_ID, BUDGET_ID, DEPARTMENT_ID, {
        startDate: '2026-03-01',
        monthsDuration: 3,
        dailySalary: 400
      })
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('getBudgetEntry returns the entry, null on 404', async () => {
    fake.reply(200, { id: ENTRY_ID }).reply(404, {})
    expect(
      await kitsu.project.getBudgetEntry(PROJECT_ID, BUDGET_ID, {
        id: ENTRY_ID
      })
    ).toEqual({ id: ENTRY_ID })
    expect(
      await kitsu.project.getBudgetEntry(
        { id: PROJECT_ID },
        { id: BUDGET_ID },
        ENTRY_ID
      )
    ).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/budgets/${BUDGET_ID}/entries/${ENTRY_ID}`
    })
  })

  it('updateBudgetEntry saves the given payload', async () => {
    fake.reply(200, { id: ENTRY_ID, amount: 500 })
    expect(
      await kitsu.project.updateBudgetEntry(PROJECT_ID, BUDGET_ID, ENTRY_ID, {
        amount: 500
      })
    ).toEqual({ id: ENTRY_ID, amount: 500 })
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/projects/${PROJECT_ID}/budgets/${BUDGET_ID}/entries/${ENTRY_ID}`
    })
    expect(fake.calls[0].body).toEqual({ amount: 500 })
  })

  it('removeBudgetEntry deletes the entry', async () => {
    fake.reply(204)
    await kitsu.project.removeBudgetEntry(
      { id: PROJECT_ID },
      { id: BUDGET_ID },
      { id: ENTRY_ID }
    )
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/projects/${PROJECT_ID}/budgets/${BUDGET_ID}/entries/${ENTRY_ID}`
    })
  })
})
