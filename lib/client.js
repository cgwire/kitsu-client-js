import { create } from 'apisauce'

const createApi = (host) => {
  const api = create({
    baseURL: host,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'JS Kitsu Client / 0.0.1'
    },
  })
  return api
}

export function KitsuClient(host) {
  this.api = createApi(host)
  this.host = host

  this.setAuthToken = (accessToken) => {
    this.api.setHeader('Authorization', `Bearer ${accessToken}`)
  }

  this.get = (path) => {
    return this.api.get(path)
      .then(res => Promise.resolve(res.data))
  }

  this.post = (path, payload) => {
    return this.api.post(path, payload)
      .then(res => {
        return Promise.resolve(res.data)
      })
  }
}

export const createClient = (host) => {
  return new KitsuClient(host)
}
