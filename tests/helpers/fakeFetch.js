import { isKnownRoute } from './routeGate.js'

export const jsonResponse = (status, body, headers = {}) =>
  new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  })

const parseBody = body => {
  if (typeof body !== 'string') return body || undefined
  try {
    return JSON.parse(body)
  } catch {
    return body
  }
}

export const createFakeFetch = () => {
  const calls = []
  const queue = []
  const routes = new Map()

  const fake = async (url, init = {}) => {
    const { pathname, searchParams } = new URL(url)
    const path = pathname.replace(/^\/api/, '').replace(/\/$/, '') || '/'
    if (!isKnownRoute(path))
      throw new Error(`fakeFetch: unknown Zou route ${path}`)
    const call = {
      method: init.method || 'GET',
      path,
      query: searchParams,
      headers: init.headers || {},
      body: parseBody(init.body),
      signal: init.signal
    }
    calls.push(call)
    const handler = routes.get(`${call.method} ${path}`) || queue.shift()
    if (!handler)
      throw new Error(`fakeFetch: no response for ${call.method} ${path}`)
    return handler(call)
  }

  fake.calls = calls
  fake.reply = (status, body, headers) => {
    queue.push(() => jsonResponse(status, body, headers))
    return fake
  }
  fake.on = (method, path, handler) => {
    routes.set(`${method} ${path}`, handler)
    return fake
  }
  return fake
}
