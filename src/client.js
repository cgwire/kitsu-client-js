import { create } from 'apisauce'
let browserFD
if (typeof window !== 'undefined') {
  browserFD = window.FormData
}
let fs, FormData

if (typeof window === 'undefined') {
  FormData = require('form-data')
  fs = require('fs')
} else {
  FormData = browserFD
}

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

  this.fetchFirst = (path) => {
    return this.api.get(path)
      .then(res => {
        return Promise.resolve(res.data && res.data.length > 0
          ? res.data[0]
          : null
        )
      })
  }

  this.post = (path, payload) => {
    return this.api.post(path, payload)
      .then(res => {
        return Promise.resolve(res.data)
      })
  }

  this.postWithFiles = (path, data, files) => {
    const form = new FormData()
    Object.keys(data).forEach(key => {
      let val = data[key]
      val = typeof val === 'object' ? JSON.stringify(data[key]) : val
      form.append(key, val)
    })
    if (files.length === 1) {
      form.append('file', fs.createReadStream(files[0]));
    } else {
      files.forEach((file, index) => {
        form.append('file' + index, fs.createReadStream(file));
      })
    }
    return this.api.post(path, form, {
      headers: {
        ...this.api.headers,
        ...form.getHeaders()
      }
    })
  }

  this.postWithForm = (path, form, data = {}) => {
    Object.keys(data).forEach(key => {
      let val = data[key]
      val = typeof val === 'object' ? JSON.stringify(data[key]) : val
      form.append(key, val)
    })
    return this.api.post(path, form, {
      headers: {
        ...this.api.headers,
        ...form.getHeaders()
      }
    })
  }

}

export const createClient = (host) => {
  return new KitsuClient(host)
}

let taskType, taskStatus, asset
