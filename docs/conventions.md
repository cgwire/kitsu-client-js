# Conventions and errors

## Conventions

- **Entity arguments** accept the entity object or its id:
  `kitsu.task.getTask(task)` and `kitsu.task.getTask(task.id)` are the same.
  Anything that is not a UUID is rejected before any request. A function
  that needs a field of the entity, such as the `project_id` of a shot for
  `kitsu.casting.getShotCasting`, reads the entity first when it gets its id
  or an object without that field.
- **Required arguments are positional**, in the same order as gazu. Optional
  ones go in one trailing options object, which also takes an `AbortSignal`:
  `kitsu.task.allTasksForShot(shot, { relations: true, signal })`.
- **An empty selection is refused where Zou would widen it.** Zou reads an
  empty list as everything in scope, so a selection that came out empty
  would create tasks or share assets across the whole production: it rejects
  with a `ParameterError` instead. Every entity is an explicit option:
  `kitsu.task.createTasks(project, taskType, 'shots', { all: true })`.
  `kitsu.asset.shareAssets` given an empty list without a project, which Zou
  takes as no asset, resolves to `[]` without any request.
- **Returned values are the raw dicts of the API**, with snake_case keys.
- **An update sends the id in the request path only**:
  `kitsu.task.updateTask({ id, priority: 2 })` sends `{ priority: 2 }`. Zou
  checks the keys of the body against what the role of the user may write,
  and an `id` key would fail that check.
- **An update changes only the fields it is given.** A field given as
  `undefined` is not given. Where Zou replaces the whole object, a metadata
  descriptor or a budget entry for instance, the client reads the object
  first and sends it merged with the given fields. One exception:
  `kitsu.project.updateMetadataDescriptorOnAllProjects` updates the
  descriptors of several projects, which can differ, and reads none of them.
  Zou resets the `data_type`, `choices`, `departments` and `for_client` it is
  not given: give the whole descriptor.
- **`get*` of a single entity resolves to `null` when it does not exist**,
  whether Zou answers a 404 or an empty object.
- **A name lookup finds that name only**: `get*ByName`, and the `new*`
  functions that return the entity that already exists, escape the `%`, `_`
  and backslash that Zou would read as a pattern, and keep the entity of that
  name in the given parent (project, episode, sequence), its exact case
  first, then the same name in another case.
- **Functions never throw synchronously**: a wrong argument is a rejected
  promise. They never mutate their arguments. The pure helpers of
  `@cgwire/kitsu-client/utils` throw instead (see
  [Utilities](./utilities.md)), and so do `createClient` and
  `events.onConnect`, `onDisconnect` and `onConnectError`, which answer at
  once.
- **Public types come from the root entry**: `ClientOptions`, `Tokens`,
  `KitsuClient`, `ErrorInfo`, `Entity` and `Model`. Other type names in the
  declarations of a subpath are internal and may change in any release.
- **`kitsu.http` is internal**, like `core.http`: it only feeds the namespace
  factories, and its methods may change in any release.

## Errors

Every error of a request or of an argument extends `KitsuError` and carries
`status`, `path`, `method` and `body` (the parsed answer of the API). Only
setup mistakes escape it: `createClient` throws a `TypeError` for a wrong
option, and real-time events reject with an `Error` when socket.io-client
cannot be loaded. So do options given as `null` instead of being left out:
most functions destructure them, and reject with a plain `TypeError`
(`kitsu.getCurrentUser(null)`, `kitsu.changePassword(oldPassword, password,
null)`).

| Condition             | Error                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------- |
| 400                   | `ParameterError` (also thrown for a malformed argument)                                                       |
| 401, 422              | `NotAuthenticatedError` (Zou answers 422 for a token it cannot decode)                                        |
| refused `logIn`       | `AuthFailedError`, or `MissingOtpError`, `WrongOtpError`, `TooManyLoginAttemptsError`, `DefaultPasswordError` |
| 403                   | `NotAllowedError`                                                                                             |
| 404                   | `NotFoundError`                                                                                               |
| 413                   | `TooBigFileError`                                                                                             |
| 5xx                   | `ServerError`                                                                                                 |
| any other status      | `KitsuError` (a 405 usually means a host given without its `/api` suffix)                                     |
| no answer             | `NetworkError`, `TimeoutError`                                                                                |
| `signal` or `close()` | the native `AbortError`, also for a `logIn` overtaken by a later session change                               |
| 2xx that is not JSON  | `KitsuError` (usually a host given without its `/api` suffix)                                                 |
| 202 to a download     | `KitsuError`: Zou still builds the file, ask again after `error.retryAfter` seconds                           |

A refused `logIn` is a 400, 401 or 409 answer of Zou, whatever the cause: Zou
also answers 400 when its database pool times out, and 409 when it has no
authentication strategy configured. `error.status` tells them apart. Any
other failure keeps its own error: a 5xx outage is a `ServerError`, not wrong
credentials.

`error.retryAfter` is the number of seconds to wait before asking again, when
the answer tells it: a download of a preview whose files Zou still builds
(202), a media request refused while Zou is busy (503). It is `null`
otherwise.

Regular calls are bounded: 60 s to the first byte, 5 min in total
(`timeout: { response, deadline }`, `0` disables a timer). Uploads are not
bounded at all and downloads only to the first byte: multi-GB movies are
legitimate. Cancel them with a `signal`. A download holds its connection
until its body is read to the end: cancel the body you do not read
(`response.body.cancel()`).
