# Real-time events

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
