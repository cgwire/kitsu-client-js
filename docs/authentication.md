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
`access_token`. `kitsu.person.generateToken(bot, expirationDate)` issues a new
one and revokes the previous one at once. The date is required: `null` for a
token that never expires, `bot.expiration_date` to keep the current one.
`updateBot` and `updatePerson` never touch it. Only an admin can renew the
token of a bot: when a bot without the admin role asks for its own, Zou issues
none, `generateToken` rejects with a `KitsuError` and the current token keeps
working.

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
that hit the 401 at the same time, and each of them is replayed once. Zou
renews the token only for a caller it does not take for a browser, judging by
its user agent: Node, Electron and the Tauri http plugin are fine. A browser,
or a webview that passes for one (WebView2 on Windows, WebKitGTK on Linux),
gets the new token in a cookie only. There a bearer session ends with its
access token, 7 days by default, when `onUnauthorized` fires, and a `logOut`
after that cannot revoke it on the server.

To check a resumed session at startup, call `kitsu.getCurrentUser()`: it
renews an expired access token like any call does. `kitsu.isAuthenticated()`
only probes the current access token, without renewing it: it answers false
for a session that the refresh token could still renew.

Web apps served by Kitsu itself use the session cookie instead:
`createClient({ host: '/api', auth: 'cookie' })`.

When Zou enforces two-factor authentication (`ENFORCE_2FA`), a user without a
second factor still logs in, but with tokens that only open the two-factor
setup, `logOut` and `getCurrentUser`: every other call is refused with a
`NotAllowedError`. The login body says so, and the setup replaces those tokens
in bearer mode:

```js
const body = await kitsu.logIn(email, password)
if (body.two_factor_authentication_required) {
  const { totp_provisionning_uri } = await kitsu.preEnableTotp()
  // show it as a QR code, then:
  const recoveryCodes = await kitsu.enableTotp(await askForCode())
}
```

FIDO devices need cookie mode on the Kitsu origin: Zou keeps the state of a
WebAuthn ceremony in its cookie session, which a bearer client never sends
back. This holds for `getFidoChallenge` and the `logIn` that answers it, for
`preRegisterFido` and `registerFido`, and for any `fidoAuthenticationResponse`
given as proof of identity.

## One client, one session

Nothing is shared between two clients: tokens, in-flight requests and the
event socket all belong to the instance. Two clients can talk to two servers,
or to the same server under two accounts. `kitsu.close()` aborts the
in-flight requests and closes the socket.

Session changes apply in call order, whatever order the answers land in.
`logOut` drops the session at once, then asks Zou to revoke it. A `logIn`
overtaken by a later `logIn`, `logOut`, `setToken` or two-factor setup keeps
nothing of its answer and rejects with an `AbortError`, even when the later
call fails: a login sent twice with a single-use code (a recovery code, an
email OTP) can end with no session at all.
