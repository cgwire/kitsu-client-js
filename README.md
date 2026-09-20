[![Kitsu](https://zou.cg-wire.com/kitsu.png)](https://kitsu.cg-wire.com)

# JavaScript client for Kitsu

`@cgwire/kitsu-client` is the JavaScript counterpart of
[gazu](https://github.com/cgwire/gazu): a client for the API of
[Kitsu](https://kitsu.cg-wire.com), the collaboration platform for animation
and VFX studios. It targets plugin and app authors: browsers, webviews
(Tauri, Electron) and Node 22 or later.

- Every client is isolated: its own session, requests and event socket.
- Same function names as gazu, in camelCase: `all*`, `get*`, `new*`,
  `update*`, `remove*`.
- Typed: declarations are generated from the JSDoc of the sources.
- No runtime dependency

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

- [Authentication and sessions](./docs/authentication.md)
- [Conventions and errors](./docs/conventions.md)
- [Working files, uploads and downloads](./docs/files.md)
- [Real-time events](./docs/events.md)
- [Utilities and smaller bundles](./docs/utilities.md)
- [Development](./docs/development.md)

## Contributing

Bug reports go to the
[issue page](https://github.com/cgwire/kitsu-client-js/issues) of this
repository, feature requests to our [Canny page](https://cgwire.canny.io/).
Pull requests follow the [C4 contract](https://rfc.zeromq.org/spec/42/).

## About authors

Kitsu is written by CGWire, a company based in France. We help animation and
VFX studios to collaborate better through efficient tooling. Visit
[cg-wire.com](https://cg-wire.com) for more information.

[![CGWire Logo](https://zou.cg-wire.com/cgwire.png)](https://cg-wire.com)
