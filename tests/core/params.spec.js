import { describe, expect, it } from 'vitest'

import {
  NotFoundError,
  ParameterError,
  ServerError
} from '../../src/core/errors.js'
import {
  dateOf,
  dayOf,
  idOf,
  idsOf,
  optionalIdOf,
  orNull,
  requiredOf,
  sortedByName,
  withoutNil
} from '../../src/core/params.js'
import { OTHER_ID, SHOT_ID } from '../helpers/ids.js'

describe('idOf', () => {
  it('accepts an entity object or a UUID string', () => {
    expect(idOf({ id: SHOT_ID, name: 'SH010' })).toBe(SHOT_ID)
    expect(idOf(SHOT_ID)).toBe(SHOT_ID)
  })

  it('rejects a missing entity, so it never lands in a path as "null"', () => {
    expect(() => idOf(null)).toThrow(ParameterError)
    expect(() => idOf(undefined)).toThrow(ParameterError)
  })

  it('rejects anything else, which also blocks path injection', () => {
    expect(() => idOf('../../auth/logout')).toThrow(ParameterError)
    expect(() => idOf({ name: 'no id' })).toThrow(ParameterError)
    expect(() => idOf(42)).toThrow(ParameterError)
  })
})

describe('optionalIdOf', () => {
  it('passes null through, for filters that buildQuery drops', () => {
    expect(optionalIdOf(null)).toBeNull()
    expect(optionalIdOf(undefined)).toBeNull()
  })

  it('checks a given value like idOf', () => {
    expect(optionalIdOf({ id: SHOT_ID })).toBe(SHOT_ID)
    expect(() => optionalIdOf('../../auth/logout')).toThrow(ParameterError)
  })
})

describe('idsOf', () => {
  it('normalizes a mixed list', () => {
    expect(idsOf([{ id: SHOT_ID }, OTHER_ID])).toEqual([SHOT_ID, OTHER_ID])
    expect(idsOf()).toEqual([])
  })

  it('rejects a missing entry', () => {
    expect(() => idsOf([SHOT_ID, undefined])).toThrow(ParameterError)
    expect(() => idsOf([null])).toThrow(ParameterError)
  })
})

describe('requiredOf', () => {
  it('returns the value, and rejects a blank one that buildQuery would drop', () => {
    expect(requiredOf('name', 'Props')).toBe('Props')
    expect(requiredOf('count', 0)).toBe(0)
    expect(() => requiredOf('name', '')).toThrow(/name is required/)
    expect(() => requiredOf('name', null)).toThrow(ParameterError)
    expect(() => requiredOf('name', undefined)).toThrow(ParameterError)
  })
})

describe('withoutNil', () => {
  it('returns a copy without the null and undefined values', () => {
    const data = {
      name: 'a',
      description: null,
      nb: 0,
      flag: false,
      x: undefined
    }
    expect(withoutNil(data)).toEqual({ name: 'a', nb: 0, flag: false })
    expect(data).toHaveProperty('description', null)
  })
})

describe('orNull', () => {
  it('turns a NotFoundError into null and rethrows anything else', async () => {
    expect(await orNull(Promise.resolve({ id: 1 }))).toEqual({ id: 1 })
    expect(await orNull(Promise.reject(new NotFoundError('gone')))).toBeNull()
    await expect(
      orNull(Promise.reject(new ServerError('boom')))
    ).rejects.toBeInstanceOf(ServerError)
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
  // Local dates on purpose: they hold in any time zone, where a UTC day
  // shifts for whoever builds dates with a picker or new Date(y, m, d).
  it('formats a Date as its local day and passes strings through', () => {
    expect(dateOf(new Date(2026, 8, 19))).toBe('2026-09-19')
    expect(dateOf(new Date(2026, 8, 19, 23, 30))).toBe('2026-09-19')
    expect(dateOf(new Date(2026, 0, 2))).toBe('2026-01-02')
    expect(dateOf('2026-01-02')).toBe('2026-01-02')
    expect(dateOf(undefined)).toBeUndefined()
  })

  it('rejects an invalid Date', () => {
    expect(() => dateOf(new Date('garbage'))).toThrow(ParameterError)
  })
})

describe('dayOf', () => {
  it('returns the day of a Date or of a "YYYY-MM-DD" string', () => {
    expect(dayOf(new Date(2026, 8, 19))).toBe('2026-09-19')
    expect(dayOf('2026-09-19')).toBe('2026-09-19')
  })

  it('rejects anything else, which keeps caller input out of paths', () => {
    expect(() => dayOf('2026-09-19/../x')).toThrow(ParameterError)
    expect(() => dayOf(undefined)).toThrow(ParameterError)
    expect(() => dayOf(20260919)).toThrow(ParameterError)
  })
})
