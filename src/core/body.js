/**
 * Read the text of an answer of the API. Both transports, fetch (http.js)
 * and XHR (upload.js), go through it so they agree on what is data.
 * @param {string} text
 * @param {string} type The Content-Type of the answer.
 * @returns {{data: any, isJson: boolean}} isJson tells a JSON string from a
 *   text page.
 * @throws {SyntaxError} A body announced as JSON that does not parse.
 */
export const parseBody = (text, type) => {
  if (!text) return { data: null, isJson: true }
  return type.includes('json')
    ? { data: JSON.parse(text), isJson: true }
    : { data: text, isJson: false }
}
