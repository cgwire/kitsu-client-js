import { beforeEach, describe, expect, it } from 'vitest'

import { ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import { CONCEPT_ID, PROJECT_ID, TASK_ID } from '../helpers/ids.js'

describe('concept namespace, Kitsu store API', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('allConceptsWithTasks lists the concepts of a project with their tasks', async () => {
    const concepts = [{ id: CONCEPT_ID, tasks: [{ id: TASK_ID }] }]
    fake.reply(200, concepts)
    expect(
      await kitsu.concept.allConceptsWithTasks({ id: PROJECT_ID })
    ).toEqual(concepts)
    expect(fake.calls).toHaveLength(1)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/concepts/with-tasks'
    })
    expect([...fake.calls[0].query.entries()]).toEqual([
      ['project_id', PROJECT_ID]
    ])
  })

  it('allConceptsWithTasks accepts a project id', async () => {
    fake.reply(200, [])
    await kitsu.concept.allConceptsWithTasks(PROJECT_ID)
    expect(fake.calls[0].query.get('project_id')).toBe(PROJECT_ID)
  })

  it('allConceptsWithTasks rejects without a project', async () => {
    await expect(kitsu.concept.allConceptsWithTasks()).rejects.toThrow(
      ParameterError
    )
    expect(fake.calls).toHaveLength(0)
  })
})
