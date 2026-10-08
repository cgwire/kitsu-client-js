# Utilities and smaller bundles

## Utilities

Pure functions, importable on their own from `@cgwire/kitsu-client/utils`:

- sorting in the canonical Kitsu order: `sortAssets`, `sortShots`,
  `sortTasks`, `sortTaskStatuses`, `sortPeople`, `sortByName`... They return
  new arrays;
- frames and timecodes: `frameToSeconds`, `formatToTimecode`, `roundToFrame`...
- previews: `isMoviePreview`, `isPicturePreview`, `formatRevision`...
- Kitsu web URLs: `getProjectUrl`, `getShotUrl`, `getTaskUrl`... They take
  the host of the web app, which `webHostOf(apiHost)` derives from the API
  host. The namespaces expose the same names, loading what the URL needs:
  `await kitsu.shot.getShotUrl(shot)`.

## Smaller bundles

`createClient` wires every namespace. To ship only what you use, compose the
core with the namespaces you need:

```js
import { createCore } from '@cgwire/kitsu-client/core'
import { taskApi } from '@cgwire/kitsu-client/task'

const core = createCore({ host: '/api', auth: 'cookie' })
const task = taskApi(core.http)
```

`core.http` is only meant to be handed to these factories: its methods are
internal and may change in any release.
