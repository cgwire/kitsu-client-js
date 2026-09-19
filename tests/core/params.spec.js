import { describe, expect, it } from 'vitest'

import { ParameterError } from '../../src/core/errors.js'
import { dateOf, idOf, idsOf, sortedByName } from '../../src/core/params.js'
import { OTHER_ID, SHOT_ID } from '../helpers/ids.js'

describe('idOf', () => {
  it('accepts an entity object or a UUID string', () => {
    expect(idOf({ id: SHOT_ID, name: 'SH010' })).toBe(SHOT_ID)
    expect(idOf(SHOT_ID)).toBe(SHOT_ID)
  })

  it('passes null through', () => {
    expect(idOf(null)).toBeNull()
    expect(idOf(undefined)).toBeNull()
  })

  it('rejects anything else, which also blocks path injection', () => {
    expect(() => idOf('../../auth/logout')).toThrow(ParameterError)
    expect(() => idOf({ name: 'no id' })).toThrow(ParameterError)
    expect(() => idOf(42)).toThrow(ParameterError)
  })
})

describe('idsOf', () => {
  it('normalizes a mixed list', () => {
    expect(idsOf([{ id: SHOT_ID }, OTHER_ID])).toEqual([SHOT_ID, OTHER_ID])
    expect(idsOf()).toEqual([])
  })
})

describe('sortedByName', () => {
  it('sorts case-insensitively like gazu and leaves the input untouched', () => {
    const entries = [{ name: 'shot' }, { name: 'Asset' }, { id: 'no-name' }]
    expect(sortedByName(entries)).toEqual([
      { id: 'no-name' },
      { name: 'Asset' },
      { name: 'shot' }
    ])
    expect(entries[0]).toEqual({ name: 'shot' })
  })
})

describe('dateOf', () => {
  it('formats a Date as YYYY-MM-DD and passes strings through', () => {
    expect(dateOf(new Date(Date.UTC(2026, 8, 19, 23, 30)))).toBe('2026-09-19')
    expect(dateOf('2026-01-02')).toBe('2026-01-02')
    expect(dateOf(undefined)).toBeUndefined()
  })
})
