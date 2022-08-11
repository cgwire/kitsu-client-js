import { KitsuClient } from './client.js'

KitsuClient.prototype.getAssetByName = function (projectId, name) {
  return this.fetchFirst(
    `data/assets/all?project_id=${projectId}&name=${name}`)
}

export default {}
