/*
 * Preview-extension type checks, ported from Kitsu (src/lib/preview.js) so
 * the canonical list of accepted extensions for each preview kind lives in
 * a single place.
 *
 * Each helper takes a bare lowercase extension string (e.g. 'mp4', 'png'),
 * as stored in the `extension` field of a preview file, and returns a
 * boolean: no entity or preview-file unwrapping. Callers derive the
 * extension from their own state.
 */

/**
 * Tell whether the extension is played as a movie.
 * @param {string} [extension] Bare extension, without the dot.
 * @returns {boolean}
 */
export const isMoviePreview = extension => extension === 'mp4'

/**
 * Tell whether the extension is displayed as a still picture.
 * @param {string} [extension] Bare extension, without the dot.
 * @returns {boolean}
 */
export const isPicturePreview = extension =>
  ['gif', 'jpeg', 'jpg', 'png'].includes(extension)

/**
 * Tell whether the extension is a picture format that may carry transparency.
 * @param {string} [extension] Bare extension, without the dot.
 * @returns {boolean}
 */
export const isTransparentPicturePreview = extension => extension === 'png'

/**
 * Tell whether the extension is displayed as a 3D model.
 * @param {string} [extension] Bare extension, without the dot.
 * @returns {boolean}
 */
export const isModelPreview = extension => ['glb', 'gltf'].includes(extension)

/**
 * Tell whether the extension is played as a sound.
 * @param {string} [extension] Bare extension, without the dot.
 * @returns {boolean}
 */
export const isSoundPreview = extension => ['mp3', 'wav'].includes(extension)

/**
 * Tell whether the extension is displayed as a PDF document.
 * @param {string} [extension] Bare extension, without the dot.
 * @returns {boolean}
 */
export const isPdfPreview = extension => extension === 'pdf'

/**
 * Tell whether the extension is displayed as a Markdown document.
 * @param {string} [extension] Bare extension, without the dot.
 * @returns {boolean}
 */
export const isMarkdownPreview = extension => extension === 'md'

/**
 * Tell whether the extension is displayed as a diff.
 * @param {string} [extension] Bare extension, without the dot.
 * @returns {boolean}
 */
export const isDiffPreview = extension => extension === 'diff'

/**
 * Tell whether the extension has no dedicated viewer, which makes the preview
 * a plain downloadable file.
 * @param {string} [extension] Bare extension, without the dot.
 * @returns {boolean}
 */
export const isFilePreview = extension =>
  !isMoviePreview(extension) &&
  !isPicturePreview(extension) &&
  !isModelPreview(extension) &&
  !isSoundPreview(extension) &&
  !isPdfPreview(extension) &&
  !isMarkdownPreview(extension) &&
  !isDiffPreview(extension)

/**
 * Format a preview revision for display, applying the project's revision
 * padding (a display-only setting: Zou stores the bare integer).
 * `revision_padding` is the minimum number of digits: 0 (default) means no
 * padding, 3 turns 0 into "v000" and 42 into "v042", while a wider number is
 * never truncated (1001 gives "v1001").
 * @param {number|string|null} [revision] Revision of the preview file.
 * @param {{revision_padding?: number}|null} [project] Project of the preview.
 * @returns {string} The label, or an empty string for a missing revision.
 */
export const formatRevision = (revision, project) => {
  if (revision == null || revision === '') return ''
  const padding = project?.revision_padding || 0
  return `v${String(revision).padStart(padding, '0')}`
}
