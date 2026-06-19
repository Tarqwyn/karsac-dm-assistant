import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'fs'
import { randomUUID } from 'crypto'
import { dirname, join } from 'path'
import { STATE_ROOT } from '../paths.js'
import { refreshChapterState } from './chapterRefresh.js'

type ChapterFileKey = 'progress' | 'facts' | 'handouts' | 'beats' | 'radar' | 'triggers' | 'scenes'

type FactRecord = {
  id: string
  knowledgeStatus: string
  revealed: boolean
}

type HandoutRecord = {
  id: string
  posted: boolean
}

type BeatRecord = {
  id: string
  completed: boolean
}

type ChapterFactsState = {
  facts: FactRecord[]
}

type ChapterHandoutsState = {
  handouts: HandoutRecord[]
}

type ChapterBeatsState = {
  beats: BeatRecord[]
}

type ChapterProgressState = {
  currentCheckpoint: {
    id: string
    index: number
    label: string
    pauseLabel: string | null
    pauseClass: string | null
    recap: string[]
  }
  checkpoints: Array<{
    id: string
    index: number
    label: string
    pauseLabel: string | null
    pauseClass: string | null
    recap: string[]
  }>
  coverage: {
    facts: { completed: number; total: number }
    handouts: { completed: number; total: number }
    beats: { completed: number; total: number }
    percent: number
  }
}

type StateMutationResult = {
  fact?: FactRecord
  handout?: HandoutRecord
  beat?: BeatRecord
  thread?: { id: string; currentStatus: string }
  worldThreads: any
  playerKnowledge: any
  progress: any | null
}

type CheckpointMutationResult = {
  progress: any
}

type ClockMutationResult = {
  clock: any
}

type ChapterStateBundle = {
  chapterId: string
  progress: any | null
  facts: any | null
  handouts: any | null
  beats: any | null
  radar: any | null
  triggers: any | null
  scenes: any | null
}

type CampaignState = {
  currentChapter?: number | null
  currentSession?: number | null
  currentScene?: string | null
  currentLocation?: string | null
  lockedChapters?: string[] | null
  [key: string]: any
}

type ChapterSummary = {
  id: string
  locked: boolean
  current: boolean
}

const CHAPTER_FILES: Record<ChapterFileKey, string> = {
  progress: 'progress.json',
  facts: 'facts.json',
  handouts: 'handouts.json',
  beats: 'beats.json',
  radar: 'radar.json',
  triggers: 'triggers.json',
  scenes: 'scenes.json',
}

export class StateServiceError extends Error {
  statusCode: number
  type: string

  constructor(statusCode: number, message: string, type = 'invalid_request_error') {
    super(message)
    this.statusCode = statusCode
    this.type = type
  }
}

function readJsonFile(filePath: string): any {
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

function writeJsonAtomic(filePath: string, data: unknown): void {
  mkdirSync(dirname(filePath), { recursive: true })
  const tmpPath = `${filePath}.${randomUUID()}.tmp`
  writeFileSync(tmpPath, JSON.stringify(data, null, 2) + '\n', 'utf8')
  renameSync(tmpPath, filePath)
}

function appendLog(filePath: string, event: Record<string, unknown>): void {
  mkdirSync(dirname(filePath), { recursive: true })
  appendFileSync(filePath, JSON.stringify(event) + '\n', 'utf8')
}

function chapterFilePath(root: string, chapterId: string, key: ChapterFileKey): string {
  return join(root, 'chapters', chapterId, CHAPTER_FILES[key])
}

function readOptionalChapterFile(root: string, chapterId: string, key: ChapterFileKey): any | null {
  const filePath = chapterFilePath(root, chapterId, key)
  if (!existsSync(filePath)) return null
  return readJsonFile(filePath)
}

function readRequiredChapterFile(root: string, chapterId: string, key: ChapterFileKey): any {
  const filePath = chapterFilePath(root, chapterId, key)
  if (!existsSync(filePath)) {
    throw new StateServiceError(404, `Missing chapter state file "${CHAPTER_FILES[key]}" for ${chapterId}.`, 'not_found_error')
  }
  return readJsonFile(filePath)
}

function buildCoverage(facts: ChapterFactsState, handouts: ChapterHandoutsState, beats: ChapterBeatsState) {
  const factCoverage = { completed: facts.facts.filter((fact) => fact.revealed).length, total: facts.facts.length }
  const handoutCoverage = { completed: handouts.handouts.filter((handout) => handout.posted).length, total: handouts.handouts.length }
  const beatCoverage = { completed: beats.beats.filter((beat) => beat.completed).length, total: beats.beats.length }
  const totalCompleted = factCoverage.completed + handoutCoverage.completed + beatCoverage.completed
  const totalItems = factCoverage.total + handoutCoverage.total + beatCoverage.total

  return {
    facts: factCoverage,
    handouts: handoutCoverage,
    beats: beatCoverage,
    percent: totalItems > 0 ? Math.round((totalCompleted / totalItems) * 100) : 0,
  }
}

export interface StateService {
  readCampaignState(): any
  readPlayerKnowledge(): any
  readWorldThreads(): any
  readChapterList(): ChapterSummary[]
  readChapterState(chapterId: string): ChapterStateBundle
  revealFact(chapterId: string, factId: string): StateMutationResult
  hideFact(chapterId: string, factId: string): StateMutationResult
  postHandout(chapterId: string, handoutId: string): StateMutationResult
  unpostHandout(chapterId: string, handoutId: string): StateMutationResult
  markBeat(chapterId: string, beatId: string): StateMutationResult
  unmarkBeat(chapterId: string, beatId: string): StateMutationResult
  setThreadStatus(chapterId: string, threadId: string, status: string): StateMutationResult
  setCheckpoint(chapterId: string, checkpointIndex: number): CheckpointMutationResult
  setClock(value: number): ClockMutationResult
  setChapterLock(chapterId: string, locked: boolean): { campaign: CampaignState; chapterList: ChapterSummary[] }
  setCurrentChapter(chapterId: string, lockCurrent?: boolean): {
    campaign: CampaignState
    chapter: ChapterStateBundle
    chapterList: ChapterSummary[]
    worldThreads: any
    playerKnowledge: any
  }
}

export function createStateService(stateRoot = STATE_ROOT): StateService {
  const logPath = join(stateRoot, 'state-log.ndjson')
  const chaptersRoot = join(stateRoot, 'chapters')

  function readCampaignState(): CampaignState {
    return readJsonFile(join(stateRoot, 'campaign-state.json'))
  }

  function writeCampaignState(campaign: CampaignState): void {
    writeJsonAtomic(join(stateRoot, 'campaign-state.json'), campaign)
  }

  function readLockedChapters(campaign: CampaignState): string[] {
    return Array.isArray(campaign.lockedChapters)
      ? campaign.lockedChapters.filter((chapterId): chapterId is string => typeof chapterId === 'string')
      : []
  }

  function isChapterLocked(campaign: CampaignState, chapterId: string): boolean {
    return readLockedChapters(campaign).includes(chapterId)
  }

  function assertChapterWritable(campaign: CampaignState, chapterId: string): void {
    if (isChapterLocked(campaign, chapterId)) {
      throw new StateServiceError(403, `Chapter "${chapterId}" is locked.`, 'forbidden_error')
    }
  }

  function readChapterIds(): string[] {
    if (!existsSync(chaptersRoot)) return []
    return readdirSync(chaptersRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^chapter-\d+$/.test(entry.name))
      .map((entry) => entry.name)
      .sort((a, b) => Number(a.slice(8)) - Number(b.slice(8)))
  }

  function readChapterList(): ChapterSummary[] {
    const campaign = readCampaignState()
    const currentChapterId = typeof campaign.currentChapter === 'number' ? `chapter-${campaign.currentChapter}` : null
    const lockedChapters = new Set(readLockedChapters(campaign))
    return readChapterIds().map((id) => ({
      id,
      locked: lockedChapters.has(id),
      current: currentChapterId === id,
    }))
  }

  function readPlayerKnowledge(): any {
    return readJsonFile(join(stateRoot, 'player-knowledge.json'))
  }

  function readWorldThreads(): any {
    return readJsonFile(join(stateRoot, 'world-threads.json'))
  }

  function readChapterState(chapterId: string): ChapterStateBundle {
    return {
      chapterId,
      progress: readOptionalChapterFile(stateRoot, chapterId, 'progress'),
      facts: readOptionalChapterFile(stateRoot, chapterId, 'facts'),
      handouts: readOptionalChapterFile(stateRoot, chapterId, 'handouts'),
      beats: readOptionalChapterFile(stateRoot, chapterId, 'beats'),
      radar: readOptionalChapterFile(stateRoot, chapterId, 'radar'),
      triggers: readOptionalChapterFile(stateRoot, chapterId, 'triggers'),
      scenes: readOptionalChapterFile(stateRoot, chapterId, 'scenes'),
    }
  }

  function refreshDerivedChapterState(chapterId: string, facts: ChapterFactsState, handouts: ChapterHandoutsState, beats: ChapterBeatsState) {
    const triggers = readOptionalChapterFile(stateRoot, chapterId, 'triggers') ?? { triggers: [] }
    const worldThreads = readJsonFile(join(stateRoot, 'world-threads.json'))
    const partyState = readJsonFile(join(stateRoot, 'party-state.json'))
    const progressPath = chapterFilePath(stateRoot, chapterId, 'progress')
    const progress = readOptionalChapterFile(stateRoot, chapterId, 'progress') as ChapterProgressState | null

    const refreshed = refreshChapterState({
      campaign: 'karsac',
      chapterId,
      facts,
      handouts,
      beats,
      triggers,
      worldThreads,
      partyState,
      source: [
        `corpus/state/chapters/${chapterId}/facts.json`,
        `corpus/state/chapters/${chapterId}/handouts.json`,
        `corpus/state/chapters/${chapterId}/beats.json`,
        'corpus/state/world-threads.json',
        'corpus/state/party-state.json',
      ],
    })

    const nextProgress = progress
      ? Object.assign({}, progress, { coverage: buildCoverage(facts, handouts, beats) })
      : null

    writeJsonAtomic(join(stateRoot, 'world-threads.json'), refreshed.worldThreads)
    writeJsonAtomic(join(stateRoot, 'player-knowledge.json'), refreshed.playerKnowledge)
    if (nextProgress) writeJsonAtomic(progressPath, nextProgress)

    return {
      worldThreads: refreshed.worldThreads,
      playerKnowledge: refreshed.playerKnowledge,
      progress: nextProgress,
    }
  }

  function setCurrentChapter(chapterId: string, lockCurrent = false) {
    const chapterIds = readChapterIds()
    if (!chapterIds.includes(chapterId)) {
      throw new StateServiceError(404, `Unknown chapter "${chapterId}".`, 'not_found_error')
    }

    const campaign = readCampaignState()
    const nextLocked = new Set(readLockedChapters(campaign))
    if (lockCurrent && typeof campaign.currentChapter === 'number') {
      nextLocked.add(`chapter-${campaign.currentChapter}`)
    }

    const chapterNumber = Number(chapterId.slice(8))
    if (!Number.isInteger(chapterNumber)) {
      throw new StateServiceError(400, `Invalid chapter id "${chapterId}".`, 'invalid_request_error')
    }
    campaign.currentChapter = chapterNumber
    campaign.currentScene = null
    campaign.currentLocation = null
    campaign.lockedChapters = Array.from(nextLocked)

    const facts = readRequiredChapterFile(stateRoot, chapterId, 'facts') as ChapterFactsState
    const handouts = (readOptionalChapterFile(stateRoot, chapterId, 'handouts') ?? { handouts: [] }) as ChapterHandoutsState
    const beats = (readOptionalChapterFile(stateRoot, chapterId, 'beats') ?? { beats: [] }) as ChapterBeatsState
    const refreshed = refreshDerivedChapterState(chapterId, facts, handouts, beats)
    const progress = readOptionalChapterFile(stateRoot, chapterId, 'progress') as ChapterProgressState | null
    const nextProgress = progress ? Object.assign({}, progress, { coverage: buildCoverage(facts, handouts, beats) }) : null
    campaign.progress = Object.assign({}, campaign.progress, { step: nextProgress?.currentCheckpoint?.index ?? 0 })
    writeCampaignState(campaign)

    if (nextProgress) writeJsonAtomic(chapterFilePath(stateRoot, chapterId, 'progress'), nextProgress)

    appendLog(logPath, {
      ts: new Date().toISOString(),
      action: 'chapter.set',
      chapterId,
      targetType: 'chapter',
      targetId: chapterId,
      value: {
        lockCurrent,
        lockedChapters: campaign.lockedChapters || [],
      },
    })

    return {
      campaign,
      chapter: {
        chapterId,
        progress: nextProgress,
        facts: readOptionalChapterFile(stateRoot, chapterId, 'facts'),
        handouts: readOptionalChapterFile(stateRoot, chapterId, 'handouts'),
        beats: readOptionalChapterFile(stateRoot, chapterId, 'beats'),
        radar: readOptionalChapterFile(stateRoot, chapterId, 'radar'),
        triggers: readOptionalChapterFile(stateRoot, chapterId, 'triggers'),
        scenes: readOptionalChapterFile(stateRoot, chapterId, 'scenes'),
      },
      chapterList: readChapterList(),
      worldThreads: refreshed.worldThreads,
      playerKnowledge: refreshed.playerKnowledge,
    }
  }

  function setChapterLock(chapterId: string, locked: boolean) {
    const chapterIds = readChapterIds()
    if (!chapterIds.includes(chapterId)) {
      throw new StateServiceError(404, `Unknown chapter "${chapterId}".`, 'not_found_error')
    }

    const campaign = readCampaignState()
    const nextLocked = new Set(readLockedChapters(campaign))
    if (locked) nextLocked.add(chapterId)
    else nextLocked.delete(chapterId)
    campaign.lockedChapters = Array.from(nextLocked)
    writeCampaignState(campaign)

    appendLog(logPath, {
      ts: new Date().toISOString(),
      action: 'chapter.lock',
      chapterId,
      targetType: 'chapter',
      targetId: chapterId,
      value: locked,
    })

    return {
      campaign,
      chapterList: readChapterList(),
    }
  }

  function mutateFact(chapterId: string, factId: string, revealed: boolean, action: 'fact.reveal' | 'fact.hide'): StateMutationResult {
    assertChapterWritable(readCampaignState(), chapterId)
    const factsPath = chapterFilePath(stateRoot, chapterId, 'facts')
    const facts = readRequiredChapterFile(stateRoot, chapterId, 'facts') as ChapterFactsState
    const fact = facts.facts.find((entry) => entry.id === factId)
    if (!fact) {
      throw new StateServiceError(404, `Unknown fact "${factId}" in ${chapterId}.`, 'not_found_error')
    }

    fact.knowledgeStatus = revealed ? 'revealed' : 'available'
    fact.revealed = revealed
    writeJsonAtomic(factsPath, facts)

    const handouts = (readOptionalChapterFile(stateRoot, chapterId, 'handouts') ?? { handouts: [] }) as ChapterHandoutsState
    const beats = (readOptionalChapterFile(stateRoot, chapterId, 'beats') ?? { beats: [] }) as ChapterBeatsState
    const refreshed = refreshDerivedChapterState(chapterId, facts, handouts, beats)

    appendLog(logPath, {
      ts: new Date().toISOString(),
      action,
      chapterId,
      targetType: 'fact',
      targetId: factId,
      value: revealed,
    })

    return {
      fact,
      worldThreads: refreshed.worldThreads,
      playerKnowledge: refreshed.playerKnowledge,
      progress: refreshed.progress,
    }
  }

  function mutateHandout(chapterId: string, handoutId: string, posted: boolean, action: 'handout.post' | 'handout.unpost'): StateMutationResult {
    assertChapterWritable(readCampaignState(), chapterId)
    const handoutsPath = chapterFilePath(stateRoot, chapterId, 'handouts')
    const handouts = readRequiredChapterFile(stateRoot, chapterId, 'handouts') as ChapterHandoutsState
    const handout = handouts.handouts.find((entry) => entry.id === handoutId)
    if (!handout) {
      throw new StateServiceError(404, `Unknown handout "${handoutId}" in ${chapterId}.`, 'not_found_error')
    }

    handout.posted = posted
    writeJsonAtomic(handoutsPath, handouts)

    const facts = readRequiredChapterFile(stateRoot, chapterId, 'facts') as ChapterFactsState
    const beats = (readOptionalChapterFile(stateRoot, chapterId, 'beats') ?? { beats: [] }) as ChapterBeatsState
    const refreshed = refreshDerivedChapterState(chapterId, facts, handouts, beats)

    appendLog(logPath, {
      ts: new Date().toISOString(),
      action,
      chapterId,
      targetType: 'handout',
      targetId: handoutId,
      value: posted,
    })

    return {
      handout,
      worldThreads: refreshed.worldThreads,
      playerKnowledge: refreshed.playerKnowledge,
      progress: refreshed.progress,
    }
  }

  function mutateBeat(chapterId: string, beatId: string, completed: boolean, action: 'beat.mark' | 'beat.unmark'): StateMutationResult {
    assertChapterWritable(readCampaignState(), chapterId)
    const beatsPath = chapterFilePath(stateRoot, chapterId, 'beats')
    const beats = readRequiredChapterFile(stateRoot, chapterId, 'beats') as ChapterBeatsState
    const beat = beats.beats.find((entry) => entry.id === beatId)
    if (!beat) {
      throw new StateServiceError(404, `Unknown beat "${beatId}" in ${chapterId}.`, 'not_found_error')
    }

    beat.completed = completed
    writeJsonAtomic(beatsPath, beats)

    const facts = readRequiredChapterFile(stateRoot, chapterId, 'facts') as ChapterFactsState
    const handouts = (readOptionalChapterFile(stateRoot, chapterId, 'handouts') ?? { handouts: [] }) as ChapterHandoutsState
    const refreshed = refreshDerivedChapterState(chapterId, facts, handouts, beats)

    appendLog(logPath, {
      ts: new Date().toISOString(),
      action,
      chapterId,
      targetType: 'beat',
      targetId: beatId,
      value: completed,
    })

    return {
      beat,
      worldThreads: refreshed.worldThreads,
      playerKnowledge: refreshed.playerKnowledge,
      progress: refreshed.progress,
    }
  }

  function mutateThreadStatus(chapterId: string, threadId: string, status: string): StateMutationResult {
    assertChapterWritable(readCampaignState(), chapterId)
    const worldThreadsPath = join(stateRoot, 'world-threads.json')
    const worldThreads = readJsonFile(worldThreadsPath)
    const thread = worldThreads.threads.find((entry: { id: string }) => entry.id === threadId)
    if (!thread) {
      throw new StateServiceError(404, `Unknown thread "${threadId}".`, 'not_found_error')
    }

    thread.currentStatus = status
    thread.statusSource = 'manual'
    writeJsonAtomic(worldThreadsPath, worldThreads)

    const facts = readRequiredChapterFile(stateRoot, chapterId, 'facts') as ChapterFactsState
    const handouts = (readOptionalChapterFile(stateRoot, chapterId, 'handouts') ?? { handouts: [] }) as ChapterHandoutsState
    const beats = (readOptionalChapterFile(stateRoot, chapterId, 'beats') ?? { beats: [] }) as ChapterBeatsState
    const refreshed = refreshDerivedChapterState(chapterId, facts, handouts, beats)

    appendLog(logPath, {
      ts: new Date().toISOString(),
      action: 'thread.set',
      chapterId,
      targetType: 'thread',
      targetId: threadId,
      value: status,
    })

    return {
      thread: { id: threadId, currentStatus: status },
      worldThreads: refreshed.worldThreads,
      playerKnowledge: refreshed.playerKnowledge,
      progress: refreshed.progress,
    }
  }

  return {
    readCampaignState,
    readPlayerKnowledge,
    readWorldThreads,
    readChapterList,
    readChapterState,
    revealFact(chapterId: string, factId: string): StateMutationResult {
      return mutateFact(chapterId, factId, true, 'fact.reveal')
    },
    hideFact(chapterId: string, factId: string): StateMutationResult {
      return mutateFact(chapterId, factId, false, 'fact.hide')
    },
    postHandout(chapterId: string, handoutId: string): StateMutationResult {
      return mutateHandout(chapterId, handoutId, true, 'handout.post')
    },
    unpostHandout(chapterId: string, handoutId: string): StateMutationResult {
      return mutateHandout(chapterId, handoutId, false, 'handout.unpost')
    },
    markBeat(chapterId: string, beatId: string): StateMutationResult {
      return mutateBeat(chapterId, beatId, true, 'beat.mark')
    },
    unmarkBeat(chapterId: string, beatId: string): StateMutationResult {
      return mutateBeat(chapterId, beatId, false, 'beat.unmark')
    },
    setThreadStatus(chapterId: string, threadId: string, status: string): StateMutationResult {
      return mutateThreadStatus(chapterId, threadId, status)
    },
    setCheckpoint(chapterId: string, checkpointIndex: number): CheckpointMutationResult {
      const progressPath = chapterFilePath(stateRoot, chapterId, 'progress')
      const progress = readRequiredChapterFile(stateRoot, chapterId, 'progress') as ChapterProgressState
      const checkpoint = progress.checkpoints.find((entry) => entry.index === checkpointIndex)
      if (!checkpoint) {
        throw new StateServiceError(404, `Unknown checkpoint index "${checkpointIndex}" in ${chapterId}.`, 'not_found_error')
      }

      progress.currentCheckpoint = checkpoint
      writeJsonAtomic(progressPath, progress)

      const campaignPath = join(stateRoot, 'campaign-state.json')
      const campaign = readJsonFile(campaignPath)
      campaign.progress = Object.assign({}, campaign.progress, { step: checkpointIndex })
      writeJsonAtomic(campaignPath, campaign)

      appendLog(logPath, {
        ts: new Date().toISOString(),
        action: 'checkpoint.set',
        chapterId,
        targetType: 'checkpoint',
        targetId: checkpoint.id,
        value: checkpointIndex,
      })

      return { progress }
    },
    setClock(value: number): ClockMutationResult {
      const campaignPath = join(stateRoot, 'campaign-state.json')
      const campaign = readJsonFile(campaignPath)
      const max = Number(campaign.clock && campaign.clock.max) || 16
      const nextValue = Math.max(0, Math.min(max, value))
      campaign.clock = Object.assign({}, campaign.clock, { value: nextValue })
      writeJsonAtomic(campaignPath, campaign)

      appendLog(logPath, {
        ts: new Date().toISOString(),
        action: 'clock.set',
        targetType: 'clock',
        targetId: 'campaign-clock',
        value: nextValue,
      })

      return { clock: campaign.clock }
    },
    setChapterLock(chapterId: string, locked: boolean) {
      return setChapterLock(chapterId, locked)
    },
    setCurrentChapter(chapterId: string, lockCurrent = false) {
      return setCurrentChapter(chapterId, lockCurrent)
    },
  }
}
