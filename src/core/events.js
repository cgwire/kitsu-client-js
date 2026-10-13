import { KitsuError, NotAuthenticatedError, ParameterError } from './errors.js'

/**
 * @typedef {(...args: any[]) => void} EventHandler
 * @typedef {() => void} Off Removes the handler it was returned for.
 */

// socket.io never reconnects by itself after this reason. Zou closes the
// connection that way when it rejects the token.
const CLOSED_BY_SERVER = 'io server disconnect'

// The specifier is a variable so bundlers do not try to resolve an optional
// peer dependency at build time.
const importIo = async () => {
  const specifier = 'socket.io-client'
  const module = await import(/* @vite-ignore */ specifier)
  return module.io || module.default
}

const handlerOf = (label, handler) => {
  if (typeof handler === 'function') return handler
  throw new ParameterError(`${label}: the handler must be a function`)
}

// As for a request: only an answer of the API tells about the session, not
// a network failure, a timeout or an outage.
const isAuthFailure = err =>
  err instanceof NotAuthenticatedError ||
  (err instanceof KitsuError && err.status >= 400 && err.status < 500)

/**
 * Per-instance real-time events: one lazy socket, on the "/events" namespace
 * of eventHost. Registrations live here, not on the socket: they last until
 * their off(), whatever happens to the connection.
 * @param {object} deps
 * @param {string} deps.eventHost Origin of the socket, without trailing slash.
 * @param {ReturnType<typeof import('./session.js').createSession>} deps.session
 * @param {Function|null} [deps.io] The socket.io-client "io" function.
 * @param {() => Promise<any>} [deps.probe] An authenticated request: it
 *   renews an expired token or reports a lost session, as any request does.
 * @param {() => Function|Promise<Function>} [deps.loadIo] Internal seam:
 *   how "io" is loaded when it is not given.
 */
export const createEvents = ({
  eventHost,
  session,
  io,
  probe = async () => {},
  loadIo = importIo
}) => {
  if (io !== undefined && io !== null && typeof io !== 'function') {
    throw new TypeError(
      'createClient: io must be the "io" function of socket.io-client'
    )
  }
  const registrations = new Set()
  const lifecycle = {
    connect: new Set(),
    disconnect: new Set(),
    connectError: new Set()
  }
  let ioImpl = null
  let loading = null
  let socket = null
  let openedIn = null
  // True from an on() to the next disconnect(): whether a socket closed
  // behind the back of the app (session change, server) may reopen.
  let wanted = false
  // True from an opening that threw to the next on().
  let failed = false
  // The session generation in which a refused token was checked, until a
  // socket connects: a token refused again waits for another change.
  let renewedIn = null

  // Single flight, kept once loaded. A failure is forgotten, so a later on()
  // tries again: in a browser the import is a network request.
  const load = () => {
    if (!loading) {
      loading = Promise.resolve()
        .then(() => io || loadIo())
        .then(loaded => {
          if (typeof loaded !== 'function') {
            throw new Error('the module exports no io function')
          }
          ioImpl = loaded
          return loaded
        })
        .catch(err => {
          loading = null
          throw new Error(
            'Kitsu events need socket.io-client: run ' +
              '"npm i socket.io-client" or pass its io function to ' +
              `createClient({ io }) (${err.message})`
          )
        })
    }
    return loading
  }

  // Failures that happen behind the back of the app (one of its lifecycle
  // handlers, a socket reopened after a session change) have no caller to
  // reject: they surface as uncaught errors, and never break the session
  // change or the socket.io emit loop they happened in.
  const throwOutOfBand = err => {
    setTimeout(() => {
      throw err
    })
  }

  const notify = (handlers, ...args) =>
    [...handlers].forEach(handler => {
      try {
        handler(...args)
      } catch (err) {
        throwOutOfBand(err)
      }
    })

  const wire = (opened, headers) => {
    let sent = headers.Authorization
    // Browsers only send extraHeaders on the polling handshake, which is
    // where Zou authenticates: keep the default transports.
    opened.io.on('reconnect_attempt', () => {
      const renewed = session.headers()
      opened.io.opts.extraHeaders = renewed
      sent = renewed.Authorization
    })
    opened.on('connect', () => {
      renewedIn = null
      notify(lifecycle.connect)
    })
    opened.on('disconnect', reason => {
      if (socket === opened && reason === CLOSED_BY_SERVER) {
        socket = null
        // The token was renewed while the rejected handshake was in flight:
        // no token change is left to come and reopen the socket. One shot:
        // the new socket sends the current token.
        if (session.headers().Authorization !== sent) reopen()
        else renew()
      }
      notify(lifecycle.disconnect, reason)
    })
    opened.on('connect_error', err => {
      // Refused by the server (a namespace it does not serve, for instance),
      // the socket is destroyed and never retries: forgotten, the next on()
      // opens another. socket.io retries any other failure by itself.
      if (socket === opened && opened.active === false) socket = null
      notify(lifecycle.connectError, err)
    })
    registrations.forEach(({ name, relay }) => opened.on(name, relay))
  }

  // The socket is only kept once fully wired: a failure leaves no broken
  // socket behind for the next on() to reuse.
  const open = () => {
    let opened = null
    try {
      // forceNew: io() caches its managers per host and a manager carries
      // the headers, so a shared one would leak a token to another instance.
      const headers = session.headers()
      opened = ioImpl(`${eventHost}/events`, {
        forceNew: true,
        extraHeaders: headers
      })
      wire(opened, headers)
    } catch (err) {
      failed = true
      try {
        if (opened && typeof opened.disconnect === 'function') {
          opened.disconnect()
        }
      } catch {
        // Already unusable: the opening error is the one to report.
      }
      throw err
    }
    socket = opened
    openedIn = session.generation()
  }

  // Behind the back of the app, only with credentials: a bearer token, or
  // in cookie mode the cookie of a logIn. Not after a failed opening either:
  // retrying on every session change would fail the same way.
  const reopen = () => {
    if (wanted && !failed && ioImpl && session.canAuthenticate()) {
      try {
        open()
      } catch (err) {
        throwOutOfBand(err)
      }
    }
  }

  // Zou refused the current token. A request tells why: an expired token is
  // renewed on the way, and the new one reopens the socket (syncSession); a
  // refused refresh reports a lost session. A token the API still accepts
  // (the socket got a stale Kitsu cookie, a two-factor setup is pending)
  // leaves the socket closed. Without an answer of the API, the next refusal
  // tries again.
  const renew = () => {
    const generation = session.generation()
    if (!wanted || renewedIn === generation || !session.canRefresh()) return
    renewedIn = generation
    probe().catch(err => {
      if (!isAuthFailure(err) && renewedIn === generation) renewedIn = null
    })
  }

  // Forgotten before it is closed: a disconnect handler that calls back
  // into the events finds them already without a socket.
  const drop = () => {
    const former = socket
    socket = null
    if (former) former.disconnect()
  }

  const connect = async () => {
    wanted = true
    failed = false
    await load()
    // disconnect() or close() may have landed during the load, and another
    // on() may have opened the socket already.
    if (wanted && !socket) open()
  }

  const subscribe = (handlers, handler) => {
    handlers.add(handler)
    return () => {
      handlers.delete(handler)
    }
  }

  return {
    /**
     * Listen to an event of Zou ("task:update", ...). The first call loads
     * socket.io-client and connects. The handler stays registered until its
     * off(): it follows the socket through reconnections, session changes
     * and a disconnect() followed by another on().
     * @param {string} name
     * @param {EventHandler} handler
     * @returns {Promise<Off>}
     */
    on: async (name, handler) => {
      if (typeof name !== 'string' || !name) {
        throw new ParameterError('events.on: the event name is required')
      }
      const target = handlerOf('events.on', handler)
      // One relay per registration: the same handler can be registered
      // twice, and each off() removes its own registration only.
      const registration = { name, relay: (...args) => target(...args) }
      const off = () => {
        if (registrations.delete(registration) && socket) {
          socket.off(name, registration.relay)
        }
      }
      registrations.add(registration)
      if (socket) socket.on(name, registration.relay)
      try {
        await connect()
      } catch (err) {
        off()
        throw err
      }
      return off
    },

    /**
     * Called on every connection and reconnection. Zou does not replay the
     * events missed during an outage: this is where an app reloads its data.
     * @param {() => void} handler
     * @returns {Off}
     */
    onConnect: handler =>
      subscribe(lifecycle.connect, handlerOf('events.onConnect', handler)),

    /**
     * Called with the socket.io reason whenever the connection is lost or
     * closed. After "io server disconnect" (Zou rejected the token) the
     * client checks the session with a request: an expired token is renewed
     * and the socket reopens. Otherwise the socket reopens at the next
     * session change, or tries again at the next on().
     * @param {(reason: string) => void} handler
     * @returns {Off}
     */
    onDisconnect: handler =>
      subscribe(
        lifecycle.disconnect,
        handlerOf('events.onDisconnect', handler)
      ),

    /**
     * Called with the error of every failed connection attempt: Zou cannot
     * be reached, a browser blocks the handshake (see the platforms of
     * docs/events.md), or Zou refuses the namespace. socket.io retries by
     * itself, except after a refusal: the next on() opens a new socket.
     * @param {(error: Error) => void} handler
     * @returns {Off}
     */
    onConnectError: handler =>
      subscribe(
        lifecycle.connectError,
        handlerOf('events.onConnectError', handler)
      ),

    /**
     * Close the socket. Handlers stay registered: a later on() reconnects
     * with all of them.
     */
    disconnect: () => {
      wanted = false
      drop()
    },

    /**
     * For the core, on every change of the session or of its tokens. A
     * socket never outlives the session it was opened under (logIn, logOut
     * and setToken replace it, in cookie mode too); a token refresh keeps the
     * session, so it keeps the socket too. A wanted socket reopens as soon as
     * the session can authenticate it.
     */
    syncSession: () => {
      if (socket && openedIn !== session.generation()) drop()
      if (!socket) reopen()
    }
  }
}
