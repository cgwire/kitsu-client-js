import { ParameterError } from '../core/errors.js'
import {
  dateOf,
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

// Keys of a read that are not fields to save: Zou would replace the build
// jobs with the ones of the read (and refuse to drop one started since),
// and ignores the others.
const READ_ONLY_KEYS = [
  'build_jobs',
  'type',
  'created_at',
  'updated_at',
  'first_preview_file_id'
]

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

// A saved entry is sent as Kitsu sends it: the entity and its preview, null
// when it has none (Zou serves such an entry without the key).
const entryOf = entry => ({
  entity_id: entry.entity_id ?? entry.id,
  preview_file_id: entry.preview_file_id ?? null
})

// Zou answers a 400 to shots: null, which a playlist read before its first
// entry carries: the stored entries are then left as they are, as Kitsu does.
const withSavedEntries = playlist => {
  if (!carriesEntries(playlist)) return playlist
  const { shots, ...fields } = playlist
  return shots === null ? fields : { ...fields, shots: shots.map(entryOf) }
}

const savedFieldsOf = playlist =>
  typeof playlist === 'object'
    ? withSavedEntries(
        Object.fromEntries(
          Object.entries(playlist).filter(
            ([key]) => !READ_ONLY_KEYS.includes(key)
          )
        )
      )
    : playlist

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
  // Zou keeps one playlist per name, project and episode. Its name filter is
  // case insensitive and reads % and _ as wildcards, and it cannot ask for
  // the playlists without episode: both are checked on the rows.
  const playlistByName = async (project, name, episode, signal) => {
    const episodeId = optionalIdOf(episode)
    const playlists = await http.fetchAll(
      'playlists',
      {
        project_id: idOf(project),
        name: requiredOf('name', name),
        episode_id: episodeId
      },
      { signal }
    )
    return (
      playlists.find(
        playlist =>
          playlist.name === name && (episodeId !== null || !playlist.episode_id)
      ) || null
    )
  }

  const entityPreviewFiles = (entity, signal) =>
    http.get(
      `data/playlists/entities/${idOf(entity)}/preview-files`,
      {},
      { signal }
    )

  const savePlaylist = (playlist, signal) =>
    http.update('playlists', idOf(playlist), savedFieldsOf(playlist), {
      signal
    })

  // The given playlist, with its stored entries when it carries none.
  const withEntries = async (playlist, signal) => {
    if (carriesEntries(playlist)) return playlist
    const id = idOf(playlist)
    const { shots } = await http.get(`data/playlists/${id}`, {}, { signal })
    return { ...(typeof playlist === 'object' ? playlist : { id }), shots }
  }

  // gazu returns the playlist it built, not the answer of the API. Only the
  // entries are sent: the other fields of a read may be stale, and its
  // build_jobs would replace the build jobs started since.
  const saveEntries = async (playlist, shots, persist, signal) => {
    if (persist) {
      await http.update(
        'playlists',
        idOf(playlist),
        { shots: shots.map(entryOf) },
        { signal }
      )
    }
    return { ...playlist, shots }
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
     *   in the playlist order: an entity_id and a preview_file_id each
     *   (missing or null when the entry has no preview).
     */
    allShotsForPlaylist: async (playlist, { signal } = {}) =>
      http
        .get(`data/playlists/${idOf(playlist)}`, {}, { signal })
        .then(entriesOf),

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
     * @param {{page?: number, signal?: AbortSignal}} [options]
     * @returns {Promise<Entity[]>} One page of the playlists of the episode,
     *   sorted by name.
     */
    allPlaylistsForEpisode: async (episode, { page = 1, signal } = {}) => {
      const episodeId = idOf(episode)
      const known = typeof episode === 'object' && 'project_id' in episode
      const source = known
        ? episode
        : await http.get(`data/episodes/${episodeId}`, {}, { signal })
      return http
        .fetchAll(
          `projects/${idOf(source.project_id)}/episodes/${episodeId}/playlists`,
          { page },
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
     * The playlist of this exact name (case included) in the episode, or in
     * the project itself without episode: Zou keeps one playlist per name,
     * project and episode. gazu takes the first playlist of the project
     * whose name is alike, whatever its episode.
     * @param {Model} project
     * @param {string} name
     * @param {{episode?: Model|null, signal?: AbortSignal}} [options]
     * @returns {Promise<Entity|null>} Null when no playlist there has this
     *   name.
     */
    getPlaylistByName: async (project, name, { episode = null, signal } = {}) =>
      playlistByName(project, name, episode, signal),

    /**
     * Create a playlist, or return the playlist that already has this name
     * in the episode (in the project itself without episode), as
     * getPlaylistByName finds it.
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
      const existing = await playlistByName(project, name, episode, signal)
      return existing || http.create('playlists', data, { signal })
    },

    /**
     * Save the playlist. Its entries (shots) replace the stored ones, each
     * sent as an entity_id and a preview_file_id, null when it has none.
     * shots: null, the entries of a playlist read before its first one,
     * leaves the stored entries as they are. The keys of a read that are not
     * fields to save (build_jobs, type, created_at, updated_at,
     * first_preview_file_id) are left out.
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
     * Remove every occurrence of the entity from the playlist. Only the
     * entries are saved.
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
     * Change the preview file reviewed for the entity in the playlist. Only
     * the entries are saved.
     * @param {Model|Entity} playlist Never mutated: use the returned
     *   playlist. A playlist that carries no shots array (a row of
     *   allPlaylistsForProject, an id) is read first.
     * @param {Model} entity
     * @param {Model} previewFile
     * @param {{
     *   previousPreviewFile?: Model|null,
     *   persist?: boolean,
     *   signal?: AbortSignal
     * }} [options] previousPreviewFile picks the entry to change, as Kitsu
     *   does: the first entry of the entity with this preview, or without
     *   preview when null. Nothing changes when no entry matches. Without
     *   it, every entry of the entity gets the new preview: an entity
     *   reviewed under several previews (one per task type) then ends with
     *   as many identical entries. With persist set to false nothing is
     *   saved.
     * @returns {Promise<Entity>} The updated playlist.
     */
    updateEntityPreview: async (
      playlist,
      entity,
      previewFile,
      { previousPreviewFile, persist = true, signal } = {}
    ) => {
      const entityId = idOf(entity)
      const previewFileId = idOf(previewFile)
      const previousId =
        previousPreviewFile === undefined
          ? undefined
          : optionalIdOf(previousPreviewFile)
      const current = await withEntries(playlist, signal)
      const entries = entriesOf(current)
      const isOfEntity = entry => entry.entity_id === entityId
      // An entry is an (entity, preview) couple: the previous preview tells
      // which one of the entity changes.
      const target = entries.findIndex(
        entry =>
          isOfEntity(entry) && (entry.preview_file_id || null) === previousId
      )
      const changes = (entry, index) =>
        previousId === undefined ? isOfEntity(entry) : index === target
      const shots = entries.map((entry, index) =>
        changes(entry, index)
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
     * Start the build of the movie of the playlist. Without a job queue (the
     * default of Zou), Zou builds the movie before it answers: a long build
     * rejects with a TimeoutError once the timeouts of the client run out
     * (60 s to the first byte, 5 min in all, see its timeout option), while
     * Zou goes on.
     * @param {Model} playlist
     * @param {{full?: boolean, signal?: AbortSignal}} [options] full
     *   re-encodes the previews, where Zou first tries to join them as they
     *   are.
     * @returns {Promise<Entity>} The build job.
     */
    buildPlaylistMovie: async (playlist, { full = false, signal } = {}) =>
      http.get(
        `data/playlists/${idOf(playlist)}/build/mp4`,
        { full: full ? true : null },
        { signal }
      ),

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
     * Zou builds the whole archive before it answers: a large playlist
     * rejects with a TimeoutError once the response timeout of the client
     * runs out (60 s to the first byte, see its timeout option), while Zou
     * goes on.
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
     * @returns {Promise<Record<string, any>[]>} The entries of the generated
     *   temporary playlist.
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
     *   expirationDate?: Date|string|null,
     *   canComment?: boolean,
     *   password?: string|null,
     *   signal?: AbortSignal
     * }} [options] expirationDate is a Date (its local day) or an ISO date:
     *   the link works to the end of that day, in UTC. An ISO date and time
     *   is taken as it is. canComment, true by default, lets the guests
     *   comment.
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
          expiration_date: dateOf(expirationDate) || null,
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
     * @returns {Promise<Record<string, any>>} The revoked share link, its
     *   is_active false.
     */
    removeShareLink: async (playlist, token, { signal } = {}) =>
      http.del(
        `data/playlists/${idOf(playlist)}/share/${shareTokenOf(token)}`,
        undefined,
        { signal }
      ),

    /**
     * Read the playlist through its project, as Kitsu does. Its build_jobs
     * are summaries (id, status, created_at, message) where getPlaylist
     * gives their ids, and each entry also carries the previews of its
     * entity where getPlaylist gives the stored entries.
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
     * @returns {Promise<{sent: string[]}>} The addresses the invitation was
     *   sent to.
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
     * Create the guest of a shared playlist, or get a known guest back. Zou
     * 1.0.94 refuses it on a password-protected link (NotFoundError), as
     * every guest write there: only getSharedPlaylist and
     * allSharedPlaylistComments work on such a link, with the password.
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
     *   share link does not exist, is revoked or expired, or is protected
     *   and the password is missing or wrong: Zou answers a 404 to all of
     *   them.
     */
    getSharedPlaylist: async (token, { password = null, signal } = {}) =>
      orNull(http.get(sharedPath(token), { password }, { signal })),

    /**
     * @param {string} token Token of the share link.
     * @param {{password?: string|null, signal?: AbortSignal}} [options]
     *   password is checked, but Zou 1.0.94 then reads the link again
     *   without it: on a protected link the context is always null.
     * @returns {Promise<Record<string, any>|null>} What a player needs to show
     *   the shared playlist (task types, statuses, ...). Null when the share
     *   link does not exist, is revoked or expired, or is protected.
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
     * }} [options] password is checked, but Zou 1.0.94 then refuses the
     *   comment on a protected link anyway, as every guest write there.
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
     * }} [options] onProgress needs XMLHttpRequest (browsers, webviews):
     *   fetch cannot report it. A client given its own fetch (Tauri) uploads
     *   through it and never calls onProgress, unless it is created with
     *   xhrUploads: true.
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
