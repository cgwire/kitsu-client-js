import { describe, expect, it } from 'vitest'

import { buildQuery, buildUrl } from '../../src/core/query.js'

describe('buildQuery', () => {
  it('drops null, undefined and empty values', () => {
    expect(buildQuery({ a: 1, b: null, c: undefined, d: '', e: false })).toBe(
      'a=1&e=false'
    )
  })

  it('repeats the key for array values', () => {
    expect(buildQuery({ id: ['x', 'y'] })).toBe('id=x&id=y')
  })
})

describe('buildUrl', () => {
  it('joins host and path whatever the slashes', () => {
    expect(buildUrl('http://k.test/api/', '/data/tasks')).toBe(
      'http://k.test/api/data/tasks'
    )
    expect(buildUrl('http://k.test/api', 'data/tasks', { page: 2 })).toBe(
      'http://k.test/api/data/tasks?page=2'
    )
  })

  it('supports a relative host for same-origin web apps', () => {
    expect(buildUrl('/api', 'data/tasks')).toBe('/api/data/tasks')
  })
})
