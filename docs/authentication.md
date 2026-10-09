# Authentication and sessions

## Bot token

With a bot token, the recommended mode for integrations:

```js
import { createClient } from '@cgwire/kitsu-client'

const kitsu = createClient({ host: 'https://kitsu.mystudio.com/api' })
kitsu.setToken(process.env.KITSU_TOKEN)

const projects = await kitsu.project.allOpenProjects()
const shots = await kitsu.shot.allShotsForProject(projects[0])
const tasks = await kitsu.task.allTasksForShot(shots[0])
```

`kitsu.person.newBot` returns the token of the bot it creates in
`access_token`. `kitsu.person.generateToken` issues a new one and revokes the
previous one at once; `updateBot` and `updatePerson` never touch it. Only an
admin can renew the token of a bot: when a bot without the admin role asks
for its own, Zou issues none, `generateToken` rejects with a `KitsuError` and
the current token keeps working.

## User credentials

With user credentials, two-factor authentication included:

```js
import { createClient, MissingOtpError } from '@cgwire/kitsu-client'

const kitsu = createClient({
  host: 'https://kitsu.mystudio.com/api',
  tokens: loadTokens(), // resume a session
  onTokensChange: saveTokens, // persist them, in the OS keychain for instance
  onUnauthorized: showLoginScreen // the session is lost for good
})

try {
  await kitsu.logIn(email, password)
} catch (err) {
  if (!(err instanceof MissingOtpError)) throw err
  // err.preferredMethod and err.enabledMethods tell which field to show
  await kitsu.logIn(email, password, { totp: await askForCode() })
}

const myTasks = await kitsu.user.allTasksToDo()
```

An expired access token is refreshed once, whatever the number of requests
that hit the 401 at the same time, and each of them is replayed once.

Web apps served by Kitsu itself use the session cookie instead:
`createClient({ host: '/api', auth: 'cookie' })`.

## One client, one session

Nothing is shared between two clients: tokens, in-flight requests and the
event socket all belong to the instance. Two clients can talk to two servers,
or to the same server under two accounts. `kitsu.close()` aborts the
in-flight requests and closes the socket.
