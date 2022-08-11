import { KitsuClient } from './client.js'

KitsuClient.prototype.getProductions = function () {
  return this.get('data/projects/all')
}

KitsuClient.prototype.getOpenProductions = function () {
  return this.get('data/projects/open')
}

KitsuClient.prototype.getProduction = function (productionId) {
  return this.fetchFirst(`data/projects/{productionId}`)
}

KitsuClient.prototype.getProductionByName = function (name) {
  return this.fetchFirst(`data/projects?name=${name}`)
}

export default {}
