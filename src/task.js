/**
 * @namespace Task
 */

import { KitsuClient } from './client.js'

 /**
  * @function getTaskType
  * @memberof Task
  * @instance
  *
  * Get task type by name
  * 
  * @param {string} name Name of the task
  * @returns Task type by name
  */
KitsuClient.prototype.getTaskType = function (name) {
  return this.fetchFirst(`data/task-types?name=${name}`)
}

 /**
  * @function getTaskStatus
  * @memberof Task
  * @instance
  * 
  * Get task status by name
  * 
  * @param {string} name Name of the task
  * @returns Task status by name
  */
KitsuClient.prototype.getTaskStatus = function (name) {
  return this.fetchFirst(`data/task-status?short_name=${name}`)
}

 /**
  * @function getTask
  * @memberof Task
  * @instance
  * 
  * Get task by entity ID and task type ID
  * 
  * @param {string} entityId ID of the entity
  * @param {string} taskTypeId ID of the task type
  * @returns Task by ID
  */
KitsuClient.prototype.getTask = function (entityId, taskTypeId) {
  return this.fetchFirst(
    `data/tasks?entity_id=${entityId}&task_type_id=${taskTypeId}`
  )
}

 /**
  * @function addComment
  * @memberof Task
  * @instance
  * 
  * Add comment
  * 
  * @param {string} taskId ID of the task
  * @param {string} taskStatusId ID of the task status
  * @param {string} comment Comment
  * @param {Array} checklist Checklist array
  * @param {Array} attachments Attachments array
  * @param {string} personId ID of the person
  * @param {string} createdAt Date of creation
  * @returns Adds comment
  */
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

 /**
  * @function addPreview
  * @memberof Task
  * @instance
  * 
  * Add preview to comment
  * 
  * @param {string} taskId ID of task
  * @param {string} commentId ID of comment
  * @param {string} previewFilePath Path of preview file
  * @param {boolean} normalizeMovie Movie normalized
  * @returns Adds preview
  */
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

 /**
  * @function publish
  * @memberof Task
  * @instance
  * 
  * Publish comment with preview
  * 
  * @param {string} taskId ID of task
  * @param {string} taskStatusId ID of task status
  * @param {string} previewFilePath Path of preview file
  * @param {string} personId ID of person
  * @param {string} createdAt Date of creation
  * @param {boolean} normalizeMovie Movie normalized
  * @returns Adds comment and preview
  */
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
