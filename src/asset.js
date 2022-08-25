/**
 * @module Asset
 */

import { KitsuClient } from './client.js'

/**
 * 
 * Gets asset by name
 * 
 * @param {string} projectId ID of the project
 * @param {string} name Name of the project
 * @returns Name of the asset
 */
KitsuClient.prototype.getAssetByName = function (projectId, name) {
  return this.fetchFirst(
    `data/assets/all?project_id=${projectId}&name=${name}`)
}

export default {}
