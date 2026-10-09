import { KitsuError, ParameterError } from '../core/errors.js'
import {
  dateOf,
  dayOf,
  idOf,
  idsOf,
  optionalIdOf,
  orNull,
  requiredOf,
  sortedByName
} from '../core/params.js'
import * as urls from '../utils/urls.js'

/**
 * @typedef {import('../core/params.js').Entity} Entity
 * @typedef {import('../core/params.js').Model} Model
 * @typedef {import('../core/params.js').RequestOptions} RequestOptions
 */

/**
 * @param {number} value
 * @returns {number}
 */
const intOf = value => {
  if (Number.isInteger(value)) return value
  throw new ParameterError('Wrong format: expected an integer')
}

/**
 * @param {number} value
 * @returns {string} The integer on two digits, as gazu's zfill(2).
 */
const twoDigits = value => String(intOf(value)).padStart(2, '0')

/**
 * @typedef {{project?: Model, studio?: Model, signal?: AbortSignal}}
 *   TimeSpentOptions project and studio keep the time spent on that project
 *   or by the people of that studio.
 * @typedef {{project?: Model, signal?: AbortSignal}} PersonTimeSpentOptions
 *   project keeps the time spent on that project.
 * @typedef {{
 *   project?: Model,
 *   taskType?: Model,
 *   countMode?: string,
 *   signal?: AbortSignal
 * }} QuotaOptions countMode is weighted (default of the API), weighteddone,
 *   feedback or done.
 */

/**
 * @param {any} http
 * @param {string} path
 * @param {TimeSpentOptions} [options]
 */
const getTimeSpents = (http, path, { project, studio, signal } = {}) =>
  http.get(
    path,
    { project_id: optionalIdOf(project), studio_id: optionalIdOf(studio) },
    { signal }
  )

// The routes of a single person have no studio filter.
/**
 * @param {any} http
 * @param {string} path
 * @param {PersonTimeSpentOptions} [options]
 */
const getPersonTimeSpents = (http, path, { project, signal } = {}) =>
  orNull(getTimeSpents(http, path, { project, signal }))

/**
 * @param {any} http
 * @param {string} path
 * @param {QuotaOptions} [options]
 */
const getQuotaShots = (
  http,
  path,
  { project, taskType, countMode, signal } = {}
) =>
  orNull(
    http.get(
      path,
      {
        project_id: optionalIdOf(project),
        task_type_id: optionalIdOf(taskType),
        count_mode: countMode
      },
      { signal }
    )
  )

/**
 * @param {any} http
 * @param {string} name
 * @param {RequestOptions} [options]
 */
const getDepartmentByName = (http, name, { signal } = {}) =>
  http.fetchFirst('departments', { name: requiredOf('name', name) }, { signal })

/**
 * @param {any} http
 * @param {string} email
 * @param {{isBot?: boolean, signal?: AbortSignal}} [options]
 */
const getPersonByEmail = (http, email, { isBot = false, signal } = {}) =>
  http.fetchFirst(
    'persons',
    { email: requiredOf('email', email), is_bot: isBot },
    { signal }
  )

// Zou issues a new token, and revokes the previous one, whenever the body of
// a person update holds expiration_date, even null. Every admin read holds
// it: only generateToken sends it.
/**
 * @param {Record<string, any>} person
 * @returns {Record<string, any>} A copy without expiration_date.
 */
const withoutExpirationDate = person =>
  Object.fromEntries(
    Object.entries(person).filter(([key]) => key !== 'expiration_date')
  )

/**
 * @param {any} http
 * @param {Entity} person
 * @param {RequestOptions} [options]
 */
const updatePerson = (http, person, { signal } = {}) =>
  http.update(
    'persons',
    idOf(person),
    withoutExpirationDate(
      Array.isArray(person.departments)
        ? { ...person, departments: idsOf(person.departments) }
        : person
    ),
    { signal }
  )

/**
 * @param {any} http
 * @param {Model} person
 * @param {{force?: boolean, signal?: AbortSignal}} [options]
 */
const removePerson = (http, person, { force = false, signal } = {}) =>
  http.remove(
    'persons',
    idOf(person),
    { force: force ? true : null },
    { signal }
  )

export const personApi = http => ({
  /**
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} All organisations, sorted by name.
   */
  allOrganisations: async ({ signal } = {}) =>
    http.fetchAll('organisations', {}, { signal }).then(sortedByName),

  /**
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} All departments, sorted by name.
   */
  allDepartments: async ({ signal } = {}) =>
    http.fetchAll('departments', {}, { signal }).then(sortedByName),

  /**
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} All persons, sorted by name.
   */
  allPersons: async ({ signal } = {}) =>
    http.fetchAll('persons', {}, { signal }).then(sortedByName),

  /**
   * @param {string} name
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity|null>} First department matching the name.
   */
  getDepartmentByName: async (name, options) =>
    getDepartmentByName(http, name, options),

  /**
   * @param {Model} department
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity|null>} The department, null when missing.
   */
  getDepartment: async (department, { signal } = {}) =>
    http.fetchOne('departments', idOf(department), { signal }),

  /**
   * @param {Model} person
   * @param {{relations?: boolean, signal?: AbortSignal}} [options] relations
   *   also loads the links of the person (departments, ...).
   * @returns {Promise<Entity|null>} The person, null when it does not exist.
   */
  getPerson: async (person, { relations = false, signal } = {}) =>
    http.fetchFirst(
      'persons',
      {
        id: idOf(person),
        relations: relations ? true : null
      },
      { signal }
    ),

  /**
   * @param {string} desktopLogin Login used to sign in on the workstation.
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity|null>} First human matching the login.
   */
  getPersonByDesktopLogin: async (desktopLogin, { signal } = {}) =>
    http.fetchFirst(
      'persons',
      {
        desktop_login: requiredOf('desktopLogin', desktopLogin),
        is_bot: false
      },
      { signal }
    ),

  /**
   * @param {string} email
   * @param {{isBot?: boolean, signal?: AbortSignal}} [options] isBot looks
   *   up a bot account instead of a human.
   * @returns {Promise<Entity|null>} First person matching the email.
   */
  getPersonByEmail: async (email, options) =>
    getPersonByEmail(http, email, options),

  /**
   * The first and last names win over the full name when both are given.
   * @param {string} fullName
   * @param {{firstName?: string, lastName?: string, signal?: AbortSignal}}
   *   [options]
   * @returns {Promise<Entity|null>} First human matching the name.
   */
  getPersonByFullName: async (fullName, { firstName, lastName, signal } = {}) =>
    http.fetchFirst(
      'persons',
      firstName != null && lastName != null
        ? {
            first_name: requiredOf('firstName', firstName),
            last_name: requiredOf('lastName', lastName),
            is_bot: false
          }
        : { full_name: requiredOf('fullName', fullName), is_bot: false },
      { signal }
    ),

  /**
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The organisation the session belongs to.
   */
  getOrganisation: async ({ signal } = {}) =>
    http
      .get('auth/authenticated', {}, { signal })
      .then(body => body.organisation),

  /**
   * @param {Entity} organisation The settings of the studio: name,
   *   hours_by_day, timesheets_locked, chat tokens, has_avatar, ...
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The updated organisation.
   */
  updateOrganisation: async (organisation, { signal } = {}) =>
    http.update('organisations', idOf(organisation), organisation, { signal }),

  /**
   * Create a department, or return the existing one bearing that name.
   * @param {string} name
   * @param {{color?: string, archived?: boolean, signal?: AbortSignal}}
   *   [options] color is a hex string such as "#00FF00".
   * @returns {Promise<Entity>} The department.
   */
  newDepartment: async (name, { color = '', archived = false, signal } = {}) =>
    (await getDepartmentByName(http, name, { signal })) ||
    http.post('data/departments', { name, color, archived }, { signal }),

  /**
   * @param {Entity} department
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The updated department.
   */
  updateDepartment: async (department, { signal } = {}) =>
    http.update('departments', idOf(department), department, { signal }),

  /**
   * Zou refuses (400) to delete a department still in use, for instance by
   * its members (see removePersonFromDepartment) or by a task type.
   *
   * gazu's force is not ported: Zou never reads it on this route.
   * @param {Model} department
   * @param {RequestOptions} [options]
   * @returns {Promise<null>}
   */
  removeDepartment: async (department, { signal } = {}) =>
    http.remove('departments', idOf(department), {}, { signal }),

  /**
   * Create a person, or return the existing human bearing that email.
   * @param {string} firstName
   * @param {string} lastName
   * @param {string} email
   * @param {{
   *   phone?: string,
   *   role?: string,
   *   desktopLogin?: string,
   *   departments?: Model[],
   *   password?: string|null,
   *   active?: boolean,
   *   contractType?: string,
   *   signal?: AbortSignal
   * }} [options] role is user, manager or admin (artist, supervisor and
   *   studio manager). Zou sets a default password when none is given.
   * @returns {Promise<Entity>} The person.
   */
  newPerson: async (
    firstName,
    lastName,
    email,
    {
      phone = '',
      role = 'user',
      desktopLogin = '',
      departments = [],
      password = null,
      active = true,
      contractType = 'open-ended',
      signal
    } = {}
  ) =>
    (await getPersonByEmail(http, email, { signal })) ||
    http.post(
      'data/persons',
      {
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        role,
        desktop_login: desktopLogin,
        departments: idsOf(departments),
        password,
        active,
        contract_type: contractType
      },
      { signal }
    ),

  /**
   * Save the person. Its expiration_date is left out: Zou takes it as a
   * request for a new token, which revokes the previous one (see
   * generateToken).
   * @param {Entity} person Its departments may be objects or ids.
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The updated person.
   */
  updatePerson: async (person, options) => updatePerson(http, person, options),

  /**
   * @param {Model} person
   * @param {{force?: boolean, signal?: AbortSignal}} [options]
   * @returns {Promise<null>}
   */
  removePerson: async (person, options) => removePerson(http, person, options),

  /**
   * @param {string} name
   * @param {string} email
   * @param {{
   *   role?: string,
   *   departments?: Model[],
   *   active?: boolean,
   *   expirationDate?: Date|string|null,
   *   signal?: AbortSignal
   * }} [options]
   * @returns {Promise<Entity>} The created bot, with its access token.
   */
  newBot: async (
    name,
    email,
    {
      role = 'user',
      departments = [],
      active = true,
      expirationDate = null,
      signal
    } = {}
  ) =>
    http.post(
      'data/persons',
      {
        first_name: name,
        last_name: '',
        email,
        role,
        departments: idsOf(departments),
        active,
        expiration_date: dateOf(expirationDate),
        is_bot: true
      },
      { signal }
    ),

  /**
   * Save the bot. Its expiration_date is left out, so its token keeps
   * working: generateToken changes the expiration date with a new token.
   * @param {Entity} bot Its departments may be objects or ids.
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The updated bot.
   */
  updateBot: async (bot, options) => updatePerson(http, bot, options),

  /**
   * Issue a new access token for the bot, or an API token for a human. Zou
   * revokes the previous one at once: whatever still uses it gets a 401.
   * An admin can issue a token for anybody, a human for themselves only. A
   * bot without the admin role cannot renew its own token: Zou answers
   * without any token and changes nothing, as it does when sent the stored
   * expiration date once past. The call then rejects with a KitsuError
   * carrying that answer, and the current token keeps working.
   * @param {Model} person
   * @param {{expirationDate?: Date|string|null, signal?: AbortSignal}}
   *   [options] expirationDate is the last day the token works,
   *   "YYYY-MM-DD", today or later. Without it the token never expires.
   * @returns {Promise<Entity>} The person, with the new token in
   *   access_token.
   */
  generateToken: async (person, { expirationDate = null, signal } = {}) => {
    const id = idOf(person)
    const body = await http.update(
      'persons',
      id,
      { expiration_date: dateOf(expirationDate) },
      { signal }
    )
    // Zou answers 200 when it issues no token: a caller that stores the
    // token must not get undefined in its place.
    if (typeof body?.access_token !== 'string' || !body.access_token) {
      throw new KitsuError('Zou issued no access token', {
        status: 200,
        path: `data/persons/${id}`,
        method: 'PUT',
        body
      })
    }
    return body
  },

  /**
   * @param {Model} bot
   * @param {{force?: boolean, signal?: AbortSignal}} [options]
   * @returns {Promise<null>}
   */
  removeBot: async (bot, options) => removePerson(http, bot, options),

  /**
   * @param {Model} person
   * @param {Date|string} startDate First day of the range, "YYYY-MM-DD".
   * @param {Date|string} endDate Last day of the range, "YYYY-MM-DD".
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]|null>} Time spents of the person in the range,
   *   null when the person does not exist.
   */
  getTimeSpentsRange: async (person, startDate, endDate, { signal } = {}) =>
    orNull(
      http.get(
        `data/persons/${idOf(person)}/time-spents`,
        { start_date: dateOf(startDate), end_date: dateOf(endDate) },
        { signal }
      )
    ),

  /**
   * @param {Model} person
   * @param {Date|string} date Any day of the month to read, "YYYY-MM-DD".
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]|null>} All time spents of the person for the
   *   month, null when the person does not exist.
   */
  getAllMonthTimeSpents: async (person, date, { signal } = {}) =>
    orNull(
      http.get(
        `data/persons/${idOf(person)}/time-spents/month/all/${dayOf(date)
          .slice(0, 7)
          .replace('-', '/')}`,
        {},
        { signal }
      )
    ),

  /**
   * @param {number} year
   * @param {number} month From 1 (January) to 12.
   * @param {RequestOptions} [options]
   * @returns {Promise<string>} The presence log table of the month, as CSV.
   */
  getPresenceLog: async (year, month, { signal } = {}) =>
    http.get(
      `data/persons/presence-logs/${intOf(year)}-${twoDigits(month)}`,
      {},
      // A CSV table: the http core refuses a non-JSON body unless told how
      // to read it.
      { signal, read: response => response.text() }
    ),

  /**
   * @param {Model} person
   * @param {Date|string} date "YYYY-MM-DD"
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]|null>} Time spents of the person on that day,
   *   null when the person does not exist.
   */
  getTimeSpentsByDate: async (person, date, { signal } = {}) =>
    orNull(
      http.get(
        `data/persons/${idOf(person)}/time-spents/${dayOf(date)}`,
        {},
        { signal }
      )
    ),

  /**
   * @param {Model} person
   * @param {number} year
   * @param {number} week
   * @param {PersonTimeSpentOptions} [options]
   * @returns {Promise<Entity[]|null>} Time spents of the person for the week,
   *   null when the person does not exist.
   */
  getWeekTimeSpents: async (person, year, week, options) =>
    getPersonTimeSpents(
      http,
      `data/persons/${idOf(person)}/time-spents/week/${intOf(year)}/${intOf(week)}`,
      options
    ),

  /**
   * @param {Model} person
   * @param {number} year
   * @param {number} month From 1 (January) to 12.
   * @param {PersonTimeSpentOptions} [options]
   * @returns {Promise<Entity[]|null>} Time spents of the person for the
   *   month, null when the person does not exist.
   */
  getMonthTimeSpents: async (person, year, month, options) =>
    getPersonTimeSpents(
      http,
      `data/persons/${idOf(person)}/time-spents/month/${intOf(year)}/${intOf(month)}`,
      options
    ),

  /**
   * @param {Model} person
   * @param {number} year
   * @param {number} month From 1 (January) to 12.
   * @param {number} day
   * @param {PersonTimeSpentOptions} [options]
   * @returns {Promise<Entity[]|null>} Time spents of the person for the day,
   *   null when the person does not exist.
   */
  getDayTimeSpents: async (person, year, month, day, options) =>
    getPersonTimeSpents(
      http,
      `data/persons/${idOf(person)}/time-spents/day/${intOf(year)}/${intOf(month)}/${intOf(day)}`,
      options
    ),

  /**
   * @param {Model} person
   * @param {number} year
   * @param {PersonTimeSpentOptions} [options]
   * @returns {Promise<Entity[]|null>} Time spents of the person for the year,
   *   null when the person does not exist.
   */
  getYearTimeSpents: async (person, year, options) =>
    getPersonTimeSpents(
      http,
      `data/persons/${idOf(person)}/time-spents/year/${intOf(year)}`,
      options
    ),

  /**
   * @param {number} year
   * @param {number} month From 1 (January) to 12.
   * @param {TimeSpentOptions} [options]
   * @returns {Promise<Entity>} Time spent by each person on each day of the
   *   month.
   */
  getTimeSpentsDayTable: async (year, month, options) =>
    getTimeSpents(
      http,
      `data/persons/time-spents/day-table/${intOf(year)}/${intOf(month)}`,
      options
    ),

  /**
   * @param {number} year
   * @param {TimeSpentOptions} [options]
   * @returns {Promise<Entity>} Time spent by each person on each week of the
   *   year.
   */
  getTimeSpentsWeekTable: async (year, options) =>
    getTimeSpents(
      http,
      `data/persons/time-spents/week-table/${intOf(year)}`,
      options
    ),

  /**
   * @param {number} year
   * @param {TimeSpentOptions} [options]
   * @returns {Promise<Entity>} Time spent by each person on each month of the
   *   year.
   */
  getTimeSpentsMonthTable: async (year, options) =>
    getTimeSpents(
      http,
      `data/persons/time-spents/month-table/${intOf(year)}`,
      options
    ),

  /**
   * @param {TimeSpentOptions} [options]
   * @returns {Promise<Entity>} Time spent by each person on each year.
   */
  getTimeSpentsYearTable: async options =>
    getTimeSpents(http, 'data/persons/time-spents/year-table', options),

  /**
   * @param {Model} person
   * @param {number} year
   * @param {number} month From 1 (January) to 12.
   * @param {QuotaOptions} [options]
   * @returns {Promise<Entity[]|null>} Shots the person delivered each day of
   *   the month, null when the person does not exist.
   */
  getMonthQuotaShots: async (person, year, month, options) =>
    getQuotaShots(
      http,
      `data/persons/${idOf(person)}/quota-shots/month/${intOf(year)}/${intOf(month)}`,
      options
    ),

  /**
   * @param {Model} person
   * @param {number} year
   * @param {number} week
   * @param {QuotaOptions} [options]
   * @returns {Promise<Entity[]|null>} Shots the person delivered during the
   *   week, null when the person does not exist.
   */
  getWeekQuotaShots: async (person, year, week, options) =>
    getQuotaShots(
      http,
      `data/persons/${idOf(person)}/quota-shots/week/${intOf(year)}/${intOf(week)}`,
      options
    ),

  /**
   * @param {Model} person
   * @param {number} year
   * @param {number} month From 1 (January) to 12.
   * @param {number} day
   * @param {QuotaOptions} [options]
   * @returns {Promise<Entity[]|null>} Shots the person delivered on that day,
   *   null when the person does not exist.
   */
  getDayQuotaShots: async (person, year, month, day, options) =>
    getQuotaShots(
      http,
      `data/persons/${idOf(person)}/quota-shots/day/${intOf(year)}/${intOf(month)}/${intOf(day)}`,
      options
    ),

  /**
   * The API narrows the day offs to a month only: year and month go together.
   * @param {{year?: number, month?: number, signal?: AbortSignal}} [options]
   *   month goes from 1 (January) to 12.
   * @returns {Promise<Entity[]>} The day offs of everyone, of the whole
   *   history or of one month.
   */
  allDayOffs: async ({ year, month, signal } = {}) => {
    if (year == null && month == null)
      return http.fetchAll('day-offs', {}, { signal })
    if (year == null || month == null)
      throw new ParameterError('year and month must be given together')
    return http.get(
      `data/persons/day-offs/${intOf(year)}/${intOf(month)}`,
      {},
      { signal }
    )
  },

  /**
   * @param {Model} person
   * @param {Date|string} date "YYYY-MM-DD"
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity|null>} The day off of the person covering that
   *   day, null when the person does not exist.
   */
  getDayOffByDate: async (person, date, { signal } = {}) =>
    orNull(
      http.get(
        `data/persons/${idOf(person)}/day-offs/${dayOf(date)}`,
        {},
        { signal }
      )
    ),

  /**
   * @param {Model} person
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]|null>} Day offs of the person, null when the
   *   person does not exist.
   */
  getDayOffs: async (person, { signal } = {}) =>
    orNull(http.fetchAll(`persons/${idOf(person)}/day-offs`, {}, { signal })),

  /**
   * @param {Model} person
   * @param {number} year
   * @param {number} week
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]|null>} Day offs of the person for the week,
   *   null when the person does not exist.
   */
  getWeekDayOffs: async (person, year, week, { signal } = {}) =>
    orNull(
      http.get(
        `data/persons/${idOf(person)}/day-offs/week/${intOf(year)}/${intOf(week)}`,
        {},
        { signal }
      )
    ),

  /**
   * @param {Model} person
   * @param {number} year
   * @param {number} month From 1 (January) to 12.
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]|null>} Day offs of the person for the month,
   *   null when the person does not exist.
   */
  getMonthDayOffs: async (person, year, month, { signal } = {}) =>
    orNull(
      http.get(
        `data/persons/${idOf(person)}/day-offs/month/${intOf(year)}/${twoDigits(month)}`,
        {},
        { signal }
      )
    ),

  /**
   * @param {Model} person
   * @param {number} year
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]|null>} Day offs of the person for the year,
   *   null when the person does not exist.
   */
  getYearDayOffs: async (person, year, { signal } = {}) =>
    orNull(
      http.get(
        `data/persons/${idOf(person)}/day-offs/year/${intOf(year)}`,
        {},
        { signal }
      )
    ),

  /**
   * @param {Model} dayOff
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity|null>} The day off, null when missing.
   */
  getDayOff: async (dayOff, { signal } = {}) =>
    http.fetchOne('day-offs', idOf(dayOff), { signal }),

  /**
   * Zou rejects a period overlapping an existing day off, and removes the
   * time spents that fall within the new period.
   * @param {Model} person
   * @param {Date|string} date First day, "YYYY-MM-DD".
   * @param {Date|string} endDate Last day, inclusive, "YYYY-MM-DD".
   * @param {{description?: string|null, signal?: AbortSignal}} [options]
   * @returns {Promise<Entity>} The created day off.
   */
  newDayOff: async (
    person,
    date,
    endDate,
    { description = null, signal } = {}
  ) =>
    http.create(
      'day-offs',
      {
        person_id: idOf(person),
        date: dateOf(date),
        end_date: dateOf(endDate),
        ...(description === null ? {} : { description })
      },
      { signal }
    ),

  /**
   * @param {Entity} dayOff The fields that can change are date, end_date,
   *   description and person_id.
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The updated day off.
   */
  updateDayOff: async (dayOff, { signal } = {}) =>
    http.update('day-offs', idOf(dayOff), dayOff, { signal }),

  /**
   * @param {Model} dayOff
   * @param {RequestOptions} [options]
   * @returns {Promise<null>}
   */
  removeDayOff: async (dayOff, { signal } = {}) =>
    http.remove('day-offs', idOf(dayOff), {}, { signal }),

  /**
   * @param {Model} person
   * @param {string} password
   * @param {RequestOptions} [options]
   * @returns {Promise<{success: boolean}>}
   */
  changePasswordForPerson: async (person, password, { signal } = {}) =>
    http.post(
      `actions/persons/${idOf(person)}/change-password`,
      { password, password_2: password },
      { signal }
    ),

  /**
   * Send the person an email inviting them to connect to Kitsu.
   * @param {Model} person
   * @param {RequestOptions} [options]
   * @returns {Promise<{success: boolean, message: string}>}
   */
  invitePerson: async (person, { signal } = {}) =>
    http.get(`actions/persons/${idOf(person)}/invite`, {}, { signal }),

  /**
   * Build a link the person can follow to choose a new password, without
   * sending any email.
   * @param {Model} person
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The link, in reset_url.
   */
  generateResetPasswordLink: async (person, { signal } = {}) =>
    http.post(`actions/persons/${idOf(person)}/reset-password-link`, null, {
      signal
    }),

  /**
   * @param {Model} person
   * @param {Model} department
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The person.
   */
  addPersonToDepartment: async (person, department, { signal } = {}) =>
    http.post(
      `actions/persons/${idOf(person)}/departments/add`,
      { department_id: idOf(department) },
      { signal }
    ),

  /**
   * @param {Model} person
   * @param {Model} department
   * @param {RequestOptions} [options]
   * @returns {Promise<null>}
   */
  removePersonFromDepartment: async (person, department, { signal } = {}) =>
    http.del(
      `actions/persons/${idOf(person)}/departments/${idOf(department)}`,
      null,
      { signal }
    ),

  /**
   * @param {Model} person
   * @param {RequestOptions} [options]
   * @returns {Promise<null>}
   */
  disableTwoFactorAuthentication: async (person, { signal } = {}) =>
    http.del(
      `actions/persons/${idOf(person)}/disable-two-factor-authentication`,
      null,
      { signal }
    ),

  /**
   * @param {Model} person
   * @param {RequestOptions} [options]
   * @returns {Promise<null>}
   */
  clearPersonAvatar: async (person, { signal } = {}) =>
    http.del(`actions/persons/${idOf(person)}/clear-avatar`, null, { signal }),

  /**
   * Upload a picture and set it as the avatar of the person.
   * @param {Model} person
   * @param {Blob} file The picture, a Blob or a File.
   * @param {{
   *   fileName?: string,
   *   onProgress?: (progress: {loaded: number, total: number}) => void,
   *   signal?: AbortSignal
   * }} [options] onProgress needs XMLHttpRequest (browsers, webviews).
   * @returns {Promise<{thumbnail_path: string}>} Path of the stored picture,
   *   relative to the host url.
   */
  setAvatar: async (person, file, { fileName, onProgress, signal } = {}) =>
    http.upload(`pictures/thumbnails/persons/${idOf(person)}`, {
      file: requiredOf('file', file),
      fileName,
      onProgress,
      signal
    }),

  /**
   * Import the persons of a CSV file (same columns as the CSV export).
   * @param {Blob} csvFile
   * @param {{
   *   update?: boolean,
   *   fileName?: string,
   *   onProgress?: (progress: {loaded: number, total: number}) => void,
   *   signal?: AbortSignal
   * }} [options] update also rewrites the persons that already exist.
   *   onProgress needs XMLHttpRequest (browsers, webviews).
   * @returns {Promise<Entity[]>} The persons created or updated by the import.
   */
  importPersonsWithCsv: async (
    csvFile,
    { update = false, fileName, onProgress, signal } = {}
  ) =>
    http.upload('import/csv/persons', {
      file: requiredOf('file', csvFile),
      query: { update: update ? true : null },
      fileName,
      onProgress,
      signal
    }),

  /**
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity[]>} The salary of each department, position and
   *   seniority.
   */
  allSalaryScales: async ({ signal } = {}) =>
    http.fetchAll('salary-scales', {}, { signal }),

  /**
   * @param {Entity} salaryScale Only its salary is sent.
   * @param {RequestOptions} [options]
   * @returns {Promise<Entity>} The updated salary scale.
   */
  updateSalaryScale: async (salaryScale, { signal } = {}) =>
    http.update(
      'salary-scales',
      idOf(salaryScale),
      { salary: salaryScale.salary },
      { signal }
    ),

  /**
   * @param {Model} person
   * @returns {Promise<string>} URL of the person page in the Kitsu web app.
   */
  getPersonUrl: async person =>
    urls.getPersonUrl(urls.webHostOf(http.host), person)
})
