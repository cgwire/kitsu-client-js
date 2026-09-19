import { describe, expect, it } from 'vitest'

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
})
