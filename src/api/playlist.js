import { ParameterError } from '../core/errors.js'
import {
  idOf,
  idsOf,
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

// Zou replaces the entries of a playlist with the shots of a PUT. List rows
// and ids carry no shots: the entries are read instead of being taken as an
// empty list, which a save would turn into an empty playlist. shots: null is
// a playlist with no entry yet.
const carriesEntries = playlist =>
  playlist !== null &&
  typeof playlist === 'object' &&
  (playlist.shots === null || Array.isArray(playlist.shots))

// An entry is an entity, or an (entity, preview file) couple.
const coupleOf = entry => {
  const isCouple =
    entry !== null && typeof entry === 'object' && 'entity' in entry
  return withoutNil({
    entity_id: idOf(isCouple ? entry.entity : entry),
    preview_file_id: isCouple ? optionalIdOf(entry.previewFile) : null
  })
}

const sharedPath = (token, suffix = '') =>
  `shared/playlists/${shareTokenOf(token)}${suffix}`

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

  // The given playlist, with its stored entries when it carries none.
  const withEntries = async (playlist, signal) => {
    if (carriesEntries(playlist)) return playlist
    const id = idOf(playlist)
    const { shots } = await http.get(`data/playlists/${id}`, {}, { signal })
    return { ...(typeof playlist === 'object' ? playlist : { id }), shots }
  }

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
     * @param {Model|Entity} playlist Never mutated: use the returned
     *   playlist. Without persist, a playlist that carries no shots array (a
     *   row of allPlaylistsForProject, an id) is read first.
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
      const current = await withEntries(playlist, signal)
      return { ...current, shots: [...entriesOf(current), entry] }
    },

    /**
     * Remove every occurrence of the entity from the playlist.
     * @param {Model|Entity} playlist Never mutated: use the returned
     *   playlist. A playlist that carries no shots array (a row of
     *   allPlaylistsForProject, an id) is read first.
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
      const current = await withEntries(playlist, signal)
      const shots = entriesOf(current).filter(
        entry => entry.entity_id !== entityId
      )
      return saveEntries(current, shots, persist, signal)
    },

    /**
     * Change the preview file reviewed for the entity in the playlist.
     * @param {Model|Entity} playlist Never mutated: use the returned
     *   playlist. A playlist that carries no shots array (a row of
     *   allPlaylistsForProject, an id) is read first.
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
      const current = await withEntries(playlist, signal)
      const shots = entriesOf(current).map(entry =>
        entry.entity_id === entityId
          ? { ...entry, preview_file_id: previewFileId }
          : entry
      )
      return saveEntries(current, shots, persist, signal)
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
      ),

    /**
     * Read the playlist through its project: unlike getPlaylist, the answer
     * carries the build jobs and the enriched entries.
     * @param {Model} project
     * @param {Model} playlist
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity|null>} Null when the playlist does not exist.
     */
    getPlaylistForProject: async (project, playlist, { signal } = {}) =>
      orNull(
        http.get(
          `data/projects/${idOf(project)}/playlists/${idOf(playlist)}`,
          {},
          { signal }
        )
      ),

    /**
     * Add several entities to the playlist in one request.
     * @param {Model} playlist
     * @param {Array<Model|{entity: Model, previewFile?: Model|null}>} entities
     *   Entities, or (entity, preview file) couples. Without a preview file
     *   the API picks the latest preview of the task type of the playlist.
     * @param {RequestOptions} [options]
     * @returns {Promise<Entity>} The updated playlist.
     */
    addEntitiesToPlaylist: async (playlist, entities, { signal } = {}) => {
      if (!Array.isArray(entities) || entities.length === 0) {
        throw new ParameterError('Missing parameter: entities')
      }
      return http.post(
        `actions/playlists/${idOf(playlist)}/add-entities`,
        { entities: entities.map(coupleOf) },
        { signal }
      )
    },

    /**
     * Email a share link of the playlist.
     * @param {Model} playlist
     * @param {string} token Token of the share link.
     * @param {{
     *   emails?: string[],
     *   persons?: Model[],
     *   message?: string|null,
     *   signal?: AbortSignal
     * }} [options] emails are free-form addresses, persons are looked up by
     *   the API. message is added to the email.
     * @returns {Promise<Record<string, any>>}
     */
    sendShareLinkInvitations: async (
      playlist,
      token,
      { emails = [], persons = [], message = null, signal } = {}
    ) =>
      http.post(
        `data/playlists/${idOf(playlist)}/share/${shareTokenOf(token)}/invite`,
        withoutNil({ emails, person_ids: idsOf(persons), message }),
        { signal }
      ),

    /**
     * Create the guest of a shared playlist, or get a known guest back.
     * @param {string} token Token of the share link.
     * @param {{
     *   firstName?: string|null,
     *   lastName?: string|null,
     *   guest?: Model|null,
     *   signal?: AbortSignal
     * }} [options] guest is a guest this share link already created: it is
     *   returned instead of a new one.
     * @returns {Promise<Entity>} The guest.
     */
    newSharedPlaylistGuest: async (
      token,
      { firstName = null, lastName = null, guest = null, signal } = {}
    ) =>
      http.post(
        sharedPath(token, '/guest'),
        withoutNil({
          first_name: firstName,
          last_name: lastName,
          guest_id: optionalIdOf(guest)
        }),
        { signal }
      ),

    /**
     * @param {string} token Token of the share link.
     * @param {{password?: string|null, signal?: AbortSignal}} [options]
     *   password is needed when the share link is protected.
     * @returns {Promise<Entity|null>} The shared playlist. Null when the
     *   share link does not exist.
     */
    getSharedPlaylist: async (token, { password = null, signal } = {}) =>
      orNull(http.get(sharedPath(token), { password }, { signal })),

    /**
     * @param {string} token Token of the share link.
     * @param {{password?: string|null, signal?: AbortSignal}} [options]
     *   password is needed when the share link is protected.
     * @returns {Promise<Record<string, any>|null>} What a player needs to show
     *   the shared playlist (task types, statuses, ...). Null when the share
     *   link does not exist.
     */
    getSharedPlaylistContext: async (token, { password = null, signal } = {}) =>
      orNull(http.get(sharedPath(token, '/context'), { password }, { signal })),

    /**
     * Save the annotations a guest drew on a preview of a shared playlist.
     * @param {string} token Token of the share link.
     * @param {Model} guest
     * @param {Model} previewFile
     * @param {{
     *   additions?: Record<string, any>[],
     *   updates?: Record<string, any>[],
     *   deletions?: Record<string, any>[],
     *   signal?: AbortSignal
     * }} [options]
     * @returns {Promise<Entity>} The preview file.
     */
    updateSharedPlaylistAnnotations: async (
      token,
      guest,
      previewFile,
      { additions = [], updates = [], deletions = [], signal } = {}
    ) =>
      http.put(
        sharedPath(token, '/annotations'),
        {
          guest_id: idOf(guest),
          preview_file_id: idOf(previewFile),
          additions,
          updates,
          deletions
        },
        { signal }
      ),

    /**
     * @param {string} token Token of the share link.
     * @param {{password?: string|null, signal?: AbortSignal}} [options]
     *   password is needed when the share link is protected.
     * @returns {Promise<Entity[]>} The comments of the tasks reviewed in the
     *   shared playlist.
     */
    allSharedPlaylistComments: async (
      token,
      { password = null, signal } = {}
    ) => http.get(sharedPath(token, '/comments'), { password }, { signal }),

    /**
     * Post the comment of a guest on a task of a shared playlist.
     * @param {string} token Token of the share link.
     * @param {Model} guest
     * @param {Model} task
     * @param {Model} taskStatus A status allowed for clients.
     * @param {{
     *   text?: string,
     *   checklist?: Record<string, any>[]|null,
     *   password?: string|null,
     *   signal?: AbortSignal
     * }} [options] password is needed when the share link is protected.
     * @returns {Promise<Entity>} The comment.
     */
    newSharedPlaylistComment: async (
      token,
      guest,
      task,
      taskStatus,
      { text = '', checklist = null, password = null, signal } = {}
    ) =>
      http.request('POST', sharedPath(token, '/comments'), {
        body: withoutNil({
          guest_id: idOf(guest),
          task_id: idOf(task),
          task_status_id: idOf(taskStatus),
          text,
          checklist
        }),
        query: { password },
        signal
      }),

    /**
     * Edit a comment of the guest. Only the given fields change.
     * @param {string} token Token of the share link.
     * @param {Model} comment
     * @param {Model} guest The author of the comment.
     * @param {{
     *   text?: string|null,
     *   checklist?: Record<string, any>[]|null,
     *   taskStatus?: Model|null,
     *   signal?: AbortSignal
     * }} [options]
     * @returns {Promise<Entity>} The comment.
     */
    updateSharedPlaylistComment: async (
      token,
      comment,
      guest,
      { text = null, checklist = null, taskStatus = null, signal } = {}
    ) =>
      http.put(
        sharedPath(token, `/comments/${idOf(comment)}`),
        withoutNil({
          guest_id: idOf(guest),
          text,
          checklist,
          task_status_id: optionalIdOf(taskStatus)
        }),
        { signal }
      ),

    /**
     * @param {string} token Token of the share link.
     * @param {Model} comment
     * @param {Model} guest The author of the comment.
     * @param {RequestOptions} [options]
     * @returns {Promise<null>}
     */
    removeSharedPlaylistComment: async (
      token,
      comment,
      guest,
      { signal } = {}
    ) =>
      http.request('DELETE', sharedPath(token, `/comments/${idOf(comment)}`), {
        query: { guest_id: idOf(guest) },
        signal
      }),

    /**
     * Attach files to a comment of the guest.
     * @param {string} token Token of the share link.
     * @param {Model} comment
     * @param {Model} guest The author of the comment.
     * @param {Blob|Blob[]} attachments The file, or the files.
     * @param {{
     *   onProgress?: (progress: {loaded: number, total: number}) => void,
     *   signal?: AbortSignal
     * }} [options]
     * @returns {Promise<Entity>} The comment with its attachment files.
     */
    addSharedPlaylistCommentAttachments: async (
      token,
      comment,
      guest,
      attachments,
      { onProgress, signal } = {}
    ) =>
      http.upload(sharedPath(token, `/comments/${idOf(comment)}/attachments`), {
        file: attachments,
        fields: { guest_id: idOf(guest) },
        onProgress,
        signal
      }),

    /**
     * @param {string} token Token of the share link.
     * @param {Model} comment
     * @param {Model} attachmentFile
     * @param {Model} guest The author of the comment.
     * @param {RequestOptions} [options]
     * @returns {Promise<null>}
     */
    removeSharedPlaylistCommentAttachment: async (
      token,
      comment,
      attachmentFile,
      guest,
      { signal } = {}
    ) =>
      http.request(
        'DELETE',
        sharedPath(
          token,
          `/comments/${idOf(comment)}/attachments/${idOf(attachmentFile)}`
        ),
        { query: { guest_id: idOf(guest) }, signal }
      )
  }
}
