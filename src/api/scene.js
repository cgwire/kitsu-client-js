import {
  idOf,
  metadataOf,
  optionalIdOf,
  orNull,
  requiredOf,
  sameNameOf,
  sortedByName,
  withoutNil
} from '../core/params.js'

/**
 * @typedef {import('../core/params.js').Entity} Entity
 * @typedef {import('../core/params.js').Model} Model
 * @typedef {import('../core/params.js').RequestOptions} RequestOptions
 */

export const sceneApi = http => {
  const fetchScene = (scene, signal) =>
    http.fetchOne('scenes', idOf(scene), { signal })

  const scenesOf = (path, signal) =>
    http.fetchAll(path, {}, { signal }).then(sortedByName)

  const saveAssetInstance = (assetInstance, data, signal) =>
    http.put(`data/asset-instances/${idOf(assetInstance)}`, data, { signal })

  return {
    /**
     * @param {Model} project
     * @param {Model} sequence
     * @param {string} name
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The created scene.
     */
    newScene: async (project, sequence, name, { signal } = {}) =>
      http.post(
        `data/projects/${idOf(project)}/scenes`,
        { name, sequence_id: idOf(sequence) },
        { signal }
      ),

    /**
     * @param {{project?: Model, signal?: AbortSignal}} [options] Without a
     *   project, Zou lists the scenes of every project to an admin only:
     *   anyone else gets a NotAllowedError.
     * @returns {Promise<Entity[]>} Every scene, or the scenes of the project,
     *   sorted by name.
     */
    allScenes: async ({ project, signal } = {}) => {
      const projectId = optionalIdOf(project)
      return scenesOf(
        projectId ? `projects/${projectId}/scenes` : 'scenes/all',
        signal
      )
    },

    /**
     * @param {Model} project
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} The scenes of the project, sorted by name.
     */
    allScenesForProject: async (project, { signal } = {}) =>
      scenesOf(`projects/${idOf(project)}/scenes`, signal),

    /**
     * @param {Model} sequence
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} The scenes of the sequence, sorted by name.
     */
    allScenesForSequence: async (sequence, { signal } = {}) =>
      scenesOf(`sequences/${idOf(sequence)}/scenes`, signal),

    /**
     * @param {Model} scene
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity|null>} The scene, null when it does not exist.
     */
    getScene: async (scene, { signal } = {}) => fetchScene(scene, signal),

    /**
     * @param {Model} sequence
     * @param {string} sceneName
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity|null>} The scene of the sequence with that
     *   name (the case ignored, an exact match first), null when there is
     *   none.
     */
    getSceneByName: async (sequence, sceneName, { signal } = {}) => {
      const sequenceId = idOf(sequence)
      requiredOf('sceneName', sceneName)
      // The scenes of the sequence are open to the members of its project,
      // while a filtered list of every scene needs an admin.
      const scenes = await orNull(
        http.fetchAll(`sequences/${sequenceId}/scenes`, {}, { signal })
      )
      return sameNameOf(scenes, sceneName)
    },

    /**
     * Save the scene. Zou merges the given metadata into the stored ones: a
     * key left out keeps its value, a key set to null is stored as null.
     * @param {Entity} scene
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The updated scene.
     */
    updateScene: async (scene, { signal } = {}) =>
      http.update('entities', idOf(scene), scene, { signal }),

    /**
     * Instantiate an asset in the scene. Zou generates the instance number.
     * @param {Model} scene
     * @param {Model} asset
     * @param {{description?: string, signal?: AbortSignal}} [options]
     * @returns {Promise<Entity>} The created asset instance.
     */
    newSceneAssetInstance: async (scene, asset, { description, signal } = {}) =>
      http.post(
        `data/scenes/${idOf(scene)}/asset-instances`,
        withoutNil({ asset_id: idOf(asset), description }),
        { signal }
      ),

    /**
     * @param {Model} scene
     * @param {RequestOptions} [options]
     * @returns {Promise<Record<string, Entity[]>>} The asset instances of the
     *   scene, keyed by the id of their asset.
     */
    allAssetInstancesForScene: async (scene, { signal } = {}) =>
      http.get(`data/scenes/${idOf(scene)}/asset-instances`, {}, { signal }),

    /**
     * @param {Model} scene
     * @param {string} name
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity|null>} The asset instance of the scene with
     *   that name (the case ignored, an exact match first), null when there
     *   is none.
     */
    getAssetInstanceByName: async (scene, name, { signal } = {}) => {
      const sceneId = idOf(scene)
      requiredOf('name', name)
      // The instances of the scene are open to the members of its project,
      // while the list of every instance needs an admin.
      const instances = await orNull(
        http.get(`data/scenes/${sceneId}/asset-instances`, {}, { signal })
      )
      return sameNameOf(Object.values(instances || {}).flat(), name)
    },

    /**
     * @param {Model} scene
     * @param {RequestOptions} [options]
     * @returns {Promise<Record<string, Entity[]>>} The camera instances of the
     *   scene, keyed by the id of their camera asset.
     */
    allCameraInstancesForScene: async (scene, { signal } = {}) =>
      http.get(`data/scenes/${idOf(scene)}/camera-instances`, {}, { signal }),

    /**
     * @param {Model} scene
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} The shots issued from the scene.
     */
    allShotsForScene: async (scene, { signal } = {}) =>
      http.get(`data/scenes/${idOf(scene)}/shots`, {}, { signal }),

    /**
     * Mark the shot as generated out of the scene.
     * @param {Model} scene
     * @param {Model} shot
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The linked shot.
     */
    addShotToScene: async (scene, shot, { signal } = {}) =>
      http.post(
        `data/scenes/${idOf(scene)}/shots`,
        { shot_id: idOf(shot) },
        { signal }
      ),

    /**
     * @param {Model} scene
     * @param {Model} shot
     * @param {RequestOptions} [options]
     * @returns {Promise<null>}
     */
    removeShotFromScene: async (scene, shot, { signal } = {}) =>
      http.del(`data/scenes/${idOf(scene)}/shots/${idOf(shot)}`, undefined, {
        signal
      }),

    /**
     * @param {Model} assetInstance
     * @param {string} name
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The updated asset instance.
     */
    updateAssetInstanceName: async (assetInstance, name, { signal } = {}) =>
      saveAssetInstance(assetInstance, { name }, signal),

    /**
     * Replace the extra data of the asset instance.
     * @param {Model} assetInstance
     * @param {Record<string, any>} data
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The updated asset instance.
     */
    updateAssetInstanceData: async (assetInstance, data, { signal } = {}) =>
      saveAssetInstance(assetInstance, { data: metadataOf(data) }, signal),

    /**
     * @param {Model} scene
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity|null>} The parent sequence, null when the scene
     *   or its sequence does not exist.
     */
    getSequenceFromScene: async (scene, { signal } = {}) => {
      // An id or an object without its parent_id key says nothing about the
      // parent: the scene is read first.
      const known = typeof scene === 'object' && scene && 'parent_id' in scene
      const source = known ? scene : await fetchScene(scene, signal)
      return source && source.parent_id
        ? http.fetchOne('sequences', idOf(source.parent_id), { signal })
        : null
    }
  }
}
