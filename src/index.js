import { createCore } from './core/index.js'

// name -> factory(http). Filled by the namespace tasks.
const NAMESPACES = {}

export const createClient = options => {
  const core = createCore(options)
  const namespaces = Object.fromEntries(
    Object.entries(NAMESPACES).map(([name, factory]) => [
      name,
      factory(core.http)
    ])
  )
  return Object.freeze({ ...core, ...namespaces })
}

export * from './core/errors.js'
