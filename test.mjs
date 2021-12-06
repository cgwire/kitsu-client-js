import kitsu from './index.js'

const client = kitsu.createClient('http://localhost:8080/api')

client.isLoggedIn()
  .then((res) => {
    console.log(res.isLoggedIn)
    return client.login('frank@cg-wire.com', 'password')
  })
  .then(res => {
    return client.isLoggedIn()
  })
  .then(res => {
    console.log(res.isLoggedIn)
    return client.getOpenProductions()
  })
  .then(projects => {
    console.log(projects)
  })
  .catch(err => {
    console.log(err)
  })
