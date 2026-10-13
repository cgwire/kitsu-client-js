/**
 * Read the text of an answer of the API. Both transports, fetch (http.js)
 * and XHR (upload.js), go through it so they agree on what is data.
 * @param {string} text
 * @param {string} type The Content-Type of the answer.
 * @returns {{data: any, isJson: boolean, error?: SyntaxError}} isJson tells
 *   a JSON string from a text page. A body announced as JSON that does not
 *   parse (cut short, a proxy page) is no JSON either: data is its text and
 *   error the parse failure.
 */
export const parseBody = (text, type) => {
  if (!text) return { data: null, isJson: true }
  if (!type.includes('json')) return { data: text, isJson: false }
  try {
    return { data: JSON.parse(text), isJson: true }
  } catch (error) {
    return { data: text, isJson: false, error }
  }
}
