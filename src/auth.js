/**
 * @module Authentication
 */

import { KitsuClient } from './client.js'

 /**
  * 
  * Login
  * 
  * @param {string} email 
  * @param {string} password 
  * @param {boolean} setToken 
  * @returns logs in
  */
KitsuClient.prototype.login = function (email, password, setToken = true) {
  return this
    .post('auth/login', { email, password })
    .then(data => {
      if (data) {
        if (setToken) this.setAuthToken(data.access_token)
        return Promise.resolve(data)
      } else {
        return Promise.reject('The authentication failed.')
      }
    })
}

 /**
  * 
  * Logout
  * 
  * @returns Logs out
  */
KitsuClient.prototype.logout = function () {
  return this.get('auth/logout')
}

 /**
  * 
  * Reset password
  * 
  * @param {string} email 
  * @returns Resets password
  */
KitsuClient.prototype.resetPassword = function (email) {
  return this.post('auth/reset-password', { email })
}

/**
  * Authenticated
  * 
  * @returns Authentication status
  */
KitsuClient.prototype.isLoggedIn = function () {
  return this.api
    .get('auth/authenticated')
    .then(res => {
      return Promise.resolve({
        isLoggedIn: res.ok,
        data: res.data
      })
    })
}

export default {}
