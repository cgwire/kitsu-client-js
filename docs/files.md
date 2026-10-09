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
report upload progress. Without it, or on a client given its own `fetch`, the
upload goes through `fetch` and `onProgress` is never called. In Node, write a
download to disk yourself:

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
