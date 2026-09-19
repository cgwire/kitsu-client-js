import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// gazu owns the extractor: it parses the blueprints of a Zou checkout
// without importing Zou. Both clients gate their tests on the same list.
const extractor = fileURLToPath(
  new URL('../../gazu/scripts/extract_zou_routes.py', import.meta.url)
)
const zou = fileURLToPath(new URL('../../zou', import.meta.url))
const target = new URL('../tests/fixtures/zou_routes.json', import.meta.url)

writeFileSync(target, execFileSync('python3', [extractor, zou]))
console.log('zou_routes.json regenerated from the Zou checkout')
