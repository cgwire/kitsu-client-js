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

User credentials, two-factor authentication and cookie mode are covered in
[Authentication and sessions](./docs/authentication.md).

## Documentation

| Topic                                                                         | Page                                                    |
| ----------------------------------------------------------------------------- | ------------------------------------------------------- |
| Bot tokens, `logIn`, two-factor authentication, cookie mode, isolated clients | [Authentication and sessions](./docs/authentication.md) |
| Naming, arguments, returned values, error classes, timeouts                   | [Conventions and errors](./docs/conventions.md)         |
| Paths from the file tree, publishing previews, downloads, Tauri               | [Working files, uploads and downloads](./docs/files.md) |
| `kitsu.events.on('task:update', ...)`, reconnection                           | [Real-time events](./docs/events.md)                    |
| Sorting, frames, previews, URLs, composing only what you use                  | [Utilities and smaller bundles](./docs/utilities.md)    |
| Checks, route contract gate, coverage of the Kitsu web app                    | [Development](./docs/development.md)                    |

## Contributing

Bug reports go to the
[issue page](https://github.com/cgwire/kitsu-client-js/issues) of this
repository, feature requests to our [Canny page](https://cgwire.canny.io/).
Pull requests follow the [C4 contract](https://rfc.zeromq.org/spec/42/).

## About authors

Kitsu is written by CGWire, a company based in France. We help animation and
VFX studios to collaborate better through efficient tooling. Visit
[cg-wire.com](https://cg-wire.com) for more information.
