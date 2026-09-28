import { beforeEach, describe, expect, it } from 'vitest'

import { makeClient } from '../helpers/client.js'
import {
  ENTITY_ID,
  OTHER_ID,
  PERSON_ID,
  PROJECT_ID,
  TASK_ID,
  WORKING_FILE_ID
} from '../helpers/ids.js'

const SOFTWARE_ID = '12121212-1212-4212-8212-121212121212'

describe('files namespace: working files', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('getAllWorkingFilesForEntity filters by task and name on demand', async () => {
    fake.reply(200, [{ id: WORKING_FILE_ID }]).reply(200, [])
    expect(
      await kitsu.files.getAllWorkingFilesForEntity({ id: ENTITY_ID })
    ).toEqual([{ id: WORKING_FILE_ID }])
    await kitsu.files.getAllWorkingFilesForEntity(ENTITY_ID, {
      task: { id: TASK_ID },
      name: 'main'
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/entities/${ENTITY_ID}/working-files`
    })
    expect(fake.calls[0].query.has('task_id')).toBe(false)
    expect(fake.calls[0].query.has('name')).toBe(false)
    expect(fake.calls[1].query.get('task_id')).toBe(TASK_ID)
    expect(fake.calls[1].query.get('name')).toBe('main')
  })

  it('buildWorkingFilePath joins the folder and the file name', async () => {
    fake.reply(200, { path: '/prod/my shot/anim', name: 'sh010 anim_v001' })
    expect(await kitsu.files.buildWorkingFilePath({ id: TASK_ID })).toBe(
      '/prod/my_shot/anim/sh010_anim_v001'
    )
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/data/tasks/${TASK_ID}/working-file-path`
    })
    expect(fake.calls[0].body).toEqual({
      mode: 'working',
      name: 'main',
      revision: 1,
      sep: '/'
    })
  })

  it('buildWorkingFilePath sends every option and joins with sep', async () => {
    fake.reply(200, { path: 'C:\\prod\\anim', name: 'sh010_v003' })
    expect(
      await kitsu.files.buildWorkingFilePath(TASK_ID, {
        name: 'hires',
        mode: 'wip',
        software: { id: SOFTWARE_ID },
        revision: 3,
        sep: '\\'
      })
    ).toBe('C:\\prod\\anim\\sh010_v003')
    expect(fake.calls[0].body).toEqual({
      mode: 'wip',
      name: 'hires',
      revision: 3,
      sep: '\\',
      software_id: SOFTWARE_ID
    })
  })

  it('newWorkingFile creates a working file with the defaults', async () => {
    fake.reply(201, { id: WORKING_FILE_ID, revision: 1 })
    expect(await kitsu.files.newWorkingFile({ id: TASK_ID })).toEqual({
      id: WORKING_FILE_ID,
      revision: 1
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/data/tasks/${TASK_ID}/working-files/new`
    })
    expect(fake.calls[0].body).toEqual({
      name: 'main',
      comment: '',
      task_id: TASK_ID,
      revision: 0,
      mode: 'working'
    })
  })

  it('newWorkingFile sends the author, the software and the options', async () => {
    fake.reply(201, { id: WORKING_FILE_ID })
    await kitsu.files.newWorkingFile(TASK_ID, {
      name: 'hires',
      mode: 'wip',
      software: SOFTWARE_ID,
      comment: 'first pass',
      person: { id: PERSON_ID },
      revision: 4
    })
    expect(fake.calls[0].body).toEqual({
      name: 'hires',
      comment: 'first pass',
      task_id: TASK_ID,
      revision: 4,
      mode: 'wip',
      person_id: PERSON_ID,
      software_id: SOFTWARE_ID
    })
  })

  it('getWorkingFilesForTask lists the working files of a task', async () => {
    fake.reply(200, [{ id: WORKING_FILE_ID }])
    expect(await kitsu.files.getWorkingFilesForTask({ id: TASK_ID })).toEqual([
      { id: WORKING_FILE_ID }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/tasks/${TASK_ID}/working-files`
    })
  })

  it('getLastWorkingFiles maps each name to its last working file', async () => {
    fake.reply(200, { main: { id: WORKING_FILE_ID, revision: 3 } })
    expect(await kitsu.files.getLastWorkingFiles(TASK_ID)).toEqual({
      main: { id: WORKING_FILE_ID, revision: 3 }
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/tasks/${TASK_ID}/working-files/last-revisions`
    })
  })

  it('getLastWorkingFileRevision picks the last file of a name', async () => {
    const lastFiles = {
      main: { id: WORKING_FILE_ID, revision: 3 },
      hires: { id: OTHER_ID, revision: 7 }
    }
    fake.reply(200, lastFiles).reply(200, lastFiles).reply(200, lastFiles)
    expect(
      await kitsu.files.getLastWorkingFileRevision({ id: TASK_ID })
    ).toEqual({ id: WORKING_FILE_ID, revision: 3 })
    expect(
      await kitsu.files.getLastWorkingFileRevision(TASK_ID, { name: 'hires' })
    ).toEqual({ id: OTHER_ID, revision: 7 })
    expect(
      await kitsu.files.getLastWorkingFileRevision(TASK_ID, { name: 'nope' })
    ).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/tasks/${TASK_ID}/working-files/last-revisions`
    })
  })

  it('getWorkingFile returns the working file, null on 404', async () => {
    fake.reply(200, { id: WORKING_FILE_ID }).reply(404, {})
    expect(await kitsu.files.getWorkingFile(WORKING_FILE_ID)).toEqual({
      id: WORKING_FILE_ID
    })
    expect(await kitsu.files.getWorkingFile({ id: WORKING_FILE_ID })).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/working-files/${WORKING_FILE_ID}`
    })
  })

  it('updateComment sets the comment of a working file', async () => {
    fake.reply(200, { id: WORKING_FILE_ID, comment: 'retake' })
    expect(
      await kitsu.files.updateComment({ id: WORKING_FILE_ID }, 'retake')
    ).toMatchObject({ comment: 'retake' })
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/actions/working-files/${WORKING_FILE_ID}/comment`,
      body: { comment: 'retake' }
    })
  })

  it('updateModificationDate touches the working file', async () => {
    fake.reply(200, { id: WORKING_FILE_ID })
    expect(await kitsu.files.updateModificationDate(WORKING_FILE_ID)).toEqual({
      id: WORKING_FILE_ID
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/actions/working-files/${WORKING_FILE_ID}/modified`,
      body: {}
    })
  })

  it('updateProjectFileTree saves the file tree on the project', async () => {
    const fileTree = { working: { mountpoint: '/prod' } }
    fake.reply(200, { id: PROJECT_ID, file_tree: fileTree })
    expect(
      await kitsu.files.updateProjectFileTree({ id: PROJECT_ID }, fileTree)
    ).toMatchObject({ id: PROJECT_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/projects/${PROJECT_ID}`,
      body: { file_tree: { working: { mountpoint: '/prod' } } }
    })
  })
})
