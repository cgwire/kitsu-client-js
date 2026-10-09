import { ParameterError } from '../core/errors.js'
import {
  idOf,
  idsOf,
  optionalIdOf,
  requiredOf,
  sortedByName,
  withoutNil
} from '../core/params.js'
import * as urls from '../utils/urls.js'

/**
 * @typedef {import('../core/params.js').Entity} Entity
 * @typedef {import('../core/params.js').Model} Model
 * @typedef {import('../core/params.js').RequestOptions} RequestOptions
 */

export const assetApi = http => {
  /**
   * @param {Model|null} project null lists the assets of every project.
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} Assets of the project, sorted by name.
   */
  const allAssetsForProject = async (project, { signal } = {}) => {
    const projectId = optionalIdOf(project)
    const path =
      projectId === null ? 'assets/all' : `projects/${projectId}/assets`
    return http.fetchAll(path, {}, { signal }).then(sortedByName)
  }

  /**
   * @param {Model} project
   * @param {string} name
   * @param {{assetType?: Model, signal?: AbortSignal}} [options]
   * @returns {Promise<Entity|null>} First asset of the project matching the
   *   name (and the asset type when given), null when there is none.
   */
  const getAssetByName = async (project, name, { assetType, signal } = {}) =>
    http.fetchFirst(
      'assets/all',
      {
        project_id: idOf(project),
        name: requiredOf('name', name),
        entity_type_id: optionalIdOf(assetType)
      },
      { signal }
    )

  /**
   * @param {Model} asset
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity|null>} The asset, null when it does not exist.
   */
  const getAsset = async (asset, { signal } = {}) =>
    http.fetchOne('assets', idOf(asset), { signal })

  /**
   * Save the asset. It must already exist.
   * @param {{id: string, [field: string]: any}} asset
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The updated asset.
   */
  const updateAsset = async (asset, { signal } = {}) =>
    http.update(
      'entities',
      idOf(asset),
      // Zou stores the episode of an asset in source_id.
      'episode_id' in asset ? { ...asset, source_id: asset.episode_id } : asset,
      { signal }
    )

  /**
   * @param {Model} assetType
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity|null>} The asset type, null when missing.
   */
  const getAssetType = async (assetType, { signal } = {}) =>
    http.fetchOne('asset-types', idOf(assetType), { signal })

  /**
   * @param {string} name
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity|null>} First asset type matching the name.
   */
  const getAssetTypeByName = async (name, { signal } = {}) =>
    http.fetchFirst(
      'entity-types',
      { name: requiredOf('name', name) },
      { signal }
    )

  return {
    /**
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} Assets of all open projects, sorted by name.
     */
    allAssetsForOpenProjects: async ({ signal } = {}) =>
      http
        .fetchAll('projects/open', {}, { signal })
        .then(projects =>
          Promise.all(
            projects.map(project => allAssetsForProject(project, { signal }))
          )
        )
        .then(assetLists => sortedByName(assetLists.flat())),

    allAssetsForProject,

    /**
     * @param {{
     *   project?: Model,
     *   episode?: Model,
     *   isShared?: boolean,
     *   signal?: AbortSignal
     * }} [options] episode keeps the assets of the episode and the ones casted
     *   in it. isShared keeps the assets shared between projects (true) or the
     *   other ones (false).
     * @returns {Promise<Entity[]>} Assets matching the filters, sorted by name.
     */
    allAssets: async ({ project, episode, isShared, signal } = {}) =>
      http
        .fetchAll(
          'assets',
          {
            project_id: optionalIdOf(project),
            episode_id: optionalIdOf(episode),
            is_shared: isShared
          },
          { signal }
        )
        .then(sortedByName),

    /**
     * Assets with their tasks, read as a stream (NDJSON) when Zou serves one:
     * made for full project views.
     * @param {{project?: Model, episode?: Model, signal?: AbortSignal}} [options]
     * @returns {Promise<Entity[]>} Assets, each with its tasks, in the order
     *   given by Zou.
     */
    allAssetsWithTasks: async ({ project, episode, signal } = {}) =>
      http.getNdjson(
        'data/assets/with-tasks',
        {
          project_id: optionalIdOf(project),
          episode_id: optionalIdOf(episode)
        },
        { signal }
      ),

    /**
     * @param {Model} project
     * @param {{episode?: Model, signal?: AbortSignal}} [options] episode keeps
     *   the shared assets used in that episode.
     * @returns {Promise<Entity[]>} Assets shared by other projects and used in
     *   the project, sorted by name.
     */
    allSharedAssetsUsedInProject: async (project, { episode, signal } = {}) => {
      const episodeId = optionalIdOf(episode)
      const scope = episodeId === null ? '' : `/episodes/${episodeId}`
      return http
        .fetchAll(
          `projects/${idOf(project)}${scope}/assets/shared-used`,
          {},
          { signal }
        )
        .then(sortedByName)
    },

    /**
     * Share assets between projects, or stop sharing them. The scope is the
     * given assets, narrowed or replaced by a project, or by an asset type of
     * a project (assets is ignored by Zou in that last case).
     * @param {{
     *   assets?: Model[],
     *   project?: Model,
     *   assetType?: Model,
     *   isShared?: boolean,
     *   signal?: AbortSignal
     * }} [options] Without a project, assets is required. assetType needs its
     *   project.
     * @returns {Promise<Entity[]>} The updated assets.
     */
    shareAssets: async ({
      assets,
      project,
      assetType,
      isShared = true,
      signal
    } = {}) => {
      const projectId = optionalIdOf(project)
      const assetTypeId = optionalIdOf(assetType)
      if (projectId === null && assetTypeId !== null) {
        throw new ParameterError(
          'Missing parameter: project is required with assetType'
        )
      }
      if (projectId === null) requiredOf('assets', assets)
      const typeScope =
        assetTypeId === null ? '' : `asset-types/${assetTypeId}/`
      const scope =
        projectId === null ? '' : `projects/${projectId}/${typeScope}`
      return http.post(
        `actions/${scope}assets/share`,
        {
          ...withoutNil({ asset_ids: assets ? idsOf(assets) : null }),
          is_shared: isShared
        },
        { signal }
      )
    },

    /**
     * @param {Model} episode
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} Assets of the episode, sorted by name.
     */
    allAssetsForEpisode: async (episode, { signal } = {}) =>
      http
        .fetchAll('assets', { source_id: idOf(episode) }, { signal })
        .then(sortedByName),

    /**
     * @param {Model} shot
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} Assets casted in the shot, sorted by name.
     */
    allAssetsForShot: async (shot, { signal } = {}) =>
      http
        .fetchAll(`shots/${idOf(shot)}/assets`, {}, { signal })
        .then(sortedByName),

    /**
     * @param {Model} project
     * @param {Model} assetType
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} Assets of the project for the asset type,
     *   sorted by name.
     */
    allAssetsForProjectAndType: async (project, assetType, { signal } = {}) =>
      http
        .fetchAll(
          `projects/${idOf(project)}/asset-types/${idOf(assetType)}/assets`,
          {},
          { signal }
        )
        .then(sortedByName),

    getAssetByName,

    getAsset,

    /**
     * Create an asset, or return the asset of that name and type when the
     * project already has one.
     * @param {Model} project
     * @param {Model} assetType
     * @param {string} name
     * @param {{
     *   description?: string,
     *   extraData?: object,
     *   episode?: Model,
     *   isShared?: boolean,
     *   signal?: AbortSignal
     * }} [options] extraData is free metadata, isShared shares the asset
     *   between projects.
     * @returns {Promise<Entity>} The created (or already existing) asset.
     */
    newAsset: async (
      project,
      assetType,
      name,
      { description, extraData = {}, episode, isShared = false, signal } = {}
    ) => {
      const existing = await getAssetByName(project, name, {
        assetType,
        signal
      })
      if (existing !== null) return existing
      return http.post(
        `data/projects/${idOf(project)}/asset-types/${idOf(assetType)}/assets/new`,
        {
          name,
          data: extraData,
          is_shared: isShared,
          ...withoutNil({ description, episode_id: optionalIdOf(episode) })
        },
        { signal }
      )
    },

    updateAsset,

    /**
     * Update the metadata of the asset. Keys that are not given are kept.
     * @param {Model} asset
     * @param {object} [data]
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The updated asset.
     */
    updateAssetData: async (asset, data = {}, { signal } = {}) => {
      // Not getAsset: a missing asset must raise NotFoundError, not be null.
      const current = await http.get(
        `data/assets/${idOf(asset)}`,
        {},
        { signal }
      )
      return updateAsset(
        { id: current.id, data: { ...(current.data || {}), ...data } },
        { signal }
      )
    },

    /**
     * Remove the asset. Without force, an asset that has tasks is only marked
     * as canceled.
     * @param {Model} asset
     * @param {{force?: boolean, signal?: AbortSignal}} [options]
     * @returns {Promise<null>}
     */
    removeAsset: async (asset, { force = false, signal } = {}) =>
      http.remove(
        'assets',
        idOf(asset),
        { force: force ? true : null },
        { signal }
      ),

    /**
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} All asset types, sorted by name.
     */
    allAssetTypes: async ({ signal } = {}) =>
      http.fetchAll('asset-types', {}, { signal }).then(sortedByName),

    /**
     * @param {Model} project
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} Asset types of the assets of the project,
     *   sorted by name.
     */
    allAssetTypesForProject: async (project, { signal } = {}) =>
      http
        .fetchAll(`projects/${idOf(project)}/asset-types`, {}, { signal })
        .then(sortedByName),

    /**
     * @param {Model} shot
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} Asset types of the assets casted in the
     *   shot, sorted by name.
     */
    allAssetTypesForShot: async (shot, { signal } = {}) =>
      http
        .fetchAll(`shots/${idOf(shot)}/asset-types`, {}, { signal })
        .then(sortedByName),

    getAssetType,

    getAssetTypeByName,

    /**
     * Create an asset type, or return the one that already has that name.
     * @param {string} name
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The created (or already existing) asset type.
     */
    newAssetType: async (name, { signal } = {}) => {
      const existing = await getAssetTypeByName(name, { signal })
      if (existing !== null) return existing
      return http.create('entity-types', { name }, { signal })
    },

    /**
     * Save the name of the asset type. It must already exist. Asset types are
     * entity types in Zou: data/asset-types is read-only, writes go through
     * data/entity-types.
     * @param {{id: string, name: string}} assetType
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The updated asset type.
     */
    updateAssetType: async (assetType, { signal } = {}) =>
      http.update(
        'entity-types',
        idOf(assetType),
        { name: assetType.name },
        { signal }
      ),

    /**
     * @param {Model} assetType
     * @param {RequestOptions} [options]
     * @returns {Promise<null>}
     */
    removeAssetType: async (assetType, { signal } = {}) =>
      http.remove('entity-types', idOf(assetType), {}, { signal }),

    /**
     * @param {Model} assetInstance
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity|null>} The asset instance, null when missing.
     */
    getAssetInstance: async (assetInstance, { signal } = {}) =>
      http.fetchOne('asset-instances', idOf(assetInstance), { signal }),

    /**
     * @param {Model} asset
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} Instances of the asset inside shots.
     */
    allShotAssetInstancesForAsset: async (asset, { signal } = {}) =>
      http.fetchAll(
        `assets/${idOf(asset)}/shot-asset-instances`,
        {},
        { signal }
      ),

    /**
     * @param {Model} assetInstance
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The asset instance, now active.
     */
    enableAssetInstance: async (assetInstance, { signal } = {}) =>
      http.update(
        'asset-instances',
        idOf(assetInstance),
        { active: true },
        { signal }
      ),

    /**
     * @param {Model} assetInstance
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The asset instance, now inactive.
     */
    disableAssetInstance: async (assetInstance, { signal } = {}) =>
      http.update(
        'asset-instances',
        idOf(assetInstance),
        { active: false },
        { signal }
      ),

    /**
     * @param {Model} asset
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} Instances of the asset inside scenes.
     */
    allSceneAssetInstancesForAsset: async (asset, { signal } = {}) =>
      http.fetchAll(
        `assets/${idOf(asset)}/scene-asset-instances`,
        {},
        { signal }
      ),

    /**
     * @param {Model} shot
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} Asset instances linked to the shot.
     */
    allAssetInstancesForShot: async (shot, { signal } = {}) =>
      http.fetchAll(`shots/${idOf(shot)}/asset-instances`, {}, { signal }),

    /**
     * @param {Model} asset
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} Asset instances instantiated inside the
     *   asset.
     */
    allAssetInstancesForAsset: async (asset, { signal } = {}) =>
      http.fetchAll(
        `assets/${idOf(asset)}/asset-asset-instances`,
        {},
        { signal }
      ),

    /**
     * Instantiate an asset inside another asset. Zou generates the instance
     * number (highest number plus one).
     * @param {Model} asset
     * @param {Model} assetToInstantiate
     * @param {{description?: string, signal?: AbortSignal}} [options]
     * @returns {Promise<Entity>} The created asset instance.
     */
    newAssetAssetInstance: async (
      asset,
      assetToInstantiate,
      { description, signal } = {}
    ) =>
      http.post(
        `data/assets/${idOf(asset)}/asset-asset-instances`,
        {
          asset_to_instantiate_id: idOf(assetToInstantiate),
          ...withoutNil({ description })
        },
        { signal }
      ),

    /**
     * Import the assets of a CSV file (same columns as the CSV export) into
     * the project.
     * @param {Model} project
     * @param {Blob} csvFile
     * @param {{
     *   update?: boolean,
     *   fileName?: string,
     *   onProgress?: (progress: {loaded: number, total: number}) => void,
     *   signal?: AbortSignal
     * }} [options] update also updates the assets that already exist.
     *   onProgress needs XMLHttpRequest (browsers, webviews): fetch cannot
     *   report it. A client given its own fetch (Tauri) uploads through it
     *   and never calls onProgress.
     * @returns {Promise<Entity[]>} The assets created by the import.
     */
    importAssetsWithCsv: async (
      project,
      csvFile,
      { update = false, fileName, onProgress, signal } = {}
    ) =>
      http.upload(`import/csv/projects/${idOf(project)}/assets`, {
        file: csvFile,
        query: { update: update ? true : null },
        fileName,
        onProgress,
        signal
      }),

    /**
     * Export the assets of the project as CSV.
     * @param {Model} project
     * @param {{
     *   episode?: Model,
     *   assignedTo?: Model,
     *   signal?: AbortSignal
     * }} [options] episode keeps the assets linked to that episode.
     *   assignedTo keeps the assets with an assigned task: Zou reads it as a
     *   flag and always filters on the logged in user, whoever is given.
     * @returns {Promise<string>} The CSV text.
     */
    exportAssetsWithCsv: async (
      project,
      { episode, assignedTo, signal } = {}
    ) =>
      http.request('GET', `export/csv/projects/${idOf(project)}/assets.csv`, {
        query: {
          episode_id: optionalIdOf(episode),
          assigned_to: optionalIdOf(assignedTo)
        },
        signal,
        read: response => response.text()
      }),

    /**
     * @param {{source_id?: string|null, episode_id?: string|null}} asset
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity|null>} The episode of the asset, null when the
     *   asset belongs to the main pack.
     */
    getEpisodeFromAsset: async (asset, { signal } = {}) => {
      // source_id is the episode link; listings serialize it as episode_id.
      // parent_id is the asset hierarchy, not the episode.
      const episodeId = optionalIdOf(asset.source_id || asset.episode_id)
      return episodeId === null
        ? Promise.resolve(null)
        : http.fetchOne('episodes', episodeId, { signal })
    },

    /**
     * @param {{entity_type_id: string}} asset
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity|null>} The asset type of the asset.
     */
    getAssetTypeFromAsset: async (asset, { signal } = {}) =>
      getAssetType(asset.entity_type_id, { signal }),

    /**
     * Loads the asset and its project, like gazu: the URL differs in a TV show.
     * @param {Model} asset
     * @param {RequestOptions} [options]
     * @returns {Promise<string>} URL of the asset page in the Kitsu web app.
     */
    getAssetUrl: async (asset, { signal } = {}) => {
      const loaded = await http.get(
        `data/assets/${idOf(asset)}`,
        {},
        { signal }
      )
      const project = await http.get(
        `data/projects/${idOf(loaded.project_id)}`,
        {},
        { signal }
      )
      return urls.getAssetUrl(urls.webHostOf(http.host), loaded, project)
    },

    /**
     * @param {Model} project
     * @param {RequestOptions} [options]
     * @returns {Promise<string>} URL of the asset list in the Kitsu web app.
     */
    getAllAssetsUrl: async (project, { signal } = {}) =>
      urls.getAllAssetsUrl(
        urls.webHostOf(http.host),
        await http.get(`data/projects/${idOf(project)}`, {}, { signal })
      ),

    /**
     * @param {Model} project
     * @param {Model|Entity} assetType Loaded only when its name is missing.
     * @param {RequestOptions} [options]
     * @returns {Promise<string>} URL of the asset list filtered on the type.
     */
    getAssetTypeUrl: async (project, assetType, { signal } = {}) => {
      const loadedProject = await http.get(
        `data/projects/${idOf(project)}`,
        {},
        { signal }
      )
      const named =
        typeof assetType === 'object' && assetType && 'name' in assetType
          ? assetType
          : await http.get(
              `data/asset-types/${idOf(assetType)}`,
              {},
              { signal }
            )
      return urls.getAssetTypeUrl(
        urls.webHostOf(http.host),
        loadedProject,
        named
      )
    }
  }
}
