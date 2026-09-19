import { idOf, requiredOf, withoutNil } from '../core/params.js'

/**
 * @typedef {import('../core/params.js').Entity} Entity
 * @typedef {import('../core/params.js').Model} Model
 * @typedef {import('../core/params.js').RequestOptions} RequestOptions
 */

/** @param {any} http */
export const hardwareApi = http => ({
  /**
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} All hardware items.
   */
  allHardwareItems: async ({ signal } = {}) =>
    http.fetchAll('hardware-items', {}, { signal }),

  /**
   * @param {Model} hardwareItem
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity|null>} The hardware item, null when it does not
   * exist.
   */
  getHardwareItem: async (hardwareItem, { signal } = {}) =>
    http.fetchOne('hardware-items', idOf(hardwareItem), { signal }),

  /**
   * @param {string} name
   * @param {{shortName?: string, monthlyCost?: number,
   * inventoryAmount?: number, signal?: AbortSignal}} [options]
   * @returns {Promise<Entity>} The created hardware item.
   */
  newHardwareItem: async (
    name,
    { shortName, monthlyCost, inventoryAmount, signal } = {}
  ) =>
    http.create(
      'hardware-items',
      withoutNil({
        name: requiredOf('name', name),
        short_name: shortName,
        monthly_cost: monthlyCost,
        inventory_amount: inventoryAmount
      }),
      { signal }
    ),

  /**
   * Save the editable fields of the hardware item: name, short_name,
   * monthly_cost, inventory_amount and archived. A field missing from the
   * given object is left untouched.
   * @param {{id: string, [field: string]: any}} hardwareItem
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The updated hardware item.
   */
  updateHardwareItem: async (hardwareItem, { signal } = {}) =>
    http.update(
      'hardware-items',
      idOf(hardwareItem),
      withoutNil({
        name: hardwareItem.name,
        short_name: hardwareItem.short_name,
        monthly_cost: hardwareItem.monthly_cost,
        inventory_amount: hardwareItem.inventory_amount,
        archived: hardwareItem.archived
      }),
      { signal }
    ),

  /**
   * @param {Model} hardwareItem
   * @param {RequestOptions} [options]
   * @returns {Promise<any>}
   */
  removeHardwareItem: async (hardwareItem, { signal } = {}) =>
    http.remove('hardware-items', idOf(hardwareItem), {}, { signal }),

  /**
   * @param {RequestOptions} [options]
   * @returns {Promise<Record<string, Entity[]>>} The hardware items linked to
   * every department, keyed by department id.
   */
  allDepartmentHardwareItems: async ({ signal } = {}) =>
    http.get('data/departments/hardware-items', {}, { signal }),

  /**
   * @param {Model} department
   * @param {Model} hardwareItem
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The link between the department and the item.
   */
  addHardwareItemToDepartment: async (
    department,
    hardwareItem,
    { signal } = {}
  ) =>
    http.post(
      `data/departments/${idOf(department)}/hardware-items`,
      { hardware_item_id: idOf(hardwareItem) },
      { signal }
    ),

  /**
   * @param {Model} department
   * @param {Model} hardwareItem
   * @param {RequestOptions} [options]
   * @returns {Promise<any>}
   */
  removeHardwareItemFromDepartment: async (
    department,
    hardwareItem,
    { signal } = {}
  ) =>
    http.del(
      `data/departments/${idOf(department)}/hardware-items/${idOf(hardwareItem)}`,
      undefined,
      { signal }
    )
})
