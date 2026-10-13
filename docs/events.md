# Real-time events

```js
import { io } from 'socket.io-client'

const kitsu = createClient({ host, io }) // or let the client import it
const off = await kitsu.events.on('task:update', ({ task_id }) => {})
kitsu.events.onConnect(() => reloadWhatMayHaveChanged())
kitsu.events.onConnectError(err => console.warn(err.message))
off()
```

The socket opens on the first `on()`. Handlers stay registered until their
`off()`: after `disconnect()` or a network loss they are attached again to the
next socket. Zou does not replay the events missed while offline, hence
`onConnect`. `onConnectError` hears the connection attempts that fail: Zou out
of reach, a handshake that a browser blocks, a namespace that Zou does not
serve. socket.io keeps retrying by itself, except after that last one: the
next `on()` opens a new socket then. A handshake that Zou refuses, for its
token or its cookie, ends in `onDisconnect` with `"io server disconnect"`.

`logIn`, `logOut` and `setToken` replace the socket, in cookie mode too, so it
never outlives the session it was opened for. A socket that `on()` asked for
opens again as soon as the new session can authenticate it: a `logIn` reopens
a socket that Zou refused or that `logOut` closed.

When Zou refuses the token of the socket while the session holds a refresh
token, the client checks the session with a request. An expired access token
is renewed on the way, as for any request, and the socket reopens with the new
one; a refresh that Zou refuses calls `onUnauthorized`. A token that the API
still accepts leaves the socket closed until the next session change.
