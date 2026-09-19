import {
  idOf,
  optionalIdOf,
  requiredOf,
  sortedByName,
  withoutNil
} from '../core/params.js'

/**
 * @typedef {import('../core/params.js').Entity} Entity
 * @typedef {import('../core/params.js').Model} Model
 * @typedef {import('../core/params.js').RequestOptions} RequestOptions
 */

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
  const saveEntity = (entity, signal) =>
    http.put(`data/entities/${idOf(entity)}`, entity, { signal })

  // The base read is a plain get, not fetchOne: a missing entity must raise
  // instead of being merged as empty metadata.
  const mergeEntityData = async (model, entity, data, signal) => {
    const current = await http.get(
      `data/${model}/${idOf(entity)}`,
      {},
      { signal }
    )
    return saveEntity(
      { id: current.id, data: { ...(current.data || {}), ...data } },
      signal
    )
  }

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
     * Save the shot. Its metadata are fully replaced by the given ones.
     * @param {{id: string}} shot
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The updated shot.
     */
    updateShot: async (shot, { signal } = {}) => saveEntity(shot, signal),

    /**
     * Save the sequence. Its metadata are fully replaced by the given ones.
     * @param {{id: string}} sequence
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
      mergeEntityData('shots', shot, data, signal),

    /**
     * Update the sequence metadata. Keys that are not given are left
     * unchanged.
     * @param {Model} sequence
     * @param {object} [data]
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The updated sequence.
     */
    updateSequenceData: async (sequence, data = {}, { signal } = {}) =>
      mergeEntityData('sequences', sequence, data, signal),

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
     * Save the episode. Its metadata are fully replaced by the given ones.
     * @param {{id: string}} episode
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
      mergeEntityData('episodes', episode, data, signal),

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
      )
  }
}
