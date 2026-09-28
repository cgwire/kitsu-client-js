import { beforeEach, describe, expect, it } from 'vitest'

import { makeClient } from '../helpers/client.js'
import {
  ASSET_INSTANCE_ID,
  ENTITY_ID,
  FILE_STATUS_ID,
  OUTPUT_FILE_ID,
  OUTPUT_TYPE_ID,
  PERSON_ID,
  SHOT_ID,
  TASK_TYPE_ID,
  WORKING_FILE_ID
} from '../helpers/ids.js'

describe('files namespace: output file paths and creation', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('buildEntityOutputFilePath joins the folder and the file name', async () => {
    fake.reply(200, {
      folder_path: '/prod/my shot/geo',
      file_name: 'sh010 geo_v001'
    })
    expect(
      await kitsu.files.buildEntityOutputFilePath(
        { id: ENTITY_ID },
        { id: OUTPUT_TYPE_ID },
        { id: TASK_TYPE_ID }
      )
    ).toBe('/prod/my_shot/geo/sh010_geo_v001')
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/data/entities/${ENTITY_ID}/output-file-path`
    })
    expect(fake.calls[0].body).toEqual({
      task_type_id: TASK_TYPE_ID,
      output_type_id: OUTPUT_TYPE_ID,
      mode: 'output',
      name: 'main',
      representation: '',
      revision: 0,
      separator: '/'
    })
  })

  it('buildEntityOutputFilePath sends every option and joins with sep', async () => {
    fake.reply(200, { folder_path: 'C:\\prod\\geo', file_name: 'sh010_v003' })
    expect(
      await kitsu.files.buildEntityOutputFilePath(
        ENTITY_ID,
        OUTPUT_TYPE_ID,
        TASK_TYPE_ID,
        {
          name: 'hires',
          mode: 'publish',
          representation: 'abc',
          revision: 3,
          sep: '\\'
        }
      )
    ).toBe('C:\\prod\\geo\\sh010_v003')
    expect(fake.calls[0].body).toEqual({
      task_type_id: TASK_TYPE_ID,
      output_type_id: OUTPUT_TYPE_ID,
      mode: 'publish',
      name: 'hires',
      representation: 'abc',
      revision: 3,
      separator: '\\'
    })
  })

  it('buildAssetInstanceOutputFilePath joins folder and file name', async () => {
    fake
      .reply(200, { folder_path: '/prod/sh010/hero 1', file_name: 'geo_v001' })
      .reply(200, { folder_path: 'C:\\prod', file_name: 'geo_v002' })
    expect(
      await kitsu.files.buildAssetInstanceOutputFilePath(
        { id: ASSET_INSTANCE_ID },
        { id: SHOT_ID },
        { id: OUTPUT_TYPE_ID },
        { id: TASK_TYPE_ID }
      )
    ).toBe('/prod/sh010/hero_1/geo_v001')
    expect(
      await kitsu.files.buildAssetInstanceOutputFilePath(
        ASSET_INSTANCE_ID,
        SHOT_ID,
        OUTPUT_TYPE_ID,
        TASK_TYPE_ID,
        {
          name: 'hires',
          representation: 'abc',
          mode: 'publish',
          revision: 2,
          sep: '\\'
        }
      )
    ).toBe('C:\\prod\\geo_v002')
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/data/asset-instances/${ASSET_INSTANCE_ID}/entities/${SHOT_ID}/output-file-path`
    })
    expect(fake.calls[0].body).toEqual({
      task_type_id: TASK_TYPE_ID,
      output_type_id: OUTPUT_TYPE_ID,
      mode: 'output',
      name: 'main',
      representation: '',
      revision: 0,
      separator: '/'
    })
    expect(fake.calls[1].body).toEqual({
      task_type_id: TASK_TYPE_ID,
      output_type_id: OUTPUT_TYPE_ID,
      mode: 'publish',
      name: 'hires',
      representation: 'abc',
      revision: 2,
      separator: '\\'
    })
  })

  it('newEntityOutputFile creates an output file with the defaults', async () => {
    fake.reply(201, { id: OUTPUT_FILE_ID, revision: 1 })
    expect(
      await kitsu.files.newEntityOutputFile(
        { id: ENTITY_ID },
        { id: OUTPUT_TYPE_ID },
        { id: TASK_TYPE_ID },
        'first export'
      )
    ).toEqual({ id: OUTPUT_FILE_ID, revision: 1 })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/data/entities/${ENTITY_ID}/output-files/new`
    })
    expect(fake.calls[0].body).toEqual({
      output_type_id: OUTPUT_TYPE_ID,
      task_type_id: TASK_TYPE_ID,
      comment: 'first export',
      revision: 0,
      representation: '',
      name: 'main',
      nb_elements: 1,
      sep: '/'
    })
  })

  it('newEntityOutputFile sends the source, the author and the options', async () => {
    fake.reply(201, { id: OUTPUT_FILE_ID })
    await kitsu.files.newEntityOutputFile(
      ENTITY_ID,
      OUTPUT_TYPE_ID,
      TASK_TYPE_ID,
      'retake',
      {
        workingFile: { id: WORKING_FILE_ID },
        person: PERSON_ID,
        name: 'hires',
        revision: 5,
        nbElements: 24,
        representation: 'abc',
        sep: '\\',
        fileStatusId: FILE_STATUS_ID
      }
    )
    expect(fake.calls[0].body).toEqual({
      output_type_id: OUTPUT_TYPE_ID,
      task_type_id: TASK_TYPE_ID,
      comment: 'retake',
      revision: 5,
      representation: 'abc',
      name: 'hires',
      nb_elements: 24,
      sep: '\\',
      working_file_id: WORKING_FILE_ID,
      person_id: PERSON_ID,
      file_status_id: FILE_STATUS_ID
    })
  })

  it('newAssetInstanceOutputFile creates a file with the defaults', async () => {
    fake.reply(201, { id: OUTPUT_FILE_ID, revision: 1 })
    expect(
      await kitsu.files.newAssetInstanceOutputFile(
        { id: ASSET_INSTANCE_ID },
        { id: SHOT_ID },
        { id: OUTPUT_TYPE_ID },
        { id: TASK_TYPE_ID },
        'first export'
      )
    ).toEqual({ id: OUTPUT_FILE_ID, revision: 1 })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/data/asset-instances/${ASSET_INSTANCE_ID}/entities/${SHOT_ID}/output-files/new`
    })
    expect(fake.calls[0].body).toEqual({
      output_type_id: OUTPUT_TYPE_ID,
      task_type_id: TASK_TYPE_ID,
      comment: 'first export',
      name: 'master',
      revision: 0,
      representation: '',
      nb_elements: 1,
      sep: '/'
    })
  })

  it('newAssetInstanceOutputFile sends the source, author and options', async () => {
    fake.reply(201, { id: OUTPUT_FILE_ID })
    await kitsu.files.newAssetInstanceOutputFile(
      ASSET_INSTANCE_ID,
      SHOT_ID,
      OUTPUT_TYPE_ID,
      TASK_TYPE_ID,
      'retake',
      {
        name: 'hires',
        workingFile: WORKING_FILE_ID,
        person: { id: PERSON_ID },
        revision: 5,
        nbElements: 24,
        representation: 'abc',
        sep: '\\',
        fileStatusId: FILE_STATUS_ID
      }
    )
    expect(fake.calls[0].body).toEqual({
      output_type_id: OUTPUT_TYPE_ID,
      task_type_id: TASK_TYPE_ID,
      comment: 'retake',
      name: 'hires',
      revision: 5,
      representation: 'abc',
      nb_elements: 24,
      sep: '\\',
      working_file_id: WORKING_FILE_ID,
      person_id: PERSON_ID,
      file_status_id: FILE_STATUS_ID
    })
  })
})
