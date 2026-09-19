import { ParameterError } from '../core/errors.js'
import {
  idOf,
  optionalIdOf,
  orNull,
  requiredOf,
  sortedByName,
  withoutNil
} from '../core/params.js'

/**
 * @typedef {import('../core/params.js').Entity} Entity
 * @typedef {import('../core/params.js').Model} Model
 * @typedef {import('../core/params.js').RequestOptions} RequestOptions
 */

const SHARE_TOKEN = /^[\w-]+$/

// The token lands in a request path: checked like ids are, so caller input
// can never reshape the route.
const shareTokenOf = token => {
  if (typeof token === 'string' && SHARE_TOKEN.test(token)) return token
  throw new ParameterError('Wrong format: expected a share link token')
}

const entriesOf = playlist => playlist.shots || []

// Same choice as gazu: the first file of each task type is its latest
// revision, the most recently created one wins.
const latestPreviewOf = previewFiles =>
  Object.values(previewFiles)
    .filter(files => files && files.length > 0)
    .map(files => files[0])
    .reduce(
      (latest, file) =>
        latest === null || latest.created_at < file.created_at ? file : latest,
      null
    )

export const playlistApi = http => {
  const playlistByName = (project, name, signal) =>
    http.fetchFirst(
      'playlists',
      { project_id: idOf(project), name: requiredOf('name', name) },
      { signal }
    )

  const entityPreviewFiles = (entity, signal) =>
    http.get(
      `data/playlists/entities/${idOf(entity)}/preview-files`,
      {},
      { signal }
    )

  const savePlaylist = (playlist, signal) =>
    http.update('playlists', idOf(playlist), playlist, { signal })

  // gazu returns the playlist it built, not the answer of the API.
  const saveEntries = async (playlist, shots, persist, signal) => {
    const updated = { ...playlist, shots }
    if (persist) await savePlaylist(updated, signal)
    return updated
  }

  return {
    /**
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} The playlists of all projects, sorted by
     *   name.
     */
    allPlaylists: async ({ signal } = {}) =>
      http.fetchAll('playlists', {}, { signal }).then(sortedByName),

    /**
     * @param {Model} playlist
     * @param {RequestOptions} [options]
     * @returns {Promise<Record<string, any>[]>} The entries of the playlist,
     *   sorted by name.
     */
    allShotsForPlaylist: async (playlist, { signal } = {}) =>
      http
        .get(`data/playlists/${idOf(playlist)}`, {}, { signal })
        .then(entriesOf)
        .then(sortedByName),

    /**
     * @param {Model} project
     * @param {{page?: number, signal?: AbortSignal}} [options]
     * @returns {Promise<Entity[]>} One page of the playlists of the project,
     *   sorted by name.
     */
    allPlaylistsForProject: async (project, { page = 1, signal } = {}) =>
      http
        .fetchAll(`projects/${idOf(project)}/playlists`, { page }, { signal })
        .then(sortedByName),

    /**
     * @param {Model} episode An episode given as an id, or as an object
     *   without its project_id, is read first.
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} The playlists of the episode, sorted by
     *   name.
     */
    allPlaylistsForEpisode: async (episode, { signal } = {}) => {
      const episodeId = idOf(episode)
      const known = typeof episode === 'object' && 'project_id' in episode
      const source = known
        ? episode
        : await http.get(`data/episodes/${episodeId}`, {}, { signal })
      return http
        .fetchAll(
          `projects/${idOf(source.project_id)}/episodes/${episodeId}/playlists`,
          {},
          { signal }
        )
        .then(sortedByName)
    },

    /**
     * @param {Model} playlist
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity|null>} Null when the playlist does not exist.
     */
    getPlaylist: async (playlist, { signal } = {}) =>
      http.fetchOne('playlists', idOf(playlist), { signal }),

    /**
     * @param {Model} project
     * @param {string} name
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity|null>} Null when no playlist of the project
     *   has this name.
     */
    getPlaylistByName: async (project, name, { signal } = {}) =>
      playlistByName(project, name, signal),

    /**
     * Create a playlist, or return the playlist of the project that already
     * has this name.
     * @param {Model} project
     * @param {string} name
     * @param {{
     *   episode?: Model|null,
     *   forEntity?: 'shot'|'asset'|'sequence'|'edit'|'episode',
     *   forClient?: boolean,
     *   isForAll?: boolean,
     *   signal?: AbortSignal
     * }} [options] Without episode the playlist belongs to the project:
     *   isForAll files it under "All Assets" instead of "Main Pack" in the
     *   web UI. forClient shares it with the clients.
     * @returns {Promise<Entity>}
     */
    newPlaylist: async (
      project,
      name,
      {
        episode = null,
        forEntity = 'shot',
        forClient = false,
        isForAll = false,
        signal
      } = {}
    ) => {
      const data = withoutNil({
        name,
        project_id: idOf(project),
        for_entity: forEntity,
        for_client: forClient,
        is_for_all: isForAll,
        episode_id: optionalIdOf(episode)
      })
      const existing = await playlistByName(project, name, signal)
      return existing || http.create('playlists', data, { signal })
    },

    /**
     * Save the playlist. Its metadata are fully replaced.
     * @param {Entity} playlist
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>}
     */
    updatePlaylist: async (playlist, { signal } = {}) =>
      savePlaylist(playlist, signal),

    /**
     * @param {Model} entity
     * @param {RequestOptions} [options]
     * @returns {Promise<Record<string, Entity[]>>} The preview files of the
     *   entity: task type ids as keys, revisions as values.
     */
    getEntityPreviewFiles: async (entity, { signal } = {}) =>
      entityPreviewFiles(entity, signal),

    /**
     * Add an entity to the playlist, with its most recent preview as the
     * revision to review.
     * @param {Model} playlist The playlist object is needed when persist is
     *   false. It is never mutated: use the returned playlist.
     * @param {Model} entity
     * @param {{
     *   previewFile?: Model|null,
     *   persist?: boolean,
     *   signal?: AbortSignal
     * }} [options] previewFile forces the revision to review. With persist
     *   set to false nothing is saved.
     * @returns {Promise<Record<string, any>>} The updated playlist.
     */
    addEntityToPlaylist: async (
      playlist,
      entity,
      { previewFile = null, persist = true, signal } = {}
    ) => {
      const entityId = idOf(entity)
      const playlistId = idOf(playlist)
      const chosen =
        previewFile === null || previewFile === undefined
          ? latestPreviewOf(await entityPreviewFiles(entityId, signal))
          : previewFile
      const entry = withoutNil({
        entity_id: entityId,
        preview_file_id: optionalIdOf(chosen)
      })
      if (persist) {
        return http.post(`actions/playlists/${playlistId}/add-entity`, entry, {
          signal
        })
      }
      const current = typeof playlist === 'object' ? playlist : { id: playlist }
      return { ...current, shots: [...entriesOf(current), entry] }
    },

    /**
     * Remove every occurrence of the entity from the playlist.
     * @param {Entity} playlist Never mutated: use the returned playlist.
     * @param {Model} entity
     * @param {{persist?: boolean, signal?: AbortSignal}} [options] With
     *   persist set to false nothing is saved.
     * @returns {Promise<Entity>} The updated playlist.
     */
    removeEntityFromPlaylist: async (
      playlist,
      entity,
      { persist = true, signal } = {}
    ) => {
      const entityId = idOf(entity)
      const shots = entriesOf(playlist).filter(
        entry => entry.entity_id !== entityId
      )
      return saveEntries(playlist, shots, persist, signal)
    },

    /**
     * Change the preview file reviewed for the entity in the playlist.
     * @param {Entity} playlist Never mutated: use the returned playlist.
     * @param {Model} entity
     * @param {Model} previewFile
     * @param {{persist?: boolean, signal?: AbortSignal}} [options] With
     *   persist set to false nothing is saved.
     * @returns {Promise<Entity>} The updated playlist.
     */
    updateEntityPreview: async (
      playlist,
      entity,
      previewFile,
      { persist = true, signal } = {}
    ) => {
      const entityId = idOf(entity)
      const previewFileId = idOf(previewFile)
      const shots = entriesOf(playlist).map(entry =>
        entry.entity_id === entityId
          ? { ...entry, preview_file_id: previewFileId }
          : entry
      )
      return saveEntries(playlist, shots, persist, signal)
    },

    /**
     * @param {Model} playlist
     * @param {RequestOptions} [options]
     * @returns {Promise<null>}
     */
    deletePlaylist: async (playlist, { signal } = {}) =>
      http.del(`data/playlists/${idOf(playlist)}`, undefined, { signal }),

    /**
     * @param {Model} playlist
     * @param {Model} buildJob
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity|null>} Null when the build job does not exist.
     */
    getBuildJob: async (playlist, buildJob, { signal } = {}) =>
      orNull(
        http.get(
          `data/playlists/${idOf(playlist)}/jobs/${idOf(buildJob)}`,
          {},
          { signal }
        )
      ),

    /**
     * @param {Model} playlist
     * @param {Model} buildJob
     * @param {RequestOptions} [options]
     * @returns {Promise<null>}
     */
    removeBuildJob: async (playlist, buildJob, { signal } = {}) =>
      http.del(
        `data/playlists/${idOf(playlist)}/jobs/${idOf(buildJob)}`,
        undefined,
        { signal }
      ),

    /**
     * @param {Model} project
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity[]>} The build jobs of the project.
     */
    allBuildJobsForProject: async (project, { signal } = {}) =>
      http.fetchAll(`projects/${idOf(project)}/build-jobs`, {}, { signal }),

    /**
     * Start the build of the movie of the playlist.
     * @param {Model} playlist
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The build job.
     */
    buildPlaylistMovie: async (playlist, { signal } = {}) =>
      http.get(`data/playlists/${idOf(playlist)}/build/mp4`, {}, { signal }),

    /**
     * @param {Model} playlist
     * @param {Model} buildJob
     * @param {RequestOptions} [options]
     * @returns {Promise<Response>} Raw response holding the built movie.
     */
    downloadPlaylistBuild: async (playlist, buildJob, { signal } = {}) =>
      http.download(
        `data/playlists/${idOf(playlist)}/jobs/${idOf(buildJob)}/build/mp4`,
        { signal }
      ),

    /**
     * @param {Model} playlist
     * @param {RequestOptions} [options]
     * @returns {Promise<Response>} Raw response holding the zip archive of
     *   the playlist.
     */
    downloadPlaylistZip: async (playlist, { signal } = {}) =>
      http.download(`data/playlists/${idOf(playlist)}/download/zip`, {
        signal
      }),

    /**
     * @param {Model} project
     * @param {Record<string, any>} data Playlist generation data.
     * @param {RequestOptions} [options]
     * @returns {Promise<any>} The generated temporary playlist.
     */
    generateTempPlaylist: async (project, data, { signal } = {}) =>
      http.post(`data/projects/${idOf(project)}/playlists/temp`, data, {
        signal
      }),

    /**
     * Tell the clients that the playlist is ready.
     * @param {Model} playlist
     * @param {RequestOptions} [options]
     * @returns {Promise<Record<string, any>>}
     */
    notifyClientsPlaylistReady: async (playlist, { signal } = {}) =>
      http.post(
        `data/playlists/${idOf(playlist)}/notify-clients`,
        {},
        { signal }
      ),

    /**
     * Create a share link for the playlist. Managers and above only.
     * @param {Model} playlist
     * @param {{
     *   expirationDate?: string|null,
     *   canComment?: boolean,
     *   password?: string|null,
     *   signal?: AbortSignal
     * }} [options] expirationDate is an ISO date. canComment, true by
     *   default, lets the guests comment.
     * @returns {Promise<Record<string, any>>} The share link, with its token.
     */
    newShareLink: async (
      playlist,
      { expirationDate = null, canComment = true, password = null, signal } = {}
    ) =>
      http.post(
        `data/playlists/${idOf(playlist)}/share`,
        withoutNil({
          can_comment: canComment,
          expiration_date: expirationDate || null,
          password: password || null
        }),
        { signal }
      ),

    /**
     * @param {Model} playlist
     * @param {RequestOptions} [options]
     * @returns {Promise<Record<string, any>[]>} The active share links.
     */
    allShareLinksForPlaylist: async (playlist, { signal } = {}) =>
      http.fetchAll(`playlists/${idOf(playlist)}/share`, {}, { signal }),

    /**
     * Revoke a share link.
     * @param {Model} playlist
     * @param {string} token
     * @param {RequestOptions} [options]
     * @returns {Promise<null>}
     */
    removeShareLink: async (playlist, token, { signal } = {}) =>
      http.del(
        `data/playlists/${idOf(playlist)}/share/${shareTokenOf(token)}`,
        undefined,
        { signal }
      )
  }
}
