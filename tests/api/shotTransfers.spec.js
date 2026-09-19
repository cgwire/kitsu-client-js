import { beforeEach, describe, expect, it } from 'vitest'

import { ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import { EPISODE_ID, PERSON_ID, PROJECT_ID, SHOT_ID } from '../helpers/ids.js'

const csvResponse = text =>
  new Response(text, { headers: { 'Content-Type': 'text/csv' } })

describe('shot namespace: transfers', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('importShotsWithCsv uploads the CSV file of the project', async () => {
    fake.reply(201, [{ id: SHOT_ID }])
    const csv = new Blob(['Sequence;Name\nSQ01;SH010'], { type: 'text/csv' })
    expect(
      await kitsu.shot.importShotsWithCsv({ id: PROJECT_ID }, csv)
    ).toEqual([{ id: SHOT_ID }])
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/import/csv/projects/${PROJECT_ID}/shots`
    })
    const { body } = fake.calls[0]
    expect(body).toBeInstanceOf(FormData)
    expect([...body.keys()]).toEqual(['file'])
    expect(await body.get('file').text()).toBe('Sequence;Name\nSQ01;SH010')
  })

  it('importShotsWithCsv names the uploaded file', async () => {
    fake.reply(201, [])
    await kitsu.shot.importShotsWithCsv(PROJECT_ID, new Blob(['a;b']), {
      fileName: 'shots.csv'
    })
    expect(fake.calls[0].body.get('file').name).toBe('shots.csv')
  })

  it('importShotsWithCsv asks for an update only on demand', async () => {
    fake.reply(201, []).reply(201, [])
    await kitsu.shot.importShotsWithCsv(PROJECT_ID, new Blob(['a;b']))
    await kitsu.shot.importShotsWithCsv(PROJECT_ID, new Blob(['a;b']), {
      update: true
    })
    expect(fake.calls[0].query.has('update')).toBe(false)
    expect(fake.calls[1].query.get('update')).toBe('true')
  })

  it('importShotsWithCsv rejects a missing file without any request', async () => {
    await expect(
      kitsu.shot.importShotsWithCsv(PROJECT_ID)
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('importOtio uploads the timeline with the project naming convention', async () => {
    fake.reply(201, { created_shots: [{ id: SHOT_ID }], updated_shots: [] })
    const otio = new Blob(['{"OTIO_SCHEMA": "Timeline.1"}'])
    expect(await kitsu.shot.importOtio({ id: PROJECT_ID }, otio)).toEqual({
      created_shots: [{ id: SHOT_ID }],
      updated_shots: []
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/import/otio/projects/${PROJECT_ID}`
    })
    const { body } = fake.calls[0]
    expect(body).toBeInstanceOf(FormData)
    expect([...body.keys()].sort()).toEqual([
      'file',
      'match_case',
      'naming_convention'
    ])
    expect(body.get('naming_convention')).toBe(
      '${project_name}_${sequence_name}-${shot_name}'
    )
    expect(body.get('match_case')).toBe('true')
    expect(await body.get('file').text()).toBe('{"OTIO_SCHEMA": "Timeline.1"}')
  })

  it('importOtio scopes the import to an episode', async () => {
    fake.reply(201, { created_shots: [], updated_shots: [] })
    await kitsu.shot.importOtio(PROJECT_ID, new Blob(['edl']), {
      episode: { id: EPISODE_ID },
      fileName: 'edit.edl'
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/import/otio/projects/${PROJECT_ID}/episodes/${EPISODE_ID}`
    })
    const { body } = fake.calls[0]
    expect(body.get('naming_convention')).toBe(
      '${project_name}_${episode_name}-${sequence_name}-${shot_name}'
    )
    expect(body.get('file').name).toBe('edit.edl')
  })

  it('importOtio sends the given naming convention and case matching', async () => {
    fake.reply(201, { created_shots: [], updated_shots: [] })
    await kitsu.shot.importOtio(PROJECT_ID, new Blob(['edl']), {
      episode: EPISODE_ID,
      namingConvention: '${sequence_name}_${shot_name}',
      matchCase: false
    })
    const { body } = fake.calls[0]
    expect(body.get('naming_convention')).toBe('${sequence_name}_${shot_name}')
    expect(body.get('match_case')).toBe('false')
  })

  it('importOtio rejects a missing file without any request', async () => {
    await expect(kitsu.shot.importOtio(PROJECT_ID)).rejects.toBeInstanceOf(
      ParameterError
    )
    expect(fake.calls).toHaveLength(0)
  })

  it('exportShotsWithCsv returns the CSV text of the project', async () => {
    fake.on('GET', `/export/csv/projects/${PROJECT_ID}/shots.csv`, () =>
      csvResponse('Sequence;Name\nSQ01;SH010')
    )
    expect(await kitsu.shot.exportShotsWithCsv({ id: PROJECT_ID })).toBe(
      'Sequence;Name\nSQ01;SH010'
    )
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/export/csv/projects/${PROJECT_ID}/shots.csv`
    })
    expect([...fake.calls[0].query.keys()]).toEqual([])
  })

  it('exportShotsWithCsv filters on the episode and the assignee', async () => {
    fake.on('GET', `/export/csv/projects/${PROJECT_ID}/shots.csv`, () =>
      csvResponse('')
    )
    expect(
      await kitsu.shot.exportShotsWithCsv(PROJECT_ID, {
        episode: { id: EPISODE_ID },
        assignedTo: PERSON_ID
      })
    ).toBe('')
    expect(fake.calls[0].query.get('episode_id')).toBe(EPISODE_ID)
    expect(fake.calls[0].query.get('assigned_to')).toBe(PERSON_ID)
  })

  // The core aborts its own request signal as soon as the caller signal is
  // aborted: an aborted request signal proves the option went through.
  it.each([
    ['importShotsWithCsv', [PROJECT_ID, new Blob(['a;b'])]],
    ['importOtio', [PROJECT_ID, new Blob(['edl'])]],
    ['exportShotsWithCsv', [PROJECT_ID]]
  ])('%s forwards the caller signal', async (name, args) => {
    const controller = new AbortController()
    controller.abort()
    fake.reply(200, [])
    await kitsu.shot[name](...args, { signal: controller.signal })
    expect(fake.calls[0].signal.aborted).toBe(true)
  })
})
