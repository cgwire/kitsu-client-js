import { beforeEach, describe, expect, it } from 'vitest'

import { ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import { DEPARTMENT_ID, FILE_STATUS_ID, SOFTWARE_ID } from '../helpers/ids.js'

describe('files namespace: functions needed by the Kitsu web app', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('allFileStatuses lists the file statuses', async () => {
    fake.reply(200, [{ id: FILE_STATUS_ID, name: 'Approved' }])
    expect(await kitsu.files.allFileStatuses()).toEqual([
      { id: FILE_STATUS_ID, name: 'Approved' }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/file-status'
    })
  })

  it('removeSoftware deletes a software', async () => {
    fake.reply(204)
    await kitsu.files.removeSoftware({ id: SOFTWARE_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/softwares/${SOFTWARE_ID}`
    })
    expect([...fake.calls[0].query.keys()]).toEqual([])
  })

  it('removeSoftware rejects a missing software', async () => {
    await expect(kitsu.files.removeSoftware(null)).rejects.toBeInstanceOf(
      ParameterError
    )
    expect(fake.calls).toHaveLength(0)
  })

  it('allDepartmentSoftwares lists the softwares keyed by department', async () => {
    const links = { [DEPARTMENT_ID]: [{ id: SOFTWARE_ID }] }
    fake.reply(200, links)
    expect(await kitsu.files.allDepartmentSoftwares()).toEqual(links)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/departments/software-licenses'
    })
  })

  it('addSoftwareToDepartment links a software to a department', async () => {
    const link = { department_id: DEPARTMENT_ID, software_id: SOFTWARE_ID }
    fake.reply(201, link)
    expect(
      await kitsu.files.addSoftwareToDepartment(
        { id: DEPARTMENT_ID },
        { id: SOFTWARE_ID }
      )
    ).toEqual(link)
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/data/departments/${DEPARTMENT_ID}/software-licenses`,
      body: { software_id: SOFTWARE_ID }
    })
  })

  it('addSoftwareToDepartment rejects a missing software', async () => {
    await expect(
      kitsu.files.addSoftwareToDepartment(DEPARTMENT_ID, undefined)
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('removeSoftwareFromDepartment unlinks a software', async () => {
    fake.reply(204)
    await kitsu.files.removeSoftwareFromDepartment(DEPARTMENT_ID, SOFTWARE_ID)
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/departments/${DEPARTMENT_ID}/software-licenses/${SOFTWARE_ID}`
    })
  })
})
