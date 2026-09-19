import { describe, expect, it } from 'vitest'

import * as preview from '../../src/utils/preview.js'
import {
  formatRevision,
  isDiffPreview,
  isFilePreview,
  isMarkdownPreview,
  isModelPreview,
  isMoviePreview,
  isPdfPreview,
  isPicturePreview,
  isSoundPreview,
  isTransparentPicturePreview
} from '../../src/utils/preview.js'

const KNOWN_EXTENSIONS = [
  'mp4',
  'gif',
  'jpeg',
  'jpg',
  'png',
  'glb',
  'gltf',
  'mp3',
  'wav',
  'pdf',
  'md',
  'diff'
]

const acceptedBy = predicate => KNOWN_EXTENSIONS.filter(predicate)

describe('utils/preview', () => {
  describe('extension type checks', () => {
    it('isMoviePreview accepts mp4 only', () => {
      expect(acceptedBy(isMoviePreview)).toEqual(['mp4'])
    })

    it('isPicturePreview accepts the still image extensions', () => {
      expect(acceptedBy(isPicturePreview)).toEqual([
        'gif',
        'jpeg',
        'jpg',
        'png'
      ])
    })

    it('isTransparentPicturePreview accepts png only', () => {
      expect(acceptedBy(isTransparentPicturePreview)).toEqual(['png'])
    })

    it('isModelPreview accepts the glTF extensions', () => {
      expect(acceptedBy(isModelPreview)).toEqual(['glb', 'gltf'])
    })

    it('isSoundPreview accepts mp3 and wav', () => {
      expect(acceptedBy(isSoundPreview)).toEqual(['mp3', 'wav'])
    })

    it('isPdfPreview accepts pdf only', () => {
      expect(acceptedBy(isPdfPreview)).toEqual(['pdf'])
    })

    it('isMarkdownPreview accepts md only', () => {
      expect(acceptedBy(isMarkdownPreview)).toEqual(['md'])
    })

    it('isDiffPreview accepts diff only', () => {
      expect(acceptedBy(isDiffPreview)).toEqual(['diff'])
    })

    it('matches the bare lowercase extension, nothing else', () => {
      expect(isMoviePreview('MP4')).toBe(false)
      expect(isMoviePreview('.mp4')).toBe(false)
      expect(isPicturePreview('PNG')).toBe(false)
      expect(isPicturePreview(undefined)).toBe(false)
      expect(isPicturePreview(null)).toBe(false)
    })

    it('isFilePreview is true for every extension no other check accepts', () => {
      expect(acceptedBy(isFilePreview)).toEqual([])
      expect(isFilePreview('zip')).toBe(true)
      expect(isFilePreview('blend')).toBe(true)
      expect(isFilePreview('')).toBe(true)
      expect(isFilePreview(undefined)).toBe(true)
    })
  })

  describe('formatRevision', () => {
    it('pads the revision to the project padding width', () => {
      const project = { revision_padding: 3 }
      expect(formatRevision(0, project)).toEqual('v000')
      expect(formatRevision(42, project)).toEqual('v042')
    })

    it('never truncates a revision wider than the padding', () => {
      expect(formatRevision(1001, { revision_padding: 3 })).toEqual('v1001')
    })

    it('falls back to no padding when the project has none', () => {
      expect(formatRevision(2, { revision_padding: 0 })).toEqual('v2')
      expect(formatRevision(2, {})).toEqual('v2')
      expect(formatRevision(2, undefined)).toEqual('v2')
    })

    it('returns an empty string for a missing revision', () => {
      expect(formatRevision(null, { revision_padding: 3 })).toEqual('')
      expect(formatRevision(undefined, { revision_padding: 3 })).toEqual('')
      expect(formatRevision('', { revision_padding: 3 })).toEqual('')
    })

    it('leaves the project untouched', () => {
      const project = Object.freeze({ revision_padding: 3 })
      expect(formatRevision(7, project)).toEqual('v007')
      expect(project).toEqual({ revision_padding: 3 })
    })
  })

  describe('module surface', () => {
    it('does not port the canvas and annotation snapshot helpers', () => {
      expect(preview).not.toHaveProperty('buildAnnotationSnapshotFilename')
      expect(preview).not.toHaveProperty('buildAnnotationSnapshotTitle')
      expect(preview).not.toHaveProperty('drawSnapshotTitle')
    })
  })
})
