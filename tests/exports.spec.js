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

// Vite resolves a package's own name through its "exports" map like Node
// does, so these imports exercise the map a consumer goes through. The
// require() test below goes through the resolver and loader of Node itself.
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

  // The exact lists: an internal helper leaking through a new "export *"
  // must fail here.
  it('exports nothing else from the root and core entries', async () => {
    const root = await import('@cgwire/kitsu-client')
    const core = await import('@cgwire/kitsu-client/core')
    const utils = await import('@cgwire/kitsu-client/utils')
    expect(Object.keys(root).sort()).toEqual(
      ['createClient', ...ERRORS, ...Object.keys(utils)].sort()
    )
    expect(Object.keys(core).sort()).toEqual(['createCore', ...ERRORS].sort())
  })

  it('exports package.json', () => {
    const require = createRequire(import.meta.url)
    const pkg = require('@cgwire/kitsu-client/package.json')
    expect(pkg.name).toBe('@cgwire/kitsu-client')
  })

  it('loads every entry point with require(), as CommonJS code does', async () => {
    const require = createRequire(import.meta.url)
    const entries = ['', '/core', '/utils', ...SUBPATHS.map(name => `/${name}`)]
    for (const entry of entries) {
      const specifier = `@cgwire/kitsu-client${entry}`
      expect(Object.keys(require(specifier)).sort()).toEqual(
        Object.keys(await import(specifier)).sort()
      )
    }
  })

  // The declarations are built at pack time: their presence is checked by
  // "npm run test:types", their mapping here.
  it('declares the types of every entry point next to its code', () => {
    const require = createRequire(import.meta.url)
    const pkg = require('@cgwire/kitsu-client/package.json')
    const declarationOf = path =>
      path.replace(/^\.\/src\//, './types/').replace(/\.js$/, '.d.ts')
    const entries = Object.entries(pkg.exports).filter(
      ([, target]) => typeof target === 'object'
    )
    expect(entries.map(([subpath]) => subpath)).toEqual([
      '.',
      './core',
      './utils',
      './*'
    ])
    for (const [, target] of entries) {
      expect(target.types).toBe(declarationOf(target.default))
    }
    expect(pkg.main).toBe(pkg.exports['.'].default)
    expect(pkg.types).toBe(pkg.exports['.'].types)
    expect(pkg.files).toEqual(expect.arrayContaining(['src', 'types']))
  })
})
