/**
 * Frame and timecode helpers, ported from Kitsu's `src/lib/video.js`.
 * The rounding rules are calibrated on the Kitsu players: do not adjust them.
 */

const PRECISION_FACTOR = 10000

/** Frame rate used when neither the production nor the shot sets one. */
export const DEFAULT_FPS = 25

const roundPrecision = value =>
  Math.round(value * PRECISION_FACTOR) / PRECISION_FACTOR

/**
 * Snap a time to the nearest frame of the video.
 * @param {number} time Time in seconds.
 * @param {number} fps Frames per second.
 * @returns {number} Time of the nearest frame, in seconds (4 decimals).
 */
export const roundToFrame = (time, fps) => {
  const frameFactor = roundPrecision(1 / fps)
  const frameNumber = Math.round(time / frameFactor)
  return roundPrecision(frameNumber * frameFactor)
}

/**
 * Snap a time to the next frame boundary of the video.
 * @param {number} time Time in seconds.
 * @param {number} fps Frames per second.
 * @returns {number} Time of the frame at or after `time`, in seconds.
 */
export const ceilToFrame = (time, fps) => {
  const frameFactor = roundPrecision(1 / fps)
  const frameNumber = Math.ceil(time / frameFactor)
  return (
    Math.ceil(frameNumber * frameFactor * PRECISION_FACTOR) / PRECISION_FACTOR
  )
}

/**
 * Snap a time to the previous frame boundary of the video.
 * @param {number} time Time in seconds.
 * @param {number} fps Frames per second.
 * @returns {number} Time of the frame at or before `time`, in seconds.
 */
export const floorToFrame = (time, fps) => {
  const frameFactor = roundPrecision(1 / fps)
  const frameNumber = Math.floor(time / frameFactor)
  return (
    Math.floor(frameNumber * frameFactor * PRECISION_FACTOR) / PRECISION_FACTOR
  )
}

/**
 * Turn a number of frames into seconds. The production fps wins over the
 * shot fps, and `DEFAULT_FPS` applies when neither is set.
 * @param {number} nbFrames Number of frames.
 * @param {{fps?: number|string}|null} [production] Zou stores fps as a string.
 * @param {{fps?: number|string}|null} [shot]
 * @returns {number} Duration in seconds, rounded to the millisecond.
 */
export const frameToSeconds = (nbFrames, production, shot) => {
  const fps = production?.fps || shot?.fps || DEFAULT_FPS
  return Math.round((nbFrames / Number(fps)) * 1000) / 1000
}

/**
 * Display a time as an `HH:MM:SS:FF` timecode. A negative or non finite time
 * counts as 0.
 * @param {number} rawTime Time in seconds.
 * @param {number} fps Frames per second.
 * @returns {string} Timecode.
 */
export const formatTime = (rawTime, fps) => {
  const seconds = Number.isFinite(rawTime) && rawTime >= 0 ? rawTime : 0
  const time = new Date(1000 * seconds).toISOString()
  const milliseconds = parseInt(time.substring(20, 23))
  const frameDuration = roundPrecision(1 / fps)
  const frame = `${Math.round(milliseconds / (1000 * frameDuration))}`.padStart(
    2,
    '0'
  )
  return `${time.substring(11, 19)}:${frame}`
}

/**
 * Get the `HH:MM:SS:FF` timecode of a frame number. A missing or negative
 * frame counts as 0.
 * @param {number|null} [frame] Frame number, counted from 0.
 * @param {number} [fps] Frames per second, `DEFAULT_FPS` when omitted.
 * @returns {string} Timecode.
 */
export const formatToTimecode = (frame, fps = DEFAULT_FPS) => {
  const count = !frame || frame < 0 ? 0 : frame
  const hours = Math.floor(count / fps / 3600)
  const minutes = Math.floor((count - hours * fps * 3600) / fps / 60)
  const seconds = Math.floor(
    (count - hours * fps * 3600 - minutes * fps * 60) / fps
  )
  return [hours, minutes, seconds, count % fps]
    .map(part => part.toString().padStart(2, '0'))
    .join(':')
}

/**
 * Display a frame number padded to 3 digits. A negative frame counts as 0.
 * @param {number} frame Frame number.
 * @returns {string} Padded frame number.
 */
export const formatFrame = frame => `${frame < 0 ? 0 : frame}`.padStart(3, '0')

/**
 * Get the production start frame of an entity: a shot numbered from
 * `data.frame_in`, for instance 1001.
 * @param {{data?: {frame_in?: number|string}|null}|null} [entity]
 * @returns {number|undefined} The start frame, undefined when the entity
 * carries no usable value.
 */
export const getEntityFrameStart = entity => {
  const frameIn = parseInt(`${entity?.data?.frame_in}`)
  return frameIn > 0 ? frameIn : undefined
}
