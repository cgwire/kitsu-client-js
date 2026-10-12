// Compiled by "npm run test:types" with public.ts: a CommonJS file, whose
// imports become require() calls, as in a CommonJS TypeScript project.
import { createClient, type KitsuClient } from '@cgwire/kitsu-client'
import { createCore } from '@cgwire/kitsu-client/core'
import { sortByName } from '@cgwire/kitsu-client/utils'
import { taskApi } from '@cgwire/kitsu-client/task'

type IsAny<T> = 0 extends 1 & T ? true : false

const kitsu: KitsuClient = createClient({ host: '/api' })
const task = taskApi(createCore({ host: '/api' }).http)
const typedClient: IsAny<typeof kitsu> = false
const typedTask: IsAny<typeof task> = false
const typedSort: IsAny<typeof sortByName> = false
