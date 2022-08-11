import { KitsuClient } from './client.js'

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

KitsuClient.prototype.logout = function () {
  return this.get('auth/logout')
}

KitsuClient.prototype.resetPassword = function (email) {
  return this.post('auth/reset-password', { email })
}

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
