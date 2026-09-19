// Empty values are dropped so an unset filter never reaches the API, and
// arrays become one repeated key per entry: Zou reads them with action="append".
export const buildQuery = (params = {}) => {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return
    if (Array.isArray(value)) {
      value.forEach(entry => query.append(key, entry))
    } else {
      query.append(key, value)
    }
  })
  return query.toString()
}

export const buildUrl = (host, path, query) => {
  const base = `${host.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
  const queryString = buildQuery(query)
  return queryString ? `${base}?${queryString}` : base
}
