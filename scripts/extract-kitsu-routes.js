import { readFileSync, readdirSync } from 'node:fs'

const API_DIR = new URL('../../kitsu/src/store/api/', import.meta.url)
const VERBS = {
  pget: 'GET',
  pgetNdjson: 'GET',
  getModel: 'GET',
  getBlob: 'GET',
  getText: 'GET',
  ppost: 'POST',
  ppostFile: 'POST',
  pput: 'PUT',
  pdel: 'DELETE'
}

const rows = readdirSync(API_DIR)
  .filter(file => file.endsWith('.js') && file !== 'client.js')
  .flatMap(file => {
    const source = readFileSync(new URL(file, API_DIR), 'utf8')
    // Methods of the default export start at two spaces of indentation.
    const chunks = source.split(/\n {2}(?=(?:async )?[a-zA-Z]+\()/).slice(1)
    return chunks.map(chunk => {
      const verb = Object.keys(VERBS).find(name =>
        chunk.includes(`client.${name}(`)
      )
      const paths = [...chunk.matchAll(/[`'"](\/api\/[^`'"?]*)/g)].map(match =>
        match[1].replace(/^\/api/, '').replace(/\$\{[^}]+\}/g, '<id>')
      )
      return {
        module: file.replace('.js', ''),
        kitsu: chunk.match(/^(?:async )?([a-zA-Z]+)\(/)[1],
        method: VERBS[verb] || '?',
        route: paths.join(' | ') || '?',
        client: '',
        status: '',
        note: ''
      }
    })
  })

console.log(JSON.stringify(rows, null, 2))
