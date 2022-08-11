import kitsu from './index.js'

const client = kitsu.createClient('http://localhost:8080/api')

let project, taskType, taskStatus, asset

const res = await client.isLoggedIn()
console.log('is logged in', res.isLoggedIn)
