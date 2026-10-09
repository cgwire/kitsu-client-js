import { rmSync } from 'node:fs'

// tsc never deletes the declarations of a removed source: start from scratch.
rmSync(new URL('../types', import.meta.url), { recursive: true, force: true })
