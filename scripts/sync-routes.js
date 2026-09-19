import { copyFileSync } from 'node:fs'

const source = new URL(
  '../../gazu/tests/fixtures/zou_routes.json',
  import.meta.url
)
const target = new URL('../tests/fixtures/zou_routes.json', import.meta.url)
copyFileSync(source, target)
console.log('zou_routes.json synced from gazu')
