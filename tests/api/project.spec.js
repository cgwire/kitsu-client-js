import { beforeEach, describe, expect, it } from 'vitest'

import { KitsuError, NotFoundError } from '../../src/core/errors.js'
import { ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import { jsonResponse } from '../helpers/fakeFetch.js'
import {
  ASSET_ID,
  OTHER_ID,
  PERSON_ID,
  PROJECT_ID,
  TASK_STATUS_ID,
  TASK_TYPE_ID
} from '../helpers/ids.js'

const STATUS_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const TEMPLATE_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

describe('project namespace: projects', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('allProjectStatus lists the project statuses sorted by name', async () => {
    fake.reply(200, [{ name: 'Open' }, { name: 'closed' }])
    const statuses = await kitsu.project.allProjectStatus()
    expect(statuses.map(status => status.name)).toEqual(['closed', 'Open'])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/project-status'
    })
  })

  it('getProjectStatusByName filters by name, null when missing', async () => {
    fake.reply(200, [{ id: STATUS_ID, name: 'Open' }]).reply(200, [])
    expect(await kitsu.project.getProjectStatusByName('Open')).toEqual({
      id: STATUS_ID,
      name: 'Open'
    })
    expect(await kitsu.project.getProjectStatusByName('Nope')).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/project-status'
    })
    expect(fake.calls[0].query.get('name')).toBe('Open')
  })

  it('allProjects lists every project sorted by name', async () => {
    fake.reply(200, [{ name: 'Zorro' }, { name: 'agent 327' }])
    const projects = await kitsu.project.allProjects()
    expect(projects.map(project => project.name)).toEqual([
      'agent 327',
      'Zorro'
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/projects'
    })
  })

  it('allOpenProjects lists the open projects sorted by name', async () => {
    fake.reply(200, [
      { id: OTHER_ID, name: 'Sprite' },
      { id: PROJECT_ID, name: 'caminandes' }
    ])
    expect(await kitsu.project.allOpenProjects()).toEqual([
      { id: PROJECT_ID, name: 'caminandes' },
      { id: OTHER_ID, name: 'Sprite' }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/projects/open'
    })
  })

  it('getProject accepts an object or an id and returns null on 404', async () => {
    fake.reply(200, { id: PROJECT_ID }).reply(404, {})
    expect(await kitsu.project.getProject({ id: PROJECT_ID })).toEqual({
      id: PROJECT_ID
    })
    expect(await kitsu.project.getProject(PROJECT_ID)).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}`
    })
  })

  it('getProjectByName filters by name, null when missing', async () => {
    fake.reply(200, [{ id: PROJECT_ID, name: 'Sprite' }]).reply(200, [])
    expect(await kitsu.project.getProjectByName('Sprite')).toMatchObject({
      id: PROJECT_ID
    })
    expect(await kitsu.project.getProjectByName('Nope')).toBeNull()
    expect(fake.calls[0].path).toBe('/data/projects')
    expect(fake.calls[0].query.get('name')).toBe('Sprite')
  })

  it('newProject creates the project with the defaults of gazu', async () => {
    fake.reply(200, []).reply(201, { id: PROJECT_ID, name: 'Sprite' })
    expect(await kitsu.project.newProject('Sprite')).toEqual({
      id: PROJECT_ID,
      name: 'Sprite'
    })
    expect(fake.calls[0].query.get('name')).toBe('Sprite')
    expect(fake.calls[1]).toMatchObject({
      method: 'POST',
      path: '/data/projects'
    })
    expect(fake.calls[1].body).toEqual({
      name: 'Sprite',
      production_type: 'short',
      team: [],
      asset_types: [],
      task_statuses: [],
      task_types: [],
      production_style: '2d3d'
    })
  })

  it('newProject sends the links as ids and the template id', async () => {
    fake.reply(200, []).reply(201, { id: PROJECT_ID })
    await kitsu.project.newProject('Sprite', {
      productionType: 'tvshow',
      team: [{ id: PERSON_ID }],
      assetTypes: [ASSET_ID],
      taskStatuses: [{ id: TASK_STATUS_ID }],
      taskTypes: [TASK_TYPE_ID],
      productionStyle: '3d',
      projectTemplate: { id: TEMPLATE_ID }
    })
    expect(fake.calls[1].body).toEqual({
      name: 'Sprite',
      production_type: 'tvshow',
      team: [PERSON_ID],
      asset_types: [ASSET_ID],
      task_statuses: [TASK_STATUS_ID],
      task_types: [TASK_TYPE_ID],
      production_style: '3d',
      project_template_id: TEMPLATE_ID
    })
  })

  it('newProject returns the existing project without creating it', async () => {
    fake.reply(200, [{ id: PROJECT_ID, name: 'Sprite' }])
    expect(await kitsu.project.newProject('Sprite')).toEqual({
      id: PROJECT_ID,
      name: 'Sprite'
    })
    expect(fake.calls).toHaveLength(1)
  })

  it('removeProject deletes the project, forcing on demand', async () => {
    fake.reply(204).reply(204)
    await kitsu.project.removeProject(PROJECT_ID)
    await kitsu.project.removeProject({ id: PROJECT_ID }, { force: true })
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/projects/${PROJECT_ID}`
    })
    expect(fake.calls[0].query.has('force')).toBe(false)
    expect(fake.calls[1].query.get('force')).toBe('true')
  })

  it('updateProject saves the project with its links as ids', async () => {
    fake.reply(200, { id: PROJECT_ID, name: 'Renamed' })
    const project = {
      id: PROJECT_ID,
      name: 'Renamed',
      team: [{ id: PERSON_ID }],
      asset_types: [{ id: ASSET_ID }],
      task_statuses: [TASK_STATUS_ID],
      task_types: [{ id: TASK_TYPE_ID }]
    }
    expect(await kitsu.project.updateProject(project)).toEqual({
      id: PROJECT_ID,
      name: 'Renamed'
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/projects/${PROJECT_ID}`
    })
    expect(fake.calls[0].body).toEqual({
      id: PROJECT_ID,
      name: 'Renamed',
      team: [PERSON_ID],
      asset_types: [ASSET_ID],
      task_statuses: [TASK_STATUS_ID],
      task_types: [TASK_TYPE_ID]
    })
    expect(project.team).toEqual([{ id: PERSON_ID }])
  })

  it('updateProject leaves out the links the project does not carry', async () => {
    fake.reply(200, { id: PROJECT_ID })
    await kitsu.project.updateProject({ id: PROJECT_ID, fps: '25' })
    expect(fake.calls[0].body).toEqual({ id: PROJECT_ID, fps: '25' })
  })

  it('updateProjectData merges the metadata on the server copy', async () => {
    fake
      .reply(200, {
        id: PROJECT_ID,
        name: 'Sprite',
        team: [PERSON_ID],
        data: { lut: 'aces', ratio: '16:9' }
      })
      .reply(200, { id: PROJECT_ID, data: { lut: 'rec709', ratio: '16:9' } })
    const data = { lut: 'rec709' }
    expect(
      await kitsu.project.updateProjectData({ id: PROJECT_ID }, data)
    ).toEqual({ id: PROJECT_ID, data: { lut: 'rec709', ratio: '16:9' } })
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}`
    })
    expect(fake.calls[1]).toMatchObject({
      method: 'PUT',
      path: `/data/projects/${PROJECT_ID}`
    })
    expect(fake.calls[1].body).toEqual({
      id: PROJECT_ID,
      name: 'Sprite',
      team: [PERSON_ID],
      data: { lut: 'rec709', ratio: '16:9' }
    })
    expect(data).toEqual({ lut: 'rec709' })
  })

  it('updateProjectData starts from an empty object when data is null', async () => {
    fake.reply(200, { id: PROJECT_ID, data: null }).reply(200, {})
    await kitsu.project.updateProjectData(PROJECT_ID, { lut: 'aces' })
    expect(fake.calls[1].body.data).toEqual({ lut: 'aces' })
  })

  it('updateProjectData rejects when the project does not exist', async () => {
    fake.reply(404, {})
    await expect(
      kitsu.project.updateProjectData(PROJECT_ID, { lut: 'aces' })
    ).rejects.toBeInstanceOf(NotFoundError)
    expect(fake.calls).toHaveLength(1)
  })

  it('closeProject sets the closed status on the project', async () => {
    fake
      .reply(200, [
        { id: OTHER_ID, name: 'Open' },
        { id: STATUS_ID, name: 'Closed' }
      ])
      .reply(200, { id: PROJECT_ID, project_status_id: STATUS_ID })
    const project = { id: PROJECT_ID, name: 'Sprite' }
    expect(await kitsu.project.closeProject(project)).toEqual({
      id: PROJECT_ID,
      project_status_id: STATUS_ID
    })
    expect(fake.calls[0].path).toBe('/data/project-status')
    expect(fake.calls[1]).toMatchObject({
      method: 'PUT',
      path: `/data/projects/${PROJECT_ID}`
    })
    expect(fake.calls[1].body).toEqual({
      id: PROJECT_ID,
      name: 'Sprite',
      project_status_id: STATUS_ID
    })
    expect(project).toEqual({ id: PROJECT_ID, name: 'Sprite' })
  })

  it('closeProject accepts an id', async () => {
    fake.reply(200, [{ id: STATUS_ID, name: 'closed' }]).reply(200, {})
    await kitsu.project.closeProject(PROJECT_ID)
    expect(fake.calls[1].body).toEqual({
      id: PROJECT_ID,
      project_status_id: STATUS_ID
    })
  })

  it('closeProject rejects when no closed status exists', async () => {
    fake.reply(200, [{ id: OTHER_ID, name: 'Open' }])
    await expect(kitsu.project.closeProject(PROJECT_ID)).rejects.toThrow(
      KitsuError
    )
    expect(fake.calls).toHaveLength(1)
  })

  it('multi-step calls forward the signal to every request', async () => {
    const controller = new AbortController()
    fake
      .on('GET', '/data/project-status', () => {
        controller.abort()
        return jsonResponse(200, [{ id: STATUS_ID, name: 'closed' }])
      })
      .reply(200, {})
    await kitsu.project.closeProject(PROJECT_ID, { signal: controller.signal })
    expect(fake.calls[0].signal.aborted).toBe(true)
    expect(fake.calls[1].signal.aborted).toBe(true)
  })

  it('first-match lookups reject a blank filter before any request', async () => {
    const lookups = [
      () => kitsu.project.getProjectByName(''),
      () => kitsu.project.getProjectByName(undefined),
      () => kitsu.project.getProjectStatusByName(''),
      () => kitsu.project.newProject(''),
      () => kitsu.project.getMetadataDescriptorByFieldName(PROJECT_ID, '')
    ]
    const errors = await Promise.all(
      lookups.map(lookup => lookup().catch(err => err))
    )
    errors.forEach(err => expect(err).toBeInstanceOf(ParameterError))
    expect(fake.calls).toHaveLength(0)
  })
})
