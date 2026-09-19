import { idOf, optionalIdOf, orNull } from '../core/params.js'

/**
 * @typedef {import('../core/params.js').Entity} Entity
 * @typedef {import('../core/params.js').Model} Model
 * @typedef {import('../core/params.js').RequestOptions} RequestOptions
 * @typedef {{
 *   data: Entity[],
 *   total: number,
 *   stats: Record<string, number>
 * }} NewsFeed One page of news, the total and the count per task status.
 */

export const newsApi = http => ({
  /**
   * The activity feed: of one project when given, of every open project of
   * the user otherwise.
   * @param {{
   *   project?: Model,
   *   onlyPreview?: boolean,
   *   taskType?: Model,
   *   taskStatus?: Model,
   *   person?: Model,
   *   episode?: Model,
   *   page?: number,
   *   limit?: number,
   *   after?: string,
   *   before?: string,
   *   signal?: AbortSignal
   * }} [options] after and before are "YYYY-MM-DDTHH:mm:ss" strings, or
   *   plain days.
   * @returns {Promise<NewsFeed>}
   */
  allNews: async ({
    project,
    onlyPreview,
    taskType,
    taskStatus,
    person,
    episode,
    page,
    limit,
    after,
    before,
    signal
  } = {}) => {
    const projectId = optionalIdOf(project)
    return http.get(
      projectId ? `data/projects/${projectId}/news` : 'data/projects/news',
      {
        only_preview: onlyPreview ? true : null,
        task_type_id: optionalIdOf(taskType),
        task_status_id: optionalIdOf(taskStatus),
        person_id: optionalIdOf(person),
        episode_id: optionalIdOf(episode),
        page,
        limit,
        after,
        before
      },
      { signal }
    )
  },

  /**
   * @param {Model} project
   * @param {Model} news
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity|null>} null when the news does not exist.
   */
  getNews: async (project, news, { signal } = {}) =>
    orNull(
      http.get(
        `data/projects/${idOf(project)}/news/${idOf(news)}`,
        {},
        { signal }
      )
    )
})
