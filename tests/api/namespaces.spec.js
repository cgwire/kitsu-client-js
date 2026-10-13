import { describe, expect, it } from 'vitest'

import { ParameterError } from '../../src/index.js'
import { makeClient } from '../helpers/client.js'

const CORE_KEYS = ['http', 'events']

const functionsOf = client =>
  Object.entries(client)
    .filter(
      ([key, value]) =>
        value && typeof value === 'object' && !CORE_KEYS.includes(key)
    )
    .flatMap(([namespace, api]) =>
      Object.keys(api).map(name => [namespace, name])
    )

// Every argument of these is optional: called bare, they send a request.
const WITHOUT_REQUIRED_ARGUMENTS = [
  'asset.allAssetTypes',
  'asset.allAssets',
  'asset.allAssetsForOpenProjects',
  'asset.allAssetsWithTasks',
  'concept.allConcepts',
  'customAction.allCustomActions',
  'entity.allEntities',
  'entity.allEntityTypes',
  'event.allEventNames',
  'event.allLastEvents',
  'event.allLastLoginLogs',
  'files.allDepartmentSoftwares',
  'files.allFileStatuses',
  'files.allOutputTypes',
  'files.allSoftwares',
  'files.getRunningPreviewFiles',
  'hardware.allDepartmentHardwareItems',
  'hardware.allHardwareItems',
  'news.allNews',
  'person.allDayOffs',
  'person.allDepartments',
  'person.allOrganisations',
  'person.allPersons',
  'person.allSalaryScales',
  'person.getOrganisation',
  'person.getTimeSpentsYearTable',
  'playlist.allPlaylists',
  'project.allGlobalStatusAutomations',
  'project.allOpenProjects',
  'project.allPreviewBackgroundFiles',
  'project.allProjectStatus',
  'project.allProjects',
  'project.allProjectsWithAccess',
  'projectTemplate.allProjectTemplates',
  'scene.allScenes',
  'shot.allShotsWithTasks',
  'studio.allStudios',
  'task.allOpenTasks',
  'task.allTaskStatuses',
  'task.allTaskTypes',
  'task.allTasks',
  'task.batchComments',
  'task.getDefaultTaskStatus',
  'task.getOpenTasksBurndown',
  'task.getOpenTasksStats',
  'task.getPersonsTasksDates',
  'user.allChats',
  'user.allDesktopLoginLogs',
  'user.allDoneTasks',
  'user.allFilterGroups',
  'user.allFilters',
  'user.allNotifications',
  'user.allOpenProjects',
  'user.allTasksRequiringFeedback',
  'user.allTasksToDo',
  'user.clearAvatar',
  'user.getContext',
  'user.getTasksRequiringFeedbackFilterValues',
  'user.logDesktopSessionLogIn',
  'user.markAllNotificationsAsRead'
]

// Known gaps, to fix in their namespaces: called bare, they send a request
// before checking a required argument, or fail with a TypeError. Remove a
// function from this list once it checks its arguments first.
const KNOWN_GAPS = [
  'asset.allAssetsForProject',
  'asset.getAssetTypeFromAsset',
  'entity.newEntityType',
  'person.newBot',
  'project.closeProject',
  'projectTemplate.newProjectTemplate',
  'task.addTasksBatchComments',
  'task.reorderTaskTypes',
  'task.setTasksMainPreview',
  'task.startTask',
  'user.getTimespentsRange',
  'user.newFilter',
  'user.newFilterGroup',
  'user.subscribeToTasks',
  'user.unsubscribeFromTasks'
]

const ALL = functionsOf(makeClient().kitsu)
const withRequiredArguments = ALL.filter(
  ([namespace, name]) =>
    ![...WITHOUT_REQUIRED_ARGUMENTS, ...KNOWN_GAPS].includes(
      `${namespace}.${name}`
    )
)

describe('namespace functions', () => {
  it('lists only functions that exist', () => {
    const names = ALL.map(([namespace, name]) => `${namespace}.${name}`)
    const unknown = [...WITHOUT_REQUIRED_ARGUMENTS, ...KNOWN_GAPS].filter(
      name => !names.includes(name)
    )
    expect(unknown).toEqual([])
  })

  // The failure must come as a rejection, so .catch() and Promise.all() see
  // it.
  it.each(ALL)('%s.%s rejects instead of throwing', async (namespace, name) => {
    const { kitsu } = makeClient()
    const results = []
    expect(() => results.push(kitsu[namespace][name]())).not.toThrow()
    expect(results[0]).toBeInstanceOf(Promise)
    await results[0].catch(() => {})
  })

  // A dropped idOf() or requiredOf() would send the request with
  // "undefined" in its path or body.
  it.each(withRequiredArguments)(
    '%s.%s rejects a missing argument before any request',
    async (namespace, name) => {
      const { kitsu, fake } = makeClient()
      await expect(kitsu[namespace][name]()).rejects.toBeInstanceOf(
        ParameterError
      )
      expect(fake.calls).toEqual([])
    }
  )

  for (const name of KNOWN_GAPS) {
    it.todo(`${name} rejects a missing argument before any request`)
  }
})
