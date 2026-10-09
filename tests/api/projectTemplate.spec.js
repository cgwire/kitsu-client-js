import { beforeEach, describe, expect, it } from 'vitest'

import { ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import { PROJECT_ID } from '../helpers/ids.js'

const TEMPLATE_ID = 'c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1'

describe('projectTemplate namespace: templates', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('allProjectTemplates lists the templates sorted by name', async () => {
    fake.reply(200, [{ name: 'tv show' }, { name: 'Feature' }, { name: 'ads' }])
    const templates = await kitsu.projectTemplate.allProjectTemplates()
    expect(templates.map(template => template.name)).toEqual([
      'ads',
      'Feature',
      'tv show'
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/project-templates'
    })
  })

  it('getProjectTemplate reads a template, null when missing', async () => {
    fake.reply(200, { id: TEMPLATE_ID, name: 'Feature' }).reply(404, {})
    expect(
      await kitsu.projectTemplate.getProjectTemplate({ id: TEMPLATE_ID })
    ).toEqual({ id: TEMPLATE_ID, name: 'Feature' })
    expect(
      await kitsu.projectTemplate.getProjectTemplate(TEMPLATE_ID)
    ).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/project-templates/${TEMPLATE_ID}`
    })
  })

  it('getProjectTemplateByName looks a template up by its name', async () => {
    fake.reply(200, [{ id: TEMPLATE_ID, name: 'Feature' }]).reply(200, [])
    expect(
      await kitsu.projectTemplate.getProjectTemplateByName('Feature')
    ).toMatchObject({ id: TEMPLATE_ID })
    expect(
      await kitsu.projectTemplate.getProjectTemplateByName('nope')
    ).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/project-templates'
    })
    expect(fake.calls[0].query.get('name')).toBe('Feature')
  })

  it('getProjectTemplateByName rejects a blank name', async () => {
    await expect(
      kitsu.projectTemplate.getProjectTemplateByName('')
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('newProjectTemplate creates a bare template', async () => {
    fake.reply(201, { id: TEMPLATE_ID, name: 'Feature' })
    expect(
      await kitsu.projectTemplate.newProjectTemplate('Feature')
    ).toMatchObject({ id: TEMPLATE_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: '/data/project-templates'
    })
    expect(fake.calls[0].body).toEqual({ name: 'Feature', description: null })
  })

  it('newProjectTemplate sends the production settings', async () => {
    fake.reply(201, { id: TEMPLATE_ID })
    await kitsu.projectTemplate.newProjectTemplate('Feature', {
      description: 'Long form',
      fps: '24',
      ratio: '16:9',
      resolution: '1920x1080',
      productionType: 'featurefilm',
      productionStyle: '3d'
    })
    expect(fake.calls[0].body).toEqual({
      name: 'Feature',
      description: 'Long form',
      fps: '24',
      ratio: '16:9',
      resolution: '1920x1080',
      production_type: 'featurefilm',
      production_style: '3d'
    })
  })

  it('updateProjectTemplate saves the template', async () => {
    const template = { id: TEMPLATE_ID, name: 'Renamed' }
    fake.reply(200, template)
    expect(await kitsu.projectTemplate.updateProjectTemplate(template)).toEqual(
      template
    )
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/project-templates/${TEMPLATE_ID}`
    })
    expect(fake.calls[0].body).toEqual({ name: 'Renamed' })
    expect(template).toEqual({ id: TEMPLATE_ID, name: 'Renamed' })
  })

  it('removeProjectTemplate deletes the template', async () => {
    fake.reply(204)
    await kitsu.projectTemplate.removeProjectTemplate({ id: TEMPLATE_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/project-templates/${TEMPLATE_ID}`
    })
  })

  it('newProjectTemplateFromProject snapshots a project', async () => {
    fake.reply(201, { id: TEMPLATE_ID }).reply(201, { id: TEMPLATE_ID })
    expect(
      await kitsu.projectTemplate.newProjectTemplateFromProject(
        { id: PROJECT_ID },
        'Feature'
      )
    ).toEqual({ id: TEMPLATE_ID })
    await kitsu.projectTemplate.newProjectTemplateFromProject(
      PROJECT_ID,
      'Feature',
      { description: 'From the pilot' }
    )
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/data/project-templates/from-project/${PROJECT_ID}`
    })
    expect(fake.calls[0].body).toEqual({ name: 'Feature', description: null })
    expect(fake.calls[1].body).toEqual({
      name: 'Feature',
      description: 'From the pilot'
    })
  })

  it('applyProjectTemplate applies the template to a project', async () => {
    fake.reply(200, { id: PROJECT_ID })
    expect(
      await kitsu.projectTemplate.applyProjectTemplate(
        { id: PROJECT_ID },
        { id: TEMPLATE_ID }
      )
    ).toEqual({ id: PROJECT_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/data/projects/${PROJECT_ID}/apply-template/${TEMPLATE_ID}`
    })
    expect(fake.calls[0].body).toEqual({})
  })

  it('setProjectTemplateMetadataDescriptors replaces the snapshot', async () => {
    const descriptors = [
      { name: 'Difficulty', entity_type: 'Shot', data_type: 'string' }
    ]
    fake.reply(200, { id: TEMPLATE_ID })
    expect(
      await kitsu.projectTemplate.setProjectTemplateMetadataDescriptors(
        TEMPLATE_ID,
        descriptors
      )
    ).toEqual({ id: TEMPLATE_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/project-templates/${TEMPLATE_ID}/metadata-descriptors`
    })
    expect(fake.calls[0].body).toEqual({ metadata_descriptors: descriptors })
  })
})
