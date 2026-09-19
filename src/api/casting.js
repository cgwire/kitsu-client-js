import { idOf, orNull, requiredOf, withoutNil } from '../core/params.js'

/**
 * @typedef {import('../core/params.js').Entity} Entity
 * @typedef {import('../core/params.js').Model} Model
 * @typedef {import('../core/params.js').RequestOptions} RequestOptions
 * @typedef {{asset_id: string, nb_occurences?: number, [field: string]: any}}
 *   CastingEntry
 * @typedef {Record<string, CastingEntry[]>} CastingMap Casting lists keyed by
 *   entity id.
 * @typedef {import('../core/params.js').TransferOptions} TransferOptions
 */

export const castingApi = http => {
  const read = (path, signal) => orNull(http.get(path, {}, { signal }))

  const entityCastingPath = (project, entity) =>
    `data/projects/${idOf(project)}/entities/${idOf(entity)}/casting`

  // Like gazu, these getters find the project on the entity itself: an id
  // alone is rejected instead of costing a second request.
  const readEntityCasting = (entity, signal) =>
    read(entityCastingPath(entity && entity.project_id, entity), signal)

  const updateEntityCasting = (project, entity, casting, signal) =>
    http.put(entityCastingPath(project, entity), casting, { signal })

  const castAsset = (project, entities, asset, data, signal) =>
    http.put(
      `data/projects/${idOf(project)}/entities/casting/assets/${idOf(asset)}`,
      {
        entity_ids: (Array.isArray(entities) ? entities : [entities]).map(idOf),
        ...withoutNil(data)
      },
      { signal }
    )

  return {
    /**
     * Replace the whole casting of a shot.
     * @param {Model} project
     * @param {Model} shot
     * @param {CastingEntry[]} casting
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The updated shot.
     */
    updateShotCasting: async (project, shot, casting, { signal } = {}) =>
      updateEntityCasting(project, shot, casting, signal),

    /**
     * Replace the whole casting of an asset.
     * @param {Model} project
     * @param {Model} asset
     * @param {CastingEntry[]} casting
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The updated asset.
     */
    updateAssetCasting: async (project, asset, casting, { signal } = {}) =>
      updateEntityCasting(project, asset, casting, signal),

    /**
     * Replace the whole casting of an episode.
     * @param {Model} project
     * @param {Model} episode
     * @param {CastingEntry[]} casting
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The updated episode.
     */
    updateEpisodeCasting: async (project, episode, casting, { signal } = {}) =>
      updateEntityCasting(project, episode, casting, signal),

    /**
     * Replace the whole casting of several entities in one request. Entities
     * missing from the map keep their casting.
     * @param {Model} project
     * @param {CastingMap} castings The new casting of each entity, keyed by
     *   entity id.
     * @param {RequestOptions} [options]
     * @returns {Promise<CastingMap>} The updated casting of each entity.
     */
    updateCastings: async (project, castings, { signal } = {}) =>
      http.put(
        `data/projects/${idOf(project)}/entities/casting`,
        requiredOf('castings', castings),
        { signal }
      ),

    /**
     * Import the breakdown of a CSV file into the project.
     * @param {Model} project
     * @param {Blob} csvFile The CSV data, as a Blob or a File.
     * @param {TransferOptions} [options]
     * @returns {Promise<null[]>} One entry per imported row: Zou answers no
     *   data for a casting row.
     */
    importCastingWithCsv: async (
      project,
      csvFile,
      { fileName, onProgress, signal } = {}
    ) =>
      http.upload(`import/csv/projects/${idOf(project)}/casting`, {
        file: requiredOf('csvFile', csvFile),
        fileName,
        onProgress,
        signal
      }),

    /**
     * Cast an asset in entities without touching the rest of their casting.
     * Prefer it to the update*Casting functions when several people edit the
     * breakdown at once.
     * @param {Model} project
     * @param {Model|Model[]} entities Shots, assets or episodes.
     * @param {Model} asset
     * @param {{nbOccurences?: number, label?: string, signal?: AbortSignal}}
     *   [options] Omit nbOccurences or label to keep the current value (1
     *   occurence on a new link); 0 occurence removes the asset.
     * @returns {Promise<CastingMap>} The updated casting of each entity.
     */
    castAsset: async (
      project,
      entities,
      asset,
      { nbOccurences, label, signal } = {}
    ) =>
      castAsset(
        project,
        entities,
        asset,
        { nb_occurences: nbOccurences, label },
        signal
      ),

    /**
     * Remove an asset from the casting of entities, leaving their other
     * assets as they are.
     * @param {Model} project
     * @param {Model|Model[]} entities
     * @param {Model} asset
     * @param {RequestOptions} [options]
     * @returns {Promise<CastingMap>} The updated casting of each entity.
     */
    uncastAsset: async (project, entities, asset, { signal } = {}) =>
      castAsset(project, entities, asset, { nb_occurences: 0 }, signal),

    /**
     * @param {Model} project
     * @param {Model} assetType
     * @param {RequestOptions} [options]
     * @returns {Promise<CastingMap|null>} The casting of each asset of the
     *   type.
     */
    getAssetTypeCasting: async (project, assetType, { signal } = {}) =>
      read(
        `data/projects/${idOf(project)}/asset-types/${idOf(assetType)}/casting`,
        signal
      ),

    /**
     * @param {Entity} sequence The sequence object: its project_id is needed.
     * @param {RequestOptions} [options]
     * @returns {Promise<CastingMap|null>} The casting of each shot of the
     *   sequence.
     */
    getSequenceCasting: async (sequence, { signal } = {}) =>
      read(
        `data/projects/${idOf(sequence && sequence.project_id)}` +
          `/sequences/${idOf(sequence)}/casting`,
        signal
      ),

    /**
     * @param {Entity} shot The shot object: its project_id is needed.
     * @param {RequestOptions} [options]
     * @returns {Promise<CastingEntry[]|null>}
     */
    getShotCasting: async (shot, { signal } = {}) =>
      readEntityCasting(shot, signal),

    /**
     * @param {Entity} asset The asset object: its project_id is needed.
     * @param {RequestOptions} [options]
     * @returns {Promise<CastingEntry[]|null>}
     */
    getAssetCasting: async (asset, { signal } = {}) =>
      readEntityCasting(asset, signal),

    /**
     * @param {Entity} episode The episode object: its project_id is needed.
     * @param {RequestOptions} [options]
     * @returns {Promise<CastingEntry[]|null>}
     */
    getEpisodeCasting: async (episode, { signal } = {}) =>
      readEntityCasting(episode, signal),

    /**
     * @param {Model} asset
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]|null>} The entities the asset is cast in.
     */
    getAssetCastIn: async (asset, { signal } = {}) =>
      read(`data/assets/${idOf(asset)}/cast-in`, signal),

    /**
     * @param {Model} project
     * @param {{page?: number, limit?: number, signal?: AbortSignal}} [options]
     *   limit only applies with a page, like in gazu.
     * @returns {Promise<Entity[]|Entity>} Every entity link of the project, or
     *   one paginated answer ("data" and the pagination fields) when a page
     *   is given.
     */
    allEntityLinksForProject: async (project, { page, limit, signal } = {}) => {
      const paginated = page !== null && page !== undefined
      return http.fetchAll(
        `projects/${idOf(project)}/entity-links`,
        paginated ? { page, limit } : {},
        { signal }
      )
    },

    /**
     * @param {Model} project
     * @param {RequestOptions} [options]
     * @returns {Promise<CastingMap|null>} The casting of each episode.
     */
    getEpisodesCasting: async (project, { signal } = {}) =>
      read(`data/projects/${idOf(project)}/episodes/casting`, signal),

    /**
     * @param {Model} project
     * @param {Model} sequence
     * @param {RequestOptions} [options]
     * @returns {Promise<CastingMap|null>} The casting of each shot of the
     *   sequence.
     */
    getSequenceShotsCasting: async (project, sequence, { signal } = {}) =>
      read(
        `data/projects/${idOf(project)}/sequences/${idOf(sequence)}/casting`,
        signal
      ),

    /**
     * @param {Model} project
     * @param {Model} episode
     * @param {RequestOptions} [options]
     * @returns {Promise<CastingMap|null>} The casting of each shot of the
     *   episode.
     */
    getEpisodeShotsCasting: async (project, episode, { signal } = {}) =>
      read(
        `data/projects/${idOf(project)}/episodes/${idOf(episode)}` +
          '/sequences/all/casting',
        signal
      ),

    /**
     * @param {Model} project
     * @param {RequestOptions} [options]
     * @returns {Promise<CastingMap|null>} The casting of each shot of the
     *   project.
     */
    getProjectShotsCasting: async (project, { signal } = {}) =>
      read(`data/projects/${idOf(project)}/sequences/all/casting`, signal),

    /**
     * @param {Model} entityLink
     * @param {RequestOptions} [options]
     * @returns {Promise<Model|{id: string}>} The deleted link, as given (an
     *   id comes back as `{ id }`), like gazu.
     */
    deleteEntityLink: async (entityLink, { signal } = {}) => {
      const id = idOf(entityLink)
      await http.del(`data/entity-links/${id}`, undefined, { signal })
      return typeof entityLink === 'object' ? entityLink : { id }
    }
  }
}
