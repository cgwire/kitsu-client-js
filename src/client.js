/**
 * @namespace Client
 */

import { create } from "apisauce";
let browserFD;
if (typeof window !== "undefined") {
  browserFD = window.FormData;
}
let fs, FormData;

if (typeof window === "undefined") {
  FormData = require("form-data");
  fs = require("fs");
} else {
  FormData = browserFD;
}

/**
 * Creates an API instance with the specified host configuration.
 *
 * @function createApi
 * @memberof Client
 * @instance
 * @param {string} host The host name/URL for the API
 * @returns {Object} Returns the configured API instance
 */
const createApi = (host) => {
  const api = create({
    baseURL: host,
    headers: {
      Accept: "application/json",
      "User-Agent": "JS Kitsu Client / 0.0.1",
    },
  });
  return api;
};

/**
 * Kitsu Client class for making API requests to a Kitsu server.
 * Provides methods for GET, POST, PUT, DELETE operations and file uploads.
 *
 * @class KitsuClient
 * @param {string} host The host name/URL of the Kitsu server
 */
export function KitsuClient(host) {
  /** @lends KitsuClient.prototype */
  this.api = createApi(host);
  this.host = host;

  /**
   * Set the authentication token for API requests.
   * This will add an Authorization header with Bearer token to all subsequent requests.
   *
   * @param {string} accessToken The access token to use for authentication
   * @returns {void}
   */
  this.setAuthToken = (accessToken) => {
    this.api.setHeader("Authorization", `Bearer ${accessToken}`);
  };

  /**
   * Performs a GET request to retrieve data from the specified path.
   *
   * @param {string} path The API endpoint path to request
   * @returns {Promise<*>} A promise that resolves to the response data
   */
  this.get = (path) => {
    return this.api.get(path).then((res) => Promise.resolve(res.data));
  };

  /**
   * Performs a GET request and returns the first item from the response array.
   * If the response is empty or not an array, returns null.
   *
   * @param {string} path The API endpoint path to request
   * @returns {Promise<*|null>} A promise that resolves to the first item in the response array, or null if empty
   */
  this.fetchFirst = (path) => {
    return this.api.get(path).then((res) => {
      return Promise.resolve(
        res.data && res.data.length > 0 ? res.data[0] : null
      );
    });
  };

  /**
   * Performs a POST request to create a new resource at the specified path.
   *
   * @param {string} path The API endpoint path to post to
   * @param {Object|*} payload The data to send in the request body
   * @returns {Promise<*>} A promise that resolves to the response data
   */
  this.post = (path, payload) => {
    return this.api.post(path, payload).then((res) => {
      return Promise.resolve(res.data);
    });
  };

  /**
   * Performs a POST request with file uploads using multipart/form-data.
   * Automatically creates a FormData object and appends the provided data and files.
   *
   * @param {string} path The API endpoint path to post to
   * @param {Object} data The data fields to include in the form
   * @param {Array<string>} files Array of file paths to upload
   * @returns {Promise<*>} A promise that resolves to the response data
   */
  this.postWithFiles = (path, data, files) => {
    const form = new FormData();
    Object.keys(data).forEach((key) => {
      let val = data[key];
      val = typeof val === "object" ? JSON.stringify(data[key]) : val;
      form.append(key, val);
    });
    if (files.length === 1) {
      form.append("file", fs.createReadStream(files[0]));
    } else {
      files.forEach((file, index) => {
        form.append("file" + index, fs.createReadStream(file));
      });
    }
    return this.api.post(path, form, {
      headers: {
        ...this.api.headers,
        ...form.getHeaders(),
      },
    });
  };

  /**
   * Performs a POST request with a pre-existing FormData object.
   * Appends additional data fields to the form before sending.
   *
   * @param {string} path The API endpoint path to post to
   * @param {FormData} form The FormData object to send
   * @param {Object} [data={}] Additional data fields to append to the form
   * @returns {Promise<*>} A promise that resolves to the response data
   */
  this.postWithForm = (path, form, data = {}) => {
    Object.keys(data).forEach((key) => {
      let val = data[key];
      val = typeof val === "object" ? JSON.stringify(data[key]) : val;
      form.append(key, val);
    });
    return this.api.post(path, form, {
      headers: {
        ...this.api.headers,
        ...form.getHeaders(),
      },
    });
  };

  /**
   * Performs a PUT request to update a resource at the specified path.
   *
   * @param {string} path The API endpoint path to update
   * @param {Object|*} payload The data to send in the request body
   * @returns {Promise<*>} A promise that resolves to the response data
   */
  this.put = (path, payload) => {
    return this.api.put(path, payload).then((res) => {
      return Promise.resolve(res.data);
    });
  };

  /**
   * Performs a DELETE request to remove a resource at the specified path.
   *
   * @param {string} path The API endpoint path to delete
   * @returns {Promise<*>} A promise that resolves to the response data
   */
  this.delete = (path) => {
    return this.api.delete(path).then((res) => Promise.resolve(res.data));
  };
}

/**
 * Factory function to create a new KitsuClient instance.
 *
 * @function createClient
 * @memberof Client
 * @instance
 * @param {string} host The host name/URL of the Kitsu server
 * @returns {KitsuClient} A new KitsuClient instance
 */
export const createClient = (host) => {
  return new KitsuClient(host);
};