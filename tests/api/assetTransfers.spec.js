import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { makeClient } from '../helpers/client.js'
import { ASSET_ID, EPISODE_ID, PERSON_ID, PROJECT_ID } from '../helpers/ids.js'

const CSV = 'Type;Name\nProps;Lamp\n'

const csvResponse = () =>
  new Response(CSV, { headers: { 'Content-Type': 'text/csv' } })

describe('asset namespace: CSV transfers', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('importAssetsWithCsv uploads the CSV in the file field', async () => {
    fake.reply(201, [{ id: ASSET_ID }])
    const csv = new Blob([CSV], { type: 'text/csv' })
    expect(
      await kitsu.asset.importAssetsWithCsv({ id: PROJECT_ID }, csv)
    ).toEqual([{ id: ASSET_ID }])
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/import/csv/projects/${PROJECT_ID}/assets`
    })
    const form = fake.calls[0].body
    expect(form).toBeInstanceOf(FormData)
    expect([...form.keys()]).toEqual(['file'])
    expect(await form.get('file').text()).toBe(CSV)
  })

  it('importAssetsWithCsv accepts a project id and a file name', async () => {
    fake.reply(201, [])
    await kitsu.asset.importAssetsWithCsv(PROJECT_ID, new Blob([CSV]), {
      fileName: 'assets.csv'
    })
    expect(fake.calls[0].path).toBe(`/import/csv/projects/${PROJECT_ID}/assets`)
    expect(fake.calls[0].body.get('file').name).toBe('assets.csv')
  })

  it('importAssetsWithCsv asks for an update only on demand', async () => {
    fake.reply(201, []).reply(201, [])
    await kitsu.asset.importAssetsWithCsv(PROJECT_ID, new Blob([CSV]))
    await kitsu.asset.importAssetsWithCsv(PROJECT_ID, new Blob([CSV]), {
      update: true
    })
    expect(fake.calls[0].query.has('update')).toBe(false)
    expect(fake.calls[1].query.get('update')).toBe('true')
  })

  // The core aborts its own request signal as soon as the caller signal is
  // aborted: an aborted request signal proves the option went through.
  it('importAssetsWithCsv forwards the signal', async () => {
    fake.reply(201, [])
    const controller = new AbortController()
    controller.abort()
    await kitsu.asset.importAssetsWithCsv(PROJECT_ID, new Blob([CSV]), {
      signal: controller.signal
    })
    expect(fake.calls[0].signal.aborted).toBe(true)
  })

  it('importAssetsWithCsv reports the progress through XMLHttpRequest', async () => {
    ;({ kitsu, fake } = makeClient({ globalFetch: true }))
    const sent = []
    class FakeXhr {
      constructor() {
        this.upload = {}
      }
      open(method, url) {
        sent.push({ method, url })
      }
      setRequestHeader() {}
      getResponseHeader() {
        return 'application/json'
      }
      send(form) {
        sent[0].form = form
        this.upload.onprogress({ loaded: 5, total: 10 })
        this.status = 201
        this.responseText = JSON.stringify([{ id: ASSET_ID }])
        this.onload()
      }
    }
    vi.stubGlobal('XMLHttpRequest', FakeXhr)
    const onProgress = vi.fn()
    expect(
      await kitsu.asset.importAssetsWithCsv(PROJECT_ID, new Blob([CSV]), {
        onProgress
      })
    ).toEqual([{ id: ASSET_ID }])
    expect(onProgress).toHaveBeenCalledWith({ loaded: 5, total: 10 })
    expect(sent[0].method).toBe('POST')
    expect(sent[0].url).toContain(`/import/csv/projects/${PROJECT_ID}/assets`)
    expect(sent[0].form.get('file')).toBeInstanceOf(Blob)
  })

  it('importAssetsWithCsv rejects without a project', async () => {
    await expect(
      kitsu.asset.importAssetsWithCsv(null, new Blob([CSV]))
    ).rejects.toMatchObject({ name: 'ParameterError' })
    expect(fake.calls).toHaveLength(0)
  })

  it('exportAssetsWithCsv returns the CSV text', async () => {
    fake.on('GET', `/export/csv/projects/${PROJECT_ID}/assets.csv`, csvResponse)
    expect(await kitsu.asset.exportAssetsWithCsv({ id: PROJECT_ID })).toBe(CSV)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/export/csv/projects/${PROJECT_ID}/assets.csv`
    })
    expect([...fake.calls[0].query.keys()]).toEqual([])
  })

  it('exportAssetsWithCsv filters on the episode and the assignee', async () => {
    fake.on('GET', `/export/csv/projects/${PROJECT_ID}/assets.csv`, csvResponse)
    await kitsu.asset.exportAssetsWithCsv(PROJECT_ID, {
      episode: { id: EPISODE_ID },
      assignedTo: PERSON_ID
    })
    expect(Object.fromEntries(fake.calls[0].query)).toEqual({
      episode_id: EPISODE_ID,
      assigned_to: PERSON_ID
    })
  })

  it('exportAssetsWithCsv forwards the signal', async () => {
    fake.on('GET', `/export/csv/projects/${PROJECT_ID}/assets.csv`, csvResponse)
    const controller = new AbortController()
    controller.abort()
    await kitsu.asset.exportAssetsWithCsv(PROJECT_ID, {
      signal: controller.signal
    })
    expect(fake.calls[0].signal.aborted).toBe(true)
  })

  it('exportAssetsWithCsv raises the typed error of the API', async () => {
    fake.reply(404, { message: 'not found' })
    await expect(
      kitsu.asset.exportAssetsWithCsv(PROJECT_ID)
    ).rejects.toMatchObject({ name: 'NotFoundError', status: 404 })
  })

  it('exportAssetsWithCsv rejects without a project', async () => {
    await expect(kitsu.asset.exportAssetsWithCsv()).rejects.toMatchObject({
      name: 'ParameterError'
    })
    expect(fake.calls).toHaveLength(0)
  })
})
