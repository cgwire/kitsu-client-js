import { idOf, optionalIdOf, requiredOf, withoutNil } from '../core/params.js'
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
 * @property {number} [revision]
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
 * @property {Model} [fileStatusId] File status set at creation.
 * @property {AbortSignal} [signal]
 */

/**
 * @typedef {object} UploadFileOptions
 * @property {string} [fileName] Name sent with the file: a bare Blob has none.
 * @property {(progress: {loaded: number, total: number}) => void} [onProgress]
 *   Needs XMLHttpRequest (browsers, webviews): fetch cannot report it. A
 *   client given its own fetch (Tauri) uploads through it and never calls
 *   onProgress.
 * @property {AbortSignal} [signal]
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

const instanceEntityPath = (assetInstance, temporalEntity) =>
  `data/asset-instances/${idOf(assetInstance)}/entities/${idOf(temporalEntity)}`

export const filesApi = http => {
  /**
   * @param {string} name
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity|null>} First output type matching the name.
   */
  const getOutputTypeByName = async (name, { signal } = {}) =>
    http.fetchFirst(
      'output-types',
      { name: requiredOf('name', name) },
      { signal }
    )

  /**
   * @param {string} name
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity|null>} First software matching the name.
   */
  const getSoftwareByName = async (name, { signal } = {}) =>
    http.fetchFirst('softwares', { name: requiredOf('name', name) }, { signal })

  /**
   * @param {string} name
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity|null>} First file status matching the name.
   */
  const getFileStatusByName = async (name, { signal } = {}) =>
    http.fetchFirst(
      'file-status',
      { name: requiredOf('name', name) },
      { signal }
    )

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
    {
      workingFile,
      person,
      name = defaultName,
      revision = 0,
      nbElements = 1,
      representation = '',
      sep = '/',
      fileStatusId,
      signal
    } = {}
  ) =>
    http.post(
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
        file_status_id: optionalIdOf(fileStatusId)
      }),
      { signal }
    )

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
   * @returns {Promise<number>} Next revision available for the output files
   *   of the entity, 1 when there is no output file yet.
   */
  const getNextEntityOutputRevision = async (
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
   * @param {Model} temporalEntity Shot or scene the instance appears in.
   * @param {Model} outputType
   * @param {Model} taskType
   * @param {{name?: string, signal?: AbortSignal}} [options]
   * @returns {Promise<number>} Next revision available for the output files
   *   of the instance, 1 when there is no output file yet.
   */
  const getNextAssetInstanceOutputRevision = async (
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
   * @param {RequestOptions} [options]
   * @returns {Promise<Record<string, Entity>>} Last working file of the task
   *   for each working file name.
   */
  const getLastWorkingFiles = async (task, { signal } = {}) =>
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

    getOutputTypeByName,

    /**
     * Create an output type, or return the one that already has this name.
     * @param {string} name
     * @param {string} shortName
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The created or existing output type.
     */
    newOutputType: async (name, shortName, { signal } = {}) =>
      (await getOutputTypeByName(name, { signal })) ||
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

    getSoftwareByName,

    /**
     * Create a software, or return the one that already has this name.
     * @param {string} name
     * @param {string} shortName
     * @param {string} fileExtension Main extension written by the software.
     * @param {{secondaryExtensions?: string[], signal?: AbortSignal}} [options]
     * @returns {Promise<Entity>} The created or existing software.
     */
    newSoftware: async (
      name,
      shortName,
      fileExtension,
      { secondaryExtensions, signal } = {}
    ) =>
      (await getSoftwareByName(name, { signal })) ||
      http.create(
        'softwares',
        withoutNil({
          name,
          short_name: shortName,
          file_extension: fileExtension,
          secondary_extensions: secondaryExtensions
        }),
        { signal }
      ),

    /**
     * @param {{id: string}} software The software dict, with its changes.
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
     * Build the path of a working file from the project file tree.
     * @param {Model} task
     * @param {{name?: string, mode?: string, software?: Model,
     *   revision?: number, sep?: string, signal?: AbortSignal}} [options]
     *   name is the file name suffix, mode selects a template of the file
     *   tree, sep is the OS separator.
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
     * revision is 0, sets the revision to the last one plus one.
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

    getNextEntityOutputRevision,

    getNextAssetInstanceOutputRevision,

    /**
     * @param {Model} entity
     * @param {Model} outputType
     * @param {Model} taskType
     * @param {{name?: string, signal?: AbortSignal}} [options]
     * @returns {Promise<number>} Last revision of the output files of the
     *   entity, 0 when there is no output file yet.
     */
    getLastEntityOutputRevision: async (
      entity,
      outputType,
      taskType,
      options
    ) =>
      getNextEntityOutputRevision(entity, outputType, taskType, options).then(
        revision => revision - 1
      ),

    /**
     * @param {Model} assetInstance
     * @param {Model} temporalEntity Shot or scene the instance appears in.
     * @param {Model} outputType
     * @param {Model} taskType
     * @param {{name?: string, signal?: AbortSignal}} [options]
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
      getNextAssetInstanceOutputRevision(
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

    getLastWorkingFiles,

    /**
     * @param {Model} task
     * @param {{name?: string, signal?: AbortSignal}} [options]
     * @returns {Promise<Entity|null>} Last working file of the task for the
     *   name, null when there is none.
     */
    getLastWorkingFileRevision: async (task, { name = 'main', signal } = {}) =>
      own(await getLastWorkingFiles(task, { signal }), name),

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
      // Not getAttachmentFile: a missing attachment must raise NotFoundError,
      // not be null.
      const { id, name } = await http.get(
        `data/attachment-files/${idOf(attachmentFile)}`,
        {},
        { signal }
      )
      // The name is free text typed by a user: left as is, a "#", a "?" or a
      // "/" would cut or reshape the route.
      return http.download(
        `data/attachment-files/${id}/file/${encodeURIComponent(name)}`,
        { signal }
      )
    },

    /**
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
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} Preview files currently being processed.
     */
    getRunningPreviewFiles: async ({ signal } = {}) =>
      http.fetchAll('playlists/preview-files/running', {}, { signal }),

    /**
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
     * @param {number} frameNumber
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
        { raw: true, query: { frame_number: frameNumber }, signal }
      ),

    /**
     * Set the displayed order of a preview among those of its revision.
     * @param {Model} previewFile
     * @param {number} position
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The updated preview file.
     */
    updatePreviewPosition: async (previewFile, position, { signal } = {}) =>
      http.put(
        `actions/preview-files/${idOf(previewFile)}/update-position`,
        { position },
        { signal }
      ),

    /**
     * @param {Model} previewFile
     * @param {{additions?: object[], updates?: object[], deletions?: string[],
     *   signal?: AbortSignal}} [options] additions are the annotations to add,
     *   updates carry the id of the annotation they change, deletions are
     *   annotation ids.
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
     * Create a file status, or return the one that already has this name.
     * @param {string} name
     * @param {string} color Hex string, "#00FF00" for instance.
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The created or existing file status.
     */
    newFileStatus: async (name, color, { signal } = {}) =>
      (await getFileStatusByName(name, { signal })) ||
      http.create('file-status', { name, color }, { signal }),

    /**
     * @param {Model} fileStatus
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity|null>} The file status, null when missing.
     */
    getFileStatus: async (fileStatus, { signal } = {}) =>
      http.fetchOne('file-status', idOf(fileStatus), { signal }),

    getFileStatusByName,

    /**
     * @param {Model} previewFile Loaded for its extension, like gazu.
     * @param {RequestOptions} [options]
     * @returns {Promise<string>} Path of the original file, relative to the
     *   API host: pass it to http.download.
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
