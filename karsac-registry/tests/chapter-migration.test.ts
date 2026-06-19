import { describe, expect, it } from 'vitest'
import {
  buildChapterBeatsSeed,
  buildChapterFacts,
  buildChapterHandouts,
  buildChapterProgress,
  buildChapterRadar,
  buildChapterScenesSeed,
  buildChapterTriggers,
} from '../src/state/chapterMigration.js'

describe('chapter migration helpers', () => {
  it('maps session progress into chapter progress with manual checkpoint and derived coverage', () => {
    const result = buildChapterProgress({
      campaign: 'karsac',
      chapterId: 'chapter-2',
      sessionProgress: {
        currentStep: 5,
        steps: [
          { index: 0, label: 'Prelude', pauseLabel: 'None', pauseClass: null, recap: [] },
          { index: 1, label: 'Arrival', pauseLabel: 'Pause', pauseClass: 'pause', recap: ['recap'] },
        ],
      },
      facts: [{ revealed: true }, { revealed: false }],
      handouts: [{ posted: true }, { posted: false }],
      beats: [{ completed: true }, { completed: false }],
    })

    expect(result.currentCheckpoint.id).toBe('checkpoint-5')
    expect(result.currentCheckpoint.index).toBe(5)
    expect(result.coverage).toEqual({
      facts: { completed: 1, total: 2 },
      handouts: { completed: 1, total: 2 },
      beats: { completed: 1, total: 2 },
      percent: 50,
    })
  })

  it('maps session facts and normalises known to revealed semantics', () => {
    const result = buildChapterFacts({
      campaign: 'karsac',
      chapterId: 'chapter-2',
      sessionFacts: {
        facts: [
          {
            id: 'mathr-no-antecedent',
            label: 'Mathr antecedent',
            scene: 'records',
            desc: 'No antecedent',
            knowledgeStatus: 'known',
            revealed: true,
            source: 'session',
            importStatus: 'imported',
          },
        ],
      },
    })

    expect(result.facts[0]).toMatchObject({
      id: 'mathr-no-antecedent',
      knowledgeStatus: 'revealed',
      revealed: true,
      type: 'chapter-fact',
      chapter: 'chapter-2',
    })
  })

  it('maps session handouts, radar, and triggers into chapter equivalents', () => {
    const handouts = buildChapterHandouts({
      campaign: 'karsac',
      chapterId: 'chapter-2',
      sessionHandouts: {
        handouts: [
          {
            id: 'H12',
            label: 'Aeorian Note',
            scene: 'scene5',
            desc: 'Ashvein note',
            posted: true,
            visibility: 'player-facing-when-posted',
            source: 'session',
            importStatus: 'imported',
          },
        ],
      },
    })

    const radar = buildChapterRadar({
      campaign: 'karsac',
      chapterId: 'chapter-2',
      sessionRadar: {
        radar: [
          {
            id: 'b',
            nav: 'thread-b',
            worldThreadId: 'aeorian-note-ashvein',
            title: 'The Maw',
            surface: 'Brynja, the Carver',
            relation: 'The artefacts and geometry',
            hook: 'Use the Carver to push them up the mountain.',
            cueScenes: ['scene4'],
            cueText: 'The Maw can become urgent here.',
            currentThreadStatus: 'hot',
          },
        ],
      },
    })

    const triggers = buildChapterTriggers({
      campaign: 'karsac',
      chapterId: 'chapter-2',
      sessionTriggers: {
        triggers: [
          { on: 'fact', id: 'aeorian-note', threadId: 'aeorian-note-ashvein', setStatus: 'hot' },
        ],
      },
    })

    expect(handouts.handouts[0]).toMatchObject({
      id: 'H12',
      type: 'chapter-handout',
      chapter: 'chapter-2',
      posted: true,
    })
    expect(radar.radar[0]).toMatchObject({
      id: 'b',
      type: 'chapter-radar-entry',
      chapter: 'chapter-2',
    })
    expect(triggers.triggers[0]).toEqual({
      on: 'fact',
      id: 'aeorian-note',
      threadId: 'aeorian-note-ashvein',
      setStatus: 'hot',
    })
  })

  it('seeds chapter beats and scenes for tracker-driven play, including scene5, thread-a, and thread-b', () => {
    const beats = buildChapterBeatsSeed({
      campaign: 'karsac',
      chapterId: 'chapter-2',
      source: 'migration',
    })
    const scenes = buildChapterScenesSeed({
      campaign: 'karsac',
      chapterId: 'chapter-2',
      source: 'migration',
    })

    expect(beats.beats.map((beat) => beat.id)).toContain('ambient-quieting')
    expect(beats.beats.map((beat) => beat.id)).toContain('maw-network-revealed')
    expect(scenes.scenes.map((scene) => scene.id)).toEqual(['scene5', 'thread-a', 'thread-c', 'thread-d', 'ambient', 'ashvein', 'maw-handout', 'thread-b'])
    expect(scenes.scenes[0].blocks.length).toBeGreaterThan(0)
    expect(scenes.scenes[0].blocks.some((block) => block.type === 'choke-point')).toBe(true)
    expect(scenes.scenes[0].blocks.some((block) => block.type === 'sequence')).toBe(true)
    expect(scenes.scenes[0].blocks.some((block) => block.type === 'scene-links')).toBe(true)
    expect(scenes.scenes[0].blocks.some((block) => block.type === 'path-cards')).toBe(true)
    expect(scenes.scenes[1].blocks.some((block) => block.type === 'npc-card')).toBe(true)
    expect(scenes.scenes[1].blocks.some((block) => block.type === 'actions')).toBe(true)
    expect(scenes.scenes[2].blocks.some((block) => block.type === 'npc-card')).toBe(true)
    expect(scenes.scenes[2].blocks.some((block) => block.type === 'table')).toBe(true)
    expect(scenes.scenes[2].blocks.some((block) => block.type === 'banner')).toBe(true)
    expect(scenes.scenes[2].blocks.some((block) => block.type === 'actions')).toBe(true)
    expect(scenes.scenes[3].blocks.some((block) => block.type === 'clock')).toBe(true)
    expect(scenes.scenes[3].blocks.some((block) => block.type === 'read-aloud')).toBe(true)
    expect(scenes.scenes[3].blocks.some((block) => block.type === 'actions')).toBe(true)
    expect(scenes.scenes[7].blocks.some((block) => block.type === 'clock')).toBe(true)
    expect(scenes.scenes[7].blocks.some((block) => block.type === 'table')).toBe(true)
    expect(scenes.scenes[7].blocks.some((block) => block.type === 'banner')).toBe(true)
  })

  it('prefers chapter-specific seed data when provided for future chapters', () => {
    const beats = buildChapterBeatsSeed({
      campaign: 'karsac',
      chapterId: 'chapter-3',
      source: 'migration',
      seedData: {
        beats: [
          { id: 'chapter-3-beat', label: 'Chapter 3 beat', scene: 'scene3', desc: 'seeded from chapter data' },
        ],
      },
    })

    const scenes = buildChapterScenesSeed({
      campaign: 'karsac',
      chapterId: 'chapter-3',
      source: 'migration',
      seedData: {
        scenes: [
          {
            id: 'scene3',
            label: '3 · New Chapter',
            kind: 'thread',
            order: 30,
            meta: 'Scene 3 · Chapter 3',
            title: 'New Chapter',
            summary: 'Seeded from chapter data.',
            facts: [],
            handouts: [],
            beats: [],
            blocks: [],
            notesMd: 'chapter 3 seed',
          },
        ],
      },
    })

    expect(beats.beats.map((beat) => beat.id)).toEqual(['chapter-3-beat'])
    expect(scenes.scenes.map((scene) => scene.id)).toEqual(['scene3'])
    expect(scenes.scenes[0].title).toBe('New Chapter')
  })
})
