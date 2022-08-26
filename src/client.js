/**
 * @namespace Client
 */

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

 /**
  * @function createApi
  * @memberof Client
  * @instance
  * 
  * Creates API.
  * 
  * @param {string} host The host name
  * @returns Returns the API
  */
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

 /**
  * 
  * Kitsu Client function to be used in all js files
  * 
  * @class
  * @param {string} host The host name
  */
export function KitsuClient(host) {
  /** @lends KitsuClient.prototype */
  this.api = createApi(host)
  this.host = host

  /**
   * Set the authentication token
   * 
   * @param {string} accessToken Access token
   */
  this.setAuthToken = (accessToken) => {
    this.api.setHeader('Authorization', `Bearer ${accessToken}`)
  }

  /**
   * 
   * Get the path of the api
   * 
   * @param {string} path Path
   * @returns path of the api
   */
  this.get = (path) => {
    return this.api.get(path)
      .then(res => Promise.resolve(res.data))
  }

  /**
   * 
   * @param {string} path Path
   * @returns data found at given path
   */
  this.fetchFirst = (path) => {
    return this.api.get(path)
      .then(res => {
        return Promise.resolve(res.data && res.data.length > 0
          ? res.data[0]
          : null
        )
      })
  }

  /**
   * 
   * @param {string} path Path
   * @param {string} payload 
   * @returns Posts data at the given path
   */
  this.post = (path, payload) => {
    return this.api.post(path, payload)
      .then(res => {
        return Promise.resolve(res.data)
      })
  }

  /**
   * 
   * @param {string} path 
   * @param {Object} data 
   * @param {string} files 
   * @returns Posts data (including files) at the given path
   */
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

  /**
   * 
   * @param {string} path 
   * @param {Object} form 
   * @param {Object} data 
   * @returns Posts data (with form) at given path
   */
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

 /**
  * @function createClient
  * @memberof Client
  * @instance
  * 
  * @param {string} host The host name
  * @returns creates new Kitsu Client
  */
export const createClient = (host) => {
  return new KitsuClient(host)
}

let taskType, taskStatus, asset
