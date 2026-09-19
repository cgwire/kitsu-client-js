import { beforeEach, describe, expect, it } from 'vitest'

import { makeClient } from '../helpers/client.js'
import {
  ASSET_ID,
  ASSET_TYPE_ID,
  CHAT_MESSAGE_ID,
  ENTITY_ID,
  FILTER_GROUP_ID,
  FILTER_ID,
  NOTIFICATION_ID,
  PROJECT_ID,
  SCENE_ID,
  SEQUENCE_ID,
  SHOT_ID,
  TASK_ID
} from '../helpers/ids.js'

const DAY = '2026-09-19'

// Every function of the namespace with its required arguments.
const FUNCTIONS = [
  ['allOpenProjects', []],
  ['allAssetTypesForProject', [PROJECT_ID]],
  ['allAssetsForAssetTypeAndProject', [PROJECT_ID, ASSET_TYPE_ID]],
  ['allTasksForAsset', [ASSET_ID]],
  ['allTasksForShot', [SHOT_ID]],
  ['allTasksForScene', [SCENE_ID]],
  ['allTasksForSequence', [SEQUENCE_ID]],
  ['allTaskTypesForAsset', [ASSET_ID]],
  ['allTaskTypesForShot', [SHOT_ID]],
  ['allTaskTypesForScene', [SCENE_ID]],
  ['allTaskTypesForSequence', [SEQUENCE_ID]],
  ['allSequencesForProject', [PROJECT_ID]],
  ['allEpisodesForProject', [PROJECT_ID]],
  ['allShotsForSequence', [SEQUENCE_ID]],
  ['allScenesForSequence', [SEQUENCE_ID]],
  ['allTasksToDo', []],
  ['allDoneTasks', []],
  ['getTimespentsRange', [DAY, DAY]],
  ['logDesktopSessionLogIn', []],
  ['allFilters', []],
  ['newFilter', ['Wip', 'status=wip', 'asset']],
  ['removeFilter', [FILTER_ID]],
  ['updateFilter', [{ id: FILTER_ID }]],
  ['getContext', []],
  ['allTasksRequiringFeedback', []],
  ['allFilterGroups', []],
  ['newFilterGroup', ['Anim']],
  ['getFilterGroup', [FILTER_GROUP_ID]],
  ['updateFilterGroup', [{ id: FILTER_GROUP_ID }]],
  ['removeFilterGroup', [FILTER_GROUP_ID]],
  ['allDesktopLoginLogs', []],
  ['getTimeSpentsByDate', [DAY]],
  ['getTaskTimeSpent', [TASK_ID, DAY]],
  ['getDayOff', [DAY]],
  ['allNotifications', []],
  ['getNotification', [NOTIFICATION_ID]],
  ['updateNotification', [{ id: NOTIFICATION_ID }]],
  ['checkTaskSubscription', [TASK_ID]],
  ['subscribeToTask', [TASK_ID]],
  ['unsubscribeFromTask', [TASK_ID]],
  ['allChats', []],
  ['joinChat', [ENTITY_ID]],
  ['leaveChat', [ENTITY_ID]],
  ['getChat', [ENTITY_ID]],
  ['allChatMessages', [ENTITY_ID]],
  ['getChatMessage', [ENTITY_ID, CHAT_MESSAGE_ID]],
  ['newChatMessage', [ENTITY_ID, 'Hello']],
  ['removeChatMessage', [ENTITY_ID, CHAT_MESSAGE_ID]],
  ['getTasksRequiringFeedbackFilterValues', []],
  ['subscribeToTasks', [[TASK_ID]]],
  ['unsubscribeFromTasks', [[TASK_ID]]],
  ['clearAvatar', []],
  ['markAllNotificationsAsRead', []]
]

describe('user namespace: surface and cancellation', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('exposes exactly the functions ported from gazu and Kitsu', () => {
    expect(Object.keys(kitsu.user).sort()).toEqual(
      FUNCTIONS.map(([name]) => name).sort()
    )
  })

  // The core aborts its own request signal as soon as the caller signal is
  // aborted: an aborted request signal proves the option went through.
  it.each(FUNCTIONS)('%s forwards the caller signal', async (name, args) => {
    const controller = new AbortController()
    controller.abort()
    fake.reply(200, [])
    await kitsu.user[name](...args, { signal: controller.signal })
    expect(fake.calls[0].signal.aborted).toBe(true)
  })

  it.each(FUNCTIONS)('%s works without options', async (name, args) => {
    fake.reply(200, [])
    await kitsu.user[name](...args)
    expect(fake.calls[0].signal.aborted).toBe(false)
  })
})
