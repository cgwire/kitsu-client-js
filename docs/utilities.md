# Utilities and smaller bundles

## Utilities

Pure functions, importable on their own from `@cgwire/kitsu-client/utils`:

- sorting in the canonical Kitsu order: `sortAssets`, `sortShots`,
  `sortTasks`, `sortTaskStatuses`, `sortPeople`, `sortByName`... They return
  new arrays. Like Kitsu, they read names that only some listings carry: the
  `*WithTasks` ones give `asset_type_name` and `episode_name`, for instance;
- frames and timecodes: `frameToSeconds`, `formatToTimecode`, `roundToFrame`...
  They read the fps string that Zou stores and, like Zou, count an empty one
  as 25;
- previews: `isMoviePreview`, `isPicturePreview`, `formatRevision`...
- Kitsu web URLs: `getProjectUrl`, `getShotUrl`, `getTaskUrl`... They take
  the host of the web app, which `webHostOf(apiHost)` derives from the API
  host. The namespaces expose the same names, loading what the URL needs:
  `await kitsu.shot.getShotUrl(shot)`;
- paths of the API files: `getPreviewFilePath`, `getPreviewMoviePath` and
  `getAttachmentThumbnailPath`, relative to the API host. `kitsu.files` names
  them `getPreviewFileUrl`, `getPreviewMovieUrl`...

Unlike the namespace functions, the URL and path helpers throw: a wrong
argument raises a `ParameterError`, for instance an id string where the URL
needs the `project_id` or the `production_type` of the object.

## Displaying previews

Zou serves the files of previews and attachments only to authenticated
requests: it reads the token from the session cookie or from the
`Authorization` header, and an `img` or a `video` tag cannot send that header.
In cookie mode, on the site of Kitsu, the browser sends the cookie: prefix the
paths with the API host. Anywhere else (a bot token, another site, Node,
Tauri), download the file and show it as an object URL:

```js
// Cookie mode, on the site of Kitsu
img.src = `/api/pictures/thumbnails/preview-files/${previewFile.id}.png`

// Any other client
const response = await kitsu.files.downloadPreviewFileThumbnail(previewFile)
img.src = URL.createObjectURL(await response.blob())
```

`getPreviewFilePath` points to the original file instead: the full picture,
or the mp4 of a movie. Call `URL.revokeObjectURL` once the image is gone. A
movie shown this way plays only once fully downloaded:
`downloadPreviewLowdefMovie` keeps it small.

## Smaller bundles

`createClient` wires every namespace. To ship only what you use, compose the
core with the namespaces you need:

```js
import { createCore } from '@cgwire/kitsu-client/core'
import { taskApi } from '@cgwire/kitsu-client/task'

const core = createCore({ host: '/api', auth: 'cookie' })
const task = taskApi(core.http)
```

`core.http`, also reachable as `kitsu.http`, is only meant to be handed to
these factories: its methods are internal and may change in any release.

TypeScript finds the declarations of the subpaths (`/core`, `/utils`, `/task`...)
with `moduleResolution` set to `node16`, `nodenext` or `bundler`. The older
`node10` resolution only finds those of the root entry. CommonJS TypeScript
code needs `module` set to `nodenext` (TypeScript 5.8 or later) or `node20`
(TypeScript 5.9 or later): with `node16` or `node18`, TypeScript refuses to
import an ES module (TS1479).
