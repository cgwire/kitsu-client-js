import { beforeEach, describe, expect, it } from 'vitest'

import { ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import { EDIT_ID, EPISODE_ID, PROJECT_ID } from '../helpers/ids.js'

const CSV = 'Episode;Name\nE01;Trailer\n'

describe('edit namespace: Kitsu store API', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('allEditsWithTasks filters by project only by default', async () => {
    fake.reply(200, [{ id: EDIT_ID, tasks: [] }])
    expect(await kitsu.edit.allEditsWithTasks({ id: PROJECT_ID })).toEqual([
      { id: EDIT_ID, tasks: [] }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/edits/with-tasks'
    })
    expect([...fake.calls[0].query.keys()]).toEqual(['project_id'])
    expect(fake.calls[0].query.get('project_id')).toBe(PROJECT_ID)
  })

  it('allEditsWithTasks filters by episode and forwards the signal', async () => {
    fake.reply(200, [])
    const controller = new AbortController()
    controller.abort()
    await kitsu.edit.allEditsWithTasks(PROJECT_ID, {
      episode: { id: EPISODE_ID },
      signal: controller.signal
    })
    expect(fake.calls[0].query.get('project_id')).toBe(PROJECT_ID)
    expect(fake.calls[0].query.get('episode_id')).toBe(EPISODE_ID)
    expect(fake.calls[0].signal.aborted).toBe(true)
  })

  it('allEditsWithTasks sends the main pack pseudo-episode', async () => {
    fake.reply(200, []).reply(200, [])
    await kitsu.edit.allEditsWithTasks(PROJECT_ID, { episode: 'main' })
    await kitsu.edit.allEditsWithTasks(PROJECT_ID, { episode: { id: 'main' } })
    expect(fake.calls[0].query.get('episode_id')).toBe('main')
    expect(fake.calls[1].query.get('episode_id')).toBe('main')
  })

  it('allEditsWithTasks does not filter on the all pseudo-episode', async () => {
    fake.reply(200, []).reply(200, [])
    await kitsu.edit.allEditsWithTasks(PROJECT_ID, { episode: 'all' })
    await kitsu.edit.allEditsWithTasks(PROJECT_ID, { episode: { id: 'all' } })
    expect([...fake.calls[0].query.keys()]).toEqual(['project_id'])
    expect([...fake.calls[1].query.keys()]).toEqual(['project_id'])
  })

  it('allEditsWithTasks rejects an episode that is not an id', async () => {
    await expect(
      kitsu.edit.allEditsWithTasks(PROJECT_ID, { episode: 'first' })
    ).rejects.toThrow(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('allEditsWithTasks rejects a missing project without any request', async () => {
    await expect(kitsu.edit.allEditsWithTasks()).rejects.toThrow(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('allVersionsForEdit reads the data history of the edit', async () => {
    fake.reply(200, [{ id: 'version-1' }]).reply(200, [])
    expect(await kitsu.edit.allVersionsForEdit({ id: EDIT_ID })).toEqual([
      { id: 'version-1' }
    ])
    await kitsu.edit.allVersionsForEdit(EDIT_ID)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/edits/${EDIT_ID}/versions`
    })
    expect(fake.calls[1].path).toBe(`/data/edits/${EDIT_ID}/versions`)
  })

  it('importEditsWithCsv uploads the CSV in the file field', async () => {
    fake.reply(201, [{ id: EDIT_ID }])
    const csv = new Blob([CSV], { type: 'text/csv' })
    expect(
      await kitsu.edit.importEditsWithCsv({ id: PROJECT_ID }, csv)
    ).toEqual([{ id: EDIT_ID }])
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/import/csv/projects/${PROJECT_ID}/edits`
    })
    expect(fake.calls[0].query.has('update')).toBe(false)
    const form = fake.calls[0].body
    expect(form).toBeInstanceOf(FormData)
    expect([...form.keys()]).toEqual(['file'])
    expect(await form.get('file').text()).toBe(CSV)
  })

  it('importEditsWithCsv asks for an update and names the file', async () => {
    fake.reply(201, [])
    const controller = new AbortController()
    controller.abort()
    await kitsu.edit.importEditsWithCsv(PROJECT_ID, new Blob([CSV]), {
      update: true,
      fileName: 'edits.csv',
      signal: controller.signal
    })
    expect(fake.calls[0].path).toBe(`/import/csv/projects/${PROJECT_ID}/edits`)
    expect(fake.calls[0].query.get('update')).toBe('true')
    expect(fake.calls[0].body.get('file').name).toBe('edits.csv')
    expect(fake.calls[0].signal.aborted).toBe(true)
  })

  it('importEditsWithCsv rejects a missing file without any request', async () => {
    await expect(kitsu.edit.importEditsWithCsv(PROJECT_ID)).rejects.toThrow(
      ParameterError
    )
    expect(fake.calls).toHaveLength(0)
  })
})
