import { ParameterError } from '../core/errors.js'
import {
  idOf,
  likeLiteralOf,
  optionalIdOf,
  orNull,
  requiredOf,
  sameNameOf,
  withoutNil
} from '../core/params.js'
import * as urls from '../utils/urls.js'

/**
 * @typedef {import('../core/params.js').Entity} Entity
 * @typedef {import('../core/params.js').Model} Model
 * @typedef {import('../core/params.js').RequestOptions} RequestOptions
 */

/**
 * @typedef {object} OutputFileFilters
 * @property {Model} [outputType]
 * @property {Model} [taskType]
 * @property {string} [name] Name of the output files.
 * @property {string} [representation] "abc", "jpg"...
 * @property {Model} [fileStatus]
 * @property {AbortSignal} [signal]
 */

/**
 * @typedef {object} OutputFilePathOptions
 * @property {string} [name] File name suffix, "main" by default.
 * @property {string} [mode] Template of the file tree, "output" by default.
 * @property {string} [representation] Selects a template inside the mode.
 * @property {number} [revision] 0 by default. Zou then takes the next
 *   revision for the file name of an entity, but keeps 0 in its folder, and
 *   in the whole path of an asset instance: pass the revision to build.
 * @property {string} [sep] OS separator, "/" by default.
 * @property {AbortSignal} [signal]
 */

/**
 * @typedef {object} NewOutputFileOptions
 * @property {Model} [workingFile] Working file the output file comes from.
 * @property {Model} [person] Author of the file.
 * @property {string} [name] File name suffix.
 * @property {number} [revision] 0 lets the server take the next revision.
 * @property {number} [nbElements] Number of files of an image sequence.
 * @property {string} [representation] "abc", "jpg"...
 * @property {string} [sep] OS separator, "/" by default.
 * @property {Model} [fileStatus] File status set at creation, the default
 *   one of Zou when left out.
 * @property {AbortSignal} [signal]
 */

/**
 * @typedef {object} UploadFileOptions
 * @property {string} [fileName] Name sent with the file: a bare Blob has none.
 * @property {(progress: {loaded: number, total: number}) => void} [onProgress]
 *   Needs XMLHttpRequest (browsers, webviews): fetch cannot report it. A
 *   client given its own fetch (Tauri) calls it only with xhrUploads: true,
 *   and a bearer client never for an upload to the origin of its page.
 * @property {AbortSignal} [signal]
 */

/**
 * @typedef {object} AnnotationFrame The drawing of a preview at one time.
 * @property {number} time Position in seconds, 0 for a picture. Zou matches
 *   it exactly: reuse the time stored on the preview, or snap a new one with
 *   the roundToFrame(time, fps) helper, as Kitsu does.
 * @property {number} [frame] Frame number, counted from 1. Zou stores it
 *   without reading it, but Kitsu reads it back (before 1.0.39, to jump to
 *   a drawing): send it when you add a drawing at a new time.
 * @property {{objects: Record<string, any>[]}} drawing The Fabric.js objects
 *   drawn at that time. Zou gives an id to an added object that has none.
 */

/**
 * @typedef {object} AnnotationDeletion
 * @property {number} time Position in seconds, as stored on the preview.
 * @property {number} [frame]
 * @property {string[]} objects Ids of the drawing objects to remove.
 */

// Same as gazu: spaces never reach the file system.
const formatPath = (folder, name, sep) =>
  `${folder.replace(/ /g, '_')}${sep}${name.replace(/ /g, '_')}`

const own = (object, key) =>
  Object.prototype.hasOwnProperty.call(object, key) ? object[key] : null

/**
 * @param {OutputFileFilters} filters
 * @returns {Record<string, string|null|undefined>} The query gazu builds.
 */
const outputFileFilters = ({
  outputType,
  taskType,
  name,
  representation,
  fileStatus
}) => ({
  output_type_id: optionalIdOf(outputType),
  task_type_id: optionalIdOf(taskType),
  representation,
  name,
  file_status_id: optionalIdOf(fileStatus)
})

// Zou counts preview positions and movie frames from 1: below, a position
// changes nothing and a frame number seeks before the first frame.
const fromOneOf = (label, value) => {
  if (Number.isInteger(value) && value >= 1) return value
  throw new ParameterError(
    `Wrong format: ${label} must be an integer counted from 1`
  )
}

const instanceEntityPath = (assetInstance, temporalEntity) =>
  `data/asset-instances/${idOf(assetInstance)}/entities/${idOf(temporalEntity)}`

export const filesApi = http => {
  // The public functions are documented where they are returned: one
  // returned by its name would lose its JSDoc in the declarations.

  /**
   * The row of that name, the case ignored but an exact match first: Zou
   * keeps "Maya" and "maya" apart.
   * @param {string} model
   * @param {string} name
   * @param {AbortSignal} [signal]
   * @returns {Promise<Entity|null>}
   */
  const byName = async (model, name, signal) =>
    orNull(
      http.fetchAll(model, { name: likeLiteralOf(name) }, { signal })
    ).then(entries => sameNameOf(entries, name))

  /**
   * @param {string} path
   * @param {Model} outputType
   * @param {Model} taskType
   * @param {OutputFilePathOptions} [options]
   * @returns {Promise<string>}
   */
  const buildOutputFilePath = async (
    path,
    outputType,
    taskType,
    {
      name = 'main',
      mode = 'output',
      representation = '',
      revision = 0,
      sep = '/',
      signal
    } = {}
  ) => {
    const result = await http.post(
      path,
      {
        task_type_id: idOf(taskType),
        output_type_id: idOf(outputType),
        mode,
        name,
        representation,
        revision,
        separator: sep
      },
      { signal }
    )
    return formatPath(result.folder_path, result.file_name, sep)
  }

  /**
   * @param {string} path
   * @param {string} defaultName
   * @param {Model} outputType
   * @param {Model} taskType
   * @param {string} comment
   * @param {NewOutputFileOptions} [options]
   * @returns {Promise<Entity>}
   */
  const newOutputFile = (
    path,
    defaultName,
    outputType,
    taskType,
    comment,
    options = {}
  ) => {
    // 0.2.0 named it fileStatusId: dropped without a word, it would leave the
    // default status on the file.
    if ('fileStatusId' in options) {
      throw new ParameterError('Wrong format: fileStatusId is now fileStatus')
    }
    const {
      workingFile,
      person,
      name = defaultName,
      revision = 0,
      nbElements = 1,
      representation = '',
      sep = '/',
      fileStatus,
      signal
    } = options
    return http.post(
      path,
      withoutNil({
        output_type_id: idOf(outputType),
        task_type_id: idOf(taskType),
        comment,
        revision,
        representation,
        name,
        nb_elements: nbElements,
        sep,
        working_file_id: optionalIdOf(workingFile),
        person_id: optionalIdOf(person),
        file_status_id: optionalIdOf(fileStatus)
      }),
      { signal }
    )
  }

  const nextOutputRevision = (path, outputType, taskType, name, signal) =>
    http
      .post(
        path,
        {
          name,
          output_type_id: idOf(outputType),
          task_type_id: idOf(taskType)
        },
        { signal }
      )
      .then(result => result.next_revision)

  /**
   * @param {Model} entity
   * @param {Model} outputType
   * @param {Model} taskType
   * @param {{name?: string, signal?: AbortSignal}} [options]
   * @returns {Promise<number>}
   */
  const nextEntityRevision = (
    entity,
    outputType,
    taskType,
    { name = 'main', signal } = {}
  ) =>
    nextOutputRevision(
      `data/entities/${idOf(entity)}/output-files/next-revision`,
      outputType,
      taskType,
      name,
      signal
    )

  /**
   * @param {Model} assetInstance
   * @param {Model} temporalEntity
   * @param {Model} outputType
   * @param {Model} taskType
   * @param {{name?: string, signal?: AbortSignal}} [options]
   * @returns {Promise<number>}
   */
  const nextInstanceRevision = (
    assetInstance,
    temporalEntity,
    outputType,
    taskType,
    { name = 'master', signal } = {}
  ) =>
    nextOutputRevision(
      `${instanceEntityPath(assetInstance, temporalEntity)}/output-files/next-revision`,
      outputType,
      taskType,
      name,
      signal
    )

  /**
   * @param {Model} task
   * @param {AbortSignal} [signal]
   * @returns {Promise<Record<string, Entity>>}
   */
  const lastWorkingFiles = (task, signal) =>
    http.get(
      `data/tasks/${idOf(task)}/working-files/last-revisions`,
      {},
      { signal }
    )

  /**
   * @param {string} path
   * @param {Blob} file
   * @param {UploadFileOptions} [options]
   * @returns {Promise<any>} The parsed answer of the API.
   */
  const uploadFile = (path, file, { fileName, onProgress, signal } = {}) =>
    http.upload(path, {
      file: requiredOf('file', file),
      fileName,
      onProgress,
      signal
    })

  /**
   * @param {string} kind "persons", "projects" or "organisations".
   * @param {Model} model
   * @param {RequestOptions} [options]
   * @returns {Promise<Response>}
   */
  const downloadAvatar = (kind, model, { signal } = {}) =>
    http.download(`pictures/thumbnails/${kind}/${idOf(model)}.png`, { signal })

  /**
   * @param {string} kind "persons", "projects" or "organisations".
   * @param {Model} model
   * @param {Blob} file
   * @param {UploadFileOptions} [options]
   * @returns {Promise<{thumbnail_path: string}>}
   */
  const uploadAvatar = (kind, model, file, options) =>
    uploadFile(`pictures/thumbnails/${kind}/${idOf(model)}`, file, options)

  // Not getPreviewFile: a missing preview must raise NotFoundError before any
  // download starts, not be null. The extension comes from the API, it is
  // encoded so it can never reshape the route.
  const originalExtension = async (previewFile, signal) => {
    const { extension } = await http.get(
      `data/preview-files/${idOf(previewFile)}`,
      {},
      { signal }
    )
    return encodeURIComponent(extension)
  }

  return {
    /**
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} All output types of the database.
     */
    allOutputTypes: async ({ signal } = {}) =>
      http.fetchAll('output-types', {}, { signal }),

    /**
     * @param {Model} entity
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} Output types of the entity output files.
     */
    allOutputTypesForEntity: async (entity, { signal } = {}) =>
      http.fetchAll(`entities/${idOf(entity)}/output-types`, {}, { signal }),

    /**
     * @param {Model} assetInstance
     * @param {Model} temporalEntity Shot or scene the instance appears in.
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} Output types of the instance output files.
     */
    allOutputTypesForAssetInstance: async (
      assetInstance,
      temporalEntity,
      { signal } = {}
    ) =>
      http.get(
        `${instanceEntityPath(assetInstance, temporalEntity)}/output-types`,
        {},
        { signal }
      ),

    /**
     * @param {Model} outputType
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity|null>} The output type, null when missing.
     */
    getOutputType: async (outputType, { signal } = {}) =>
      http.fetchOne('output-types', idOf(outputType), { signal }),

    /**
     * @param {string} name
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity|null>} The output type of this name, the case
     *   ignored but an exact match first, null when there is none.
     */
    getOutputTypeByName: async (name, { signal } = {}) =>
      byName('output-types', name, signal),

    /**
     * Create an output type, or return the one that already has this name, case
     * ignored.
     * @param {string} name
     * @param {string} shortName
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The created or existing output type.
     */
    newOutputType: async (name, shortName, { signal } = {}) =>
      (await byName('output-types', name, signal)) ||
      http.create('output-types', { name, short_name: shortName }, { signal }),

    /**
     * @param {Model} outputFile
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity|null>} The output file, null when missing.
     */
    getOutputFile: async (outputFile, { signal } = {}) =>
      http.fetchOne('output-files', idOf(outputFile), { signal }),

    /**
     * @param {string} path
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity|null>} First output file stored at the path.
     */
    getOutputFileByPath: async (path, { signal } = {}) =>
      http.fetchFirst(
        'output-files',
        { path: requiredOf('path', path) },
        { signal }
      ),

    /**
     * @param {Model} entity
     * @param {{task?: Model, name?: string, signal?: AbortSignal}} [options]
     * @returns {Promise<Entity[]>} Working files of the entity.
     */
    getAllWorkingFilesForEntity: async (entity, { task, name, signal } = {}) =>
      http.fetchAll(
        `entities/${idOf(entity)}/working-files`,
        { task_id: optionalIdOf(task), name },
        { signal }
      ),

    /**
     * @param {Model} previewFile
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity|null>} The preview file, null when missing.
     */
    getPreviewFile: async (previewFile, { signal } = {}) =>
      http.fetchOne('preview-files', idOf(previewFile), { signal }),

    /**
     * @param {Model} previewFile
     * @param {{force?: boolean, signal?: AbortSignal}} [options] force deletes
     *   the stored files whatever the server configuration.
     * @returns {Promise<null>}
     */
    removePreviewFile: async (previewFile, { force = false, signal } = {}) =>
      http.remove(
        'preview-files',
        idOf(previewFile),
        { force: force ? true : null },
        { signal }
      ),

    /**
     * @param {Model} task
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} Preview files of the task.
     */
    getAllPreviewFilesForTask: async (task, { signal } = {}) =>
      http.fetchAll('preview-files', { task_id: idOf(task) }, { signal }),

    /**
     * @param {Model} task
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} Attachment files of the task.
     */
    getAllAttachmentFilesForTask: async (task, { signal } = {}) =>
      http.fetchAll(`tasks/${idOf(task)}/attachment-files`, {}, { signal }),

    /**
     * @param {Model} project
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} Attachment files of the project.
     */
    getAllAttachmentFilesForProject: async (project, { signal } = {}) =>
      http.fetchAll(
        `projects/${idOf(project)}/attachment-files`,
        {},
        { signal }
      ),

    /**
     * @param {Model} entity
     * @param {OutputFileFilters} [options]
     * @returns {Promise<Entity[]>} Output files of the entity.
     */
    allOutputFilesForEntity: async (entity, { signal, ...filters } = {}) =>
      http.fetchAll(
        `entities/${idOf(entity)}/output-files`,
        outputFileFilters(filters),
        { signal }
      ),

    /**
     * @param {Model} assetInstance
     * @param {OutputFileFilters & {temporalEntity?: Model}} [options]
     *   temporalEntity is the shot or scene the instance appears in.
     * @returns {Promise<Entity[]>} Output files of the asset instance.
     */
    allOutputFilesForAssetInstance: async (
      assetInstance,
      { temporalEntity, signal, ...filters } = {}
    ) =>
      http.fetchAll(
        `asset-instances/${idOf(assetInstance)}/output-files`,
        {
          temporal_entity_id: optionalIdOf(temporalEntity),
          ...outputFileFilters(filters)
        },
        { signal }
      ),

    /**
     * @param {Model} project
     * @param {OutputFileFilters} [options]
     * @returns {Promise<Entity[]>} Output files of the project.
     */
    allOutputFilesForProject: async (project, { signal, ...filters } = {}) =>
      http.fetchAll(
        `projects/${idOf(project)}/output-files`,
        outputFileFilters(filters),
        { signal }
      ),

    /**
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} All softwares of the database.
     */
    allSoftwares: async ({ signal } = {}) =>
      http.fetchAll('softwares', {}, { signal }),

    /**
     * @param {Model} software
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity|null>} The software, null when missing.
     */
    getSoftware: async (software, { signal } = {}) =>
      http.fetchOne('softwares', idOf(software), { signal }),

    /**
     * @param {string} name
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity|null>} The software of this name, the case
     *   ignored but an exact match first, null when there is none.
     */
    getSoftwareByName: async (name, { signal } = {}) =>
      byName('softwares', name, signal),

    /**
     * Create a software, or return the one that already has this name, case
     * ignored.
     * @param {string} name
     * @param {string} shortName
     * @param {string} fileExtension Main extension written by the software.
     * @param {{
     *   secondaryExtensions?: string[],
     *   version?: string,
     *   monthlyCost?: number,
     *   inventoryAmount?: number,
     *   signal?: AbortSignal
     * }} [options] version, monthlyCost and inventoryAmount describe the
     *   license, as in the form of Kitsu. The options only go to a created
     *   software: an existing one comes back as it is.
     * @returns {Promise<Entity>} The created or existing software.
     */
    newSoftware: async (
      name,
      shortName,
      fileExtension,
      {
        secondaryExtensions,
        version,
        monthlyCost,
        inventoryAmount,
        signal
      } = {}
    ) =>
      (await byName('softwares', name, signal)) ||
      http.create(
        'softwares',
        withoutNil({
          name,
          short_name: shortName,
          file_extension: fileExtension,
          secondary_extensions: secondaryExtensions,
          version,
          monthly_cost: monthlyCost,
          inventory_amount: inventoryAmount
        }),
        { signal }
      ),

    /**
     * @param {Entity} software The software dict, with its changes.
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The updated software.
     */
    updateSoftware: async (software, { signal } = {}) =>
      http.update('softwares', idOf(software), software, { signal }),

    /**
     * @param {Model} software
     * @param {RequestOptions} [options]
     * @returns {Promise<null>}
     */
    removeSoftware: async (software, { signal } = {}) =>
      http.remove('softwares', idOf(software), {}, { signal }),

    /**
     * @param {RequestOptions} [options]
     * @returns {Promise<Record<string, Entity[]>>} The softwares linked to
     *   each department, keyed by department id.
     */
    allDepartmentSoftwares: async ({ signal } = {}) =>
      http.get('data/departments/software-licenses', {}, { signal }),

    /**
     * @param {Model} department
     * @param {Model} software
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The link between the two.
     */
    addSoftwareToDepartment: async (department, software, { signal } = {}) =>
      http.post(
        `data/departments/${idOf(department)}/software-licenses`,
        { software_id: idOf(software) },
        { signal }
      ),

    /**
     * @param {Model} department
     * @param {Model} software
     * @param {RequestOptions} [options]
     * @returns {Promise<null>}
     */
    removeSoftwareFromDepartment: async (
      department,
      software,
      { signal } = {}
    ) =>
      http.del(
        `data/departments/${idOf(department)}/software-licenses/${idOf(software)}`,
        undefined,
        { signal }
      ),

    /**
     * @param {Model} project
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} The softwares set for the task types of
     *   the project, as project_id, task_type_id and software_id links.
     */
    allTaskTypeSoftwares: async (project, { signal } = {}) =>
      http.get(
        `data/projects/${idOf(project)}/task-type-softwares`,
        {},
        { signal }
      ),

    /**
     * Set a software for a task type of the project. A second call returns
     * the existing link.
     * @param {Model} project
     * @param {Model} taskType A task type of the project.
     * @param {Model} software A software that is not archived.
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The link.
     */
    addSoftwareToTaskType: async (
      project,
      taskType,
      software,
      { signal } = {}
    ) =>
      http.post(
        `data/projects/${idOf(project)}/task-types/${idOf(taskType)}/softwares`,
        { software_id: idOf(software) },
        { signal }
      ),

    /**
     * @param {Model} project
     * @param {Model} taskType
     * @param {Model} software
     * @param {RequestOptions} [options]
     * @returns {Promise<null>}
     */
    removeSoftwareFromTaskType: async (
      project,
      taskType,
      software,
      { signal } = {}
    ) =>
      http.del(
        `data/projects/${idOf(project)}/task-types/${idOf(taskType)}/softwares/${idOf(software)}`,
        undefined,
        { signal }
      ),

    /**
     * Build the path of a working file from the project file tree. Without
     * software, Zou takes 3ds Max where newWorkingFile takes Blender, and
     * creates it when missing: give both functions the same software.
     * @param {Model} task
     * @param {{name?: string, mode?: string, software?: Model,
     *   revision?: number, sep?: string, signal?: AbortSignal}} [options]
     *   name is the file name suffix, mode selects a template of the file
     *   tree, sep is the OS separator. revision is 1 by default, as in gazu:
     *   0 asks Zou for the next revision of the name, the one newWorkingFile
     *   creates by default.
     * @returns {Promise<string>} The working file path, without extension.
     */
    buildWorkingFilePath: async (
      task,
      {
        name = 'main',
        mode = 'working',
        software,
        revision = 1,
        sep = '/',
        signal
      } = {}
    ) => {
      const result = await http.post(
        `data/tasks/${idOf(task)}/working-file-path`,
        withoutNil({
          mode,
          name,
          revision,
          sep,
          software_id: optionalIdOf(software)
        }),
        { signal }
      )
      return formatPath(result.path, result.name, sep)
    },

    /**
     * Build the path of an entity output file from the project file tree.
     * @param {Model} entity
     * @param {Model} outputType
     * @param {Model} taskType
     * @param {OutputFilePathOptions} [options]
     * @returns {Promise<string>} The output file path, without extension.
     */
    buildEntityOutputFilePath: async (entity, outputType, taskType, options) =>
      buildOutputFilePath(
        `data/entities/${idOf(entity)}/output-file-path`,
        outputType,
        taskType,
        options
      ),

    /**
     * Build the path of an asset instance output file from the project file
     * tree.
     * @param {Model} assetInstance
     * @param {Model} temporalEntity Shot or scene the instance appears in.
     * @param {Model} outputType
     * @param {Model} taskType
     * @param {OutputFilePathOptions} [options]
     * @returns {Promise<string>} The output file path, without extension.
     */
    buildAssetInstanceOutputFilePath: async (
      assetInstance,
      temporalEntity,
      outputType,
      taskType,
      options
    ) =>
      buildOutputFilePath(
        `${instanceEntityPath(assetInstance, temporalEntity)}/output-file-path`,
        outputType,
        taskType,
        options
      ),

    /**
     * Create a working file for a task. The server builds its path and, when
     * revision is 0 (the default), sets the revision to the last one plus
     * one: save the file at the path of the created working file.
     *
     * Zou also assigns the task to the calling user, whoever person names.
     * Without software, it takes Blender where buildWorkingFilePath takes
     * 3ds Max, and creates it when missing: give both functions the same
     * software.
     * @param {Model} task
     * @param {{name?: string, mode?: string, software?: Model,
     *   comment?: string, person?: Model, revision?: number,
     *   signal?: AbortSignal}} [options] person is the author of the file.
     * @returns {Promise<Entity>} The created working file.
     */
    newWorkingFile: async (
      task,
      {
        name = 'main',
        mode = 'working',
        software,
        comment = '',
        person,
        revision = 0,
        signal
      } = {}
    ) =>
      http.post(
        `data/tasks/${idOf(task)}/working-files/new`,
        withoutNil({
          name,
          comment,
          task_id: idOf(task),
          revision,
          mode,
          person_id: optionalIdOf(person),
          software_id: optionalIdOf(software)
        }),
        { signal }
      ),

    /**
     * Create an output file for an entity. The server builds its path and,
     * when revision is 0, sets the revision to the last one plus one.
     * @param {Model} entity
     * @param {Model} outputType
     * @param {Model} taskType
     * @param {string} comment
     * @param {NewOutputFileOptions} [options] name is "main" by default.
     * @returns {Promise<Entity>} The created output file.
     */
    newEntityOutputFile: async (
      entity,
      outputType,
      taskType,
      comment,
      options
    ) =>
      newOutputFile(
        `data/entities/${idOf(entity)}/output-files/new`,
        'main',
        outputType,
        taskType,
        comment,
        options
      ),

    /**
     * Create an output file for an asset instance. The server builds its path
     * and, when revision is 0, sets the revision to the last one plus one.
     * @param {Model} assetInstance
     * @param {Model} temporalEntity Shot or scene the instance appears in.
     * @param {Model} outputType
     * @param {Model} taskType
     * @param {string} comment
     * @param {NewOutputFileOptions} [options] name is "master" by default.
     * @returns {Promise<Entity>} The created output file.
     */
    newAssetInstanceOutputFile: async (
      assetInstance,
      temporalEntity,
      outputType,
      taskType,
      comment,
      options
    ) =>
      newOutputFile(
        `${instanceEntityPath(assetInstance, temporalEntity)}/output-files/new`,
        'master',
        outputType,
        taskType,
        comment,
        options
      ),

    /**
     * @param {Model} entity
     * @param {Model} outputType
     * @param {Model} taskType
     * @param {{name?: string, signal?: AbortSignal}} [options] name is
     *   "main" by default, like for the other entity output file functions.
     * @returns {Promise<number>} Next revision available for the output files
     *   of the entity, 1 when there is no output file yet.
     */
    getNextEntityOutputRevision: async (
      entity,
      outputType,
      taskType,
      options
    ) => nextEntityRevision(entity, outputType, taskType, options),

    /**
     * @param {Model} assetInstance
     * @param {Model} temporalEntity Shot or scene the instance appears in.
     * @param {Model} outputType
     * @param {Model} taskType
     * @param {{name?: string, signal?: AbortSignal}} [options] name is
     *   "master" by default, like for newAssetInstanceOutputFile (gazu), while
     *   buildAssetInstanceOutputFilePath takes "main".
     * @returns {Promise<number>} Next revision available for the output files
     *   of the instance, 1 when there is no output file yet.
     */
    getNextAssetInstanceOutputRevision: async (
      assetInstance,
      temporalEntity,
      outputType,
      taskType,
      options
    ) =>
      nextInstanceRevision(
        assetInstance,
        temporalEntity,
        outputType,
        taskType,
        options
      ),

    /**
     * @param {Model} entity
     * @param {Model} outputType
     * @param {Model} taskType
     * @param {{name?: string, signal?: AbortSignal}} [options] name is
     *   "main" by default, like for the other entity output file functions.
     * @returns {Promise<number>} Last revision of the output files of the
     *   entity, 0 when there is no output file yet.
     */
    getLastEntityOutputRevision: async (
      entity,
      outputType,
      taskType,
      options
    ) =>
      nextEntityRevision(entity, outputType, taskType, options).then(
        revision => revision - 1
      ),

    /**
     * @param {Model} assetInstance
     * @param {Model} temporalEntity Shot or scene the instance appears in.
     * @param {Model} outputType
     * @param {Model} taskType
     * @param {{name?: string, signal?: AbortSignal}} [options] name is
     *   "master" by default, like for newAssetInstanceOutputFile (gazu), while
     *   buildAssetInstanceOutputFilePath takes "main".
     * @returns {Promise<number>} Last revision of the output files of the
     *   instance, 0 when there is no output file yet.
     */
    getLastAssetInstanceOutputRevision: async (
      assetInstance,
      temporalEntity,
      outputType,
      taskType,
      options
    ) =>
      nextInstanceRevision(
        assetInstance,
        temporalEntity,
        outputType,
        taskType,
        options
      ).then(revision => revision - 1),

    /**
     * @param {Model} entity
     * @param {OutputFileFilters} [options]
     * @returns {Promise<Entity[]>} Last revision of each output file of the
     *   entity.
     */
    getLastOutputFilesForEntity: async (entity, { signal, ...filters } = {}) =>
      http.fetchAll(
        `entities/${idOf(entity)}/output-files/last-revisions`,
        outputFileFilters(filters),
        { signal }
      ),

    /**
     * @param {Model} assetInstance
     * @param {Model} temporalEntity Shot or scene the instance appears in.
     * @param {OutputFileFilters} [options]
     * @returns {Promise<Entity[]>} Last revision of each output file of the
     *   instance.
     */
    getLastOutputFilesForAssetInstance: async (
      assetInstance,
      temporalEntity,
      { signal, ...filters } = {}
    ) =>
      http.get(
        `${instanceEntityPath(assetInstance, temporalEntity)}/output-files/last-revisions`,
        outputFileFilters(filters),
        { signal }
      ),

    /**
     * @param {Model} task
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} Working files of the task.
     */
    getWorkingFilesForTask: async (task, { signal } = {}) =>
      http.get(`data/tasks/${idOf(task)}/working-files`, {}, { signal }),

    /**
     * @param {Model} task
     * @param {RequestOptions} [options]
     * @returns {Promise<Record<string, Entity>>} Last working file of the task
     *   for each working file name.
     */
    getLastWorkingFiles: async (task, { signal } = {}) =>
      lastWorkingFiles(task, signal),

    /**
     * @param {Model} task
     * @param {{name?: string, signal?: AbortSignal}} [options]
     * @returns {Promise<Entity|null>} Last working file of the task for the
     *   name, null when there is none.
     */
    getLastWorkingFileRevision: async (task, { name = 'main', signal } = {}) =>
      own(await lastWorkingFiles(task, signal), name),

    /**
     * @param {Model} workingFile
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity|null>} The working file, null when missing.
     */
    getWorkingFile: async (workingFile, { signal } = {}) =>
      http.fetchOne('working-files', idOf(workingFile), { signal }),

    /**
     * @param {Model} workingFile
     * @param {string} comment
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The updated working file.
     */
    updateComment: async (workingFile, comment, { signal } = {}) =>
      http.put(
        `actions/working-files/${idOf(workingFile)}/comment`,
        { comment },
        { signal }
      ),

    /**
     * Set the modification date of a working file to now.
     * @param {Model} workingFile
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The updated working file.
     */
    updateModificationDate: async (workingFile, { signal } = {}) =>
      http.put(
        `actions/working-files/${idOf(workingFile)}/modified`,
        {},
        { signal }
      ),

    /**
     * @param {Model} outputFile
     * @param {object} data Fields to change on the output file.
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The updated output file.
     */
    updateOutputFile: async (outputFile, data, { signal } = {}) =>
      http.update('output-files', idOf(outputFile), data, { signal }),

    /**
     * Set the file tree template used to build the file paths of a project.
     * @param {Model} project
     * @param {object} fileTree
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The updated project.
     */
    updateProjectFileTree: async (project, fileTree, { signal } = {}) =>
      http.update(
        'projects',
        idOf(project),
        { file_tree: fileTree },
        { signal }
      ),

    /**
     * Store a file as the content of a working file.
     * @param {Model} workingFile
     * @param {Blob} file
     * @param {UploadFileOptions} [options]
     * @returns {Promise<Entity>} The working file.
     */
    uploadWorkingFile: async (workingFile, file, options) =>
      uploadFile(`data/working-files/${idOf(workingFile)}/file`, file, options),

    /**
     * @param {Model} workingFile
     * @param {RequestOptions} [options]
     * @returns {Promise<Response>} Raw response holding the stored file.
     */
    downloadWorkingFile: async (workingFile, { signal } = {}) =>
      http.download(`data/working-files/${idOf(workingFile)}/file`, { signal }),

    /**
     * Download the original file of a preview, movie or not.
     * A preview whose files Zou still builds rejects with a KitsuError of
     * status 202, whose retryAfter tells when to ask again.
     * @param {Model} previewFile
     * @param {RequestOptions} [options]
     * @returns {Promise<Response>} Raw response holding the original file.
     */
    downloadPreviewFile: async (previewFile, { signal } = {}) => {
      const extension = await originalExtension(previewFile, signal)
      const kind = extension === 'mp4' ? 'movies' : 'pictures'
      return http.download(
        `${kind}/originals/preview-files/${idOf(previewFile)}.${extension}`,
        { signal }
      )
    },

    /**
     * @param {Model} attachmentFile
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity|null>} The attachment file, null when missing.
     */
    getAttachmentFile: async (attachmentFile, { signal } = {}) =>
      http.fetchOne('attachment-files', idOf(attachmentFile), { signal }),

    /**
     * @param {Model} attachmentFile
     * @param {RequestOptions} [options]
     * @returns {Promise<Response>} Raw response holding the attached file.
     */
    downloadAttachmentFile: async (attachmentFile, { signal } = {}) => {
      const id = idOf(attachmentFile)
      // Zou never reads the file name of the route, it names the download
      // from its record: the id stands there, where a stored name holding a
      // "/" or made of dots would no longer match the route.
      return http.download(`data/attachment-files/${id}/file/${id}`, {
        signal
      })
    },

    /**
     * A preview whose files Zou still builds rejects with a KitsuError of
     * status 202, whose retryAfter tells when to ask again.
     * @param {Model} previewFile
     * @param {RequestOptions} [options]
     * @returns {Promise<Response>} Raw response holding the PNG thumbnail.
     */
    downloadPreviewFileThumbnail: async (previewFile, { signal } = {}) =>
      http.download(
        `pictures/thumbnails/preview-files/${idOf(previewFile)}.png`,
        { signal }
      ),

    /**
     * A preview whose files Zou still builds rejects with a KitsuError of
     * status 202, whose retryAfter tells when to ask again.
     * @param {Model} previewFile
     * @param {RequestOptions} [options]
     * @returns {Promise<Response>} Raw response holding the full size PNG
     *   picture of the preview.
     */
    downloadPreviewFileCover: async (previewFile, { signal } = {}) =>
      http.download(
        `pictures/originals/preview-files/${idOf(previewFile)}.png`,
        { signal }
      ),

    /**
     * @param {Model} person
     * @param {RequestOptions} [options]
     * @returns {Promise<Response>} Raw response holding the PNG avatar.
     */
    downloadPersonAvatar: async (person, options) =>
      downloadAvatar('persons', person, options),

    /**
     * @param {Model} person
     * @param {Blob} file Picture to set as avatar.
     * @param {UploadFileOptions} [options]
     * @returns {Promise<{thumbnail_path: string}>} Path of the stored
     *   picture, relative to the host.
     */
    uploadPersonAvatar: async (person, file, options) =>
      uploadAvatar('persons', person, file, options),

    /**
     * @param {Model} project
     * @param {RequestOptions} [options]
     * @returns {Promise<Response>} Raw response holding the PNG avatar.
     */
    downloadProjectAvatar: async (project, options) =>
      downloadAvatar('projects', project, options),

    /**
     * @param {Model} project
     * @param {Blob} file Picture to set as avatar.
     * @param {UploadFileOptions} [options]
     * @returns {Promise<{thumbnail_path: string}>} Path of the stored
     *   picture, relative to the host.
     */
    uploadProjectAvatar: async (project, file, options) =>
      uploadAvatar('projects', project, file, options),

    /**
     * @param {Model} organisation
     * @param {RequestOptions} [options]
     * @returns {Promise<Response>} Raw response holding the PNG avatar.
     */
    downloadOrganisationAvatar: async (organisation, options) =>
      downloadAvatar('organisations', organisation, options),

    /**
     * @param {Model} organisation
     * @param {Blob} file Picture to set as avatar.
     * @param {UploadFileOptions} [options]
     * @returns {Promise<{thumbnail_path: string}>} Path of the stored
     *   picture, relative to the host.
     */
    uploadOrganisationAvatar: async (organisation, file, options) =>
      uploadAvatar('organisations', organisation, file, options),

    /**
     * @param {Model} previewFile
     * @param {object} data Fields to change on the preview file.
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The updated preview file.
     */
    updatePreview: async (previewFile, data, { signal } = {}) =>
      http.update('preview-files', idOf(previewFile), data, { signal }),

    /**
     * List the preview files of the open productions whose status is
     * processing, broken or missing, newest first. Admins only. A broken or
     * missing preview stays listed until its status changes.
     * @param {{limit?: number, lastPreviewFile?: Model,
     *   signal?: AbortSignal}} [options] Without limit, the API answers every
     *   preview file at once. lastPreviewFile is the last preview file of the
     *   previous page (cursor pagination).
     * @returns {Promise<Entity[]>} The preview files, each with the
     *   project_id, task_type_id and full_entity_name of its task.
     */
    getRunningPreviewFiles: async ({ limit, lastPreviewFile, signal } = {}) =>
      http.fetchAll(
        'playlists/preview-files/running',
        { limit, cursor_preview_file_id: optionalIdOf(lastPreviewFile) },
        { signal }
      ),

    /**
     * A preview whose files Zou still builds rejects with a KitsuError of
     * status 202, whose retryAfter tells when to ask again.
     * @param {Model} previewFile
     * @param {RequestOptions} [options]
     * @returns {Promise<Response>} Raw response holding the original movie.
     */
    downloadPreviewMovie: async (previewFile, { signal } = {}) => {
      const extension = await originalExtension(previewFile, signal)
      return http.download(
        `movies/originals/preview-files/${idOf(previewFile)}.${extension}`,
        { signal }
      )
    },

    /**
     * A preview whose files Zou still builds rejects with a KitsuError of
     * status 202, whose retryAfter tells when to ask again.
     * @param {Model} previewFile
     * @param {RequestOptions} [options]
     * @returns {Promise<Response>} Raw response holding the low definition
     *   movie, always an MP4.
     */
    downloadPreviewLowdefMovie: async (previewFile, { signal } = {}) =>
      http.download(`movies/low/preview-files/${idOf(previewFile)}.mp4`, {
        signal
      }),

    /**
     * @param {Model} attachmentFile
     * @param {RequestOptions} [options]
     * @returns {Promise<Response>} Raw response holding the PNG thumbnail.
     */
    downloadAttachmentThumbnail: async (attachmentFile, { signal } = {}) =>
      http.download(
        `pictures/thumbnails/attachment-files/${idOf(attachmentFile)}.png`,
        { signal }
      ),

    /**
     * @param {Model} previewFile
     * @param {number} frameNumber Counted from 1, as the frame of an
     *   annotation.
     * @param {RequestOptions} [options]
     * @returns {Promise<Response>} Raw response holding the frame picture.
     */
    extractFrameFromPreview: async (
      previewFile,
      frameNumber,
      { signal } = {}
    ) =>
      http.request(
        'GET',
        `actions/preview-files/${idOf(previewFile)}/extract-frame`,
        {
          raw: true,
          query: { frame_number: fromOneOf('frameNumber', frameNumber) },
          signal
        }
      ),

    /**
     * Set the displayed order of a preview among those of its revision.
     * @param {Model} previewFile
     * @param {number} position Counted from 1, up to the number of previews
     *   of the revision: Zou keeps the order as it is for a position past
     *   the last one.
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} Every preview file of the revision, in its
     *   new order.
     */
    updatePreviewPosition: async (previewFile, position, { signal } = {}) =>
      http.put(
        `actions/preview-files/${idOf(previewFile)}/update-position`,
        { position: fromOneOf('position', position) },
        { signal }
      ),

    /**
     * Change the annotations of a preview. Zou finds a frame by its exact
     * time and a drawing object by its id: an addition never replaces an
     * object, an update only replaces existing ones, and a frame left without
     * objects is removed.
     * @param {Model} previewFile
     * @param {{
     *   additions?: AnnotationFrame[],
     *   updates?: AnnotationFrame[],
     *   deletions?: AnnotationDeletion[],
     *   signal?: AbortSignal
     * }} [options]
     * @returns {Promise<Entity>} The preview file with its new annotations.
     */
    updatePreviewAnnotations: async (
      previewFile,
      { additions, updates, deletions, signal } = {}
    ) =>
      http.put(
        `actions/preview-files/${idOf(previewFile)}/update-annotations`,
        withoutNil({ additions, updates, deletions }),
        { signal }
      ),

    /**
     * @param {Model} previewFile
     * @param {RequestOptions} [options]
     * @returns {Promise<Response>} Raw response holding the tile picture.
     */
    extractTileFromPreview: async (previewFile, { signal } = {}) =>
      http.request(
        'GET',
        `actions/preview-files/${idOf(previewFile)}/extract-tile`,
        { raw: true, signal }
      ),

    /**
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} All file statuses of the database.
     */
    allFileStatuses: async ({ signal } = {}) =>
      http.fetchAll('file-status', {}, { signal }),

    /**
     * Create a file status, or return the one that already has this name, case
     * ignored.
     * @param {string} name
     * @param {string} color Hex string, "#00FF00" for instance.
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The created or existing file status.
     */
    newFileStatus: async (name, color, { signal } = {}) =>
      (await byName('file-status', name, signal)) ||
      http.create('file-status', { name, color }, { signal }),

    /**
     * @param {Model} fileStatus
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity|null>} The file status, null when missing.
     */
    getFileStatus: async (fileStatus, { signal } = {}) =>
      http.fetchOne('file-status', idOf(fileStatus), { signal }),

    /**
     * @param {string} name
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity|null>} The file status of this name, the case
     *   ignored but an exact match first, null when there is none.
     */
    getFileStatusByName: async (name, { signal } = {}) =>
      byName('file-status', name, signal),

    /**
     * @param {Model} previewFile Loaded for its extension, like gazu.
     * @param {RequestOptions} [options]
     * @returns {Promise<string>} Path of the original file, relative to the
     *   API host. downloadPreviewFile downloads that file.
     */
    getPreviewFileUrl: async (previewFile, { signal } = {}) =>
      urls.getPreviewFilePath(
        await http.get(
          `data/preview-files/${idOf(previewFile)}`,
          {},
          { signal }
        )
      ),

    /**
     * @param {Model} previewFile Loaded for its extension, like gazu.
     * @param {{lowdef?: boolean, signal?: AbortSignal}} [options]
     * @returns {Promise<string>} Path of the movie, relative to the API host.
     */
    getPreviewMovieUrl: async (previewFile, { lowdef = false, signal } = {}) =>
      urls.getPreviewMoviePath(
        await http.get(
          `data/preview-files/${idOf(previewFile)}`,
          {},
          { signal }
        ),
        { lowdef }
      ),

    /**
     * @param {Model} previewFile
     * @param {RequestOptions} [options]
     * @returns {Promise<string>} Path of the low definition movie.
     */
    getPreviewLowdefMovieUrl: async (previewFile, { signal } = {}) =>
      urls.getPreviewMoviePath(
        await http.get(
          `data/preview-files/${idOf(previewFile)}`,
          {},
          { signal }
        ),
        { lowdef: true }
      ),

    /**
     * @param {Model} attachmentFile
     * @returns {Promise<string>} Path of the thumbnail, relative to the API
     *   host.
     */
    getAttachmentThumbnailUrl: async attachmentFile =>
      urls.getAttachmentThumbnailPath(attachmentFile)
  }
}
