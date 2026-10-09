import { beforeEach, describe, expect, it } from 'vitest'

import { ParameterError } from '../../src/core/errors.js'
import { makeClient } from '../helpers/client.js'
import { DEPARTMENT_ID, OTHER_ID, PERSON_ID } from '../helpers/ids.js'

describe('person namespace', () => {
  let kitsu, fake
  beforeEach(() => {
    ;({ kitsu, fake } = makeClient())
  })

  it('allOrganisations lists the organisations sorted by name', async () => {
    fake.reply(200, [{ name: 'studio B' }, { name: 'Studio A' }])
    const organisations = await kitsu.person.allOrganisations()
    expect(organisations.map(entry => entry.name)).toEqual([
      'Studio A',
      'studio B'
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/organisations'
    })
  })

  it('allDepartments lists the departments sorted by name', async () => {
    fake.reply(200, [{ name: 'rigging' }, { name: 'Animation' }])
    const departments = await kitsu.person.allDepartments()
    expect(departments.map(entry => entry.name)).toEqual([
      'Animation',
      'rigging'
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/departments'
    })
  })

  it('allPersons lists every person, sorted by name like gazu', async () => {
    fake.reply(200, [
      { id: PERSON_ID, name: 'zoe' },
      { id: OTHER_ID, name: 'Alice' }
    ])
    expect(await kitsu.person.allPersons()).toEqual([
      { id: OTHER_ID, name: 'Alice' },
      { id: PERSON_ID, name: 'zoe' }
    ])
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/persons'
    })
  })

  it('getDepartmentByName filters by name, null when nothing matches', async () => {
    fake.reply(200, [{ id: DEPARTMENT_ID, name: 'Rigging' }]).reply(200, [])
    expect(await kitsu.person.getDepartmentByName('Rigging')).toMatchObject({
      id: DEPARTMENT_ID
    })
    expect(await kitsu.person.getDepartmentByName('Nope')).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/departments'
    })
    expect(fake.calls[0].query.get('name')).toBe('Rigging')
  })

  it('getDepartment returns the department, null on 404', async () => {
    fake.reply(200, { id: DEPARTMENT_ID }).reply(404, {})
    expect(await kitsu.person.getDepartment({ id: DEPARTMENT_ID })).toEqual({
      id: DEPARTMENT_ID
    })
    expect(await kitsu.person.getDepartment(DEPARTMENT_ID)).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/data/departments/${DEPARTMENT_ID}`
    })
  })

  it('getPerson filters persons by id, with relations on demand', async () => {
    fake.reply(200, [{ id: PERSON_ID }]).reply(200, [])
    expect(await kitsu.person.getPerson({ id: PERSON_ID })).toEqual({
      id: PERSON_ID
    })
    expect(
      await kitsu.person.getPerson(PERSON_ID, { relations: true })
    ).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/persons'
    })
    expect(fake.calls[0].query.get('id')).toBe(PERSON_ID)
    expect(fake.calls[0].query.has('relations')).toBe(false)
    expect(fake.calls[1].query.get('relations')).toBe('true')
  })

  it('getPersonByDesktopLogin looks among the humans only', async () => {
    fake.reply(200, [{ id: PERSON_ID }]).reply(200, [])
    expect(await kitsu.person.getPersonByDesktopLogin('jdoe')).toEqual({
      id: PERSON_ID
    })
    expect(await kitsu.person.getPersonByDesktopLogin('nope')).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/persons'
    })
    expect(fake.calls[0].query.get('desktop_login')).toBe('jdoe')
    expect(fake.calls[0].query.get('is_bot')).toBe('false')
  })

  it('getPersonByEmail filters by email, among the bots on demand', async () => {
    fake.reply(200, [{ id: PERSON_ID }]).reply(200, [])
    expect(await kitsu.person.getPersonByEmail('john@doe.com')).toEqual({
      id: PERSON_ID
    })
    expect(
      await kitsu.person.getPersonByEmail('bot@doe.com', { isBot: true })
    ).toBeNull()
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/persons'
    })
    expect(fake.calls[0].query.get('email')).toBe('john@doe.com')
    expect(fake.calls[0].query.get('is_bot')).toBe('false')
    expect(fake.calls[1].query.get('is_bot')).toBe('true')
  })

  it('getPersonByFullName filters by full name or by both names', async () => {
    fake
      .reply(200, [{ id: PERSON_ID }])
      .reply(200, [])
      .reply(200, [])
    expect(await kitsu.person.getPersonByFullName('John Doe')).toEqual({
      id: PERSON_ID
    })
    expect(
      await kitsu.person.getPersonByFullName('John Doe', {
        firstName: 'John',
        lastName: 'Doe'
      })
    ).toBeNull()
    await kitsu.person.getPersonByFullName('John Doe', { firstName: 'John' })
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/data/persons'
    })
    expect(Object.fromEntries(fake.calls[0].query)).toEqual({
      full_name: 'John Doe',
      is_bot: 'false'
    })
    expect(Object.fromEntries(fake.calls[1].query)).toEqual({
      first_name: 'John',
      last_name: 'Doe',
      is_bot: 'false'
    })
    expect(fake.calls[2].query.get('full_name')).toBe('John Doe')
  })

  it('newDepartment creates the department unless the name exists', async () => {
    fake
      .reply(200, [])
      .reply(201, { id: DEPARTMENT_ID })
      .reply(200, [])
      .reply(201, { id: DEPARTMENT_ID })
      .reply(200, [{ id: OTHER_ID, name: 'Rigging' }])
    expect(await kitsu.person.newDepartment('Rigging')).toEqual({
      id: DEPARTMENT_ID
    })
    await kitsu.person.newDepartment('Layout', {
      color: '#00FF00',
      archived: true
    })
    expect(await kitsu.person.newDepartment('Rigging')).toMatchObject({
      id: OTHER_ID
    })
    expect(fake.calls[0].query.get('name')).toBe('Rigging')
    expect(fake.calls[1]).toMatchObject({
      method: 'POST',
      path: '/data/departments',
      body: { name: 'Rigging', color: '', archived: false }
    })
    expect(fake.calls[3].body).toEqual({
      name: 'Layout',
      color: '#00FF00',
      archived: true
    })
    expect(fake.calls).toHaveLength(5)
  })

  it('updateDepartment puts the department', async () => {
    fake.reply(200, { id: DEPARTMENT_ID, name: 'Rig' })
    const department = { id: DEPARTMENT_ID, name: 'Rig' }
    expect(await kitsu.person.updateDepartment(department)).toEqual(department)
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/departments/${DEPARTMENT_ID}`,
      body: { id: DEPARTMENT_ID, name: 'Rig' }
    })
  })

  // Zou never reads force on this route: the former option sends nothing.
  it('removeDepartment deletes the department without any query', async () => {
    fake.reply(204).reply(204)
    await kitsu.person.removeDepartment(DEPARTMENT_ID)
    await kitsu.person.removeDepartment({ id: DEPARTMENT_ID }, { force: true })
    fake.calls.forEach(call => {
      expect(call).toMatchObject({
        method: 'DELETE',
        path: `/data/departments/${DEPARTMENT_ID}`
      })
      expect([...call.query.keys()]).toEqual([])
    })
  })

  it('newPerson creates the person unless the email exists', async () => {
    fake
      .reply(200, [])
      .reply(201, { id: PERSON_ID })
      .reply(200, [])
      .reply(201, { id: PERSON_ID })
      .reply(200, [{ id: OTHER_ID }])
    const departments = [{ id: DEPARTMENT_ID }, OTHER_ID]
    expect(await kitsu.person.newPerson('John', 'Doe', 'john@doe.com')).toEqual(
      { id: PERSON_ID }
    )
    await kitsu.person.newPerson('Jane', 'Doe', 'jane@doe.com', {
      phone: '0102',
      role: 'manager',
      desktopLogin: 'jane',
      departments,
      password: 'secret-password',
      active: false,
      contractType: 'freelance'
    })
    expect(await kitsu.person.newPerson('John', 'Doe', 'john@doe.com')).toEqual(
      { id: OTHER_ID }
    )
    expect(fake.calls[0].path).toBe('/data/persons')
    expect(Object.fromEntries(fake.calls[0].query)).toEqual({
      email: 'john@doe.com',
      is_bot: 'false'
    })
    expect(fake.calls[1]).toMatchObject({
      method: 'POST',
      path: '/data/persons'
    })
    expect(fake.calls[1].body).toEqual({
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@doe.com',
      phone: '',
      role: 'user',
      desktop_login: '',
      departments: [],
      password: null,
      active: true,
      contract_type: 'open-ended'
    })
    expect(fake.calls[3].body).toEqual({
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'jane@doe.com',
      phone: '0102',
      role: 'manager',
      desktop_login: 'jane',
      departments: [DEPARTMENT_ID, OTHER_ID],
      password: 'secret-password',
      active: false,
      contract_type: 'freelance'
    })
    expect(departments).toEqual([{ id: DEPARTMENT_ID }, OTHER_ID])
    expect(fake.calls).toHaveLength(5)
  })

  it('updatePerson puts the person with its departments as ids', async () => {
    fake.reply(200, { id: PERSON_ID }).reply(200, { id: PERSON_ID })
    const person = {
      id: PERSON_ID,
      phone: '0102',
      departments: [{ id: DEPARTMENT_ID }, OTHER_ID]
    }
    await kitsu.person.updatePerson(person)
    await kitsu.person.updatePerson({ id: PERSON_ID, role: 'admin' })
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/persons/${PERSON_ID}`
    })
    expect(fake.calls[0].body).toEqual({
      id: PERSON_ID,
      phone: '0102',
      departments: [DEPARTMENT_ID, OTHER_ID]
    })
    expect(fake.calls[1].body).toEqual({ id: PERSON_ID, role: 'admin' })
    expect(person.departments).toEqual([{ id: DEPARTMENT_ID }, OTHER_ID])
  })

  it('removePerson deletes the person, forcing on demand', async () => {
    fake.reply(204).reply(204)
    await kitsu.person.removePerson(PERSON_ID)
    await kitsu.person.removePerson({ id: PERSON_ID }, { force: true })
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/persons/${PERSON_ID}`
    })
    expect(fake.calls[0].query.has('force')).toBe(false)
    expect(fake.calls[1].query.get('force')).toBe('true')
  })

  it('newBot creates a bot account', async () => {
    fake
      .reply(201, { id: PERSON_ID, access_token: 'bot-token' })
      .reply(201, { id: PERSON_ID })
    expect(await kitsu.person.newBot('Render bot', 'bot@doe.com')).toEqual({
      id: PERSON_ID,
      access_token: 'bot-token'
    })
    await kitsu.person.newBot('Render bot', 'bot@doe.com', {
      role: 'admin',
      departments: [{ id: DEPARTMENT_ID }],
      active: false,
      expirationDate: new Date(2027, 0, 31, 12)
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: '/data/persons'
    })
    expect(fake.calls[0].body).toEqual({
      first_name: 'Render bot',
      last_name: '',
      email: 'bot@doe.com',
      role: 'user',
      departments: [],
      active: true,
      expiration_date: null,
      is_bot: true
    })
    expect(fake.calls[1].body).toEqual({
      first_name: 'Render bot',
      last_name: '',
      email: 'bot@doe.com',
      role: 'admin',
      departments: [DEPARTMENT_ID],
      active: false,
      expiration_date: '2027-01-31',
      is_bot: true
    })
  })

  it('updateBot puts the bot like a person', async () => {
    fake.reply(200, { id: PERSON_ID })
    await kitsu.person.updateBot({
      id: PERSON_ID,
      active: false,
      departments: [{ id: DEPARTMENT_ID }]
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'PUT',
      path: `/data/persons/${PERSON_ID}`,
      body: { id: PERSON_ID, active: false, departments: [DEPARTMENT_ID] }
    })
  })

  it('removeBot deletes the bot like a person', async () => {
    fake.reply(204).reply(204)
    await kitsu.person.removeBot({ id: PERSON_ID })
    await kitsu.person.removeBot(PERSON_ID, { force: true })
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/data/persons/${PERSON_ID}`
    })
    expect(fake.calls[0].query.has('force')).toBe(false)
    expect(fake.calls[1].query.get('force')).toBe('true')
  })

  it('changePasswordForPerson posts the password and its confirmation', async () => {
    fake.reply(200, { success: true })
    expect(
      await kitsu.person.changePasswordForPerson({ id: PERSON_ID }, 'n3w-pass')
    ).toEqual({ success: true })
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/actions/persons/${PERSON_ID}/change-password`
    })
    expect(fake.calls[0].body).toEqual({
      password: 'n3w-pass',
      password_2: 'n3w-pass'
    })
  })

  it('invitePerson asks Zou to send the invitation email', async () => {
    fake.reply(200, { success: true, message: 'Email sent' })
    expect(await kitsu.person.invitePerson(PERSON_ID)).toEqual({
      success: true,
      message: 'Email sent'
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: `/actions/persons/${PERSON_ID}/invite`
    })
  })

  it('addPersonToDepartment posts the department id', async () => {
    fake.reply(201, { id: PERSON_ID }).reply(201, { id: PERSON_ID })
    await kitsu.person.addPersonToDepartment(
      { id: PERSON_ID },
      { id: DEPARTMENT_ID }
    )
    await kitsu.person.addPersonToDepartment(PERSON_ID, DEPARTMENT_ID)
    expect(fake.calls[0]).toMatchObject({
      method: 'POST',
      path: `/actions/persons/${PERSON_ID}/departments/add`
    })
    expect(fake.calls[0].body).toEqual({ department_id: DEPARTMENT_ID })
    expect(fake.calls[1].body).toEqual({ department_id: DEPARTMENT_ID })
  })

  it('removePersonFromDepartment deletes the link', async () => {
    fake.reply(204)
    await kitsu.person.removePersonFromDepartment(PERSON_ID, {
      id: DEPARTMENT_ID
    })
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/actions/persons/${PERSON_ID}/departments/${DEPARTMENT_ID}`
    })
  })

  it('disableTwoFactorAuthentication deletes the 2FA of the person', async () => {
    fake.reply(204)
    await kitsu.person.disableTwoFactorAuthentication({ id: PERSON_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/actions/persons/${PERSON_ID}/disable-two-factor-authentication`
    })
  })

  it('clearPersonAvatar deletes the avatar of the person', async () => {
    fake.reply(204)
    await kitsu.person.clearPersonAvatar(PERSON_ID)
    expect(fake.calls[0]).toMatchObject({
      method: 'DELETE',
      path: `/actions/persons/${PERSON_ID}/clear-avatar`
    })
  })

  it('rejects anything that is not an id before any request', async () => {
    await expect(
      kitsu.person.invitePerson('../../auth/logout')
    ).rejects.toThrow(ParameterError)
    await expect(
      kitsu.person.removePersonFromDepartment(PERSON_ID, 'rigging')
    ).rejects.toThrow(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('getPerson rejects a missing id instead of listing every person', async () => {
    await expect(kitsu.person.getPerson(undefined)).rejects.toThrow(
      ParameterError
    )
    await expect(
      kitsu.person.getPerson(null, { relations: true })
    ).rejects.toThrow(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('first-match lookups reject a blank filter before any request', async () => {
    const { person } = kitsu
    await expect(person.getDepartmentByName('')).rejects.toThrow(ParameterError)
    await expect(person.getDepartmentByName(undefined)).rejects.toThrow(
      ParameterError
    )
    await expect(person.getPersonByDesktopLogin('')).rejects.toThrow(
      ParameterError
    )
    await expect(person.getPersonByDesktopLogin(null)).rejects.toThrow(
      ParameterError
    )
    await expect(person.getPersonByEmail('')).rejects.toThrow(ParameterError)
    await expect(
      person.getPersonByEmail(null, { isBot: true })
    ).rejects.toThrow(ParameterError)
    await expect(person.getPersonByFullName('')).rejects.toThrow(ParameterError)
    await expect(person.getPersonByFullName(undefined)).rejects.toThrow(
      ParameterError
    )
    await expect(
      person.getPersonByFullName('John Doe', { firstName: '', lastName: 'Doe' })
    ).rejects.toThrow(ParameterError)
    await expect(
      person.getPersonByFullName('John Doe', {
        firstName: 'John',
        lastName: ''
      })
    ).rejects.toThrow(ParameterError)
    expect(fake.calls).toHaveLength(0)
  })

  it('newPerson and newDepartment never adopt a row on a blank key', async () => {
    fake
      .reply(200, [{ id: OTHER_ID, email: 'someone@else.com' }])
      .reply(200, [{ id: DEPARTMENT_ID, name: 'Animation' }])
    await expect(
      kitsu.person.newPerson('Jane', 'Doe', '')
    ).rejects.toBeInstanceOf(ParameterError)
    await expect(kitsu.person.newDepartment('')).rejects.toBeInstanceOf(
      ParameterError
    )
    await expect(kitsu.person.newDepartment(null)).rejects.toBeInstanceOf(
      ParameterError
    )
    expect(fake.calls).toHaveLength(0)
  })

  it('getOrganisation reads the organisation of the session', async () => {
    fake.reply(200, { user: { id: PERSON_ID }, organisation: { id: OTHER_ID } })
    expect(await kitsu.person.getOrganisation()).toEqual({ id: OTHER_ID })
    expect(fake.calls[0]).toMatchObject({
      method: 'GET',
      path: '/auth/authenticated'
    })
  })
})
