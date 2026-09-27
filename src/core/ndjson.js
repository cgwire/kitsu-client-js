// Compact rows are positional arrays described by the field lists sent in
// the NDJSON header: always map by name, never by position.
const decodeCompactRow = (row, fields, taskFields) =>
  Object.fromEntries(
    fields.map((field, index) => [
      field,
      field === 'tasks'
        ? row[index].map(task => decodeCompactTask(task, taskFields))
        : row[index]
    ])
  )

// Compact rows may omit the assignees relation; consumers treat
// task.assignees as an array.
const decodeCompactTask = (row, taskFields) => {
  const task = decodeCompactRow(row, taskFields)
  return { ...task, assignees: task.assignees || [] }
}

export const readNdjson = async response => {
  let header = null
  let entityFields = null
  const entities = []
  const handleLine = line => {
    if (!line) return
    if (!header) {
      header = JSON.parse(line)
      const fieldsKey = Object.keys(header).find(
        key => key.endsWith('_fields') && key !== 'task_fields'
      )
      entityFields = header[fieldsKey]
      return
    }
    const row = JSON.parse(line)
    entities.push(
      header.compact
        ? decodeCompactRow(row, entityFields, header.task_fields)
        : row
    )
  }
  // Decoding failures get one type, so callers tell a malformed stream
  // from a transport failure.
  const decodeLine = line => {
    try {
      handleLine(line)
    } catch (err) {
      // The cause option of Error is ES2022: set by hand for the floor.
      throw Object.assign(
        new SyntaxError(`Malformed NDJSON line: ${err.message}`),
        { cause: err }
      )
    }
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    // A stream reader has no functional equivalent: this loop is the idiom.
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()
      lines.forEach(decodeLine)
    }
    decodeLine((buffer + decoder.decode()).trim())
  } catch (err) {
    // An abandoned stream holds its connection until garbage collection.
    await reader.cancel().catch(() => {})
    throw err
  }
  return entities
}
