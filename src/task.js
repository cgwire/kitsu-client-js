import { KitsuClient } from './client.js'

KitsuClient.prototype.getTaskType = function (name) {
  return this.fetchFirst(`data/task-types?name=${name}`)
}

KitsuClient.prototype.getTaskStatus = function (name) {
  return this.fetchFirst(`data/task-status?short_name=${name}`)
}

KitsuClient.prototype.getTask = function (entityId, taskTypeId) {
  return this.fetchFirst(
    `data/tasks?entity_id=${entityId}&task_type_id=${taskTypeId}`
  )
}

KitsuClient.prototype.addComment = function (
  taskId,
  taskStatusId,
  comment = '',
  checklist = [],
  attachments = [],
  personId,
  createdAt
) {
  const data = {
    task_status_id: taskStatusId,
    comment,
    checklist
  }

  if (personId) {
    data.person_id = personId
  }

  if (createdAt) {
    data.created_at = createdAt
  }

  if (attachments.length === 0) {
    return this.post(`actions/tasks/${taskId}/comment`, data)
  } else {
    return this.postWithFiles(
      `actions/tasks/${taskId}/comment`,
      data,
      attachments
    )
  }
}

KitsuClient.prototype.addPreview = function (
  taskId,
  commentId,
  previewFilePath,
  normalizeMovie = true
) {
  let path = `actions/tasks/${taskId}/comments/${commentId}/add-preview`
  return this.post(path, {})
    .then(previewFile => {
      path = `pictures/preview-files/${previewFile.id}`
      if (!normalizeMovie) {
        path += "?normalize=false"
      }
      return this.postWithFiles(path, {}, [previewFilePath])
    })
}

KitsuClient.prototype.publish = function (
  taskId,
  taskStatusId,
  previewFilePath,
  personId,
  createdAt,
  normalizeMovie = true
) {
  return this.addComment(taskId, taskStatusId, '', [], [], personId, createdAt)
    .then(comment => {
      return this.addPreview(
        taskId,
        comment.id,
        previewFilePath,
        normalizeMovie
      )
    })
}

export default {}
