import { describe, expect, it } from 'vitest'

import { parseBody } from '../../src/core/body.js'

describe('parseBody', () => {
  it('parses JSON, reads an empty answer as null and keeps a page as text', () => {
    expect(parseBody('{"id":1}', 'application/json')).toEqual({
      data: { id: 1 },
      isJson: true
    })
    expect(parseBody('', 'text/html')).toEqual({ data: null, isJson: true })
    expect(parseBody('<html></html>', 'text/html')).toEqual({
      data: '<html></html>',
      isJson: false
    })
  })

  // Both transports turn a 2xx that is no JSON into a KitsuError: a parse
  // failure must reach that guard, not escape as a bare SyntaxError.
  it('reports JSON that does not parse as no JSON, with the parse failure', () => {
    const { data, isJson, error } = parseBody('{"id":', 'application/json')
    expect({ data, isJson }).toEqual({ data: '{"id":', isJson: false })
    expect(error).toBeInstanceOf(SyntaxError)
  })
})
