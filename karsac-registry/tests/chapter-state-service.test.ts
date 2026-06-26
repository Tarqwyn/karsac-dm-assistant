import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { createStateService, StateServiceError } from '../src/state/service.js'

function writeJson(root: string, relativePath: string, data: unknown): void {
  const fullPath = join(root, relativePath)
  mkdirSync(join(fullPath, '..'), { recursive: true })
  writeFileSync(fullPath, JSON.stringify(data, null, 2) + '\n', 'utf8')
}

function readJson(root: string, relativePath: string): any {
  return JSON.parse(readFileSync(join(root, relativePath), 'utf8'))
}

function makeStateFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'karsac-state-'))

  writeJson(root, 'campaign-state.json', {
    id: 'campaign-state',
    type: 'campaign-state',
    campaign: 'karsac',
    currentSession: 2,
    currentChapter: 2,
    currentScene: null,
    currentLocation: null,
    clock: { value: 0, max: 16, tiers: { low: '0-3', medium: '4-6', high: '7-9', critical: '10-16' }, meaning: 'test' },
    progress: { session: 2, step: 0, steps: 8 },
    storageKey: 'karsac.campaign.v1',
    source: 'test',
    importStatus: 'test',
    uiStateIgnored: [],
  })

  writeJson(root, 'party-state.json', {
    id: 'party-state',
    type: 'party-state',
    campaign: 'karsac',
    currentParty: ['korvann'],
    partyLevel: 3,
    partySize: 1,
    source: 'test',
    importStatus: 'test',
    characters: [
      {
        id: 'korvann',
        name: 'Korvann',
        class: 'Ranger',
        status: 'present',
        wound: 'wound',
        karsac: 'karsac',
        crow: null,
        namNote: null,
        dmNote: null,
        threads: [
          { hot: true, text: 'Korvann has finally seen the original geometry.' },
        ],
        npcs: [],
      },
    ],
  })

  writeJson(root, 'world-threads.json', {
    id: 'world-threads',
    type: 'world-threads',
    campaign: 'karsac',
    source: 'test',
    importStatus: 'test',
    statusLabels: {
      hot: 'Hot',
      simmering: 'Simmering',
      dormant: 'Dormant',
      closed: 'Closed',
      abandoned: 'Abandoned',
    },
    threads: [
      {
        id: 'mathr-arithmetic',
        name: 'Mathr arithmetic',
        type: 'world',
        origin: 'ch2',
        defaultStatus: 'dormant',
        currentStatus: 'dormant',
        summary: 'summary',
        players: [],
        npcs: [],
        pokeWhen: 'poke',
        closesWhen: 'close',
        autoTriggers: [],
      },
    ],
  })

  writeJson(root, 'player-knowledge.json', {
    id: 'player-knowledge',
    type: 'player-knowledge',
    campaign: 'karsac',
    scope: 'party',
    chapterBasis: 'chapter-2',
    knownFacts: [],
    postedHandouts: [],
    knownBeats: [],
    activeThreads: [],
    unresolvedQuestions: [],
    notYetRevealed: ['mathr-no-antecedent'],
    source: ['test'],
    importStatus: 'derived',
  })

  writeJson(root, 'chapters/chapter-2/facts.json', {
    id: 'chapter-2-facts',
    type: 'chapter-facts',
    campaign: 'karsac',
    chapterId: 'chapter-2',
    source: 'test',
    importStatus: 'test',
    facts: [
      {
        id: 'mathr-no-antecedent',
        label: 'Mathr without antecedent',
        scene: 'records',
        desc: 'No record before sixty years ago.',
        knowledgeStatus: 'available',
        revealed: false,
        type: 'chapter-fact',
        chapter: 'chapter-2',
        source: 'test',
        importStatus: 'test',
      },
    ],
  })

  writeJson(root, 'chapters/chapter-2/handouts.json', {
    id: 'chapter-2-handouts',
    type: 'chapter-handouts',
    campaign: 'karsac',
    chapterId: 'chapter-2',
    source: 'test',
    importStatus: 'test',
    handouts: [
      {
        id: 'H12',
        label: 'Aeorian Note',
        scene: 'maw',
        desc: 'A note referencing Ashvein.',
        posted: false,
        visibility: 'player-facing-when-posted',
        type: 'chapter-handout',
        chapter: 'chapter-2',
        source: 'test',
        importStatus: 'test',
      },
    ],
  })

  writeJson(root, 'chapters/chapter-2/beats.json', {
    id: 'chapter-2-beats',
    type: 'chapter-beats',
    campaign: 'karsac',
    chapterId: 'chapter-2',
    source: 'test',
    importStatus: 'test',
    beats: [
      {
        id: 'ambient-forgetting',
        label: 'Ambient forgetting',
        scene: 'ambient',
        desc: 'The flag is at half mast and no one knows why.',
        completed: true,
        type: 'chapter-beat',
        chapter: 'chapter-2',
        source: 'test',
        importStatus: 'test',
      },
    ],
  })

  writeJson(root, 'chapters/chapter-2/triggers.json', {
    id: 'chapter-2-triggers',
    type: 'chapter-triggers',
    campaign: 'karsac',
    chapterId: 'chapter-2',
    source: 'test',
    importStatus: 'test',
    triggers: [
      {
        on: 'fact',
        id: 'mathr-no-antecedent',
        threadId: 'mathr-arithmetic',
        setStatus: 'hot',
      },
      {
        on: 'handout',
        id: 'H12',
        threadId: 'mathr-arithmetic',
        setStatus: 'simmering',
      },
      {
        on: 'beat',
        id: 'ambient-forgetting',
        threadId: 'mathr-arithmetic',
        setStatus: 'simmering',
      },
    ],
  })

  writeJson(root, 'chapters/chapter-2/progress.json', {
    id: 'chapter-2-progress',
    type: 'chapter-progress',
    campaign: 'karsac',
    chapterId: 'chapter-2',
    source: 'test',
    importStatus: 'test',
    currentCheckpoint: {
      id: 'checkpoint-0',
      index: 0,
      label: 'Prelude',
      pauseLabel: 'None',
      pauseClass: null,
      recap: [],
    },
    checkpoints: [
      {
        id: 'checkpoint-0',
        index: 0,
        label: 'Prelude',
        pauseLabel: 'None',
        pauseClass: null,
        recap: [],
      },
      {
        id: 'checkpoint-1',
        index: 1,
        label: 'Arrival',
        pauseLabel: 'Pause',
        pauseClass: 'pause',
        recap: ['recap'],
      },
    ],
    coverage: {
      facts: { completed: 0, total: 1 },
      handouts: { completed: 0, total: 1 },
      beats: { completed: 1, total: 1 },
      percent: 33,
    },
  })

  writeJson(root, 'chapters/chapter-2/scenes.json', {
    id: 'chapter-2-scenes',
    type: 'chapter-scenes',
    campaign: 'karsac',
    chapterId: 'chapter-2',
    source: 'test',
    importStatus: 'test',
    scenes: [],
  })

  writeJson(root, 'chapters/chapter-3/facts.json', {
    id: 'chapter-3-facts',
    type: 'chapter-facts',
    campaign: 'karsac',
    chapterId: 'chapter-3',
    source: 'test',
    importStatus: 'test',
    facts: [],
  })

  writeJson(root, 'chapters/chapter-3/handouts.json', {
    id: 'chapter-3-handouts',
    type: 'chapter-handouts',
    campaign: 'karsac',
    chapterId: 'chapter-3',
    source: 'test',
    importStatus: 'test',
    handouts: [],
  })

  writeJson(root, 'chapters/chapter-3/beats.json', {
    id: 'chapter-3-beats',
    type: 'chapter-beats',
    campaign: 'karsac',
    chapterId: 'chapter-3',
    source: 'test',
    importStatus: 'test',
    beats: [],
  })

  writeJson(root, 'chapters/chapter-3/progress.json', {
    id: 'chapter-3-progress',
    type: 'chapter-progress',
    campaign: 'karsac',
    chapterId: 'chapter-3',
    source: 'test',
    importStatus: 'test',
    currentCheckpoint: {
      id: 'checkpoint-0',
      index: 0,
      label: 'Prelude',
      pauseLabel: 'None',
      pauseClass: null,
      recap: [],
    },
    checkpoints: [
      {
        id: 'checkpoint-0',
        index: 0,
        label: 'Prelude',
        pauseLabel: 'None',
        pauseClass: null,
        recap: [],
      },
    ],
    coverage: {
      facts: { completed: 0, total: 0 },
      handouts: { completed: 0, total: 0 },
      beats: { completed: 0, total: 0 },
      percent: 0,
    },
  })

  writeJson(root, 'chapters/chapter-3/scenes.json', {
    id: 'chapter-3-scenes',
    type: 'chapter-scenes',
    campaign: 'karsac',
    chapterId: 'chapter-3',
    source: 'test',
    importStatus: 'test',
    scenes: [],
  })

  mkdirSync(join(root, 'proposals', 'scenes'), { recursive: true })
  writeFileSync(join(root, 'proposals', 'scenes', 'greybacks-departure.proposed.md'), `---
id: proposals/scenes/greybacks-departure
proposal_type: scene
title: Greyback's Departure
status: promoted
canonical: provisional
visibility: dm-only
review_status: approved
promote_target: corpus/planning/scenes
---

# Greyback's Departure
`, 'utf8')

  mkdirSync(join(root, 'proposals', 'npcs'), { recursive: true })
  writeFileSync(join(root, 'proposals', 'npcs', 'brynja.proposed.md'), `---
id: proposals/npcs/brynja
proposal_type: npc
title: Brynja
status: promoted
canonical: provisional
visibility: dm-only
review_status: approved
promote_target: corpus/planning/npcs
---

# Brynja
`, 'utf8')

  mkdirSync(join(root, 'proposals', 'places'), { recursive: true })
  writeFileSync(join(root, 'proposals', 'places', 'torweg-harbour.proposed.md'), `---
id: proposals/places/torweg-harbour
proposal_type: place
title: Torweg Harbour
status: proposed
canonical: provisional
visibility: dm-only
review_status: approved
promote_target: corpus/planning/places
---

# Torweg Harbour
`, 'utf8')

  mkdirSync(join(root, 'proposals', 'adversaries'), { recursive: true })
  writeFileSync(join(root, 'proposals', 'adversaries', 'ledger-keeper.proposed.md'), `---
id: proposals/ledger-keeper
proposal_type: adversary
title: The Ledger-Keeper
status: promoted
canonical: provisional
visibility: dm-only
review_status: approved
promote_target: corpus/planning/adversaries
---

# The Ledger-Keeper
`, 'utf8')

  mkdirSync(join(root, 'proposals', 'items'), { recursive: true })
  writeFileSync(join(root, 'proposals', 'items', 'mathr-token.proposed.md'), `---
id: proposals/mathr-token
proposal_type: item
title: Mathr Token
status: proposed
canonical: provisional
visibility: dm-only
review_status: approved
promote_target: corpus/planning/items
---

# Mathr Token
`, 'utf8')

  return root
}

const cleanupRoots: string[] = []

afterEach(() => {
  while (cleanupRoots.length > 0) {
    const root = cleanupRoots.pop()
    if (root) rmSync(root, { recursive: true, force: true })
  }
})

describe('state service', () => {
  it('reveals a fact, refreshes derived state, and appends a state log entry', () => {
    const root = makeStateFixture()
    cleanupRoots.push(root)
    const service = createStateService(root)

    const result = service.revealFact('chapter-2', 'mathr-no-antecedent')

    expect(result.fact.id).toBe('mathr-no-antecedent')
    expect(result.fact.knowledgeStatus).toBe('revealed')
    expect(result.fact.revealed).toBe(true)
    expect(result.worldThreads.threads[0]?.currentStatus).toBe('hot')
    expect(result.playerKnowledge.knownFacts).toEqual(['mathr-no-antecedent'])
    expect(result.playerKnowledge.knownBeats).toEqual(['ambient-forgetting'])
    expect(result.playerKnowledge.activeThreads).toEqual([
      { id: 'mathr-arithmetic', name: 'Mathr arithmetic', status: 'hot' },
    ])

    const facts = readJson(root, 'chapters/chapter-2/facts.json')
    expect(facts.facts[0].revealed).toBe(true)

    const playerKnowledge = readJson(root, 'player-knowledge.json')
    expect(playerKnowledge.knownFacts).toEqual(['mathr-no-antecedent'])

    const logLines = readFileSync(join(root, 'state-log.ndjson'), 'utf8').trim().split('\n')
    expect(logLines).toHaveLength(1)
    const event = JSON.parse(logLines[0] ?? '{}')
    expect(event.action).toBe('fact.reveal')
    expect(event.chapterId).toBe('chapter-2')
    expect(event.targetId).toBe('mathr-no-antecedent')
  })

  it('can hide a revealed fact and roll derived knowledge back', () => {
    const root = makeStateFixture()
    cleanupRoots.push(root)
    const service = createStateService(root)

    service.revealFact('chapter-2', 'mathr-no-antecedent')
    const result = service.hideFact('chapter-2', 'mathr-no-antecedent')

    expect(result.fact.knowledgeStatus).toBe('available')
    expect(result.fact.revealed).toBe(false)
    expect(result.playerKnowledge.knownFacts).toEqual([])
    expect(result.playerKnowledge.notYetRevealed).toEqual(['mathr-no-antecedent'])

    const logLines = readFileSync(join(root, 'state-log.ndjson'), 'utf8').trim().split('\n')
    expect(logLines).toHaveLength(2)
    const lastEvent = JSON.parse(logLines[1] ?? '{}')
    expect(lastEvent.action).toBe('fact.hide')
  })

  it('throws a not-found error for an unknown fact id', () => {
    const root = makeStateFixture()
    cleanupRoots.push(root)
    const service = createStateService(root)

    expect(() => service.revealFact('chapter-2', 'missing-fact')).toThrowError(StateServiceError)
    expect(() => service.revealFact('chapter-2', 'missing-fact')).toThrow('Unknown fact "missing-fact"')
  })

  it('posts a handout, refreshes player knowledge, and updates coverage', () => {
    const root = makeStateFixture()
    cleanupRoots.push(root)
    const service = createStateService(root)

    const result = service.postHandout('chapter-2', 'H12')

    expect(result.handout.id).toBe('H12')
    expect(result.handout.posted).toBe(true)
    expect(result.playerKnowledge.postedHandouts).toEqual(['H12'])

    const progress = readJson(root, 'chapters/chapter-2/progress.json')
    expect(progress.coverage.handouts).toEqual({ completed: 1, total: 1 })
  })

  it('marks a beat complete and keeps derived beat knowledge in sync', () => {
    const root = makeStateFixture()
    cleanupRoots.push(root)
    const service = createStateService(root)

    service.unmarkBeat('chapter-2', 'ambient-forgetting')
    const result = service.markBeat('chapter-2', 'ambient-forgetting')

    expect(result.beat.id).toBe('ambient-forgetting')
    expect(result.beat.completed).toBe(true)
    expect(result.playerKnowledge.knownBeats).toEqual(['ambient-forgetting'])
  })

  it('falls back to an empty party state when party-state.json is absent', () => {
    const root = makeStateFixture()
    cleanupRoots.push(root)
    rmSync(join(root, 'party-state.json'))
    const service = createStateService(root)

    const result = service.revealFact('chapter-2', 'mathr-no-antecedent')

    expect(result.fact.revealed).toBe(true)
    expect(result.playerKnowledge.knownFacts).toEqual(['mathr-no-antecedent'])
    expect(result.playerKnowledge.unresolvedQuestions).toEqual([])
  })

  it('sets a thread status directly and keeps the manual choice through derived refresh', () => {
    const root = makeStateFixture()
    cleanupRoots.push(root)
    const service = createStateService(root)

    const result = service.setThreadStatus('chapter-2', 'mathr-arithmetic', 'closed')

    expect(result.thread).toEqual({ id: 'mathr-arithmetic', currentStatus: 'closed' })
    expect(result.worldThreads.threads[0]?.currentStatus).toBe('closed')

    const factResult = service.revealFact('chapter-2', 'mathr-no-antecedent')
    expect(factResult.worldThreads.threads[0]?.currentStatus).toBe('closed')

    const threads = readJson(root, 'world-threads.json')
    expect(threads.threads[0].currentStatus).toBe('closed')
  })

  it('sets the current checkpoint and updates campaign progress mirror', () => {
    const root = makeStateFixture()
    cleanupRoots.push(root)
    const service = createStateService(root)

    const result = service.setCheckpoint('chapter-2', 1)

    expect(result.progress.currentCheckpoint.index).toBe(1)
    expect(result.progress.currentCheckpoint.label).toBe('Arrival')

    const campaign = readJson(root, 'campaign-state.json')
    expect(campaign.progress.step).toBe(1)
  })

  it('locks and unlocks a chapter without changing the campaign pointer', () => {
    const root = makeStateFixture()
    cleanupRoots.push(root)
    const service = createStateService(root)

    const locked = service.setChapterLock('chapter-2', true)
    expect(locked.campaign.lockedChapters).toContain('chapter-2')
    expect(locked.campaign.currentChapter).toBe(2)

    const unlocked = service.setChapterLock('chapter-2', false)
    expect(unlocked.campaign.lockedChapters).not.toContain('chapter-2')
  })

  it('switches to another chapter and locks the current chapter when requested', () => {
    const root = makeStateFixture()
    cleanupRoots.push(root)
    const service = createStateService(root)

    const result = service.setCurrentChapter('chapter-3', true)

    expect(result.campaign.currentChapter).toBe(3)
    expect(result.chapter.chapterId).toBe('chapter-3')
    expect(result.chapterList.find((entry) => entry.id === 'chapter-2')?.locked).toBe(true)
    expect(result.chapterList.find((entry) => entry.id === 'chapter-3')?.current).toBe(true)

    const campaign = readJson(root, 'campaign-state.json')
    expect(campaign.currentChapter).toBe(3)
    expect(campaign.lockedChapters).toContain('chapter-2')
  })

  it('sets the clock value in campaign state', () => {
    const root = makeStateFixture()
    cleanupRoots.push(root)
    const service = createStateService(root)

    const result = service.setClock(7)

    expect(result.clock.value).toBe(7)

    const campaign = readJson(root, 'campaign-state.json')
    expect(campaign.clock.value).toBe(7)
  })

  it('previews and closes a session export, writing summary files and appending the log', () => {
    const root = makeStateFixture()
    cleanupRoots.push(root)
    const service = createStateService(root)

    const preview = service.previewSessionClose()
    expect(preview.summary.chapterId).toBe('chapter-2')
    expect(preview.summary.exportPaths).toEqual([
      'corpus/state/session-close/session-2-chapter-2.summary.json',
      'corpus/state/session-close/session-2-chapter-2.summary.md',
    ])

    const result = service.closeSession()
    expect(result.pathsWritten).toEqual(preview.summary.exportPaths)
    expect(result.logEntry.action).toBe('session.close')

    const summaryJson = readJson(root, 'session-close/session-2-chapter-2.summary.json')
    expect(summaryJson.chapterId).toBe('chapter-2')
    expect(summaryJson.coverage.percent).toBe(33)

    const markdown = readFileSync(join(root, 'session-close/session-2-chapter-2.summary.md'), 'utf8')
    expect(markdown).toContain('# Session Close Summary')

    const logLines = readFileSync(join(root, 'state-log.ndjson'), 'utf8').trim().split('\n')
    const event = JSON.parse(logLines[0] ?? '{}')
    expect(event.action).toBe('session.close')
    expect(event.targetId).toBe('session-2-chapter-2')
  })

  it('writes and reads a chapter plan with annotated proposal reference status', () => {
    const root = makeStateFixture()
    cleanupRoots.push(root)
    const service = createStateService(root)

    service.writeChapterPlan('chapter-3', {
      title: 'The Weight of Witness',
      notes: 'Chapter notes',
      scenes: [
        {
          id: 'scene-1',
          label: 'The Greyback Departure',
          kind: 'opening',
          order: 10,
          summary: 'Set the departure tone.',
          artifactRef: 'proposals/scenes/greybacks-departure',
          npcs: ['proposals/npcs/brynja'],
          places: ['proposals/places/torweg-harbour'],
          adversaries: ['proposals/ledger-keeper'],
          items: ['proposals/mathr-token'],
          beats: [{ id: 'beat-departure', label: 'Departure', desc: 'The ship leaves.' }],
          facts: [{ id: 'fact-mathr', label: 'Mathr named', desc: 'The name Mathr appears.' }],
          handouts: [{ id: 'handout-note', label: 'Mathr Note', desc: 'A folded note.' }],
          triggers: [{ on: 'fact', id: 'fact-mathr', threadId: 'mathr-arithmetic', setStatus: 'hot' }],
        },
      ],
      threads: [{ threadId: 'mathr-arithmetic', hook: 'Mathr pressure builds.', cueSceneIds: ['scene-1'] }],
      checkpoints: [{ id: 'cp-opening', index: 0, label: 'Opening', sceneIds: ['scene-1'], pauseLabel: null }],
    })

    const result = service.readChapterPlan('chapter-3')

    expect(result.plan.id).toBe('chapter-3-plan')
    expect(result.plan.type).toBe('chapter-plan')
    expect(result.referenceStatuses).toEqual(expect.arrayContaining([
      expect.objectContaining({ proposalId: 'proposals/scenes/greybacks-departure', status: 'promoted' }),
      expect.objectContaining({ proposalId: 'proposals/npcs/brynja', status: 'promoted' }),
      expect.objectContaining({ proposalId: 'proposals/places/torweg-harbour', status: 'reviewed' }),
      expect.objectContaining({ proposalId: 'proposals/ledger-keeper', status: 'promoted' }),
      expect.objectContaining({ proposalId: 'proposals/mathr-token', status: 'reviewed' }),
    ]))
  })

  it('materialises a chapter plan into tracker-facing state files when all refs are promoted', () => {
    const root = makeStateFixture()
    cleanupRoots.push(root)
    const service = createStateService(root)

    service.writeChapterPlan('chapter-3', {
      title: 'The Weight of Witness',
      scenes: [
        {
          id: 'scene-1',
          label: 'The Greyback Departure',
          kind: 'opening',
          order: 10,
          summary: 'Set the departure tone.',
          artifactRef: 'proposals/scenes/greybacks-departure',
          npcs: ['proposals/npcs/brynja'],
          places: [],
          adversaries: ['proposals/ledger-keeper'],
          items: [],
          beats: [{ id: 'beat-departure', label: 'Departure', desc: 'The ship leaves.' }],
          facts: [{ id: 'fact-mathr', label: 'Mathr named', desc: 'The name Mathr appears.' }],
          handouts: [{ id: 'handout-note', label: 'Mathr Note', desc: 'A folded note.' }],
          triggers: [{ on: 'fact', id: 'fact-mathr', threadId: 'mathr-arithmetic', setStatus: 'hot' }],
        },
      ],
      threads: [{ threadId: 'mathr-arithmetic', hook: 'Mathr pressure builds.', cueSceneIds: ['scene-1'] }],
      checkpoints: [{ id: 'cp-opening', index: 0, label: 'Opening', sceneIds: ['scene-1'], pauseLabel: null }],
    })

    const result = service.materializeChapterPlan('chapter-3')

    expect(result.bundle.chapterId).toBe('chapter-3')
    expect(result.bundle.facts?.facts[0]?.revealed).toBe(false)
    expect(result.bundle.beats?.beats[0]?.completed).toBe(false)
    expect(result.bundle.progress?.currentCheckpoint?.id).toBe('cp-opening')
    expect(result.writtenFiles).toContain('corpus/state/chapters/chapter-3/facts.json')
    expect(result.bundle.scenes?.scenes[0]?.notesMd).toContain('Adversaries: `proposals/ledger-keeper`')
    expect(result.bundle.triggers?.triggers).toEqual([
      { on: 'fact', id: 'fact-mathr', threadId: 'mathr-arithmetic', setStatus: 'hot' },
    ])

    const revealResult = service.revealFact('chapter-3', 'fact-mathr')
    expect(revealResult.worldThreads.threads.find((thread: { id: string }) => thread.id === 'mathr-arithmetic')?.currentStatus).toBe('hot')
  })

  it('rejects duplicate item ids and triggers that do not target the same segment', () => {
    const root = makeStateFixture()
    cleanupRoots.push(root)
    const service = createStateService(root)

    try {
      service.writeChapterPlan('chapter-3', {
        title: 'Invalid trigger plan',
        scenes: [
          {
            id: 'scene-1',
            label: 'First',
            kind: 'opening',
            order: 10,
            summary: '',
            beats: [],
            facts: [{ id: 'shared-id', label: 'First fact' }],
            handouts: [],
            triggers: [{ on: 'fact', id: 'other-fact', threadId: 'mathr-arithmetic', setStatus: 'hot' }],
          },
          {
            id: 'scene-2',
            label: 'Second',
            kind: 'middle',
            order: 20,
            summary: '',
            beats: [],
            facts: [{ id: 'shared-id', label: 'Second fact' }, { id: 'other-fact', label: 'Other fact' }],
            handouts: [],
            triggers: [],
          },
        ],
        threads: [{ threadId: 'mathr-arithmetic', hook: '', cueSceneIds: [] }],
        checkpoints: [],
      })
      throw new Error('Expected invalid trigger plan to fail.')
    } catch (error) {
      expect(error).toBeInstanceOf(StateServiceError)
      expect((error as StateServiceError).issues).toEqual(expect.arrayContaining([
        expect.stringContaining('Chapter item id "shared-id" is duplicated'),
        'scene-1 trigger fact:other-fact must reference a fact in the same segment.',
      ]))
    }
  })

  it('rejects triggers for plan threads that are absent from world thread state', () => {
    const root = makeStateFixture()
    cleanupRoots.push(root)
    const service = createStateService(root)

    try {
      service.writeChapterPlan('chapter-3', {
        title: 'Unknown world thread plan',
        scenes: [
          {
            id: 'scene-1',
            label: 'First',
            kind: 'opening',
            order: 10,
            summary: '',
            beats: [],
            facts: [{ id: 'fact-mathr', label: 'Mathr named' }],
            handouts: [],
            triggers: [{ on: 'fact', id: 'fact-mathr', threadId: 'missing-world-thread', setStatus: 'hot' }],
          },
        ],
        threads: [{ threadId: 'missing-world-thread', hook: '', cueSceneIds: [] }],
        checkpoints: [],
      })
      throw new Error('Expected missing world thread plan to fail.')
    } catch (error) {
      expect(error).toBeInstanceOf(StateServiceError)
      expect((error as StateServiceError).issues).toContain(
        'scene-1 trigger fact:fact-mathr references unknown world thread "missing-world-thread".',
      )
    }
  })

  it('rejects materialisation when the plan still references unpromoted artifacts', () => {
    const root = makeStateFixture()
    cleanupRoots.push(root)
    const service = createStateService(root)

    service.writeChapterPlan('chapter-3', {
      title: 'The Weight of Witness',
      scenes: [
        {
          id: 'scene-1',
          label: 'The Greyback Departure',
          kind: 'opening',
          order: 10,
          summary: 'Set the departure tone.',
          artifactRef: 'proposals/scenes/greybacks-departure',
          npcs: [],
          places: [],
          adversaries: [],
          items: ['proposals/mathr-token'],
          beats: [],
          facts: [],
          handouts: [],
        },
      ],
      threads: [],
      checkpoints: [],
    })

    try {
      service.materializeChapterPlan('chapter-3')
      throw new Error('Expected materialisation to fail.')
    } catch (error) {
      expect(error).toBeInstanceOf(StateServiceError)
      expect((error as StateServiceError).statusCode).toBe(409)
      expect((error as StateServiceError).issues).toContain(
        'scene-1 items reference proposals/mathr-token is reviewed, not promoted.',
      )
    }
  })
})
