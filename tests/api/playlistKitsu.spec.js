import { beforeEach, describe, expect, it } from 'vitest'

import { ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'
import {
  ATTACHMENT_ID,
  COMMENT_ID,
  ENTITY_ID,
  GUEST_ID,
  OTHER_ID,
  PERSON_ID,
  PLAYLIST_ID,
  PREVIEW_FILE_ID,
  PROJECT_ID,
  SHARE_TOKEN,
  SHOT_ID,
  TASK_ID,
  TASK_STATUS_ID
} from '../helpers/ids.js'

const SHARED = `/shared/playlists/${SHARE_TOKEN}`

describe('playlist namespace: Kitsu coverage', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('getPlaylistForProject reads the playlist through its project', async () => {
    fake.reply(200, { id: PLAYLIST_ID, build_jobs: [] })
    expect(
      await kitsu.playlist.getPlaylistForProject(
        { id: PROJECT_ID },
        { id: PLAYLIST_ID }
      )
    ).toEqual({ id: PLAYLIST_ID, build_jobs: [] })
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/projects/${PROJECT_ID}/playlists/${PLAYLIST_ID}`
    })
  })

  it('getPlaylistForProject returns null on a 404', async () => {
    fake.reply(404, {})
    expect(
      await kitsu.playlist.getPlaylistForProject(PROJECT_ID, PLAYLIST_ID)
    ).toBeNull()
  })

  it('addEntitiesToPlaylist posts the entities in one request', async () => {
    fake.reply(200, { id: PLAYLIST_ID })
    expect(
      await kitsu.playlist.addEntitiesToPlaylist({ id: PLAYLIST_ID }, [
        SHOT_ID,
        { id: ENTITY_ID },
        { entity: { id: OTHER_ID }, previewFile: { id: PREVIEW_FILE_ID } },
        { entity: SHOT_ID, previewFile: null }
      ])
    ).toEqual({ id: PLAYLIST_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/actions/playlists/${PLAYLIST_ID}/add-entities`
    })
    expect(fake.calls[0].body).toEqual({
      entities: [
        { entity_id: SHOT_ID },
        { entity_id: ENTITY_ID },
        { entity_id: OTHER_ID, preview_file_id: PREVIEW_FILE_ID },
        { entity_id: SHOT_ID }
      ]
    })
  })

  it.each([[[]], [undefined], [[null]]])(
    'addEntitiesToPlaylist rejects the entities %j without any request',
    async entities => {
      await expect(
        kitsu.playlist.addEntitiesToPlaylist(PLAYLIST_ID, entities)
      ).rejects.toBeInstanceOf(ParameterError)
      expect(fake.calls).toHaveLength(0)
    }
  )

  it('sendShareLinkInvitations emails the share link', async () => {
    fake.reply(200, { sent: 2 })
    expect(
      await kitsu.playlist.sendShareLinkInvitations(
        { id: PLAYLIST_ID },
        SHARE_TOKEN,
        {
          emails: ['client@studio.test'],
          persons: [{ id: PERSON_ID }],
          message: 'Please review'
        }
      )
    ).toEqual({ sent: 2 })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/data/playlists/${PLAYLIST_ID}/share/${SHARE_TOKEN}/invite`
    })
    expect(fake.calls[0].body).toEqual({
      emails: ['client@studio.test'],
      person_ids: [PERSON_ID],
      message: 'Please review'
    })
  })

  it('sendShareLinkInvitations sends empty lists by default', async () => {
    fake.reply(200, {})
    await kitsu.playlist.sendShareLinkInvitations(PLAYLIST_ID, SHARE_TOKEN)
    expect(fake.calls[0].body).toEqual({ emails: [], person_ids: [] })
  })

  it('newSharedPlaylistGuest creates a guest', async () => {
    fake.reply(201, { id: GUEST_ID })
    expect(
      await kitsu.playlist.newSharedPlaylistGuest(SHARE_TOKEN, {
        firstName: 'Ada',
        lastName: 'Lovelace'
      })
    ).toEqual({ id: GUEST_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `${SHARED}/guest`
    })
    expect(fake.calls[0].body).toEqual({
      first_name: 'Ada',
      last_name: 'Lovelace'
    })
  })

  it('newSharedPlaylistGuest asks for a known guest back', async () => {
    fake.reply(200, { id: GUEST_ID })
    await kitsu.playlist.newSharedPlaylistGuest(SHARE_TOKEN, {
      guest: { id: GUEST_ID }
    })
    expect(fake.calls[0].body).toEqual({ guest_id: GUEST_ID })
  })

  it('getSharedPlaylist reads the shared playlist', async () => {
    fake.reply(200, { id: PLAYLIST_ID })
    expect(await kitsu.playlist.getSharedPlaylist(SHARE_TOKEN)).toEqual({
      id: PLAYLIST_ID
    })
    expect(fake.calls[0]).toMatchObject({ method: 'GET', path: SHARED })
    expect(fake.calls[0].query.has('password')).toBe(false)
  })

  it('getSharedPlaylist sends the password and returns null on a 404', async () => {
    fake.reply(404, {})
    expect(
      await kitsu.playlist.getSharedPlaylist(SHARE_TOKEN, {
        password: 'secret'
      })
    ).toBeNull()
    expect(fake.calls[0].query.get('password')).toBe('secret')
  })

  it('getSharedPlaylistContext reads the context of the shared playlist', async () => {
    fake.reply(200, { task_status: [] })
    expect(
      await kitsu.playlist.getSharedPlaylistContext(SHARE_TOKEN, {
        password: 'secret'
      })
    ).toEqual({ task_status: [] })
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `${SHARED}/context`
    })
    expect(fake.calls[0].query.get('password')).toBe('secret')
  })

  it('getSharedPlaylistContext returns null on a 404', async () => {
    fake.reply(404, {})
    expect(
      await kitsu.playlist.getSharedPlaylistContext(SHARE_TOKEN)
    ).toBeNull()
  })

  it('updateSharedPlaylistAnnotations sends the annotation diff', async () => {
    fake.reply(200, { id: PREVIEW_FILE_ID })
    const additions = [{ time: 1, drawing: { objects: [] } }]
    expect(
      await kitsu.playlist.updateSharedPlaylistAnnotations(
        SHARE_TOKEN,
        { id: GUEST_ID },
        { id: PREVIEW_FILE_ID },
        { additions, deletions: [{ time: 2, objects: [OTHER_ID] }] }
      )
    ).toEqual({ id: PREVIEW_FILE_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `${SHARED}/annotations`
    })
    expect(fake.calls[0].body).toEqual({
      guest_id: GUEST_ID,
      preview_file_id: PREVIEW_FILE_ID,
      additions,
      updates: [],
      deletions: [{ time: 2, objects: [OTHER_ID] }]
    })
  })

  it('allSharedPlaylistComments lists the comments', async () => {
    fake.reply(200, [{ id: COMMENT_ID }])
    expect(
      await kitsu.playlist.allSharedPlaylistComments(SHARE_TOKEN, {
        password: 'secret'
      })
    ).toEqual([{ id: COMMENT_ID }])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `${SHARED}/comments`
    })
    expect(fake.calls[0].query.get('password')).toBe('secret')
  })

  it('newSharedPlaylistComment posts a guest comment', async () => {
    fake.reply(201, { id: COMMENT_ID })
    expect(
      await kitsu.playlist.newSharedPlaylistComment(
        SHARE_TOKEN,
        { id: GUEST_ID },
        { id: TASK_ID },
        { id: TASK_STATUS_ID },
        {
          text: 'Too dark',
          checklist: [{ text: 'Fix the light', checked: false }],
          password: 'secret'
        }
      )
    ).toEqual({ id: COMMENT_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `${SHARED}/comments`
    })
    expect(fake.calls[0].query.get('password')).toBe('secret')
    expect(fake.calls[0].body).toEqual({
      guest_id: GUEST_ID,
      task_id: TASK_ID,
      task_status_id: TASK_STATUS_ID,
      text: 'Too dark',
      checklist: [{ text: 'Fix the light', checked: false }]
    })
  })

  it('newSharedPlaylistComment sends an empty text by default', async () => {
    fake.reply(201, { id: COMMENT_ID })
    await kitsu.playlist.newSharedPlaylistComment(
      SHARE_TOKEN,
      GUEST_ID,
      TASK_ID,
      TASK_STATUS_ID
    )
    expect(fake.calls[0].query.has('password')).toBe(false)
    expect(fake.calls[0].body).toEqual({
      guest_id: GUEST_ID,
      task_id: TASK_ID,
      task_status_id: TASK_STATUS_ID,
      text: ''
    })
  })

  it('updateSharedPlaylistComment edits the comment of the guest', async () => {
    fake.reply(200, { id: COMMENT_ID })
    expect(
      await kitsu.playlist.updateSharedPlaylistComment(
        SHARE_TOKEN,
        { id: COMMENT_ID },
        { id: GUEST_ID },
        { text: 'Better', checklist: [], taskStatus: { id: TASK_STATUS_ID } }
      )
    ).toEqual({ id: COMMENT_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `${SHARED}/comments/${COMMENT_ID}`
    })
    expect(fake.calls[0].body).toEqual({
      guest_id: GUEST_ID,
      text: 'Better',
      checklist: [],
      task_status_id: TASK_STATUS_ID
    })
  })

  it('updateSharedPlaylistComment only sends what changes', async () => {
    fake.reply(200, { id: COMMENT_ID })
    await kitsu.playlist.updateSharedPlaylistComment(
      SHARE_TOKEN,
      COMMENT_ID,
      GUEST_ID,
      { text: 'Better' }
    )
    expect(fake.calls[0].body).toEqual({ guest_id: GUEST_ID, text: 'Better' })
  })

  it('removeSharedPlaylistComment deletes the comment of the guest', async () => {
    fake.reply(204)
    await kitsu.playlist.removeSharedPlaylistComment(
      SHARE_TOKEN,
      { id: COMMENT_ID },
      { id: GUEST_ID }
    )
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `${SHARED}/comments/${COMMENT_ID}`
    })
    expect(fake.calls[0].query.get('guest_id')).toBe(GUEST_ID)
  })

  it('addSharedPlaylistCommentAttachments uploads the files', async () => {
    fake.reply(201, { id: COMMENT_ID, attachment_files: [] })
    expect(
      await kitsu.playlist.addSharedPlaylistCommentAttachments(
        SHARE_TOKEN,
        { id: COMMENT_ID },
        { id: GUEST_ID },
        [new Blob(['one']), new Blob(['two'])]
      )
    ).toEqual({ id: COMMENT_ID, attachment_files: [] })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `${SHARED}/comments/${COMMENT_ID}/attachments`
    })
    const { body } = fake.calls[0]
    expect(body).toBeInstanceOf(FormData)
    expect([...body.keys()].sort()).toEqual(['file', 'file-1', 'guest_id'])
    expect(body.get('guest_id')).toBe(GUEST_ID)
    expect(await body.get('file').text()).toBe('one')
    expect(await body.get('file-1').text()).toBe('two')
  })

  it('addSharedPlaylistCommentAttachments accepts a single file', async () => {
    fake.reply(201, { id: COMMENT_ID })
    await kitsu.playlist.addSharedPlaylistCommentAttachments(
      SHARE_TOKEN,
      COMMENT_ID,
      GUEST_ID,
      new Blob(['one'])
    )
    expect([...fake.calls[0].body.keys()].sort()).toEqual(['file', 'guest_id'])
  })

  it.each([[[]], [undefined], ['notes.txt']])(
    'addSharedPlaylistCommentAttachments rejects the files %j',
    async attachments => {
      await expect(
        kitsu.playlist.addSharedPlaylistCommentAttachments(
          SHARE_TOKEN,
          COMMENT_ID,
          GUEST_ID,
          attachments
        )
      ).rejects.toBeInstanceOf(ParameterError)
      expect(fake.calls).toHaveLength(0)
    }
  )

  it('removeSharedPlaylistCommentAttachment deletes the attachment', async () => {
    fake.reply(204)
    await kitsu.playlist.removeSharedPlaylistCommentAttachment(
      SHARE_TOKEN,
      { id: COMMENT_ID },
      { id: ATTACHMENT_ID },
      { id: GUEST_ID }
    )
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `${SHARED}/comments/${COMMENT_ID}/attachments/${ATTACHMENT_ID}`
    })
    expect(fake.calls[0].query.get('guest_id')).toBe(GUEST_ID)
  })

  const tokenCalls = [
    ['sendShareLinkInvitations', token => [PLAYLIST_ID, token]],
    ['newSharedPlaylistGuest', token => [token]],
    ['getSharedPlaylist', token => [token]],
    ['getSharedPlaylistContext', token => [token]],
    [
      'updateSharedPlaylistAnnotations',
      token => [token, GUEST_ID, PREVIEW_FILE_ID]
    ],
    ['allSharedPlaylistComments', token => [token]],
    [
      'newSharedPlaylistComment',
      token => [token, GUEST_ID, TASK_ID, TASK_STATUS_ID]
    ],
    ['updateSharedPlaylistComment', token => [token, COMMENT_ID, GUEST_ID]],
    ['removeSharedPlaylistComment', token => [token, COMMENT_ID, GUEST_ID]],
    [
      'addSharedPlaylistCommentAttachments',
      token => [token, COMMENT_ID, GUEST_ID, new Blob(['one'])]
    ],
    [
      'removeSharedPlaylistCommentAttachment',
      token => [token, COMMENT_ID, ATTACHMENT_ID, GUEST_ID]
    ]
  ]

  it.each(tokenCalls)(
    '%s rejects a token that would reshape the route',
    async (name, argsFor) => {
      await expect(
        kitsu.playlist[name](...argsFor('a/b'))
      ).rejects.toBeInstanceOf(ParameterError)
      expect(fake.calls).toHaveLength(0)
    }
  )

  // The core aborts its own request signal as soon as the caller signal is
  // aborted: an aborted request signal proves the option went through.
  it.each([
    ['getPlaylistForProject', () => [PROJECT_ID, PLAYLIST_ID]],
    ['addEntitiesToPlaylist', () => [PLAYLIST_ID, [SHOT_ID]]],
    ...tokenCalls
  ])('%s forwards the caller signal', async (name, argsFor) => {
    const controller = new AbortController()
    controller.abort()
    fake.reply(200, [])
    await kitsu.playlist[name](...argsFor(SHARE_TOKEN), {
      signal: controller.signal
    })
    expect(fake.calls).toHaveLength(1)
    expect(fake.calls[0].signal.aborted).toBe(true)
  })
})
