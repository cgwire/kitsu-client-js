import { describe, expect, it } from 'vitest'

import * as lib from '../src/index.js'

describe('package entry', () => {
  it('exports createClient', () => {
    expect(typeof lib.createClient).toBe('function')
  })
})
