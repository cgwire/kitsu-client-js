import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createEvents } from '../../src/core/events.js'
import { ParameterError, createCore } from '../../src/core/index.js'
import { createSession } from '../../src/core/session.js'
import { createFakeFetch } from '../helpers/fakeFetch.js'
import { HOST } from '../helpers/ids.js'

const CLOSED_BY_SERVER = 'io server disconnect'

// socket.io double. It models what the events rely on: a lost connection and
// disconnect() only fire "disconnect" on a connected socket, whereas the
// server can close one that is still in its handshake; and a socket closed by
// disconnect() or by the server is destroyed: it receives nothing more and
// never reconnects.
const createFakeIo = () => {
  const sockets = []
  const io = vi.fn((url, opts) => {
    const listeners = new Map()
    const managerListeners = new Map()
    const state = { connected: false, destroyed: false }
    const emit = (name, ...args) =>
      [...(listeners.get(name) || [])].forEach(fn => fn(...args))
    const close = (reason, destroyed) => {
      const heard = state.connected || reason === CLOSED_BY_SERVER
      state.connected = false
      state.destroyed = state.destroyed || destroyed
      if (heard) emit('disconnect', reason)
    }
    const socket = {
      url,
      opts,
      on: (name, fn) =>
        listeners.set(name, [...(listeners.get(name) || []), fn]),
      off: (name, fn) =>
        listeners.set(
          name,
          (listeners.get(name) || []).filter(entry => entry !== fn)
        ),
      listenerCount: name => (listeners.get(name) || []).length,
      isOpen: () => !state.destroyed,
      disconnect: vi.fn(() => close('io client disconnect', true)),
      connects: () => {
        state.connected = true
        emit('connect')
      },
      drops: reason => close(reason, reason === CLOSED_BY_SERVER),
      fromServer: (name, ...args) => {
        if (!state.destroyed) emit(name, ...args)
      },
      io: {
        opts,
        on: (name, fn) => managerListeners.set(name, fn),
        trigger: name => managerListeners.get(name)()
      }
    }
    sockets.push(socket)
    return socket
  })
  return { io, sockets }
}

const deferred = () => {
  const handles = {}
  const promise = new Promise((resolve, reject) =>
    Object.assign(handles, { resolve, reject })
  )
  return { promise, ...handles }
}

const makeCore = (io, extra = {}) =>
  createCore({
    host: HOST,
    fetch: createFakeFetch(),
    tokens: { access_token: 'token' },
    io,
    ...extra
  })

// A resumed session whose access token expired: the first API call renews it.
const makeExpiredCore = io =>
  makeCore(io, {
    fetch: createFakeFetch()
      .reply(401, {})
      .reply(200, { access_token: 'renewed' })
      .reply(200, { user: { id: 'u' } }),
    tokens: { access_token: 'expired', refresh_token: 'refresh' }
  })

// Straight on createEvents, for the internal loadIo seam: the public options
// have no way to make the loading of socket.io-client slow or failing.
const makeEvents = deps =>
  createEvents({
    eventHost: 'http://kitsu.test',
    session: createSession({ tokens: { access_token: 'token' } }),
    ...deps
  })

describe('events', () => {
  describe('connection', () => {
    it('connects lazily to /events on the host without /api, with the bearer token', async () => {
      const { io, sockets } = createFakeIo()
      const kitsu = makeCore(io)
      expect(io).not.toHaveBeenCalled()

      await kitsu.events.on('task:update', () => {})

      expect(io).toHaveBeenCalledTimes(1)
      expect(sockets[0].url).toBe('http://kitsu.test/events')
      expect(sockets[0].opts.extraHeaders).toEqual({
        Authorization: 'Bearer token'
      })
    })

    it.each([
      ['http://events.test', 'http://events.test/events'],
      ['http://events.test/', 'http://events.test/events']
    ])('honours eventHost %s', async (eventHost, url) => {
      const { io, sockets } = createFakeIo()
      await makeCore(io, { eventHost }).events.on('x', () => {})
      expect(sockets[0].url).toBe(url)
    })

    it('connects to the same origin for a relative host', async () => {
      const { io, sockets } = createFakeIo()
      await makeCore(io, { host: '/api' }).events.on('x', () => {})
      expect(sockets[0].url).toBe('/events')
    })

    it('sends no header in cookie mode', async () => {
      const { io, sockets } = createFakeIo()
      await makeCore(io, { auth: 'cookie' }).events.on('x', () => {})
      expect(sockets[0].opts.extraHeaders).toEqual({})
    })

    it('shares one socket between listeners of the same instance, never across instances', async () => {
      const { io, sockets } = createFakeIo()
      const a = makeCore(io)
      const b = makeCore(io)
      await Promise.all([
        a.events.on('x', () => {}),
        a.events.on('y', () => {})
      ])
      await a.events.on('z', () => {})
      await b.events.on('x', () => {})
      expect(io).toHaveBeenCalledTimes(2)
      // io() caches its managers per host, and a manager carries the headers.
      expect(sockets.map(socket => socket.opts.forceNew)).toEqual([true, true])
    })

    it('rejects an io option that is not a function at creation', () => {
      expect(() => makeCore('socket.io-client')).toThrow(TypeError)
    })
  })

  describe('handlers', () => {
    it('delivers events and stops after off()', async () => {
      const { io, sockets } = createFakeIo()
      const handler = vi.fn()
      const off = await makeCore(io).events.on('task:update', handler)
      sockets[0].fromServer('task:update', { task_id: 't1' })
      off()
      off()
      sockets[0].fromServer('task:update', { task_id: 't2' })
      expect(handler.mock.calls).toEqual([[{ task_id: 't1' }]])
      expect(sockets[0].listenerCount('task:update')).toBe(0)
    })

    it('removes one registration per off(), even for the same handler', async () => {
      const { io, sockets } = createFakeIo()
      const { events } = makeCore(io)
      const handler = vi.fn()
      const offFirst = await events.on('x', handler)
      await events.on('x', handler)
      offFirst()
      offFirst()
      sockets[0].fromServer('x', 1)
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('rejects bad arguments instead of throwing', async () => {
      const { io } = createFakeIo()
      const { events } = makeCore(io)
      const results = []
      expect(() => {
        results.push(
          events.on('', () => {}),
          events.on('x', 'handler')
        )
      }).not.toThrow()
      await expect(results[0]).rejects.toBeInstanceOf(ParameterError)
      await expect(results[1]).rejects.toBeInstanceOf(ParameterError)
      expect(io).not.toHaveBeenCalled()
      expect(() => events.onConnect(null)).toThrow(ParameterError)
      expect(() => events.onDisconnect('handler')).toThrow(ParameterError)
    })

    it('notifies connect and disconnect, even when registered before connecting', async () => {
      const { io, sockets } = createFakeIo()
      const kitsu = makeCore(io)
      const onConnect = vi.fn()
      const onDisconnect = vi.fn()
      const offConnect = kitsu.events.onConnect(onConnect)
      kitsu.events.onDisconnect(onDisconnect)
      await kitsu.events.on('x', () => {})
      sockets[0].connects()
      sockets[0].drops('transport close')
      offConnect()
      sockets[0].connects()
      expect(onConnect).toHaveBeenCalledTimes(1)
      expect(onDisconnect.mock.calls).toEqual([['transport close']])
    })

    it('keeps the socket through an outage: socket.io reconnects it itself', async () => {
      const { io, sockets } = createFakeIo()
      const kitsu = makeCore(io)
      const handler = vi.fn()
      await kitsu.events.on('x', handler)
      sockets[0].connects()
      sockets[0].drops('transport close')
      sockets[0].connects()
      await kitsu.events.on('y', () => {})
      sockets[0].fromServer('x', 1)
      expect(io).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith(1)
    })
  })

  describe('disconnect and close', () => {
    it('close() disconnects the socket', async () => {
      const { io, sockets } = createFakeIo()
      const kitsu = makeCore(io)
      const onDisconnect = vi.fn()
      kitsu.events.onDisconnect(onDisconnect)
      await kitsu.events.on('x', () => {})
      sockets[0].connects()
      kitsu.close()
      kitsu.close()
      expect(sockets[0].disconnect).toHaveBeenCalledTimes(1)
      expect(onDisconnect.mock.calls).toEqual([['io client disconnect']])
    })

    it('disconnect() without a socket does nothing', () => {
      const { io } = createFakeIo()
      expect(() => makeCore(io).events.disconnect()).not.toThrow()
      expect(io).not.toHaveBeenCalled()
    })

    it('reconnects at a later on(), with the handlers still registered', async () => {
      const { io, sockets } = createFakeIo()
      const { events } = makeCore(io)
      const kept = vi.fn()
      const removed = vi.fn()
      await events.on('x', kept)
      const off = await events.on('x', removed)
      events.disconnect()
      // off() after disconnect(): nothing to detach, and no comeback.
      expect(off).not.toThrow()

      const late = vi.fn()
      await events.on('y', late)

      expect(io).toHaveBeenCalledTimes(2)
      sockets[0].fromServer('x', 'former socket')
      sockets[1].fromServer('x', 1)
      sockets[1].fromServer('y', 2)
      expect(kept.mock.calls).toEqual([[1]])
      expect(late.mock.calls).toEqual([[2]])
      expect(removed).not.toHaveBeenCalled()
    })

    it('opens no socket when close() lands while the connection loads', async () => {
      const { io } = createFakeIo()
      const kitsu = makeCore(io)
      const pending = kitsu.events.on('x', () => {})
      kitsu.close()
      expect(await pending).toBeInstanceOf(Function)
      expect(io).not.toHaveBeenCalled()
    })

    it('keeps the handler of an on() interrupted by disconnect() for the next connection', async () => {
      const { io, sockets } = createFakeIo()
      const loading = deferred()
      const events = makeEvents({ loadIo: () => loading.promise })
      const handler = vi.fn()
      const pending = events.on('x', handler)
      events.disconnect()
      loading.resolve(io)
      await pending
      expect(io).not.toHaveBeenCalled()

      await events.on('y', () => {})
      sockets[0].fromServer('x', 1)
      expect(io).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith(1)
    })

    it('loads and connects once when on() follows disconnect() during the load', async () => {
      const { io, sockets } = createFakeIo()
      const loading = deferred()
      const loadIo = vi.fn(() => loading.promise)
      const events = makeEvents({ loadIo })
      const first = vi.fn()
      const second = vi.fn()
      const pending = [events.on('x', first)]
      events.disconnect()
      pending.push(events.on('x', second))
      loading.resolve(io)
      await Promise.all(pending)

      sockets[0].fromServer('x', 1)
      expect(loadIo).toHaveBeenCalledTimes(1)
      expect(io).toHaveBeenCalledTimes(1)
      expect([first.mock.calls, second.mock.calls]).toEqual([[[1]], [[1]]])
    })

    it('does not attach a handler removed while the connection loads', async () => {
      const { io, sockets } = createFakeIo()
      const loading = deferred()
      const events = makeEvents({ loadIo: () => loading.promise })
      const removed = events.on('x', () => {})
      const kept = events.on('y', () => {})
      loading.resolve(io)
      ;(await removed)()
      await kept
      expect(sockets[0].listenerCount('x')).toBe(0)
      expect(sockets[0].listenerCount('y')).toBe(1)
    })
  })

  describe('session', () => {
    it('picks a refreshed token on reconnection attempts, on the same socket', async () => {
      const { io, sockets } = createFakeIo()
      const fetch = createFakeFetch()
        .reply(200, { access_token: 'first', refresh_token: 'refresh' })
        .reply(401, {})
        .reply(200, { access_token: 'renewed' })
        .reply(200, { user: { id: 'u' } })
      const kitsu = makeCore(io, { fetch, tokens: null })
      // Not the first session of the instance: a refresh keeps the session,
      // whichever it is.
      await kitsu.logIn('user@kitsu.test', 'password')
      await kitsu.events.on('x', () => {})
      await kitsu.getCurrentUser()
      sockets[0].io.trigger('reconnect_attempt')
      expect(io).toHaveBeenCalledTimes(1)
      expect(sockets[0].disconnect).not.toHaveBeenCalled()
      expect(sockets[0].io.opts.extraHeaders).toEqual({
        Authorization: 'Bearer renewed'
      })
    })

    it('replaces the socket of a former session, handlers included', async () => {
      const { io, sockets } = createFakeIo()
      const kitsu = makeCore(io)
      const handler = vi.fn()
      await kitsu.events.on('x', handler)

      kitsu.setToken('other')

      expect(sockets[0].disconnect).toHaveBeenCalledTimes(1)
      expect(sockets).toHaveLength(2)
      expect(sockets[1].opts.extraHeaders).toEqual({
        Authorization: 'Bearer other'
      })
      sockets[0].fromServer('x', 'former session')
      sockets[1].fromServer('x', 1)
      expect(handler.mock.calls).toEqual([[1]])
    })

    it('closes the socket on logOut and reopens it on logIn', async () => {
      const { io, sockets } = createFakeIo()
      const fetch = createFakeFetch()
        .reply(200, { logout: true })
        .reply(200, { user: { id: 'u' }, access_token: 'second' })
      const kitsu = makeCore(io, { fetch })
      const handler = vi.fn()
      await kitsu.events.on('x', handler)

      await kitsu.logOut()
      expect(sockets[0].disconnect).toHaveBeenCalledTimes(1)
      expect(sockets).toHaveLength(1)

      await kitsu.logIn('user@kitsu.test', 'password')
      expect(sockets).toHaveLength(2)
      expect(sockets[1].opts.extraHeaders).toEqual({
        Authorization: 'Bearer second'
      })
      sockets[1].fromServer('x', 1)
      expect(handler.mock.calls).toEqual([[1]])
    })

    it('stays closed through a session change after disconnect()', async () => {
      const { io, sockets } = createFakeIo()
      const kitsu = makeCore(io)
      await kitsu.events.on('x', () => {})
      kitsu.events.disconnect()
      kitsu.setToken('other')
      expect(sockets).toHaveLength(1)
    })

    it('opens one socket, for the new session, when it changes during the load', async () => {
      const { io, sockets } = createFakeIo()
      const kitsu = makeCore(io)
      const pending = kitsu.events.on('x', () => {})
      kitsu.setToken('other')
      await pending
      expect(sockets).toHaveLength(1)
      expect(sockets[0].opts.extraHeaders).toEqual({
        Authorization: 'Bearer other'
      })
      // Opened under the current session: the next change replaces it.
      kitsu.setToken('third')
      expect(sockets[0].disconnect).toHaveBeenCalledTimes(1)
      expect(sockets).toHaveLength(2)
    })

    it('in cookie mode closes on logOut and reconnects at the next on()', async () => {
      const { io, sockets } = createFakeIo()
      const fetch = createFakeFetch().reply(200, { logout: true })
      const kitsu = makeCore(io, { fetch, auth: 'cookie', tokens: null })
      await kitsu.events.on('x', () => {})
      await kitsu.logOut()
      expect(sockets[0].disconnect).toHaveBeenCalledTimes(1)
      expect(sockets).toHaveLength(1)
      await kitsu.events.on('y', () => {})
      expect(sockets).toHaveLength(2)
    })

    it('keeps calling the onTokensChange given at creation', () => {
      const { io } = createFakeIo()
      const onTokensChange = vi.fn()
      const options = {
        host: HOST,
        fetch: createFakeFetch(),
        io,
        onTokensChange
      }
      const kitsu = createCore(options)
      options.onTokensChange = vi.fn()
      kitsu.setToken('other')
      expect(onTokensChange).toHaveBeenCalledWith({ access_token: 'other' })
      expect(options.onTokensChange).not.toHaveBeenCalled()
    })
  })

  // An exception of the app must not break the session, the socket or the
  // other handlers: it is rethrown out of band, from a timer.
  describe('lifecycle handler that throws', () => {
    const bug = () => {
      throw new Error('handler bug')
    }

    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('replaces the socket of a former session and persists the tokens', async () => {
      const { io, sockets } = createFakeIo()
      const onTokensChange = vi.fn()
      const kitsu = makeCore(io, { onTokensChange })
      const handler = vi.fn()
      kitsu.events.onDisconnect(bug)
      await kitsu.events.on('x', handler)
      sockets[0].connects()

      expect(() => kitsu.setToken('other')).not.toThrow()

      expect(onTokensChange).toHaveBeenCalledWith({ access_token: 'other' })
      expect(sockets).toHaveLength(2)
      sockets[1].fromServer('x', 1)
      expect(handler.mock.calls).toEqual([[1]])
      expect(() => vi.runAllTimers()).toThrow('handler bug')
    })

    it('lets logIn resolve and reopen the socket', async () => {
      const { io, sockets } = createFakeIo()
      const fetch = createFakeFetch().reply(200, {
        user: { id: 'u' },
        access_token: 'second'
      })
      const kitsu = makeCore(io, { fetch })
      kitsu.events.onDisconnect(bug)
      await kitsu.events.on('x', () => {})
      sockets[0].connects()

      const body = await kitsu.logIn('user@kitsu.test', 'password')

      expect(body.access_token).toBe('second')
      expect(sockets).toHaveLength(2)
      expect(sockets[1].opts.extraHeaders).toEqual({
        Authorization: 'Bearer second'
      })
      expect(() => vi.runAllTimers()).toThrow('handler bug')
    })

    it('lets close() abort the pending requests', async () => {
      const { io, sockets } = createFakeIo()
      const kitsu = makeCore(io)
      const abortAll = vi.spyOn(kitsu.http, 'abortAll')
      kitsu.events.onDisconnect(bug)
      await kitsu.events.on('x', () => {})
      sockets[0].connects()

      expect(() => kitsu.close()).not.toThrow()

      expect(sockets[0].disconnect).toHaveBeenCalledTimes(1)
      expect(abortAll).toHaveBeenCalledTimes(1)
      expect(() => vi.runAllTimers()).toThrow('handler bug')
    })

    it('still runs the handlers registered after it', async () => {
      const { io, sockets } = createFakeIo()
      const kitsu = makeCore(io)
      const onConnect = vi.fn()
      const onDisconnect = vi.fn()
      kitsu.events.onConnect(bug)
      kitsu.events.onConnect(onConnect)
      kitsu.events.onDisconnect(bug)
      kitsu.events.onDisconnect(onDisconnect)
      await kitsu.events.on('x', () => {})

      expect(() => sockets[0].connects()).not.toThrow()
      expect(() => sockets[0].drops('transport close')).not.toThrow()

      expect(onConnect).toHaveBeenCalledTimes(1)
      expect(onDisconnect.mock.calls).toEqual([['transport close']])
      expect(vi.getTimerCount()).toBe(2)
      expect(() => vi.runAllTimers()).toThrow('handler bug')
    })
  })

  describe('connection closed by the server', () => {
    // Zou closes the connection of a rejected token, and socket.io never
    // reconnects by itself after an "io server disconnect".
    it('opens a new socket at the next on(), handlers included', async () => {
      const { io, sockets } = createFakeIo()
      const kitsu = makeCore(io)
      const handler = vi.fn()
      const onDisconnect = vi.fn()
      kitsu.events.onDisconnect(onDisconnect)
      await kitsu.events.on('x', handler)
      sockets[0].connects()
      sockets[0].drops(CLOSED_BY_SERVER)
      expect(onDisconnect.mock.calls).toEqual([['io server disconnect']])

      await kitsu.events.on('y', () => {})

      expect(sockets).toHaveLength(2)
      sockets[1].fromServer('x', 1)
      expect(handler.mock.calls).toEqual([[1]])
    })

    it('reopens as soon as the token is renewed', async () => {
      const { io, sockets } = createFakeIo()
      const kitsu = makeExpiredCore(io)
      await kitsu.events.on('x', () => {})
      sockets[0].drops(CLOSED_BY_SERVER)

      await kitsu.getCurrentUser()

      expect(sockets).toHaveLength(2)
      expect(sockets[1].opts.extraHeaders).toEqual({
        Authorization: 'Bearer renewed'
      })
    })

    // The start of an app that resumes a session: on() and the first API
    // calls leave together, and the refresh lands during the handshake. No
    // token change is left to come and reopen the socket afterwards.
    it('reopens at once a handshake rejected for a token renewed since', async () => {
      const { io, sockets } = createFakeIo()
      const kitsu = makeExpiredCore(io)
      const handler = vi.fn()
      const onDisconnect = vi.fn()
      kitsu.events.onDisconnect(onDisconnect)
      await kitsu.events.on('x', handler)
      await kitsu.getCurrentUser()
      expect(sockets).toHaveLength(1)

      sockets[0].drops(CLOSED_BY_SERVER)

      expect(onDisconnect.mock.calls).toEqual([[CLOSED_BY_SERVER]])
      expect(sockets).toHaveLength(2)
      expect(sockets[1].opts.extraHeaders).toEqual({
        Authorization: 'Bearer renewed'
      })
      sockets[1].fromServer('x', 1)
      expect(handler.mock.calls).toEqual([[1]])

      // One shot: rejected with the current token, it waits for another one.
      sockets[1].drops(CLOSED_BY_SERVER)
      expect(sockets).toHaveLength(2)
    })

    it('does not reopen a reconnection rejected with the current token', async () => {
      const { io, sockets } = createFakeIo()
      const kitsu = makeExpiredCore(io)
      await kitsu.events.on('x', () => {})
      sockets[0].connects()
      await kitsu.getCurrentUser()
      sockets[0].drops('transport close')
      sockets[0].io.trigger('reconnect_attempt')

      sockets[0].drops(CLOSED_BY_SERVER)

      expect(sockets).toHaveLength(1)
    })

    it('stays closed when a disconnect handler answers the rejection with disconnect()', async () => {
      const { io, sockets } = createFakeIo()
      const kitsu = makeExpiredCore(io)
      kitsu.events.onDisconnect(() => kitsu.events.disconnect())
      await kitsu.events.on('x', () => {})
      await kitsu.getCurrentUser()

      sockets[0].drops(CLOSED_BY_SERVER)
      kitsu.setToken('other')

      expect(sockets.filter(socket => socket.isOpen())).toEqual([])
    })

    it('ignores the late disconnection of a socket already replaced', async () => {
      const { io, sockets } = createFakeIo()
      const kitsu = makeCore(io)
      await kitsu.events.on('x', () => {})
      sockets[0].connects()
      kitsu.setToken('other')
      sockets[1].connects()
      sockets[0].connects()
      sockets[0].drops(CLOSED_BY_SERVER)
      await kitsu.events.on('y', () => {})
      expect(sockets).toHaveLength(2)
    })
  })

  // A bad eventHost, a relative host in Node (socket.io reads location) or a
  // broken injected io.
  describe('socket that fails to open', () => {
    const explode = () => {
      throw new Error('io exploded')
    }

    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('rejects on() and leaves the session alone', async () => {
      const io = vi.fn(explode)
      const fetch = createFakeFetch().reply(200, {
        user: { id: 'u' },
        access_token: 'second'
      })
      const kitsu = makeCore(io, { fetch })
      await expect(kitsu.events.on('x', () => {})).rejects.toThrow(
        'io exploded'
      )

      expect(() => kitsu.setToken('other')).not.toThrow()
      const body = await kitsu.logIn('user@kitsu.test', 'password')

      expect(body.access_token).toBe('second')
      expect(io).toHaveBeenCalledTimes(1)
      expect(vi.getTimerCount()).toBe(0)
    })

    it('still replays the request that renewed the token', async () => {
      const kitsu = makeExpiredCore(vi.fn(explode))
      await kitsu.events.on('x', () => {}).catch(() => {})
      expect(await kitsu.getCurrentUser()).toEqual({ id: 'u' })
    })

    it('rejects every on() of the failed opening, and the next one tries again', async () => {
      const { io, sockets } = createFakeIo()
      io.mockImplementationOnce(explode).mockImplementationOnce(explode)
      const { events } = makeCore(io)
      const failed = vi.fn()
      const results = await Promise.all([
        events.on('x', failed).catch(err => err.message),
        events.on('y', failed).catch(err => err.message)
      ])
      expect(results).toEqual(['io exploded', 'io exploded'])

      const handler = vi.fn()
      await events.on('x', handler)

      sockets[0].fromServer('x', 1)
      sockets[0].fromServer('y', 1)
      expect(handler.mock.calls).toEqual([[1]])
      expect(failed).not.toHaveBeenCalled()
    })

    it('forgets a socket that came out of io() unusable', async () => {
      const { io, sockets } = createFakeIo()
      io.mockImplementationOnce(() => ({}))
      const { events } = makeCore(io)
      await expect(events.on('x', () => {})).rejects.toThrow(TypeError)
      await events.on('x', () => {})
      expect(sockets[0].listenerCount('x')).toBe(1)
    })

    it('reports a failed reopening out of band and waits for the next on()', async () => {
      const { io, sockets } = createFakeIo()
      const kitsu = makeCore(io)
      const handler = vi.fn()
      await kitsu.events.on('x', handler)
      io.mockImplementationOnce(explode)

      expect(() => kitsu.setToken('other')).not.toThrow()
      expect(() => vi.runAllTimers()).toThrow('io exploded')
      kitsu.setToken('third')
      expect(io).toHaveBeenCalledTimes(2)

      await kitsu.events.on('y', () => {})
      expect(sockets[1].opts.extraHeaders).toEqual({
        Authorization: 'Bearer third'
      })
      sockets[1].fromServer('x', 1)
      expect(handler.mock.calls).toEqual([[1]])
    })
  })

  describe('loading socket.io-client', () => {
    const missing = () =>
      Promise.reject(new Error("Cannot find package 'socket.io-client'"))

    it('names the install command when the package is missing', async () => {
      const events = makeEvents({ loadIo: missing })
      const failures = await Promise.all([
        events.on('x', () => {}).catch(err => err),
        events.on('y', () => {}).catch(err => err)
      ])
      failures.forEach(failure => {
        expect(failure).toBeInstanceOf(Error)
        expect(failure.message).toContain('npm i socket.io-client')
        expect(failure.message).toContain('Cannot find package')
      })
    })

    it('reports a loader that throws, or a module without io, the same way', async () => {
      const throwing = () => {
        throw new Error('sync failure')
      }
      await expect(
        makeEvents({ loadIo: throwing }).on('x', () => {})
      ).rejects.toThrow(/npm i socket\.io-client.*sync failure/)
      await expect(
        makeEvents({ loadIo: async () => undefined }).on('x', () => {})
      ).rejects.toThrow('npm i socket.io-client')
    })

    it('retries the load at the next on(), without the handlers that failed', async () => {
      const { io, sockets } = createFakeIo()
      const loadIo = vi.fn(missing)
      const events = makeEvents({ loadIo })
      const failed = vi.fn()
      await events.on('x', failed).catch(() => {})
      loadIo.mockImplementation(async () => io)

      const handler = vi.fn()
      await events.on('x', handler)

      expect(loadIo).toHaveBeenCalledTimes(2)
      sockets[0].fromServer('x', 1)
      expect(handler).toHaveBeenCalledWith(1)
      expect(failed).not.toHaveBeenCalled()
    })

    it('loads the package once for all the connections of an instance', async () => {
      const { io } = createFakeIo()
      const loadIo = vi.fn(async () => io)
      const events = makeEvents({ loadIo })
      await Promise.all([events.on('x', () => {}), events.on('y', () => {})])
      events.disconnect()
      await events.on('z', () => {})
      expect(loadIo).toHaveBeenCalledTimes(1)
      expect(io).toHaveBeenCalledTimes(2)
    })
  })
})
