export function resolveChapterId(input: {
  chapterId?: string | null
  currentChapter?: number | null
}): string {
  if (typeof input.chapterId === 'string' && input.chapterId.trim()) return input.chapterId
  if (typeof input.currentChapter === 'number' && Number.isFinite(input.currentChapter)) {
    return `chapter-${input.currentChapter}`
  }
  return 'chapter-2'
}

