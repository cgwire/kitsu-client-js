const kitsu = require('./lib/index.js')

const client = kitsu.createClient('http://localhost:8080/api')

let project, taskType, taskStatus, asset, task

client.isLoggedIn()
  .then(res => {
    return client.login('frank@cg-wire.com', 'cococo08')
  })
  .then(res => {
    return client.isLoggedIn()
  })
  .then(res => {
    return client.getOpenProductions()
  })
  .then(projects => {
    return client.getTaskType('Modeling')
  })
  .then(type => {
    taskType = type
    return client.getTaskStatus('wip')
  })
  .then(tstatus => {
    taskStatus = tstatus
    return client.getProductionByName('Caminandes')
  })
  .then(prod => {
    project = prod
    return client.getAssetByName(project.id, 'Lama')
  })
  .then(entity => {
    asset = entity
    return client.getTask(asset.id, taskType.id)
  })
  .then(t => {
    task = t
    return client.addComment(
      task.id, 
      taskStatus.id, 
      'test',
      [],
      []
    )
  })
  .then(comment => {
    return client.publish(task.id, taskStatus.id, './v1.png')
  })
  .catch(err => {
    console.log(err)
  })
