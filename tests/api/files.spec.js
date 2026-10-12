import { beforeEach, describe, expect, it } from 'vitest'

import { ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import {
  ASSET_INSTANCE_ID,
  ENTITY_ID,
  OTHER_ID,
  SHOT_ID
} from '../helpers/ids.js'

describe('files namespace: output types, softwares and file status', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('allOutputTypes lists the output types', async () => {
    fake.reply(200, [{ id: OTHER_ID, name: 'Geometry' }])
    expect(await kitsu.files.allOutputTypes()).toHaveLength(1)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/output-types'
    })
  })

  it('allOutputTypesForEntity lists the output types of an entity', async () => {
    fake.reply(200, [{ id: OTHER_ID }])
    expect(
      await kitsu.files.allOutputTypesForEntity({ id: ENTITY_ID })
    ).toEqual([{ id: OTHER_ID }])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/entities/${ENTITY_ID}/output-types`
    })
  })

  it('allOutputTypesForAssetInstance scopes the types to a shot', async () => {
    fake.reply(200, [{ id: OTHER_ID }])
    expect(
      await kitsu.files.allOutputTypesForAssetInstance(
        { id: ASSET_INSTANCE_ID },
        SHOT_ID
      )
    ).toEqual([{ id: OTHER_ID }])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/asset-instances/${ASSET_INSTANCE_ID}/entities/${SHOT_ID}/output-types`
    })
  })

  it('getOutputType returns the type, null on 404', async () => {
    fake.reply(200, { id: OTHER_ID }).reply(404, {})
    expect(await kitsu.files.getOutputType(OTHER_ID)).toEqual({ id: OTHER_ID })
    expect(await kitsu.files.getOutputType({ id: OTHER_ID })).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/output-types/${OTHER_ID}`
    })
  })

  it('getOutputTypeByName filters by name, null when missing', async () => {
    fake.reply(200, [{ id: OTHER_ID, name: 'Geometry' }]).reply(200, [])
    expect(await kitsu.files.getOutputTypeByName('Geometry')).toMatchObject({
      id: OTHER_ID
    })
    expect(await kitsu.files.getOutputTypeByName('Nope')).toBeNull()
    expect(fake.calls[0].path).toBe('/data/output-types')
    expect(fake.calls[0].query.get('name')).toBe('Geometry')
  })

  it('newOutputType creates the type when the name is free', async () => {
    fake.reply(200, []).reply(201, { id: OTHER_ID, name: 'Geometry' })
    expect(await kitsu.files.newOutputType('Geometry', 'geo')).toMatchObject({
      id: OTHER_ID
    })
    expect(fake.calls[0].query.get('name')).toBe('Geometry')
    expect(fake.calls[1]).toMatchObject({
      method: 'POST',
      path: '/data/output-types',
      body: { name: 'Geometry', short_name: 'geo' }
    })
  })

  it('newOutputType returns the existing type without creating', async () => {
    fake.reply(200, [{ id: OTHER_ID, name: 'Geometry' }])
    expect(await kitsu.files.newOutputType('Geometry', 'geo')).toEqual({
      id: OTHER_ID,
      name: 'Geometry'
    })
    expect(fake.calls).toHaveLength(1)
  })

  it('allSoftwares lists the softwares', async () => {
    fake.reply(200, [{ id: OTHER_ID, name: 'Blender' }])
    expect(await kitsu.files.allSoftwares()).toEqual([
      { id: OTHER_ID, name: 'Blender' }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/softwares'
    })
  })

  it('getSoftware returns the software, null on 404', async () => {
    fake.reply(200, { id: OTHER_ID }).reply(404, {})
    expect(await kitsu.files.getSoftware({ id: OTHER_ID })).toEqual({
      id: OTHER_ID
    })
    expect(await kitsu.files.getSoftware(OTHER_ID)).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/softwares/${OTHER_ID}`
    })
  })

  it('getSoftwareByName filters by name, null when missing', async () => {
    fake.reply(200, [{ id: OTHER_ID, name: 'Blender' }]).reply(200, [])
    expect(await kitsu.files.getSoftwareByName('Blender')).toMatchObject({
      id: OTHER_ID
    })
    expect(await kitsu.files.getSoftwareByName('Nope')).toBeNull()
    expect(fake.calls[0].path).toBe('/data/softwares')
    expect(fake.calls[0].query.get('name')).toBe('Blender')
  })

  it('newSoftware creates the software when the name is free', async () => {
    fake
      .reply(200, [])
      .reply(201, { id: OTHER_ID })
      .reply(200, [])
      .reply(201, { id: OTHER_ID })
    await kitsu.files.newSoftware('Maya', 'maya', 'ma')
    await kitsu.files.newSoftware('Maya', 'maya', 'ma', {
      secondaryExtensions: ['mb']
    })
    expect(fake.calls[0].query.get('name')).toBe('Maya')
    expect(fake.calls[1]).toMatchObject({
      method: 'POST',
      path: '/data/softwares',
      body: { name: 'Maya', short_name: 'maya', file_extension: 'ma' }
    })
    expect(fake.calls[1].body).not.toHaveProperty('secondary_extensions')
    expect(fake.calls[3].body.secondary_extensions).toEqual(['mb'])
  })

  it('newSoftware returns the existing software without creating', async () => {
    fake.reply(200, [{ id: OTHER_ID, name: 'Maya' }])
    expect(await kitsu.files.newSoftware('Maya', 'maya', 'ma')).toEqual({
      id: OTHER_ID,
      name: 'Maya'
    })
    expect(fake.calls).toHaveLength(1)
  })

  it('updateSoftware saves the software dict', async () => {
    const software = { id: OTHER_ID, secondary_extensions: ['mb'] }
    fake.reply(200, software)
    expect(await kitsu.files.updateSoftware(software)).toEqual(software)
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/softwares/${OTHER_ID}`
    })
    expect(fake.calls[0].body).toEqual({ secondary_extensions: ['mb'] })
  })

  it('getFileStatus returns the status, null on 404', async () => {
    fake.reply(200, { id: OTHER_ID }).reply(404, {})
    expect(await kitsu.files.getFileStatus(OTHER_ID)).toEqual({ id: OTHER_ID })
    expect(await kitsu.files.getFileStatus({ id: OTHER_ID })).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/file-status/${OTHER_ID}`
    })
  })

  it('getFileStatusByName filters by name, null when missing', async () => {
    fake.reply(200, [{ id: OTHER_ID, name: 'Approved' }]).reply(200, [])
    expect(await kitsu.files.getFileStatusByName('Approved')).toMatchObject({
      id: OTHER_ID
    })
    expect(await kitsu.files.getFileStatusByName('Nope')).toBeNull()
    expect(fake.calls[0].path).toBe('/data/file-status')
    expect(fake.calls[0].query.get('name')).toBe('Approved')
  })

  it('newFileStatus creates the status when the name is free', async () => {
    fake.reply(200, []).reply(201, { id: OTHER_ID, name: 'Approved' })
    expect(await kitsu.files.newFileStatus('Approved', '#00FF00')).toEqual({
      id: OTHER_ID,
      name: 'Approved'
    })
    expect(fake.calls[1]).toMatchObject({
      method: 'POST',
      path: '/data/file-status',
      body: { name: 'Approved', color: '#00FF00' }
    })
  })

  it('newFileStatus returns the existing status without creating', async () => {
    fake.reply(200, [{ id: OTHER_ID, name: 'Approved' }])
    expect(await kitsu.files.newFileStatus('Approved', '#00FF00')).toEqual({
      id: OTHER_ID,
      name: 'Approved'
    })
    expect(fake.calls).toHaveLength(1)
  })

  it('first-match lookups reject a blank filter before any request', async () => {
    const lookups = [
      () => kitsu.files.getOutputTypeByName(''),
      () => kitsu.files.getSoftwareByName(undefined),
      () => kitsu.files.getFileStatusByName(''),
      () => kitsu.files.getOutputFileByPath('')
    ]
    const errors = await Promise.all(
      lookups.map(lookup => lookup().catch(err => err))
    )
    errors.forEach(err => expect(err).toBeInstanceOf(ParameterError))
    expect(fake.calls).toHaveLength(0)
  })
})
