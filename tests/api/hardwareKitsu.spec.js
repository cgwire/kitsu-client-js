import { beforeEach, describe, expect, it } from 'vitest'

import { ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import { DEPARTMENT_ID, HARDWARE_ITEM_ID } from '../helpers/ids.js'

describe('hardware namespace: Kitsu parity', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('allHardwareItems lists the hardware items', async () => {
    fake.reply(200, [{ id: HARDWARE_ITEM_ID, name: 'Workstation' }])
    expect(await kitsu.hardware.allHardwareItems()).toEqual([
      { id: HARDWARE_ITEM_ID, name: 'Workstation' }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/hardware-items'
    })
  })

  it('getHardwareItem returns the item, or null on a 404', async () => {
    fake.reply(200, { id: HARDWARE_ITEM_ID, name: 'Tablet' }).reply(404, {})
    expect(
      await kitsu.hardware.getHardwareItem(HARDWARE_ITEM_ID)
    ).toMatchObject({ name: 'Tablet' })
    expect(
      await kitsu.hardware.getHardwareItem({ id: HARDWARE_ITEM_ID })
    ).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/hardware-items/${HARDWARE_ITEM_ID}`
    })
  })

  it('newHardwareItem sends the Kitsu body keys', async () => {
    fake.reply(201, { id: HARDWARE_ITEM_ID })
    expect(
      await kitsu.hardware.newHardwareItem('Workstation', {
        shortName: 'WS',
        monthlyCost: 120,
        inventoryAmount: 8
      })
    ).toEqual({ id: HARDWARE_ITEM_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: '/data/hardware-items'
    })
    expect(fake.calls[0].body).toEqual({
      name: 'Workstation',
      short_name: 'WS',
      monthly_cost: 120,
      inventory_amount: 8
    })
  })

  it('newHardwareItem leaves the unset options out of the body', async () => {
    fake.reply(201, { id: HARDWARE_ITEM_ID })
    await kitsu.hardware.newHardwareItem('Workstation', { monthlyCost: 0 })
    expect(fake.calls[0].body).toEqual({ name: 'Workstation', monthly_cost: 0 })
  })

  it('newHardwareItem rejects a blank name', async () => {
    await expect(kitsu.hardware.newHardwareItem('')).rejects.toBeInstanceOf(
      ParameterError
    )
    expect(fake.calls).toHaveLength(0)
  })

  it('updateHardwareItem sends only the editable fields', async () => {
    fake.reply(200, { id: HARDWARE_ITEM_ID })
    const item = {
      id: HARDWARE_ITEM_ID,
      name: 'Workstation',
      short_name: 'WS',
      monthly_cost: 150,
      inventory_amount: 9,
      archived: true,
      created_at: '2026-01-01T00:00:00'
    }
    await kitsu.hardware.updateHardwareItem(item)
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/hardware-items/${HARDWARE_ITEM_ID}`
    })
    expect(fake.calls[0].body).toEqual({
      name: 'Workstation',
      short_name: 'WS',
      monthly_cost: 150,
      inventory_amount: 9,
      archived: true
    })
  })

  it('updateHardwareItem leaves the missing fields untouched', async () => {
    fake.reply(200, { id: HARDWARE_ITEM_ID })
    await kitsu.hardware.updateHardwareItem({
      id: HARDWARE_ITEM_ID,
      archived: false
    })
    expect(fake.calls[0].body).toEqual({ archived: false })
  })

  it('removeHardwareItem deletes the item', async () => {
    fake.reply(204)
    await kitsu.hardware.removeHardwareItem({ id: HARDWARE_ITEM_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/hardware-items/${HARDWARE_ITEM_ID}`
    })
  })

  it('allDepartmentHardwareItems returns the items keyed by department', async () => {
    const linked = { [DEPARTMENT_ID]: [{ id: HARDWARE_ITEM_ID }] }
    fake.reply(200, linked)
    expect(await kitsu.hardware.allDepartmentHardwareItems()).toEqual(linked)
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/departments/hardware-items'
    })
  })

  it('addHardwareItemToDepartment links the item', async () => {
    fake.reply(201, {
      department_id: DEPARTMENT_ID,
      hardware_item_id: HARDWARE_ITEM_ID
    })
    await kitsu.hardware.addHardwareItemToDepartment(
      { id: DEPARTMENT_ID },
      { id: HARDWARE_ITEM_ID }
    )
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/data/departments/${DEPARTMENT_ID}/hardware-items`
    })
    expect(fake.calls[0].body).toEqual({ hardware_item_id: HARDWARE_ITEM_ID })
  })

  it('removeHardwareItemFromDepartment unlinks the item', async () => {
    fake.reply(204)
    await kitsu.hardware.removeHardwareItemFromDepartment(
      DEPARTMENT_ID,
      HARDWARE_ITEM_ID
    )
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/departments/${DEPARTMENT_ID}/hardware-items/${HARDWARE_ITEM_ID}`
    })
  })

  it('link functions reject a missing department or item', async () => {
    await expect(
      kitsu.hardware.addHardwareItemToDepartment(DEPARTMENT_ID)
    ).rejects.toBeInstanceOf(ParameterError)
    await expect(
      kitsu.hardware.removeHardwareItemFromDepartment(null, HARDWARE_ITEM_ID)
    ).rejects.toBeInstanceOf(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })
})
