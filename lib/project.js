import { KitsuClient } from './client.js'

KitsuClient.prototype.getProductions = function () {
  return this.get('data/projects/all')
}

KitsuClient.prototype.getOpenProductions = function () {
  return this.get('data/projects/open')
}

KitsuClient.prototype.getProduction = function (productionId) {
  return this.get(`data/projects/{productionId}`)
}

export default {}
