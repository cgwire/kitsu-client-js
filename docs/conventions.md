# Conventions and errors

## Conventions

- **Entity arguments** accept the entity object or its id:
  `kitsu.task.getTask(task)` and `kitsu.task.getTask(task.id)` are the same.
  Anything that is not a UUID is rejected before any request.
- **Required arguments are positional**, in the same order as gazu. Optional
  ones go in one trailing options object, which also takes an `AbortSignal`:
  `kitsu.task.allTasksForShot(shot, { relations: true, signal })`.
- **Returned values are the raw dicts of the API**, with snake_case keys.
- **An update sends the id in the request path only**:
  `kitsu.task.updateTask({ id, priority: 2 })` sends `{ priority: 2 }`. Zou
  checks the keys of the body against what the role of the user may write,
  and an `id` key would fail that check.
- **`get*` of a single entity resolves to `null` when it does not exist.**
- **Functions never throw synchronously**: a wrong argument is a rejected
  promise. They never mutate their arguments.

## Errors

Every error extends `KitsuError` and carries `status`, `path`, `method` and
`body` (the parsed answer of the API).

| Condition             | Error                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------- |
| 400                   | `ParameterError` (also thrown for a malformed argument)                                                       |
| 401                   | `NotAuthenticatedError`                                                                                       |
| refused `logIn`       | `AuthFailedError`, or `MissingOtpError`, `WrongOtpError`, `TooManyLoginAttemptsError`, `DefaultPasswordError` |
| 403                   | `NotAllowedError`                                                                                             |
| 404                   | `NotFoundError`                                                                                               |
| 413                   | `TooBigFileError`                                                                                             |
| 5xx                   | `ServerError`                                                                                                 |
| no answer             | `NetworkError`, `TimeoutError`                                                                                |
| `signal` or `close()` | the native `AbortError`                                                                                       |
| 2xx that is not JSON  | `KitsuError` (usually a host given without its `/api` suffix)                                                 |

Regular calls are bounded: 60 s to the first byte, 5 min in total
(`timeout: { response, deadline }`, `0` disables a timer). Uploads are not
bounded at all and downloads only to the first byte: multi-GB movies are
legitimate. Cancel them with a `signal`.
