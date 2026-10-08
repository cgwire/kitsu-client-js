import { readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

// Every subpath is part of the public API: adding, renaming or removing one
// must be a deliberate change of this list.
const SUBPATHS = [
  'asset',
  'casting',
  'concept',
  'customAction',
  'edit',
  'entity',
  'event',
  'files',
  'hardware',
  'news',
  'person',
  'playlist',
  'project',
  'projectTemplate',
  'scene',
  'schedule',
  'search',
  'shot',
  'studio',
  'task',
  'user'
]

// The errors listed in docs/conventions.md.
const ERRORS = [
  'KitsuError',
  'ParameterError',
  'NotAuthenticatedError',
  'NotAllowedError',
  'NotFoundError',
  'TooBigFileError',
  'ServerError',
  'NetworkError',
  'TimeoutError',
  'AuthFailedError',
  'WrongOtpError',
  'TooManyLoginAttemptsError',
  'DefaultPasswordError',
  'MissingOtpError'
]

// Node resolves a package's own name through its "exports" map, so these
// imports exercise the map a consumer goes through.
describe('package exports', () => {
  it('resolves the root, core, utils and a namespace subpath', async () => {
    const root = await import('@cgwire/kitsu-client')
    const core = await import('@cgwire/kitsu-client/core')
    const utils = await import('@cgwire/kitsu-client/utils')
    const task = await import('@cgwire/kitsu-client/task')
    expect(typeof root.createClient).toBe('function')
    expect(typeof root.sortByName).toBe('function')
    expect(typeof root.NotFoundError).toBe('function')
    expect(typeof core.createCore).toBe('function')
    expect(typeof utils.formatToTimecode).toBe('function')
    expect(typeof task.taskApi).toBe('function')
  })

  it('exposes every namespace module as a subpath, and nothing else', async () => {
    const modules = readdirSync(new URL('../src/api/', import.meta.url))
      .filter(file => file.endsWith('.js'))
      .map(file => file.slice(0, -3))
    expect(modules.sort()).toEqual([...SUBPATHS].sort())
    for (const name of SUBPATHS) {
      const namespace = await import(`@cgwire/kitsu-client/${name}`)
      expect(Object.keys(namespace)).toEqual([`${name}Api`])
    }
  })

  it('exports the documented errors, not the internal factories', async () => {
    const root = await import('@cgwire/kitsu-client')
    const core = await import('@cgwire/kitsu-client/core')
    for (const entry of [root, core]) {
      for (const name of ERRORS) {
        expect(entry[name].prototype).toBeInstanceOf(Error)
      }
      expect(entry).not.toHaveProperty('errorFromResponse')
      expect(entry).not.toHaveProperty('loginErrorFrom')
    }
  })

  it('exports package.json', () => {
    const require = createRequire(import.meta.url)
    const pkg = require('@cgwire/kitsu-client/package.json')
    expect(pkg.name).toBe('@cgwire/kitsu-client')
  })
})
