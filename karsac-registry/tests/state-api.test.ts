import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { createGatewayServer } from '../src/gateway/server.js'
import { createStateService } from '../src/state/service.js'

function writeJson(root: string, relativePath: string, data: unknown): void {
  const fullPath = join(root, relativePath)
  mkdirSync(join(fullPath, '..'), { recursive: true })
  writeFileSync(fullPath, JSON.stringify(data, null, 2) + '\n', 'utf8')
}

function makeStateFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'karsac-api-state-'))

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
        threads: [{ hot: true, text: 'Korvann has finally seen the original geometry.' }],
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
        completed: false,
        type: 'chapter-beat',
        chapter: 'chapter-2',
        source: 'test',
        importStatus: 'test',
      },
    ],
  })

  writeJson(root, 'chapters/chapter-2/radar.json', {
    id: 'chapter-2-radar',
    type: 'chapter-radar',
    campaign: 'karsac',
    chapterId: 'chapter-2',
    source: 'test',
    importStatus: 'test',
    radar: [
      {
        id: 'd',
        nav: 'thread-d',
        worldThreadId: 'mathr-arithmetic',
        title: 'The Records',
        surface: 'Brynja, the archives clerk',
        relation: 'Mathr enters the record fully formed.',
        hook: 'Use the archives to make the arithmetic land.',
        cueScenes: ['scene4'],
        cueText: 'The records can turn abstract suspicion into evidence here.',
        currentThreadStatus: 'dormant',
        type: 'chapter-radar-entry',
        chapter: 'chapter-2',
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
      { on: 'fact', id: 'mathr-no-antecedent', threadId: 'mathr-arithmetic', setStatus: 'hot' },
      { on: 'handout', id: 'H12', threadId: 'mathr-arithmetic', setStatus: 'simmering' },
      { on: 'beat', id: 'ambient-forgetting', threadId: 'mathr-arithmetic', setStatus: 'simmering' },
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
      beats: { completed: 0, total: 1 },
      percent: 0,
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

  return root
}

describe('state API', () => {
  let root: string
  let server: ReturnType<typeof createGatewayServer>
  let baseUrl: string

  beforeEach(async () => {
    root = makeStateFixture()
    server = createGatewayServer({ stateService: createStateService(root) })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Server did not bind to an ephemeral port')
    baseUrl = `http://127.0.0.1:${address.port}`
  })

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())))
    rmSync(root, { recursive: true, force: true })
  })

  it('returns campaign state from the API', async () => {
    const response = await fetch(`${baseUrl}/api/state/campaign`, {
      headers: {
        Authorization: 'Bearer local-karsac-dev-key',
      },
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.currentChapter).toBe(2)
    expect(body.type).toBe('campaign-state')
  })

  it('returns chapter state bundle from the API', async () => {
    const response = await fetch(`${baseUrl}/api/state/chapters/chapter-2`, {
      headers: {
        Authorization: 'Bearer local-karsac-dev-key',
      },
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.chapterId).toBe('chapter-2')
    expect(body.facts.facts[0].id).toBe('mathr-no-antecedent')
    expect(body.radar.radar[0].worldThreadId).toBe('mathr-arithmetic')
  })

  it('returns the chapter index from the API', async () => {
    const response = await fetch(`${baseUrl}/api/state/chapters`, {
      headers: {
        Authorization: 'Bearer local-karsac-dev-key',
      },
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.chapters.map((entry: { id: string }) => entry.id)).toContain('chapter-2')
    expect(body.chapters.map((entry: { id: string }) => entry.id)).toContain('chapter-3')
  })

  it('returns world thread state from the API', async () => {
    const response = await fetch(`${baseUrl}/api/state/world-threads`, {
      headers: {
        Authorization: 'Bearer local-karsac-dev-key',
      },
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.threads[0].id).toBe('mathr-arithmetic')
    expect(body.threads[0].currentStatus).toBe('dormant')
  })

  it('reveals a fact through the API and returns refreshed derived state', async () => {
    const response = await fetch(`${baseUrl}/api/state/facts/reveal`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer local-karsac-dev-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chapterId: 'chapter-2',
        factId: 'mathr-no-antecedent',
      }),
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.fact.revealed).toBe(true)
    expect(body.playerKnowledge.knownFacts).toEqual(['mathr-no-antecedent'])
    expect(body.worldThreads.threads[0].currentStatus).toBe('hot')
  })

  it('posts a handout through the API', async () => {
    const response = await fetch(`${baseUrl}/api/state/handouts/post`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer local-karsac-dev-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chapterId: 'chapter-2',
        handoutId: 'H12',
      }),
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.handout.posted).toBe(true)
    expect(body.playerKnowledge.postedHandouts).toEqual(['H12'])
  })

  it('marks a beat through the API', async () => {
    const response = await fetch(`${baseUrl}/api/state/beats/mark`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer local-karsac-dev-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chapterId: 'chapter-2',
        beatId: 'ambient-forgetting',
      }),
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.beat.completed).toBe(true)
    expect(body.playerKnowledge.knownBeats).toEqual(['ambient-forgetting'])
  })

  it('sets a thread status through the API', async () => {
    const response = await fetch(`${baseUrl}/api/state/threads/set`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer local-karsac-dev-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chapterId: 'chapter-2',
        threadId: 'mathr-arithmetic',
        status: 'closed',
      }),
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.thread.currentStatus).toBe('closed')
    expect(body.worldThreads.threads[0].currentStatus).toBe('closed')
  })

  it('sets checkpoint and clock through the API', async () => {
    const checkpointResponse = await fetch(`${baseUrl}/api/state/checkpoint/set`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer local-karsac-dev-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chapterId: 'chapter-2',
        checkpointIndex: 1,
      }),
    })
    expect(checkpointResponse.status).toBe(200)
    const checkpointBody = await checkpointResponse.json()
    expect(checkpointBody.progress.currentCheckpoint.index).toBe(1)

    const clockResponse = await fetch(`${baseUrl}/api/state/clock/set`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer local-karsac-dev-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        value: 7,
      }),
    })
    expect(clockResponse.status).toBe(200)
    const clockBody = await clockResponse.json()
    expect(clockBody.clock.value).toBe(7)
  })

  it('switches chapter and can lock the previous chapter through the API', async () => {
    const response = await fetch(`${baseUrl}/api/state/campaign/chapter`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer local-karsac-dev-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chapterId: 'chapter-3',
        lockCurrent: true,
      }),
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.campaign.currentChapter).toBe(3)
    expect(body.chapter.chapterId).toBe('chapter-3')
    expect(body.chapterList.find((entry: { id: string }) => entry.id === 'chapter-2')?.locked).toBe(true)
  })

  it('locks a chapter through the API without switching the campaign pointer', async () => {
    const response = await fetch(`${baseUrl}/api/state/campaign/lock`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer local-karsac-dev-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chapterId: 'chapter-2',
        locked: true,
      }),
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.campaign.currentChapter).toBe(2)
    expect(body.campaign.lockedChapters).toContain('chapter-2')
  })

  it('previews and closes a session through the API', async () => {
    const previewResponse = await fetch(`${baseUrl}/api/v1/session/close/preview`, {
      headers: {
        Authorization: 'Bearer local-karsac-dev-key',
      },
    })

    expect(previewResponse.status).toBe(200)
    const previewBody = await previewResponse.json()
    expect(previewBody.summary.chapterId).toBe('chapter-2')

    const response = await fetch(`${baseUrl}/api/v1/session/close`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer local-karsac-dev-key',
      },
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.summary.chapterId).toBe('chapter-2')
    expect(body.pathsWritten).toEqual([
      'corpus/state/session-close/session-2-chapter-2.summary.json',
      'corpus/state/session-close/session-2-chapter-2.summary.md',
    ])
  })

  it('rejects requests without a valid API key', async () => {
    const response = await fetch(`${baseUrl}/api/state/campaign`)
    expect(response.status).toBe(401)
  })
})
