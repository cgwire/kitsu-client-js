import { beforeEach, describe, expect, it } from 'vitest'

import { makeClient } from '../helpers/client.js'
import {
  ASSET_INSTANCE_ID,
  ENTITY_ID,
  FILE_STATUS_ID,
  OTHER_ID,
  OUTPUT_FILE_ID,
  OUTPUT_TYPE_ID,
  PROJECT_ID,
  SHOT_ID,
  TASK_TYPE_ID
} from '../helpers/ids.js'

const FILTERS = {
  outputType: { id: OUTPUT_TYPE_ID },
  taskType: TASK_TYPE_ID,
  name: 'main',
  representation: 'abc',
  fileStatus: { id: FILE_STATUS_ID }
}

const expectFilters = query => {
  expect(query.get('output_type_id')).toBe(OUTPUT_TYPE_ID)
  expect(query.get('task_type_id')).toBe(TASK_TYPE_ID)
  expect(query.get('name')).toBe('main')
  expect(query.get('representation')).toBe('abc')
  expect(query.get('file_status_id')).toBe(FILE_STATUS_ID)
}

describe('files namespace: output file listings', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('getOutputFile returns the output file, null on 404', async () => {
    fake.reply(200, { id: OUTPUT_FILE_ID }).reply(404, {})
    expect(await kitsu.files.getOutputFile(OUTPUT_FILE_ID)).toEqual({
      id: OUTPUT_FILE_ID
    })
    expect(await kitsu.files.getOutputFile({ id: OUTPUT_FILE_ID })).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/output-files/${OUTPUT_FILE_ID}`
    })
  })

  it('getOutputFileByPath filters by path, null when missing', async () => {
    fake.reply(200, [{ id: OUTPUT_FILE_ID }]).reply(200, [])
    expect(
      await kitsu.files.getOutputFileByPath('/prod/sh010/geo_v001.abc')
    ).toEqual({ id: OUTPUT_FILE_ID })
    expect(await kitsu.files.getOutputFileByPath('/nope')).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/output-files'
    })
    expect(fake.calls[0].query.get('path')).toBe('/prod/sh010/geo_v001.abc')
  })

  it('allOutputFilesForEntity lists the files, filtered on demand', async () => {
    fake.reply(200, [{ id: OUTPUT_FILE_ID }]).reply(200, [])
    expect(
      await kitsu.files.allOutputFilesForEntity({ id: ENTITY_ID })
    ).toEqual([{ id: OUTPUT_FILE_ID }])
    await kitsu.files.allOutputFilesForEntity(ENTITY_ID, FILTERS)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/entities/${ENTITY_ID}/output-files`
    })
    expect([...fake.calls[0].query.keys()]).toEqual([])
    expectFilters(fake.calls[1].query)
  })

  it('allOutputFilesForAssetInstance filters by temporal entity too', async () => {
    fake.reply(200, [{ id: OUTPUT_FILE_ID }]).reply(200, [])
    expect(
      await kitsu.files.allOutputFilesForAssetInstance({
        id: ASSET_INSTANCE_ID
      })
    ).toEqual([{ id: OUTPUT_FILE_ID }])
    await kitsu.files.allOutputFilesForAssetInstance(ASSET_INSTANCE_ID, {
      ...FILTERS,
      temporalEntity: { id: SHOT_ID }
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/asset-instances/${ASSET_INSTANCE_ID}/output-files`
    })
    expect([...fake.calls[0].query.keys()]).toEqual([])
    expectFilters(fake.calls[1].query)
    expect(fake.calls[1].query.get('temporal_entity_id')).toBe(SHOT_ID)
  })

  it('allOutputFilesForProject lists the files, filtered on demand', async () => {
    fake.reply(200, [{ id: OUTPUT_FILE_ID }]).reply(200, [])
    expect(
      await kitsu.files.allOutputFilesForProject({ id: PROJECT_ID })
    ).toEqual([{ id: OUTPUT_FILE_ID }])
    await kitsu.files.allOutputFilesForProject(PROJECT_ID, FILTERS)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/output-files`
    })
    expect([...fake.calls[0].query.keys()]).toEqual([])
    expectFilters(fake.calls[1].query)
  })

  it('getLastOutputFilesForEntity lists the last revisions', async () => {
    fake.reply(200, [{ id: OUTPUT_FILE_ID }]).reply(200, [])
    expect(
      await kitsu.files.getLastOutputFilesForEntity({ id: ENTITY_ID })
    ).toEqual([{ id: OUTPUT_FILE_ID }])
    await kitsu.files.getLastOutputFilesForEntity(ENTITY_ID, FILTERS)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/entities/${ENTITY_ID}/output-files/last-revisions`
    })
    expect([...fake.calls[0].query.keys()]).toEqual([])
    expectFilters(fake.calls[1].query)
  })

  it('getLastOutputFilesForAssetInstance lists the last revisions', async () => {
    fake.reply(200, [{ id: OUTPUT_FILE_ID }]).reply(200, [])
    expect(
      await kitsu.files.getLastOutputFilesForAssetInstance(
        { id: ASSET_INSTANCE_ID },
        { id: SHOT_ID }
      )
    ).toEqual([{ id: OUTPUT_FILE_ID }])
    await kitsu.files.getLastOutputFilesForAssetInstance(
      ASSET_INSTANCE_ID,
      SHOT_ID,
      FILTERS
    )
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/asset-instances/${ASSET_INSTANCE_ID}/entities/${SHOT_ID}/output-files/last-revisions`
    })
    expect([...fake.calls[0].query.keys()]).toEqual([])
    expectFilters(fake.calls[1].query)
    expect(fake.calls[1].query.has('temporal_entity_id')).toBe(false)
  })

  it('updateOutputFile saves the given data on the output file', async () => {
    const data = { comment: 'fixed normals' }
    fake.reply(200, { id: OUTPUT_FILE_ID, comment: 'fixed normals' })
    expect(
      await kitsu.files.updateOutputFile({ id: OUTPUT_FILE_ID }, data)
    ).toMatchObject({ comment: 'fixed normals' })
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/output-files/${OUTPUT_FILE_ID}`,
      body: { comment: 'fixed normals' }
    })
    expect(data).toEqual({ comment: 'fixed normals' })
  })

  it('getNextEntityOutputRevision reads the next revision', async () => {
    fake.reply(200, { next_revision: 4 }).reply(200, { next_revision: 1 })
    expect(
      await kitsu.files.getNextEntityOutputRevision(
        { id: ENTITY_ID },
        { id: OUTPUT_TYPE_ID },
        { id: TASK_TYPE_ID }
      )
    ).toBe(4)
    await kitsu.files.getNextEntityOutputRevision(
      ENTITY_ID,
      OUTPUT_TYPE_ID,
      TASK_TYPE_ID,
      { name: 'hires' }
    )
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/data/entities/${ENTITY_ID}/output-files/next-revision`
    })
    expect(fake.calls[0].body).toEqual({
      name: 'main',
      output_type_id: OUTPUT_TYPE_ID,
      task_type_id: TASK_TYPE_ID
    })
    expect(fake.calls[1].body.name).toBe('hires')
  })

  it('getLastEntityOutputRevision is the next revision minus one', async () => {
    fake.reply(200, { next_revision: 4 }).reply(200, { next_revision: 1 })
    expect(
      await kitsu.files.getLastEntityOutputRevision(
        ENTITY_ID,
        OUTPUT_TYPE_ID,
        TASK_TYPE_ID
      )
    ).toBe(3)
    expect(
      await kitsu.files.getLastEntityOutputRevision(
        ENTITY_ID,
        OUTPUT_TYPE_ID,
        TASK_TYPE_ID,
        { name: 'hires' }
      )
    ).toBe(0)
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/data/entities/${ENTITY_ID}/output-files/next-revision`
    })
    expect(fake.calls[0].body.name).toBe('main')
    expect(fake.calls[1].body.name).toBe('hires')
  })

  it('getNextAssetInstanceOutputRevision reads the next revision', async () => {
    fake.reply(200, { next_revision: 2 }).reply(200, { next_revision: 1 })
    expect(
      await kitsu.files.getNextAssetInstanceOutputRevision(
        { id: ASSET_INSTANCE_ID },
        { id: SHOT_ID },
        { id: OUTPUT_TYPE_ID },
        { id: TASK_TYPE_ID }
      )
    ).toBe(2)
    await kitsu.files.getNextAssetInstanceOutputRevision(
      ASSET_INSTANCE_ID,
      SHOT_ID,
      OUTPUT_TYPE_ID,
      TASK_TYPE_ID,
      { name: 'hires' }
    )
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/data/asset-instances/${ASSET_INSTANCE_ID}/entities/${SHOT_ID}/output-files/next-revision`
    })
    expect(fake.calls[0].body).toEqual({
      name: 'master',
      output_type_id: OUTPUT_TYPE_ID,
      task_type_id: TASK_TYPE_ID
    })
    expect(fake.calls[1].body.name).toBe('hires')
  })

  it('getLastAssetInstanceOutputRevision is the next minus one', async () => {
    fake.reply(200, { next_revision: 2 }).reply(200, { next_revision: 1 })
    expect(
      await kitsu.files.getLastAssetInstanceOutputRevision(
        ASSET_INSTANCE_ID,
        SHOT_ID,
        OUTPUT_TYPE_ID,
        TASK_TYPE_ID
      )
    ).toBe(1)
    expect(
      await kitsu.files.getLastAssetInstanceOutputRevision(
        ASSET_INSTANCE_ID,
        SHOT_ID,
        OUTPUT_TYPE_ID,
        TASK_TYPE_ID,
        { name: 'hires' }
      )
    ).toBe(0)
    expect(fake.calls[0].path).toBe(
      `/data/asset-instances/${ASSET_INSTANCE_ID}/entities/${SHOT_ID}/output-files/next-revision`
    )
    expect(fake.calls[0].body.name).toBe('master')
    expect(fake.calls[1].body.name).toBe('hires')
  })

  it('allOutputFilesForEntity only sends the filters that are set', async () => {
    fake.reply(200, [])
    await kitsu.files.allOutputFilesForEntity(ENTITY_ID, {
      outputType: OTHER_ID
    })
    expect([...fake.calls[0].query.keys()]).toEqual(['output_type_id'])
  })
})
