/**
 * Frame and timecode helpers, ported from Kitsu's `src/lib/video.js`.
 * The rounding rules are calibrated on the Kitsu players: do not adjust them.
 * Every fps may be the string Zou stores, and `DEFAULT_FPS` replaces a
 * missing, empty or zero one, as Zou does.
 */

const PRECISION_FACTOR = 10000

/** Frame rate used when neither the production nor the shot sets one. */
export const DEFAULT_FPS = 25

const roundPrecision = value =>
  Math.round(value * PRECISION_FACTOR) / PRECISION_FACTOR

// The first usable fps wins. Zou reads "23,976" as 23.976.
const fpsOf = (...values) =>
  values
    .map(value => Number(`${value}`.replace(',', '.')))
    .find(value => value > 0 && Number.isFinite(value)) || DEFAULT_FPS

/**
 * Snap a time to the nearest frame of the video.
 * @param {number} time Time in seconds.
 * @param {number|string|null} [fps] Frames per second.
 * @returns {number} Time of the nearest frame, in seconds (4 decimals).
 */
export const roundToFrame = (time, fps) => {
  const frameFactor = roundPrecision(1 / fpsOf(fps))
  const frameNumber = Math.round(time / frameFactor)
  return roundPrecision(frameNumber * frameFactor)
}

/**
 * Snap a time to the next frame boundary of the video.
 * @param {number} time Time in seconds.
 * @param {number|string|null} [fps] Frames per second.
 * @returns {number} Time of the frame at or after `time`, in seconds.
 */
export const ceilToFrame = (time, fps) => {
  const frameFactor = roundPrecision(1 / fpsOf(fps))
  const frameNumber = Math.ceil(time / frameFactor)
  return (
    Math.ceil(frameNumber * frameFactor * PRECISION_FACTOR) / PRECISION_FACTOR
  )
}

/**
 * Snap a time to the previous frame boundary of the video.
 * @param {number} time Time in seconds.
 * @param {number|string|null} [fps] Frames per second.
 * @returns {number} Time of the frame at or before `time`, in seconds.
 */
export const floorToFrame = (time, fps) => {
  const frameFactor = roundPrecision(1 / fpsOf(fps))
  const frameNumber = Math.floor(time / frameFactor)
  return (
    Math.floor(frameNumber * frameFactor * PRECISION_FACTOR) / PRECISION_FACTOR
  )
}

/**
 * Turn a number of frames into seconds. The production fps wins over the
 * shot fps, and `DEFAULT_FPS` applies when neither is set.
 * @param {number} nbFrames Number of frames.
 * @param {{fps?: number|string, [field: string]: any}|null} [production] Zou
 *   stores fps as a string.
 * @param {{fps?: number|string, [field: string]: any}|null} [shot]
 * @returns {number} Duration in seconds, rounded to the millisecond.
 */
export const frameToSeconds = (nbFrames, production, shot) =>
  Math.round((nbFrames / fpsOf(production?.fps, shot?.fps)) * 1000) / 1000

/**
 * Display a time as an `HH:MM:SS:FF` timecode. A negative or non finite time
 * counts as 0.
 * @param {number} rawTime Time in seconds.
 * @param {number|string|null} [fps] Frames per second.
 * @returns {string} Timecode.
 */
export const formatTime = (rawTime, fps) => {
  const seconds = Number.isFinite(rawTime) && rawTime >= 0 ? rawTime : 0
  const time = new Date(1000 * seconds).toISOString()
  const milliseconds = parseInt(time.substring(20, 23))
  const rate = fpsOf(fps)
  const frameDuration = roundPrecision(1 / rate)
  // Rounding up the last milliseconds of a second would name frame fps.
  const frame = `${Math.min(
    Math.round(milliseconds / (1000 * frameDuration)),
    Math.ceil(rate) - 1
  )}`.padStart(2, '0')
  return `${time.substring(11, 19)}:${frame}`
}

/**
 * Get the `HH:MM:SS:FF` timecode of a frame number. A missing or negative
 * frame counts as 0. A fractional fps counts at its nominal rate, like the
 * non-drop-frame timecode of editing software: 24 frames a second at 23.976.
 * @param {number|null} [frame] Frame number, counted from 0.
 * @param {number|string|null} [fps] Frames per second.
 * @returns {string} Timecode.
 */
export const formatToTimecode = (frame, fps) => {
  const count = !frame || frame < 0 ? 0 : Math.floor(frame)
  // Whole numbers only: float divisions by 23.976 floor a second too low.
  const rate = Math.round(fpsOf(fps))
  const seconds = Math.floor(count / rate)
  return [
    Math.floor(seconds / 3600),
    Math.floor(seconds / 60) % 60,
    seconds % 60,
    count % rate
  ]
    .map(part => part.toString().padStart(2, '0'))
    .join(':')
}

/**
 * Display a frame number padded to 3 digits. A missing or negative frame
 * counts as 0.
 * @param {number|null} [frame] Frame number.
 * @returns {string} Padded frame number.
 */
export const formatFrame = frame =>
  `${!frame || frame < 0 ? 0 : frame}`.padStart(3, '0')

/**
 * Get the production start frame of an entity: a shot numbered from
 * `data.frame_in`, for instance 1001.
 * @param {{
 *   data?: {frame_in?: number|string, [field: string]: any}|null,
 *   [field: string]: any
 * }|null} [entity]
 * @returns {number|undefined} The start frame, undefined when the entity
 * carries no usable value.
 */
export const getEntityFrameStart = entity => {
  const frameIn = parseInt(`${entity?.data?.frame_in}`)
  return frameIn > 0 ? frameIn : undefined
}
