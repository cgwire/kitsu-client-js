/**
 * @module Project
 */

import { KitsuClient } from './client.js'

 /**
  * 
  * Get all projects
  * 
  * @returns All projects
  */
KitsuClient.prototype.getProductions = function () {
  return this.get('data/projects/all')
}

 /**
  * 
  * Get all open projects
  * 
  * @returns All open projects
  */
KitsuClient.prototype.getOpenProductions = function () {
  return this.get('data/projects/open')
}

 /**
  * 
  * Get the project given by ID
  * 
  * @param {string} productionId ID of the project
  * @returns The project given by ID
  */
KitsuClient.prototype.getProduction = function (productionId) {
  return this.fetchFirst(`data/projects/{productionId}`)
}

 /**
  * 
  * Get the project by name
  * 
  * @param {string} name Name of the project
  * @returns The project given by name
  */
KitsuClient.prototype.getProductionByName = function (name) {
  return this.fetchFirst(`data/projects?name=${name}`)
}

export default {}
