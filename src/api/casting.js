import { ParameterError } from '../core/errors.js'
import { idOf, orNull, requiredOf, withoutNil } from '../core/params.js'

/**
 * @typedef {import('../core/params.js').Entity} Entity
 * @typedef {import('../core/params.js').Model} Model
 * @typedef {import('../core/params.js').RequestOptions} RequestOptions
 * @typedef {{
 *   asset_id: string,
 *   nb_occurences: number,
 *   label?: string,
 *   [field: string]: any
 * }} CastingEntry An asset of a casting. The other fields of a casting read
 *   can be sent back as they are.
 * @typedef {Record<string, CastingEntry[]>} CastingMap Casting lists keyed by
 *   entity id.
 * @typedef {{
 *   shot_id: string,
 *   shot_name: string,
 *   sequence_name: string,
 *   episode_id: string,
 *   episode_name: string|null,
 *   preview_file_id: string|null,
 *   nb_occurences: number
 * }} ShotCastIn A shot an asset is cast in. Its episode_id is the string
 *   'None' when the shot belongs to no episode.
 * @typedef {{
 *   asset_id: string,
 *   asset_name: string,
 *   asset_type_name: string,
 *   preview_file_id: string|null,
 *   nb_occurences: number
 * }} AssetCastIn An asset holding the asset in its casting, such as a set.
 * @typedef {import('../core/params.js').TransferOptions} TransferOptions
 */

const isCastingEntry = entry =>
  entry !== null &&
  typeof entry === 'object' &&
  typeof entry.asset_id === 'string' &&
  Number.isInteger(entry.nb_occurences) &&
  entry.nb_occurences >= 0

// Zou empties the casting first, then creates the entries holding both an
// asset_id and a nb_occurences: any other entry would drop its asset without
// an error. It compares the asset ids of an episode casting as strings: an id
// in uppercase would read as a removed asset, uncast from every shot of the
// episode.
const castingOf = casting => {
  if (!Array.isArray(requiredOf('casting', casting))) {
    throw new ParameterError('Wrong format: casting must be a list of entries')
  }
  return casting.map(entry => {
    if (!isCastingEntry(entry)) {
      throw new ParameterError(
        'Wrong format: each casting entry needs an asset_id and nb_occurences, a whole number'
      )
    }
    return { ...entry, asset_id: idOf(entry.asset_id) }
  })
}

const castingsOf = castings => {
  const given = requiredOf('castings', castings)
  if (typeof given !== 'object' || Array.isArray(given)) {
    throw new ParameterError(
      'Wrong format: castings must map entity ids to casting lists'
    )
  }
  return Object.fromEntries(
    Object.entries(given).map(([entityId, casting]) => [
      idOf(entityId),
      castingOf(casting)
    ])
  )
}

export const castingApi = http => {
  const read = (path, signal) => orNull(http.get(path, {}, { signal }))

  const entityCastingPath = (project, entity) =>
    `data/projects/${idOf(project)}/entities/${idOf(entity)}/casting`

  // Like gazu, these getters find the project on the entity itself. An id,
  // or an object without its project_id, is read first: a missing entity
  // has no casting.
  const projectIdOf = async (model, entity, signal) => {
    const known =
      entity !== null && typeof entity === 'object' && entity.project_id
    const source = known
      ? entity
      : await http.fetchOne(model, idOf(entity), { signal })
    return source === null ? null : idOf(source.project_id)
  }

  const readEntityCasting = async (model, entity, signal) => {
    const projectId = await projectIdOf(model, entity, signal)
    return projectId === null
      ? null
      : read(entityCastingPath(projectId, entity), signal)
  }

  const updateEntityCasting = (project, entity, casting, signal) =>
    http.put(entityCastingPath(project, entity), castingOf(casting), {
      signal
    })

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
     * @param {CastingEntry[]} casting Every entry needs its asset_id and
     *   nb_occurences: an empty list removes every asset.
     * @param {RequestOptions} [options]
     * @returns {Promise<CastingEntry[]>} The casting, as sent: Zou answers
     *   the request body.
     */
    updateShotCasting: async (project, shot, casting, { signal } = {}) =>
      updateEntityCasting(project, shot, casting, signal),

    /**
     * Replace the whole casting of an asset.
     * @param {Model} project
     * @param {Model} asset
     * @param {CastingEntry[]} casting Every entry needs its asset_id and
     *   nb_occurences: an empty list removes every asset.
     * @param {RequestOptions} [options]
     * @returns {Promise<CastingEntry[]>} The casting, as sent: Zou answers
     *   the request body.
     */
    updateAssetCasting: async (project, asset, casting, { signal } = {}) =>
      updateEntityCasting(project, asset, casting, signal),

    /**
     * Replace the whole casting of an episode. Zou also removes the assets
     * it leaves out from the casting of every shot of the episode.
     * @param {Model} project
     * @param {Model} episode
     * @param {CastingEntry[]} casting Every entry needs its asset_id and
     *   nb_occurences: an empty list removes every asset, from the episode
     *   and from its shots.
     * @param {RequestOptions} [options]
     * @returns {Promise<CastingEntry[]>} The casting, as sent: Zou answers
     *   the request body.
     */
    updateEpisodeCasting: async (project, episode, casting, { signal } = {}) =>
      updateEntityCasting(project, episode, casting, signal),

    /**
     * Replace the whole casting of several entities in one request. Entities
     * missing from the map keep their casting.
     * @param {Model} project
     * @param {CastingMap} castings The new casting of each entity, keyed by
     *   entity id. Every entry needs its asset_id and nb_occurences.
     * @param {RequestOptions} [options]
     * @returns {Promise<CastingMap>} The updated casting of each entity.
     */
    updateCastings: async (project, castings, { signal } = {}) =>
      http.put(
        `data/projects/${idOf(project)}/entities/casting`,
        castingsOf(castings),
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
     * @param {Model} sequence The project of the casting is its project_id:
     *   a sequence given as an id, or without it, is read first.
     * @param {RequestOptions} [options]
     * @returns {Promise<CastingMap|null>} The casting of each shot of the
     *   sequence, null when the sequence does not exist.
     */
    getSequenceCasting: async (sequence, { signal } = {}) => {
      const projectId = await projectIdOf('sequences', sequence, signal)
      return projectId === null
        ? null
        : read(
            `data/projects/${projectId}/sequences/${idOf(sequence)}/casting`,
            signal
          )
    },

    /**
     * @param {Model} shot The project of the casting is its project_id: a
     *   shot given as an id, or without it, is read first.
     * @param {RequestOptions} [options]
     * @returns {Promise<CastingEntry[]|null>} The casting of the shot, null
     *   when the shot does not exist.
     */
    getShotCasting: async (shot, { signal } = {}) =>
      readEntityCasting('shots', shot, signal),

    /**
     * @param {Model} asset The project of the casting is its project_id: an
     *   asset given as an id, or without it, is read first.
     * @param {RequestOptions} [options]
     * @returns {Promise<CastingEntry[]|null>} The casting of the asset, null
     *   when the asset does not exist.
     */
    getAssetCasting: async (asset, { signal } = {}) =>
      readEntityCasting('assets', asset, signal),

    /**
     * @param {Model} episode The project of the casting is its project_id: an
     *   episode given as an id, or without it, is read first.
     * @param {RequestOptions} [options]
     * @returns {Promise<CastingEntry[]|null>} The casting of the episode, null
     *   when the episode does not exist.
     */
    getEpisodeCasting: async (episode, { signal } = {}) =>
      readEntityCasting('episodes', episode, signal),

    /**
     * @param {Model} asset
     * @param {RequestOptions} [options]
     * @returns {Promise<(ShotCastIn|AssetCastIn)[]|null>} The shots, then the
     *   assets, the asset is cast in. The rows carry no id of their own.
     */
    getAssetCastIn: async (asset, { signal } = {}) =>
      read(`data/assets/${idOf(asset)}/cast-in`, signal),

    /**
     * @param {Model} project
     * @param {{page?: number, limit?: number, signal?: AbortSignal}} [options]
     *   limit only applies with a page, like in gazu.
     * @returns {Promise<Entity[]|{
     *   data: Entity[],
     *   total: number,
     *   nb_pages: number,
     *   limit: number,
     *   offset: number,
     *   page: number
     * }>} Every entity link of the project, or one page envelope, the links
     *   in "data", when a page is given.
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
     * Delete the link through the generic route, like gazu: it needs an
     * admin, and Zou deletes the row alone, without updating the casting
     * counts of the entity nor sending a casting event. To take an asset out
     * of a casting, use uncastAsset.
     * @param {Model} entityLink
     * @param {RequestOptions} [options]
     * @returns {Promise<{id: string, [field: string]: any}>} The deleted link,
     *   as given (an id comes back as `{ id }`), like gazu.
     */
    deleteEntityLink: async (entityLink, { signal } = {}) => {
      const id = idOf(entityLink)
      await http.del(`data/entity-links/${id}`, undefined, { signal })
      return typeof entityLink === 'object' ? entityLink : { id }
    }
  }
}
