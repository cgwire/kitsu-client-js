import { beforeEach, describe, expect, it } from 'vitest'

import { makeClient } from '../helpers/client.js'
import { DEPARTMENT_ID, PERSON_ID, PROJECT_ID } from '../helpers/ids.js'

const BUDGET_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const ENTRY_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

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

  it('createBudget sends every option, dates as YYYY-MM-DD', async () => {
    fake.reply(201, { id: BUDGET_ID })
    await kitsu.project.createBudget({ id: PROJECT_ID }, 'Season 1', {
      description: 'First season',
      currency: 'EUR',
      startDate: new Date(2026, 0, 5, 10),
      endDate: '2026-12-18',
      amount: 0
    })
    expect(fake.calls[0].body).toEqual({
      name: 'Season 1',
      description: 'First season',
      currency: 'EUR',
      start_date: '2026-01-05',
      end_date: '2026-12-18',
      amount: 0
    })
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

  it('createBudgetEntry sends the department alone by default', async () => {
    fake.reply(201, { id: ENTRY_ID })
    expect(
      await kitsu.project.createBudgetEntry(
        PROJECT_ID,
        BUDGET_ID,
        DEPARTMENT_ID
      )
    ).toEqual({ id: ENTRY_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/data/projects/${PROJECT_ID}/budgets/${BUDGET_ID}/entries`
    })
    expect(fake.calls[0].body).toEqual({ department_id: DEPARTMENT_ID })
  })

  it('createBudgetEntry sends every option on the wire', async () => {
    fake.reply(201, { id: ENTRY_ID })
    await kitsu.project.createBudgetEntry(
      { id: PROJECT_ID },
      { id: BUDGET_ID },
      { id: DEPARTMENT_ID },
      {
        person: { id: PERSON_ID },
        position: 'artist',
        seniority: 'senior',
        startDate: new Date(2026, 2, 1),
        monthsDuration: 3,
        dailySalary: 400
      }
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
