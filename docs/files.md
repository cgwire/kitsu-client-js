# Working files, uploads and downloads

## Working files

The server owns the paths: they come from the file tree of the project.

```js
const path = await kitsu.files.buildWorkingFilePath(task, {
  software,
  sep: '/'
})
const workingFile = await kitsu.files.newWorkingFile(task, {
  software,
  comment: 'Blocking pass'
})
```

## Uploads and downloads

The client takes and returns data, it never touches the disk: uploads take a
`Blob` or a `File`, downloads resolve to the `Response`.

```js
const { comment, preview_file } = await kitsu.task.publishPreview(
  task,
  taskStatus,
  file,
  { comment: 'First pass', onProgress: ({ loaded, total }) => {} }
)
```

`onProgress` needs `XMLHttpRequest` (browsers and webviews): `fetch` cannot
report upload progress. By default an upload given an `onProgress` goes
through `XMLHttpRequest` and any other through `fetch`, while a client given
its own `fetch` sends every upload through it, without progress. The
`xhrUploads` option decides instead: `true` sends every upload through
`XMLHttpRequest`, `false` every upload through `fetch`. In bearer mode an
upload to the origin of the page goes through `fetch` anyway, without
progress: `XMLHttpRequest` would send the Kitsu session cookie of the page,
which Zou reads before the token.

With `xhrUploads: true`, uploads skip the `fetch` of the client, and so the
headers it adds. It suits a `fetch` that only logs or traces, not one that
adds a header the server needs, a gateway key for instance.

In Node, write a download to disk yourself:

```js
import { createWriteStream } from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const response = await kitsu.files.downloadPreviewFile(previewFile)
await pipeline(Readable.fromWeb(response.body), createWriteStream('shot.mp4'))
```

In a Tauri app, pass the `fetch` of the http plugin so requests are not
subject to CORS: `createClient({ host, fetch })`. Uploads go through it too,
without progress: `XMLHttpRequest` would leave the plugin for the network
stack of the webview, where CORS applies.

The plugin reads the whole file into memory and hands it to Rust as an array
of bytes: fine for pictures and short movies, slow or failing for large ones.
For those, add the origin of the app (`tauri://localhost` on macOS and Linux,
`http://tauri.localhost` on Windows) to `CORS_ALLOWED_ORIGINS` in the
configuration of Zou, and create the client with `xhrUploads: true`: every
upload then goes through the `XMLHttpRequest` of the webview, which streams the
file and reports the progress, while the other requests keep the plugin.
