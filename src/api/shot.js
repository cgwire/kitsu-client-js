import {
  idOf,
  optionalIdOf,
  placeholdersToNull,
  requiredOf,
  sortedByName,
  withoutNil
} from '../core/params.js'
import * as urls from '../utils/urls.js'

/**
 * @typedef {import('../core/params.js').Entity} Entity
 * @typedef {import('../core/params.js').Model} Model
 * @typedef {import('../core/params.js').RequestOptions} RequestOptions
 * @typedef {import('../core/params.js').TransferOptions} TransferOptions
 */

// Same defaults as gazu. Zou fills these placeholders itself: they are not
// JavaScript template literals.
const otioNamingConvention = episodeId =>
  episodeId
    ? '${project_name}_${episode_name}-${sequence_name}-${shot_name}'
    : '${project_name}_${sequence_name}-${shot_name}'

export const shotApi = http => {
  const fetchOne = (model, entity, signal) =>
    http.fetchOne(model, idOf(entity), { signal })

  // An id or an object without its parent_id key says nothing about the
  // parent: the entity is read first. A missing entity has no parent.
  const parentIdOf = async (model, entity, signal) => {
    const known = typeof entity === 'object' && 'parent_id' in entity
    const source = known ? entity : await fetchOne(model, entity, signal)
    return source ? source.parent_id : null
  }

  // Like gazu: a sequence name is unique per episode on a TV show, per
  // project otherwise.
  const sequenceByName = (project, name, episode, signal) => {
    const projectId = idOf(project)
    const filter = { name: requiredOf('name', name) }
    return http.fetchFirst(
      'sequences',
      episode
        ? { ...filter, episode_id: idOf(episode) }
        : { ...filter, project_id: projectId },
      { signal }
    )
  }

  const episodeByName = (project, name, signal) =>
    http.fetchFirst(
      'episodes',
      { project_id: idOf(project), name: requiredOf('name', name) },
      { signal }
    )

  const shotByName = (sequence, name, signal) =>
    http.fetchFirst(
      'shots/all',
      { sequence_id: idOf(sequence), name: requiredOf('name', name) },
      { signal }
    )

  // Shots, sequences and episodes are all saved through the entity route.
  // The rows of allSequencesWithTasks and allEpisodesWithTasks write a
  // missing preview as '', which Zou refuses on save.
  const saveEntity = (entity, signal) =>
    http.update(
      'entities',
      idOf(entity),
      placeholdersToNull(entity, { preview_file_id: '' }),
      { signal }
    )

  // Only the given keys, which Zou merges into the stored metadata:
  // resending the others would revert concurrent changes and, on a shot,
  // fail for a supervisor with departments (Zou refuses that supervisor on
  // sequences and episodes whatever the keys).
  const saveEntityData = (entity, data, signal) =>
    http.update('entities', idOf(entity), { data: { ...data } }, { signal })

  const removeWithForce = (model, entity, force, signal) =>
    http.remove(model, idOf(entity), { force: force ? true : null }, { signal })

  const assetInstancesOf = (shot, signal) =>
    http.get(`data/shots/${idOf(shot)}/asset-instances`, {}, { signal })

  return {
    /**
     * @param {Model} shot
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} The preview files of the shot.
     */
    allPreviewsForShot: async (shot, { signal } = {}) =>
      http.fetchAll(`shots/${idOf(shot)}/preview-files`, {}, { signal }),

    /**
     * @param {Model} project
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} The shots of the project, sorted by name.
     */
    allShotsForProject: async (project, { signal } = {}) =>
      http
        .fetchAll(`projects/${idOf(project)}/shots`, {}, { signal })
        .then(sortedByName),

    /**
     * @param {Model} episode
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} The shots of the episode, sorted by name.
     */
    allShotsForEpisode: async (episode, { signal } = {}) =>
      http
        .fetchAll(`episodes/${idOf(episode)}/shots`, {}, { signal })
        .then(sortedByName),

    /**
     * @param {Model} sequence
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} The shots of the sequence, sorted by name.
     */
    allShotsForSequence: async (sequence, { signal } = {}) =>
      http
        .fetchAll(`sequences/${idOf(sequence)}/shots`, {}, { signal })
        .then(sortedByName),

    /**
     * @param {Model} project
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} The sequences of the project, sorted by name.
     */
    allSequencesForProject: async (project, { signal } = {}) =>
      http
        .fetchAll(`projects/${idOf(project)}/sequences`, {}, { signal })
        .then(sortedByName),

    /**
     * @param {Model} episode
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} The sequences of the episode, sorted by name.
     */
    allSequencesForEpisode: async (episode, { signal } = {}) =>
      http
        .fetchAll(`episodes/${idOf(episode)}/sequences`, {}, { signal })
        .then(sortedByName),

    /**
     * @param {Model} project
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} The episodes of the project, sorted by name.
     */
    allEpisodesForProject: async (project, { signal } = {}) =>
      http
        .fetchAll(`projects/${idOf(project)}/episodes`, {}, { signal })
        .then(sortedByName),

    /**
     * @param {Model} episode
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity|null>} The episode, null when it does not exist.
     */
    getEpisode: async (episode, { signal } = {}) =>
      fetchOne('episodes', episode, signal),

    /**
     * @param {Model} project
     * @param {string} episodeName
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity|null>} The episode of the project with that name.
     */
    getEpisodeByName: async (project, episodeName, { signal } = {}) =>
      episodeByName(project, episodeName, signal),

    /**
     * @param {Model} sequence The sequence object, or its id: the sequence is
     *   then read first to find its parent.
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity|null>} The parent episode, null when the
     *   sequence has none.
     */
    getEpisodeFromSequence: async (sequence, { signal } = {}) => {
      const episodeId = await parentIdOf('sequences', sequence, signal)
      return episodeId ? fetchOne('episodes', episodeId, signal) : null
    },

    /**
     * @param {Model} sequence
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity|null>} The sequence, null when it does not exist.
     */
    getSequence: async (sequence, { signal } = {}) =>
      fetchOne('sequences', sequence, signal),

    /**
     * @param {Model} project
     * @param {string} sequenceName
     * @param {{episode?: Model, signal?: AbortSignal}} [options] With an
     *   episode (TV show), the lookup is scoped to it instead of the project.
     * @returns {Promise<Entity|null>} The sequence with that name.
     */
    getSequenceByName: async (
      project,
      sequenceName,
      { episode, signal } = {}
    ) => sequenceByName(project, sequenceName, episode, signal),

    /**
     * @param {Model} shot The shot object, or its id: the shot is then read
     *   first to find its parent.
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity|null>} The parent sequence.
     */
    getSequenceFromShot: async (shot, { signal } = {}) => {
      const sequenceId = await parentIdOf('shots', shot, signal)
      return sequenceId ? fetchOne('sequences', sequenceId, signal) : null
    },

    /**
     * @param {Model} shot
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity|null>} The shot, null when it does not exist.
     */
    getShot: async (shot, { signal } = {}) => fetchOne('shots', shot, signal),

    /**
     * @param {Model} sequence
     * @param {string} shotName
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity|null>} The shot of the sequence with that name.
     */
    getShotByName: async (sequence, shotName, { signal } = {}) =>
      shotByName(sequence, shotName, signal),

    /**
     * Create a sequence, unless one already has that name in the project (or
     * in the episode): the existing sequence is then returned.
     * @param {Model} project
     * @param {string} name
     * @param {{episode?: Model, signal?: AbortSignal}} [options]
     * @returns {Promise<Entity>} The created or existing sequence.
     */
    newSequence: async (project, name, { episode, signal } = {}) => {
      const existing = await sequenceByName(project, name, episode, signal)
      if (existing) return existing
      return http.post(
        `data/projects/${idOf(project)}/sequences`,
        { name, ...withoutNil({ episode_id: optionalIdOf(episode) }) },
        { signal }
      )
    },

    /**
     * Create a shot, unless one already has that name in the sequence: the
     * existing shot is then returned. Frame in and frame out are stored in
     * the shot metadata.
     * @param {Model} project
     * @param {Model} sequence
     * @param {string} name
     * @param {{
     *   nbFrames?: number,
     *   frameIn?: number,
     *   frameOut?: number,
     *   description?: string,
     *   data?: object,
     *   signal?: AbortSignal
     * }} [options] data is a free field for metadata of any kind.
     * @returns {Promise<Entity>} The created or existing shot.
     */
    newShot: async (
      project,
      sequence,
      name,
      { nbFrames, frameIn, frameOut, description, data, signal } = {}
    ) => {
      const body = {
        name,
        data: {
          ...data,
          ...withoutNil({ frame_in: frameIn, frame_out: frameOut })
        },
        sequence_id: idOf(sequence),
        ...withoutNil({ nb_frames: nbFrames, description })
      }
      const path = `data/projects/${idOf(project)}/shots`
      const existing = await shotByName(sequence, name, signal)
      return existing || http.post(path, body, { signal })
    },

    /**
     * Save the shot. Zou merges the given metadata into the stored ones: a
     * key left out keeps its value, a key set to null is stored as null.
     * @param {Entity} shot
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The updated shot.
     */
    updateShot: async (shot, { signal } = {}) => saveEntity(shot, signal),

    /**
     * Save the sequence. Zou merges the given metadata into the stored
     * ones: a key left out keeps its value, a key set to null is stored as
     * null. A row of allSequencesWithTasks can be saved back as it is: its
     * missing preview, written '', is sent as null.
     * @param {Entity} sequence
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The updated sequence.
     */
    updateSequence: async (sequence, { signal } = {}) =>
      saveEntity(sequence, signal),

    /**
     * @param {Model} shot
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} The asset instances linked to the shot.
     */
    getAssetInstancesForShot: async (shot, { signal } = {}) =>
      assetInstancesOf(shot, signal),

    /**
     * Alias of getAssetInstancesForShot, kept for parity with gazu.
     * @param {Model} shot
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} The asset instances linked to the shot.
     */
    allAssetInstancesForShot: async (shot, { signal } = {}) =>
      assetInstancesOf(shot, signal),

    /**
     * Update the shot metadata. Keys that are not given are left unchanged.
     * @param {Model} shot
     * @param {object} [data]
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The updated shot.
     */
    updateShotData: async (shot, data = {}, { signal } = {}) =>
      saveEntityData(shot, data, signal),

    /**
     * Update the sequence metadata. Keys that are not given are left
     * unchanged.
     * @param {Model} sequence
     * @param {object} [data]
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The updated sequence.
     */
    updateSequenceData: async (sequence, data = {}, { signal } = {}) =>
      saveEntityData(sequence, data, signal),

    /**
     * A shot with tasks is only marked as canceled, unless forced.
     * @param {Model} shot
     * @param {{force?: boolean, signal?: AbortSignal}} [options] force deletes
     *   the shot even when tasks are linked to it.
     * @returns {Promise<null>}
     */
    removeShot: async (shot, { force = false, signal } = {}) =>
      removeWithForce('shots', shot, force, signal),

    /**
     * Uncancel the shot.
     * @param {Model} shot
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The restored shot.
     */
    restoreShot: async (shot, { signal } = {}) =>
      http.put(`data/shots/${idOf(shot)}`, { canceled: false }, { signal }),

    /**
     * Create an episode, unless one already has that name in the project:
     * the existing episode is then returned.
     * @param {Model} project
     * @param {string} name
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The created or existing episode.
     */
    newEpisode: async (project, name, { signal } = {}) => {
      const existing = await episodeByName(project, name, signal)
      if (existing) return existing
      return http.post(
        `data/projects/${idOf(project)}/episodes`,
        { name },
        { signal }
      )
    },

    /**
     * Save the episode. Zou merges the given metadata into the stored
     * ones: a key left out keeps its value, a key set to null is stored as
     * null. A row of allEpisodesWithTasks can be saved back as it is: its
     * missing preview, written '', is sent as null.
     * @param {Entity} episode
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The updated episode.
     */
    updateEpisode: async (episode, { signal } = {}) =>
      saveEntity(episode, signal),

    /**
     * Update the episode metadata. Keys that are not given are left
     * unchanged.
     * @param {Model} episode
     * @param {object} [data]
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The updated episode.
     */
    updateEpisodeData: async (episode, data = {}, { signal } = {}) =>
      saveEntityData(episode, data, signal),

    /**
     * Without force, the deletion fails when records are linked to the
     * episode.
     * @param {Model} episode
     * @param {{force?: boolean, signal?: AbortSignal}} [options] force also
     *   deletes the linked sequences, shots, assets, playlists and tasks.
     * @returns {Promise<null>}
     */
    removeEpisode: async (episode, { force = false, signal } = {}) =>
      removeWithForce('episodes', episode, force, signal),

    /**
     * Without force, the deletion fails when records are linked to the
     * sequence.
     * @param {Model} sequence
     * @param {{force?: boolean, signal?: AbortSignal}} [options] force also
     *   deletes the linked shots and tasks.
     * @returns {Promise<null>}
     */
    removeSequence: async (sequence, { force = false, signal } = {}) =>
      removeWithForce('sequences', sequence, force, signal),

    /**
     * @param {Model} shot
     * @param {Model} assetInstance
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The related shot.
     */
    addAssetInstanceToShot: async (shot, assetInstance, { signal } = {}) =>
      http.post(
        `data/shots/${idOf(shot)}/asset-instances`,
        { asset_instance_id: idOf(assetInstance) },
        { signal }
      ),

    /**
     * @param {Model} shot
     * @param {Model} assetInstance
     * @param {RequestOptions} [options]
     * @returns {Promise<null>}
     */
    removeAssetInstanceFromShot: async (shot, assetInstance, { signal } = {}) =>
      http.del(
        `data/shots/${idOf(shot)}/asset-instances/${idOf(assetInstance)}`,
        undefined,
        { signal }
      ),

    /**
     * Import the shots of a CSV file, as exported by exportShotsWithCsv, into
     * the project.
     * @param {Model} project
     * @param {Blob} csvFile The CSV data, as a Blob or a File.
     * @param {TransferOptions & {update?: boolean}} [options] update also
     *   updates the shots that already exist.
     * @returns {Promise<Entity[]>} The shots created by the import.
     */
    importShotsWithCsv: async (
      project,
      csvFile,
      { update = false, fileName, onProgress, signal } = {}
    ) =>
      http.upload(`import/csv/projects/${idOf(project)}/shots`, {
        file: requiredOf('csvFile', csvFile),
        query: { update: update ? true : null },
        fileName,
        onProgress,
        signal
      }),

    /**
     * Import shots from an OpenTimelineIO file, or from any format an OTIO
     * adapter reads (EDL, ...). Zou picks the adapter from the extension of
     * the file name: a plain Blob has none, so give fileName with it.
     * @param {Model} project
     * @param {Blob} otioFile The timeline data, as a Blob or a File.
     * @param {TransferOptions & {
     *   episode?: Model,
     *   namingConvention?: string,
     *   matchCase?: boolean
     * }} [options] namingConvention is the template matching the shot names
     *   of the file, by default
     *   "${project_name}_${sequence_name}-${shot_name}" (with
     *   "${episode_name}-" before the sequence when an episode is given).
     *   matchCase (true by default) matches the shot names case-sensitively.
     * @returns {Promise<{created_shots: Entity[], updated_shots: Entity[]}>}
     *   The shots altered by the import.
     */
    importOtio: async (
      project,
      otioFile,
      {
        episode,
        namingConvention,
        matchCase = true,
        fileName,
        onProgress,
        signal
      } = {}
    ) => {
      const episodeId = optionalIdOf(episode)
      const projectPath = `import/otio/projects/${idOf(project)}`
      return http.upload(
        episodeId ? `${projectPath}/episodes/${episodeId}` : projectPath,
        {
          file: requiredOf('otioFile', otioFile),
          fields: {
            naming_convention:
              namingConvention || otioNamingConvention(episodeId),
            match_case: matchCase
          },
          fileName,
          onProgress,
          signal
        }
      )
    },

    /**
     * @param {Model} project
     * @param {{
     *   episode?: Model,
     *   assignedTo?: Model,
     *   signal?: AbortSignal
     * }} [options] episode keeps the shots of that episode only, assignedTo
     *   the shots with at least one task assigned to that person.
     * @returns {Promise<string>} The shots of the project, as CSV.
     */
    exportShotsWithCsv: async (project, { episode, assignedTo, signal } = {}) =>
      http.request('GET', `export/csv/projects/${idOf(project)}/shots.csv`, {
        query: {
          episode_id: optionalIdOf(episode),
          assigned_to: optionalIdOf(assignedTo)
        },
        signal,
        // A CSV table: the http core refuses a non-JSON body unless told how
        // to read it.
        read: response => response.text()
      }),

    /**
     * The shots with their tasks, as the shot list of the Kitsu web app loads
     * them (streamed when the API supports it).
     * @param {{
     *   project?: Model,
     *   episode?: Model,
     *   signal?: AbortSignal
     * }} [options]
     * @returns {Promise<Entity[]>} The shots, each with its tasks.
     */
    allShotsWithTasks: async ({ project, episode, signal } = {}) =>
      http.getNdjson(
        'data/shots/with-tasks',
        {
          project_id: optionalIdOf(project),
          episode_id: optionalIdOf(episode)
        },
        { signal }
      ),

    /**
     * @param {Model} project
     * @param {{episode?: Model, signal?: AbortSignal}} [options] episode keeps
     *   the sequences of that episode only.
     * @returns {Promise<Entity[]>} The sequences, each with its tasks.
     */
    allSequencesWithTasks: async (project, { episode, signal } = {}) =>
      http.get(
        'data/sequences/with-tasks',
        { project_id: idOf(project), episode_id: optionalIdOf(episode) },
        { signal }
      ),

    /**
     * @param {Model} project
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} The episodes, each with its tasks.
     */
    allEpisodesWithTasks: async (project, { signal } = {}) =>
      http.get(
        'data/episodes/with-tasks',
        { project_id: idOf(project) },
        { signal }
      ),

    /**
     * @param {Model} project
     * @param {RequestOptions} [options]
     * @returns {Promise<Object<string, object>>} The task counts per status
     *   and task type, keyed by episode id ("all" sums the episodes).
     */
    getEpisodeStats: async (project, { signal } = {}) =>
      http.get(`data/projects/${idOf(project)}/episodes/stats`, {}, { signal }),

    /**
     * @param {Model} project
     * @param {RequestOptions} [options]
     * @returns {Promise<Object<string, object>>} The retake counts per task
     *   type, keyed by episode id ("all" sums the episodes).
     */
    getEpisodeRetakeStats: async (project, { signal } = {}) =>
      http.get(
        `data/projects/${idOf(project)}/episodes/retake-stats`,
        {},
        { signal }
      ),

    /**
     * @param {Model} shot
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} The data history of the shot: one version
     *   per change of its metadata.
     */
    allVersionsForShot: async (shot, { signal } = {}) =>
      http.get(`data/shots/${idOf(shot)}/versions`, {}, { signal }),

    /**
     * Set the number of frames of the shots from the length of their latest
     * preview for the task type.
     * @param {Model} taskType
     * @param {Model} project
     * @param {{episode?: Model, signal?: AbortSignal}} [options] episode
     *   limits the change to the shots of that episode.
     * @returns {Promise<{id: string, nb_frames: number}[]>} The new number of
     *   frames of each updated shot.
     */
    setNbFramesFromTaskTypePreviews: async (
      taskType,
      project,
      { episode, signal } = {}
    ) =>
      http.request(
        'POST',
        `actions/projects/${idOf(project)}/task-types/${idOf(taskType)}` +
          '/set-shot-nb-frames',
        { query: { episode_id: optionalIdOf(episode) }, signal }
      ),

    /**
     * @param {Model} episode
     * @param {RequestOptions} [options]
     * @returns {Promise<string>} URL of the episode shots in the Kitsu web app.
     */
    getEpisodeUrl: async (episode, { signal } = {}) =>
      urls.getEpisodeUrl(
        urls.webHostOf(http.host),
        await http.get(`data/episodes/${idOf(episode)}`, {}, { signal })
      ),

    /**
     * @param {Model} shot
     * @param {RequestOptions} [options]
     * @returns {Promise<string>} URL of the shot page in the Kitsu web app.
     */
    getShotUrl: async (shot, { signal } = {}) =>
      urls.getShotUrl(
        urls.webHostOf(http.host),
        await http.get(`data/shots/${idOf(shot)}`, {}, { signal })
      ),

    /**
     * @param {Model} sequence
     * @param {RequestOptions} [options]
     * @returns {Promise<string>} URL of the sequence page in the Kitsu web app.
     */
    getSequenceUrl: async (sequence, { signal } = {}) =>
      urls.getSequenceUrl(
        urls.webHostOf(http.host),
        await http.get(`data/sequences/${idOf(sequence)}`, {}, { signal })
      ),

    /**
     * @param {Model} project
     * @returns {Promise<string>} URL of the episode list in the Kitsu web app.
     */
    getAllEpisodesUrl: async project =>
      urls.getAllEpisodesUrl(urls.webHostOf(http.host), project),

    /**
     * @param {Model} project
     * @returns {Promise<string>} URL of the sequence list in the Kitsu web app.
     */
    getAllSequencesUrl: async project =>
      urls.getAllSequencesUrl(urls.webHostOf(http.host), project)
  }
}
