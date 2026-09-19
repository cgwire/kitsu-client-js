import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { makeClient } from './helpers/client.js'

const mapping = JSON.parse(
  readFileSync(
    new URL('../docs/kitsu-store-api-mapping.json', import.meta.url),
    'utf8'
  )
)
const { kitsu } = makeClient()

// "root.x" lives on the client itself, "http.x" on client.http, anything
// else on its namespace.
const resolve = path => {
  const [namespace, name] = path.split('.')
  const owner = namespace === 'root' ? kitsu : kitsu[namespace] || {}
  return owner[name]
}

// A row covering several routes joins its functions with " | ".
const clientsOf = row => row.client.split(' | ')

describe('Kitsu store/api mapping', () => {
  it('decides every row', () => {
    const undecided = mapping.filter(
      row => !['existing', 'added', 'excluded'].includes(row.status)
    )
    expect(undecided.map(row => `${row.module}.${row.kitsu}`)).toEqual([])
  })

  it('explains every exclusion', () => {
    const silent = mapping.filter(row => row.status === 'excluded' && !row.note)
    expect(silent.map(row => `${row.module}.${row.kitsu}`)).toEqual([])
  })

  it('points to client functions that exist', () => {
    const missing = mapping
      .filter(row => row.status !== 'excluded')
      .flatMap(row =>
        clientsOf(row)
          .filter(path => typeof resolve(path) !== 'function')
          .map(path => `${row.kitsu} -> ${path}`)
      )
    expect(missing).toEqual([])
  })
})
