import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'fs'
import { randomUUID } from 'crypto'
import { dirname, join } from 'path'
import fg from 'fast-glob'
import matter from 'gray-matter'
import { PROPOSALS_ROOT, STATE_ROOT } from '../paths.js'
import { refreshChapterState } from './chapterRefresh.js'

type ChapterFileKey = 'progress' | 'facts' | 'handouts' | 'beats' | 'radar' | 'triggers' | 'scenes' | 'plan'

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

type ChapterPlanBeat = {
  id: string
  label: string
  desc: string
}

type ChapterPlanFact = {
  id: string
  label: string
  desc?: string
}

type ChapterPlanHandout = {
  id: string
  label: string
  desc?: string
}

type ChapterPlanScene = {
  id: string
  label: string
  kind: string
  order: number
  summary: string
  artifactRef?: string | null
  npcs?: string[]
  places?: string[]
  beats: ChapterPlanBeat[]
  facts: ChapterPlanFact[]
  handouts: ChapterPlanHandout[]
}

type ChapterPlanThread = {
  threadId: string
  hook: string
  cueSceneIds?: string[]
}

type ChapterPlanCheckpoint = {
  id: string
  index: number
  label: string
  sceneIds: string[]
  pauseLabel?: string | null
}

type ChapterPlan = {
  id: string
  type: 'chapter-plan'
  campaign: string
  chapterId: string
  source: string
  importStatus: string
  title: string
  updatedAt?: string
  notes?: string
  scenes: ChapterPlanScene[]
  threads: ChapterPlanThread[]
  checkpoints: ChapterPlanCheckpoint[]
}

type ProposalReferenceStatus = 'promoted' | 'reviewed' | 'proposed' | 'missing'

type ChapterPlanReferenceStatus = {
  proposalId: string
  status: ProposalReferenceStatus
  title?: string
  proposalType?: string
  reviewStatus?: string
  promoteTarget?: string
}

type ChapterPlanReadResult = {
  plan: ChapterPlan
  referenceStatuses: ChapterPlanReferenceStatus[]
}

type ChapterPlanMaterializeResult = {
  chapterId: string
  bundle: ChapterStateBundle
  writtenFiles: string[]
}

type ProposalRecord = {
  id: string
  title: string
  proposalType: string
  status: string
  reviewStatus: string
  promoteTarget: string
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

type SessionCloseSummary = {
  chapterId: string
  sessionId: number | string | null
  clock: {
    value: number
    max: number
  }
  coverage: {
    facts: { completed: number; total: number }
    handouts: { completed: number; total: number }
    beats: { completed: number; total: number }
    percent: number
  }
  openThreads: Array<{
    id: string
    name: string
    status: string
  }>
  exportPaths: string[]
}

type SessionCloseResult = {
  summary: SessionCloseSummary
  pathsWritten: string[]
  logEntry: {
    action: string
    targetId: string
  }
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
  plan: 'plan.json',
}

export class StateServiceError extends Error {
  statusCode: number
  type: string
  issues?: string[]

  constructor(statusCode: number, message: string, type = 'invalid_request_error', issues?: string[]) {
    super(message)
    this.statusCode = statusCode
    this.type = type
    this.issues = issues
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export interface StateService {
  readCampaignState(): any
  readPlayerKnowledge(): any
  readWorldThreads(): any
  readChapterList(): ChapterSummary[]
  readChapterState(chapterId: string): ChapterStateBundle
  readChapterPlan(chapterId: string): ChapterPlanReadResult
  writeChapterPlan(chapterId: string, plan: unknown): ChapterPlanReadResult
  patchChapterPlan(chapterId: string, patch: unknown): ChapterPlanReadResult
  materializeChapterPlan(chapterId: string): ChapterPlanMaterializeResult
  revealFact(chapterId: string, factId: string): StateMutationResult
  hideFact(chapterId: string, factId: string): StateMutationResult
  postHandout(chapterId: string, handoutId: string): StateMutationResult
  unpostHandout(chapterId: string, handoutId: string): StateMutationResult
  markBeat(chapterId: string, beatId: string): StateMutationResult
  unmarkBeat(chapterId: string, beatId: string): StateMutationResult
  setThreadStatus(chapterId: string, threadId: string, status: string): StateMutationResult
  setCheckpoint(chapterId: string, checkpointIndex: number): CheckpointMutationResult
  setClock(value: number): ClockMutationResult
  previewSessionClose(): { summary: SessionCloseSummary }
  closeSession(): SessionCloseResult
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

  function currentChapterId(campaign: CampaignState): string {
    if (typeof campaign.currentChapter !== 'number' || !Number.isInteger(campaign.currentChapter)) {
      throw new StateServiceError(400, 'Campaign state does not have a valid currentChapter.', 'invalid_request_error')
    }
    return `chapter-${campaign.currentChapter}`
  }

  function relativeStatePath(...parts: string[]): string {
    return join('corpus', 'state', ...parts)
  }

  function sessionClosePaths(chapterId: string, sessionId: number | string | null): { jsonPath: string; markdownPath: string; targetId: string } {
    const sessionLabel = sessionId == null ? 'session-unknown' : `session-${sessionId}`
    const targetId = `${sessionLabel}-${chapterId}`
    return {
      jsonPath: join(stateRoot, 'session-close', `${targetId}.summary.json`),
      markdownPath: join(stateRoot, 'session-close', `${targetId}.summary.md`),
      targetId,
    }
  }

  function buildSessionCloseSummary(): SessionCloseSummary {
    const campaign = readCampaignState()
    const chapterId = currentChapterId(campaign)
    const facts = readRequiredChapterFile(stateRoot, chapterId, 'facts') as ChapterFactsState
    const handouts = (readOptionalChapterFile(stateRoot, chapterId, 'handouts') ?? { handouts: [] }) as ChapterHandoutsState
    const beats = (readOptionalChapterFile(stateRoot, chapterId, 'beats') ?? { beats: [] }) as ChapterBeatsState
    const coverage = buildCoverage(facts, handouts, beats)
    const threads = readWorldThreads()
    const openThreads = Array.isArray(threads.threads)
      ? threads.threads
        .filter((thread: { currentStatus?: string }) => {
          const status = String(thread.currentStatus ?? '').toLowerCase()
          return status === 'hot' || status === 'simmering' || status === 'dormant'
        })
        .map((thread: { id: string; name?: string; currentStatus?: string }) => ({
          id: thread.id,
          name: thread.name ?? thread.id,
          status: String(thread.currentStatus ?? 'unknown'),
        }))
      : []
    const paths = sessionClosePaths(chapterId, campaign.currentSession ?? null)

    return {
      chapterId,
      sessionId: campaign.currentSession ?? null,
      clock: {
        value: Number(campaign.clock?.value) || 0,
        max: Number(campaign.clock?.max) || 16,
      },
      coverage,
      openThreads,
      exportPaths: [
        relativeStatePath('session-close', `${paths.targetId}.summary.json`),
        relativeStatePath('session-close', `${paths.targetId}.summary.md`),
      ],
    }
  }

  function renderSessionCloseMarkdown(summary: SessionCloseSummary): string {
    const threadLines = summary.openThreads.length
      ? summary.openThreads.map((thread) => `- ${thread.name} (\`${thread.id}\`) — ${thread.status}`).join('\n')
      : '- None'

    return [
      `# Session Close Summary`,
      '',
      `- Chapter: \`${summary.chapterId}\``,
      `- Session: \`${summary.sessionId ?? 'unknown'}\``,
      `- Clock: ${summary.clock.value}/${summary.clock.max}`,
      `- Coverage: ${summary.coverage.percent}%`,
      '',
      `## Coverage`,
      '',
      `- Facts: ${summary.coverage.facts.completed}/${summary.coverage.facts.total}`,
      `- Handouts: ${summary.coverage.handouts.completed}/${summary.coverage.handouts.total}`,
      `- Beats: ${summary.coverage.beats.completed}/${summary.coverage.beats.total}`,
      '',
      `## Open Threads`,
      '',
      threadLines,
      '',
      `## Export Paths`,
      '',
      ...summary.exportPaths.map((path) => `- \`${path}\``),
      '',
    ].join('\n')
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

  function createPlanScaffold(chapterId: string): ChapterPlan {
    const chapterNumber = chapterId.match(/^chapter-(\d+)$/)?.[1]
    return {
      id: `${chapterId}-plan`,
      type: 'chapter-plan',
      campaign: 'karsac',
      chapterId,
      source: 'authored',
      importStatus: 'live',
      title: chapterNumber ? `Chapter ${chapterNumber}` : chapterId,
      updatedAt: new Date().toISOString(),
      notes: '',
      scenes: [],
      threads: [],
      checkpoints: [],
    }
  }

  function assertChapterId(chapterId: string): void {
    if (!/^chapter-[A-Za-z0-9._-]+$/.test(chapterId)) {
      throw new StateServiceError(400, `Invalid chapter id "${chapterId}".`, 'invalid_request_error')
    }
  }

  function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }

  function asString(value: unknown, label: string): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new StateServiceError(400, `${label} must be a non-empty string.`, 'invalid_request_error')
    }
    return value.trim()
  }

  function asOptionalString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined
  }

  function asStringArray(value: unknown, label: string): string[] {
    if (value === undefined) return []
    if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || !entry.trim())) {
      throw new StateServiceError(400, `${label} must be an array of non-empty strings.`, 'invalid_request_error')
    }
    return value.map((entry) => entry.trim())
  }

  function normalizePlanBeat(value: unknown, index: number): ChapterPlanBeat {
    if (!isObject(value)) {
      throw new StateServiceError(400, `scenes[].beats[${index}] must be an object.`, 'invalid_request_error')
    }
    return {
      id: asString(value.id, `scenes[].beats[${index}].id`),
      label: asString(value.label, `scenes[].beats[${index}].label`),
      desc: asOptionalString(value.desc) ?? '',
    }
  }

  function normalizePlanFact(value: unknown, index: number): ChapterPlanFact {
    if (!isObject(value)) {
      throw new StateServiceError(400, `scenes[].facts[${index}] must be an object.`, 'invalid_request_error')
    }
    return {
      id: asString(value.id, `scenes[].facts[${index}].id`),
      label: asString(value.label, `scenes[].facts[${index}].label`),
      desc: asOptionalString(value.desc),
    }
  }

  function normalizePlanHandout(value: unknown, index: number): ChapterPlanHandout {
    if (!isObject(value)) {
      throw new StateServiceError(400, `scenes[].handouts[${index}] must be an object.`, 'invalid_request_error')
    }
    return {
      id: asString(value.id, `scenes[].handouts[${index}].id`),
      label: asString(value.label, `scenes[].handouts[${index}].label`),
      desc: asOptionalString(value.desc),
    }
  }

  function normalizePlanScene(value: unknown, index: number): ChapterPlanScene {
    if (!isObject(value)) {
      throw new StateServiceError(400, `scenes[${index}] must be an object.`, 'invalid_request_error')
    }
    if (!Number.isInteger(value.order)) {
      throw new StateServiceError(400, `scenes[${index}].order must be an integer.`, 'invalid_request_error')
    }
    const artifactRef = value.artifactRef == null ? null : asString(value.artifactRef, `scenes[${index}].artifactRef`)
    return {
      id: asString(value.id, `scenes[${index}].id`),
      label: asString(value.label, `scenes[${index}].label`),
      kind: asString(value.kind, `scenes[${index}].kind`),
      order: Number(value.order),
      summary: typeof value.summary === 'string' ? value.summary : '',
      artifactRef,
      npcs: asStringArray(value.npcs, `scenes[${index}].npcs`),
      places: asStringArray(value.places, `scenes[${index}].places`),
      beats: Array.isArray(value.beats) ? value.beats.map((entry, beatIndex) => normalizePlanBeat(entry, beatIndex)) : [],
      facts: Array.isArray(value.facts) ? value.facts.map((entry, factIndex) => normalizePlanFact(entry, factIndex)) : [],
      handouts: Array.isArray(value.handouts) ? value.handouts.map((entry, handoutIndex) => normalizePlanHandout(entry, handoutIndex)) : [],
    }
  }

  function normalizePlanThread(value: unknown, index: number): ChapterPlanThread {
    if (!isObject(value)) {
      throw new StateServiceError(400, `threads[${index}] must be an object.`, 'invalid_request_error')
    }
    return {
      threadId: asString(value.threadId, `threads[${index}].threadId`),
      hook: typeof value.hook === 'string' ? value.hook : '',
      cueSceneIds: asStringArray(value.cueSceneIds, `threads[${index}].cueSceneIds`),
    }
  }

  function normalizePlanCheckpoint(value: unknown, index: number): ChapterPlanCheckpoint {
    if (!isObject(value)) {
      throw new StateServiceError(400, `checkpoints[${index}] must be an object.`, 'invalid_request_error')
    }
    if (!Number.isInteger(value.index)) {
      throw new StateServiceError(400, `checkpoints[${index}].index must be an integer.`, 'invalid_request_error')
    }
    return {
      id: asString(value.id, `checkpoints[${index}].id`),
      index: Number(value.index),
      label: asString(value.label, `checkpoints[${index}].label`),
      sceneIds: asStringArray(value.sceneIds, `checkpoints[${index}].sceneIds`),
      pauseLabel: value.pauseLabel == null ? null : String(value.pauseLabel),
    }
  }

  function normalizeChapterPlan(chapterId: string, raw: unknown, base?: ChapterPlan): ChapterPlan {
    assertChapterId(chapterId)
    const scaffold = createPlanScaffold(chapterId)
    const source = base ?? scaffold
    if (!isObject(raw)) {
      throw new StateServiceError(400, 'Chapter plan payload must be an object.', 'invalid_request_error')
    }
    if (raw.chapterId !== undefined && raw.chapterId !== chapterId) {
      throw new StateServiceError(400, `Plan chapterId must match route chapter "${chapterId}".`, 'invalid_request_error')
    }

    const nextPlan: ChapterPlan = {
      ...source,
      id: `${chapterId}-plan`,
      type: 'chapter-plan',
      campaign: 'karsac',
      chapterId,
      source: 'authored',
      importStatus: 'live',
      title: raw.title !== undefined ? asString(raw.title, 'title') : source.title,
      updatedAt: new Date().toISOString(),
      notes: raw.notes !== undefined ? String(raw.notes) : (source.notes ?? ''),
      scenes: raw.scenes !== undefined
        ? (Array.isArray(raw.scenes) ? raw.scenes.map((entry, index) => normalizePlanScene(entry, index)) : (() => { throw new StateServiceError(400, 'scenes must be an array.', 'invalid_request_error') })())
        : source.scenes,
      threads: raw.threads !== undefined
        ? (Array.isArray(raw.threads) ? raw.threads.map((entry, index) => normalizePlanThread(entry, index)) : (() => { throw new StateServiceError(400, 'threads must be an array.', 'invalid_request_error') })())
        : source.threads,
      checkpoints: raw.checkpoints !== undefined
        ? (Array.isArray(raw.checkpoints) ? raw.checkpoints.map((entry, index) => normalizePlanCheckpoint(entry, index)) : (() => { throw new StateServiceError(400, 'checkpoints must be an array.', 'invalid_request_error') })())
        : source.checkpoints,
    }

    nextPlan.scenes = [...nextPlan.scenes].sort((a, b) => a.order - b.order)
    nextPlan.checkpoints = [...nextPlan.checkpoints].sort((a, b) => a.index - b.index)
    return nextPlan
  }

  function resolveProposalsRoot(): string {
    const candidates = [
      join(stateRoot, 'proposals'),
      join(stateRoot, 'corpus', 'proposals'),
      join(dirname(stateRoot), 'proposals'),
      PROPOSALS_ROOT,
    ]
    return candidates.find((candidate) => existsSync(candidate)) ?? PROPOSALS_ROOT
  }

  function readProposalIndex(): Map<string, ProposalRecord> {
    const proposalsRoot = resolveProposalsRoot()
    if (!existsSync(proposalsRoot)) return new Map()

    const files = fg.sync('**/*.proposed.md', { cwd: proposalsRoot, absolute: true })
    const proposals = new Map<string, ProposalRecord>()
    for (const filePath of files) {
      const parsed = matter(readFileSync(filePath, 'utf8'))
      const frontmatter = parsed.data as Record<string, unknown>
      const id = typeof frontmatter.id === 'string' ? frontmatter.id.trim() : ''
      if (!id) continue
      const reviewed = frontmatter.reviewed === true || frontmatter.review_status === 'approved'
      proposals.set(id, {
        id,
        title: typeof frontmatter.title === 'string' ? frontmatter.title : id,
        proposalType: typeof frontmatter.proposal_type === 'string' ? frontmatter.proposal_type : '',
        status: typeof frontmatter.status === 'string' ? frontmatter.status : 'proposed',
        reviewStatus: reviewed
          ? 'approved'
          : (typeof frontmatter.review_status === 'string' ? frontmatter.review_status : 'pending'),
        promoteTarget: typeof frontmatter.promote_target === 'string' ? frontmatter.promote_target : '',
      })
    }
    return proposals
  }

  function collectPlanReferenceIds(plan: ChapterPlan): string[] {
    const ids = new Set<string>()
    for (const scene of plan.scenes) {
      if (scene.artifactRef) ids.add(scene.artifactRef)
      for (const proposalId of scene.npcs ?? []) ids.add(proposalId)
      for (const proposalId of scene.places ?? []) ids.add(proposalId)
    }
    return Array.from(ids)
  }

  function annotatePlanReferences(plan: ChapterPlan): ChapterPlanReferenceStatus[] {
    const proposalIndex = readProposalIndex()
    return collectPlanReferenceIds(plan).map((proposalId) => {
      const proposal = proposalIndex.get(proposalId)
      if (!proposal) return { proposalId, status: 'missing' }
      const status: ProposalReferenceStatus = proposal.status === 'promoted'
        ? 'promoted'
        : proposal.reviewStatus === 'approved'
          ? 'reviewed'
          : 'proposed'
      return {
        proposalId,
        status,
        title: proposal.title,
        proposalType: proposal.proposalType,
        reviewStatus: proposal.reviewStatus,
        promoteTarget: proposal.promoteTarget,
      }
    })
  }

  function readChapterPlan(chapterId: string): ChapterPlanReadResult {
    assertChapterId(chapterId)
    const filePath = chapterFilePath(stateRoot, chapterId, 'plan')
    if (!existsSync(filePath)) {
      throw new StateServiceError(
        404,
        `No chapter plan exists for ${chapterId}. Save a plan to create ${join('corpus', 'state', 'chapters', chapterId, 'plan.json')}.`,
        'not_found_error',
      )
    }
    const plan = normalizeChapterPlan(chapterId, readJsonFile(filePath))
    return {
      plan,
      referenceStatuses: annotatePlanReferences(plan),
    }
  }

  function writeChapterPlan(chapterId: string, plan: unknown): ChapterPlanReadResult {
    const normalized = normalizeChapterPlan(chapterId, plan)
    writeJsonAtomic(chapterFilePath(stateRoot, chapterId, 'plan'), normalized)
    appendLog(logPath, {
      ts: new Date().toISOString(),
      action: 'chapter.plan.write',
      chapterId,
      targetType: 'chapter-plan',
      targetId: normalized.id,
    })
    return {
      plan: normalized,
      referenceStatuses: annotatePlanReferences(normalized),
    }
  }

  function patchChapterPlan(chapterId: string, patch: unknown): ChapterPlanReadResult {
    const current = existsSync(chapterFilePath(stateRoot, chapterId, 'plan'))
      ? normalizeChapterPlan(chapterId, readJsonFile(chapterFilePath(stateRoot, chapterId, 'plan')))
      : createPlanScaffold(chapterId)
    const normalized = normalizeChapterPlan(chapterId, patch, current)
    writeJsonAtomic(chapterFilePath(stateRoot, chapterId, 'plan'), normalized)
    appendLog(logPath, {
      ts: new Date().toISOString(),
      action: 'chapter.plan.patch',
      chapterId,
      targetType: 'chapter-plan',
      targetId: normalized.id,
    })
    return {
      plan: normalized,
      referenceStatuses: annotatePlanReferences(normalized),
    }
  }

  function materializeChapterPlan(chapterId: string): ChapterPlanMaterializeResult {
    const { plan, referenceStatuses } = readChapterPlan(chapterId)
    const referenceLookup = new Map(referenceStatuses.map((entry) => [entry.proposalId, entry]))
    const issues: string[] = []

    for (const scene of plan.scenes) {
      const refs = [
        scene.artifactRef ? { slot: 'artifactRef', proposalId: scene.artifactRef } : null,
        ...(scene.npcs ?? []).map((proposalId) => ({ slot: 'npcs', proposalId })),
        ...(scene.places ?? []).map((proposalId) => ({ slot: 'places', proposalId })),
      ].filter((entry): entry is { slot: string; proposalId: string } => Boolean(entry))

      for (const ref of refs) {
        const status = referenceLookup.get(ref.proposalId)?.status ?? 'missing'
        if (status !== 'promoted') {
          issues.push(`${scene.id} ${ref.slot} reference ${ref.proposalId} is ${status}, not promoted.`)
        }
      }
    }

    if (issues.length > 0) {
      throw new StateServiceError(409, `Cannot materialise ${chapterId} until all referenced artifacts are promoted.`, 'validation_error', issues)
    }

    const sceneLookup = new Map(plan.scenes.map((scene) => [scene.id, scene]))
    const worldThreads = readWorldThreads()
    const worldThreadById = new Map(
      Array.isArray(worldThreads?.threads)
        ? worldThreads.threads.map((thread: { id: string }) => [thread.id, thread])
        : [],
    )

    const facts = {
      id: `${chapterId}-facts`,
      type: 'chapter-facts',
      campaign: 'karsac',
      chapterId,
      source: 'chapter-plan',
      importStatus: 'live',
      facts: plan.scenes.flatMap((scene) => scene.facts.map((fact) => ({
        id: fact.id,
        label: fact.label,
        scene: scene.id,
        desc: fact.desc || fact.label,
        knowledgeStatus: 'available',
        revealed: false,
        type: 'chapter-fact',
        chapter: chapterId,
        source: 'chapter-plan',
        importStatus: 'live',
      }))),
    }

    const handouts = {
      id: `${chapterId}-handouts`,
      type: 'chapter-handouts',
      campaign: 'karsac',
      chapterId,
      source: 'chapter-plan',
      importStatus: 'live',
      handouts: plan.scenes.flatMap((scene) => scene.handouts.map((handout) => ({
        id: handout.id,
        label: handout.label,
        scene: scene.id,
        desc: handout.desc || handout.label,
        posted: false,
        visibility: 'player-facing-when-posted',
        type: 'chapter-handout',
        chapter: chapterId,
        source: 'chapter-plan',
        importStatus: 'live',
      }))),
    }

    const beats = {
      id: `${chapterId}-beats`,
      type: 'chapter-beats',
      campaign: 'karsac',
      chapterId,
      source: 'chapter-plan',
      importStatus: 'live',
      beats: plan.scenes.flatMap((scene) => scene.beats.map((beat) => ({
        id: beat.id,
        label: beat.label,
        scene: scene.id,
        desc: beat.desc || beat.label,
        completed: false,
        type: 'chapter-beat',
        chapter: chapterId,
        source: 'chapter-plan',
        importStatus: 'live',
      }))),
    }

    const scenes = {
      id: `${chapterId}-scenes`,
      type: 'chapter-scenes',
      campaign: 'karsac',
      chapterId,
      source: 'chapter-plan',
      importStatus: 'live',
      scenes: plan.scenes.map((scene) => ({
        id: scene.id,
        label: scene.label,
        kind: scene.kind,
        order: scene.order,
        meta: scene.kind,
        title: scene.label,
        summary: scene.summary || scene.label,
        facts: scene.facts.map((fact) => fact.id),
        handouts: scene.handouts.map((handout) => handout.id),
        beats: scene.beats.map((beat) => beat.id),
        blocks: [
          {
            type: 'paragraph',
            bodyHtml: `<p>${escapeHtml(scene.summary || scene.label)}</p>`,
          },
        ],
        notesMd: [
          scene.artifactRef ? `Artifact: \`${scene.artifactRef}\`` : '',
          (scene.npcs ?? []).length ? `NPCs: ${(scene.npcs ?? []).map((value) => `\`${value}\``).join(', ')}` : '',
          (scene.places ?? []).length ? `Places: ${(scene.places ?? []).map((value) => `\`${value}\``).join(', ')}` : '',
        ].filter(Boolean).join('\n') || null,
      })),
    }

    const checkpoints = [...plan.checkpoints].sort((a, b) => a.index - b.index).map((checkpoint) => ({
      id: checkpoint.id,
      index: checkpoint.index,
      label: checkpoint.label,
      pauseLabel: checkpoint.pauseLabel ?? null,
      pauseClass: null,
      recap: checkpoint.sceneIds
        .map((sceneId) => sceneLookup.get(sceneId)?.label)
        .filter((label): label is string => Boolean(label)),
    }))

    const progress = {
      id: `${chapterId}-progress`,
      type: 'chapter-progress',
      campaign: 'karsac',
      chapterId,
      source: 'chapter-plan',
      importStatus: 'live',
      currentCheckpoint: checkpoints[0] ?? {
        id: 'checkpoint-0',
        index: 0,
        label: 'Opening',
        pauseLabel: null,
        pauseClass: null,
        recap: [],
      },
      checkpoints,
      coverage: buildCoverage(facts, handouts, beats),
    }

    const radar = {
      id: `${chapterId}-radar`,
      type: 'chapter-radar',
      campaign: 'karsac',
      chapterId,
      source: 'chapter-plan',
      importStatus: 'live',
      radar: plan.threads.map((thread, index) => {
        const worldThread = worldThreadById.get(thread.threadId) as { name?: string; currentStatus?: string } | undefined
        const cueScenes = thread.cueSceneIds ?? []
        return {
          id: `${thread.threadId}-${index + 1}`,
          nav: thread.threadId,
          worldThreadId: thread.threadId,
          title: worldThread?.name || thread.threadId,
          surface: cueScenes.map((sceneId) => sceneLookup.get(sceneId)?.label || sceneId).join(', ') || plan.title,
          relation: thread.hook || 'Chapter thread',
          hook: thread.hook || 'Chapter thread',
          cueScenes,
          cueText: cueScenes.map((sceneId) => sceneLookup.get(sceneId)?.label || sceneId).join(', ') || 'No cue scenes assigned.',
          currentThreadStatus: typeof worldThread?.currentStatus === 'string' ? worldThread.currentStatus : 'dormant',
          type: 'chapter-radar-entry',
          chapter: chapterId,
        }
      }),
    }

    const triggers = {
      id: `${chapterId}-triggers`,
      type: 'chapter-triggers',
      campaign: 'karsac',
      chapterId,
      source: 'chapter-plan',
      importStatus: 'live',
      triggers: [],
    }

    const files: Array<[ChapterFileKey, unknown]> = [
      ['facts', facts],
      ['handouts', handouts],
      ['beats', beats],
      ['scenes', scenes],
      ['progress', progress],
      ['radar', radar],
      ['triggers', triggers],
    ]
    const writtenFiles = files.map(([key]) => join('corpus', 'state', 'chapters', chapterId, CHAPTER_FILES[key]))
    for (const [key, payload] of files) {
      writeJsonAtomic(chapterFilePath(stateRoot, chapterId, key), payload)
    }

    appendLog(logPath, {
      ts: new Date().toISOString(),
      action: 'chapter.materialize',
      chapterId,
      targetType: 'chapter',
      targetId: chapterId,
      value: {
        writtenFiles,
      },
    })

    return {
      chapterId,
      bundle: readChapterState(chapterId),
      writtenFiles,
    }
  }

  function refreshDerivedChapterState(chapterId: string, facts: ChapterFactsState, handouts: ChapterHandoutsState, beats: ChapterBeatsState) {
    const triggers = readOptionalChapterFile(stateRoot, chapterId, 'triggers') ?? { triggers: [] }
    const worldThreads = readJsonFile(join(stateRoot, 'world-threads.json'))
    const partyState = existsSync(join(stateRoot, 'party-state.json'))
      ? readJsonFile(join(stateRoot, 'party-state.json'))
      : { characters: [] }
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
    readChapterPlan,
    writeChapterPlan,
    patchChapterPlan,
    materializeChapterPlan,
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
    previewSessionClose() {
      return { summary: buildSessionCloseSummary() }
    },
    closeSession(): SessionCloseResult {
      const summary = buildSessionCloseSummary()
      const paths = sessionClosePaths(summary.chapterId, summary.sessionId)
      const markdown = renderSessionCloseMarkdown(summary)

      writeJsonAtomic(paths.jsonPath, summary)
      writeFileSync(paths.markdownPath, markdown, 'utf8')

      const logEntry = {
        ts: new Date().toISOString(),
        action: 'session.close',
        chapterId: summary.chapterId,
        targetType: 'session-close',
        targetId: paths.targetId,
        value: {
          exportPaths: summary.exportPaths,
          coverage: summary.coverage,
          sessionId: summary.sessionId,
        },
      }
      appendLog(logPath, logEntry)

      return {
        summary,
        pathsWritten: summary.exportPaths,
        logEntry: {
          action: logEntry.action,
          targetId: logEntry.targetId,
        },
      }
    },
    setChapterLock(chapterId: string, locked: boolean) {
      return setChapterLock(chapterId, locked)
    },
    setCurrentChapter(chapterId: string, lockCurrent = false) {
      return setCurrentChapter(chapterId, lockCurrent)
    },
  }
}
