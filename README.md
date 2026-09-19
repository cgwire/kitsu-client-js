[![Kitsu](https://www.cg-wire.com/en/images/kitsu.png)](https://kitsu.cg-wire.com)

# JavaScript client for Kitsu

`@cgwire/kitsu-client` is the JavaScript counterpart of
[gazu](https://github.com/cgwire/gazu): a client for the API of
[Kitsu](https://kitsu.cg-wire.com), the collaboration platform for animation
and VFX studios. It targets plugin and app authors: browsers, webviews
(Tauri, Electron) and Node 22 or later.

- No runtime dependency, ESM only, tree-shakeable.
- Same function names as gazu, in camelCase: `all*`, `get*`, `new*`,
  `update*`, `remove*`.
- Every client is isolated: its own session, requests and event socket.
- Typed: declarations are generated from the JSDoc of the sources.

[![Discord](https://badgen.net/badge/icon/discord?icon=discord&label)](https://discord.com/invite/VbCxtKN)

## Install

```bash
npm i @cgwire/kitsu-client
# only if you listen to real-time events:
npm i socket.io-client
```

## Quick start

With a bot token, the recommended mode for integrations:

```js
import { createClient } from '@cgwire/kitsu-client'

const kitsu = createClient({ host: 'https://kitsu.mystudio.com/api' })
kitsu.setToken(process.env.KITSU_TOKEN)

const projects = await kitsu.project.allOpenProjects()
const shots = await kitsu.shot.allShotsForProject(projects[0])
const tasks = await kitsu.task.allTasksForShot(shots[0])
```

With user credentials, two-factor authentication included:

```js
import { createClient, MissingOtpError } from '@cgwire/kitsu-client'

const kitsu = createClient({
  host: 'https://kitsu.mystudio.com/api',
  tokens: loadTokens(), // resume a session
  onTokensChange: saveTokens, // persist them, in the OS keychain for instance
  onUnauthorized: showLoginScreen // the session is lost for good
})

try {
  await kitsu.logIn(email, password)
} catch (err) {
  if (!(err instanceof MissingOtpError)) throw err
  // err.preferredMethod and err.enabledMethods tell which field to show
  await kitsu.logIn(email, password, { totp: await askForCode() })
}

const myTasks = await kitsu.user.allTasksToDo()
```

An expired access token is refreshed once, whatever the number of requests
that hit the 401 at the same time, and each of them is replayed once.

Web apps served by Kitsu itself use the session cookie instead:
`createClient({ host: '/api', auth: 'cookie' })`.

## One client, one session

Nothing is shared between two clients: tokens, in-flight requests and the
event socket all belong to the instance. Two clients can talk to two servers,
or to the same server under two accounts. `kitsu.close()` aborts the
in-flight requests and closes the socket.

## Conventions

- **Entity arguments** accept the entity object or its id:
  `kitsu.task.getTask(task)` and `kitsu.task.getTask(task.id)` are the same.
  Anything that is not a UUID is rejected before any request.
- **Required arguments are positional**, in the same order as gazu. Optional
  ones go in one trailing options object, which also takes an `AbortSignal`:
  `kitsu.task.allTasksForShot(shot, { relations: true, signal })`.
- **Returned values are the raw dicts of the API**, with snake_case keys.
- **`get*` of a single entity resolves to `null` when it does not exist.**
- **Functions never throw synchronously**: a wrong argument is a rejected
  promise. They never mutate their arguments.

## Errors

Every error extends `KitsuError` and carries `status`, `path`, `method` and
`body` (the parsed answer of the API).

| Condition             | Error                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------- |
| 400                   | `ParameterError` (also thrown for a malformed argument)                                                       |
| 401                   | `NotAuthenticatedError`                                                                                       |
| refused `logIn`       | `AuthFailedError`, or `MissingOtpError`, `WrongOtpError`, `TooManyLoginAttemptsError`, `DefaultPasswordError` |
| 403                   | `NotAllowedError`                                                                                             |
| 404                   | `NotFoundError`                                                                                               |
| 413                   | `TooBigFileError`                                                                                             |
| 5xx                   | `ServerError`                                                                                                 |
| no answer             | `NetworkError`, `TimeoutError`                                                                                |
| `signal` or `close()` | the native `AbortError`                                                                                       |
| 2xx that is not JSON  | `KitsuError` (usually a host given without its `/api` suffix)                                                 |

Regular calls are bounded: 60 s to the first byte, 5 min in total
(`timeout: { response, deadline }`, `0` disables a timer). Uploads are not
bounded at all and downloads only to the first byte: multi-GB movies are
legitimate. Cancel them with a `signal`.

## Working files

The server owns the paths: they come from the file tree of the project.

```js
const path = await kitsu.files.buildWorkingFilePath(task, {
  software,
  sep: '/'
})
const workingFile = await kitsu.files.newWorkingFile(task, {
  software,
  comment: 'Blocking pass'
})
```

## Uploads and downloads

The client takes and returns data, it never touches the disk: uploads take a
`Blob` or a `File`, downloads resolve to the `Response`.

```js
const { comment, preview_file } = await kitsu.task.publishPreview(
  task,
  taskStatus,
  file,
  { comment: 'First pass', onProgress: ({ loaded, total }) => {} }
)
```

`onProgress` needs `XMLHttpRequest` (browsers and webviews): `fetch` cannot
report upload progress. In Node, write a download to disk yourself:

```js
import { createWriteStream } from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const response = await kitsu.files.downloadPreviewFile(previewFile)
await pipeline(Readable.fromWeb(response.body), createWriteStream('shot.mp4'))
```

In a Tauri app, pass the `fetch` of the http plugin so requests are not
subject to CORS: `createClient({ host, fetch })`.

## Real-time events

```js
import { io } from 'socket.io-client'

const kitsu = createClient({ host, io }) // or let the client import it
const off = await kitsu.events.on('task:update', ({ task_id }) => {})
kitsu.events.onConnect(() => reloadWhatMayHaveChanged())
off()
```

The socket opens on the first `on()`. Handlers stay registered until their
`off()`: after `disconnect()` or a network loss they are attached again to the
next socket. Zou does not replay the events missed while offline, hence
`onConnect`. `logIn`, `logOut` and `setToken` replace the socket, so it never
outlives the session it was opened for.

## Utilities

Pure functions, importable on their own from `@cgwire/kitsu-client/utils`:

- sorting in the canonical Kitsu order: `sortAssets`, `sortShots`,
  `sortTasks`, `sortTaskStatuses`, `sortPeople`, `sortByName`... They return
  new arrays;
- frames and timecodes: `frameToSeconds`, `formatToTimecode`, `roundToFrame`...
- previews: `isMoviePreview`, `isPicturePreview`, `formatRevision`...
- Kitsu web URLs: `getProjectUrl`, `getShotUrl`, `getTaskUrl`... The
  namespaces expose the same names, loading what the URL needs:
  `await kitsu.shot.getShotUrl(shot)`.

## Smaller bundles

`createClient` wires every namespace. To ship only what you use, compose the
core with the namespaces you need:

```js
import { createCore } from '@cgwire/kitsu-client/core'
import { taskApi } from '@cgwire/kitsu-client/task'

const core = createCore({ host: '/api', auth: 'cookie' })
const task = taskApi(core.http)
```

## Kitsu web app coverage

`docs/kitsu-store-api-mapping.json` maps every API function of the Kitsu web
app to the client function covering it. `tests/mapping.spec.js` fails when a
mapped function does not exist.

## Development

```bash
npm run check        # eslint, prettier, type declarations, tests
npm run sync-routes  # regenerate tests/fixtures/zou_routes.json from ../zou
npm run test:live    # read-only smoke test: KITSU_HOST and KITSU_TOKEN
```

Tests inject a fake `fetch`. It rejects any path that Zou does not serve
(`tests/fixtures/zou_routes.json`), so an invented route fails its test. Known
gap: a wrong path shaped like `/data/tasks/open` cannot be told apart from the
CRUD route `/data/tasks/<id>`.

## Contributing

Bug reports go to the
[issue page](https://github.com/cgwire/kitsu-client-js/issues) of this
repository, feature requests to our [Canny page](https://cgwire.canny.io/).
Pull requests follow the [C4 contract](https://rfc.zeromq.org/spec/42/).

## About authors

Kitsu is written by CGWire, a company based in France. We help animation and
VFX studios to collaborate better through efficient tooling. Visit
[cg-wire.com](https://cg-wire.com) for more information.
