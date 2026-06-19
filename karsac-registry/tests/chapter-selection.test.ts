import { describe, expect, it } from 'vitest'
import { resolveChapterId } from '../src/state/chapterSelection.js'

describe('chapter selection', () => {
  it('uses an explicit chapter id when provided', () => {
    expect(resolveChapterId({ chapterId: 'chapter-3', currentChapter: 2 })).toBe('chapter-3')
  })

  it('derives the chapter id from current chapter when explicit chapter id is absent', () => {
    expect(resolveChapterId({ currentChapter: 3 })).toBe('chapter-3')
  })

  it('falls back to chapter 2 for legacy bootstrap', () => {
    expect(resolveChapterId({})).toBe('chapter-2')
  })
})
