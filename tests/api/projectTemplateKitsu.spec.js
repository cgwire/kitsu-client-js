import { beforeEach, describe, expect, it } from 'vitest'

import { ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import {
  OTHER_ID,
  PROJECT_TEMPLATE_ID,
  TASK_STATUS_ID,
  TASK_TYPE_ID
} from '../helpers/ids.js'

const REORDERS = [
  {
    name: 'reorderTaskTypesForProjectTemplate',
    segment: 'task-types',
    key: 'task_type_ids',
    id: TASK_TYPE_ID
  },
  {
    name: 'reorderTaskStatusesForProjectTemplate',
    segment: 'task-statuses',
    key: 'task_status_ids',
    id: TASK_STATUS_ID
  }
]

describe('projectTemplate namespace: Kitsu functions', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  REORDERS.forEach(({ name, segment, key, id }) => {
    it(`${name} posts the ids in their new order`, async () => {
      const links = [
        { id: OTHER_ID, priority: 1 },
        { id, priority: 2 }
      ]
      fake.reply(200, links)
      expect(
        await kitsu.projectTemplate[name]({ id: PROJECT_TEMPLATE_ID }, [
          { id: OTHER_ID },
          id
        ])
      ).toEqual(links)
      expect(fake.calls[0]).toMatchObject({
        method: 'POST',
        path: `/actions/project-templates/${PROJECT_TEMPLATE_ID}/${segment}/reorder`
      })
      expect(fake.calls[0].body).toEqual({ [key]: [OTHER_ID, id] })
    })

    it(`${name} rejects a missing template`, async () => {
      await expect(kitsu.projectTemplate[name](null, [id])).rejects.toThrow(
        ParameterError
      )
      expect(fake.calls).toHaveLength(0)
    })

    it(`${name} rejects a missing id list`, async () => {
      await expect(
        kitsu.projectTemplate[name](PROJECT_TEMPLATE_ID)
      ).rejects.toThrow(ParameterError)
      expect(fake.calls).toHaveLength(0)
    })
  })
})
