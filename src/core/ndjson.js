// Compact rows are positional arrays described by the field lists sent in
// the NDJSON header: always map by name, never by position.
const decodeCompactRow = (row, fields, taskFields) =>
  fields.reduce(
    (entity, field, index) => ({
      ...entity,
      [field]:
        field === 'tasks'
          ? row[index].map(task => decodeCompactTask(task, taskFields))
          : row[index]
    }),
    {}
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
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  // A stream reader has no functional equivalent: this loop is the idiom.
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()
    lines.forEach(handleLine)
  }
  handleLine((buffer + decoder.decode()).trim())
  return entities
}
