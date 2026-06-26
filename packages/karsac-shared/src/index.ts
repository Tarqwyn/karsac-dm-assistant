export type ReadMode = 'live' | 'planning'
export type CorpusSource = 'collections' | 'planning' | 'external'
export type ReviewStatus = 'approved' | 'pending' | 'changes_requested'
export type ValidationStatus = 'pass' | 'warning' | 'fail'

export interface CorpusEntitySummary {
  id: string
  title: string
  type: string
  collection: string
  path: string
  source: CorpusSource
  canonical?: string
  visibility?: string
  summary?: string
  aliases: string[]
  related: Record<string, string[]>
}

export interface CorpusEntityDetail extends CorpusEntitySummary {
  visibleInMode: boolean
  contentPath: string
  content: string
}

export interface CorpusEntitiesResponse {
  mode: ReadMode
  query: string
  count: number
  entities: CorpusEntitySummary[]
}

export interface CorpusEntityResponse {
  mode: ReadMode
  entity: CorpusEntityDetail
}

export interface ProposalReviewState {
  reviewed: boolean
  review_status: ReviewStatus
  reviewed_at?: string
  review_notes?: string
}

export interface ProposalValidation {
  status: ValidationStatus
  issues: string[]
}

export interface ProposalSummary {
  id: string
  title: string
  proposalType: string
  status: string
  canonical: string
  visibility: string
  path: string
  summary: string
  promoteTarget: string
  sourcePrompt: string
  related: Record<string, string[]>
  validation: ProposalValidation
  review: ProposalReviewState
  updatedAt?: string
}

export interface ProposalDetail extends ProposalSummary {
  body: string
  frontmatter: Record<string, unknown>
}

export interface ProposalListResponse {
  mode: ReadMode
  count: number
  proposals: ProposalSummary[]
}

export interface ProposalDetailResponse {
  mode: ReadMode
  proposal: ProposalDetail
}

export interface ProposalPromotionResult {
  success?: boolean
  error?: string
  validationIssues?: string[]
  outputPath?: string
  promotedPath?: string
}

export interface ProposalPromotionResponse {
  mode: ReadMode
  result: ProposalPromotionResult
  proposal: ProposalDetail
}

export const PROPOSAL_TYPES = [
  'adversary', 'encounter', 'chapter-outline', 'session-outline',
  'scene', 'npc', 'place', 'item', 'clue', 'handout', 'state-update',
] as const

export type ProposalType = typeof PROPOSAL_TYPES[number]

export interface ProposalCreateRequest {
  type: ProposalType
  title: string
  summary?: string
}

export interface ProposalUpdateRequest {
  title?: string
  summary?: string
  body?: string
  related?: Record<string, string[]>
}

export interface ProposalGenerateRequest {
  type: ProposalType
  prompt: string
}

export interface ProposalGenerateResponse {
  mode: ReadMode
  validationStatus?: string
  proposal: ProposalDetail
}

export interface CampaignClock {
  value: number
  max?: number
  tiers?: Record<string, string>
  meaning?: string
}

export interface CampaignProgress {
  step?: number
  steps?: number
}

export interface CampaignState {
  currentChapter?: number | string | null
  session?: number | string | null
  currentSession?: number | string | null
  clock?: CampaignClock
  progress?: CampaignProgress
  [key: string]: unknown
}

export interface ChapterSummary {
  id: string
  current?: boolean
  locked?: boolean
  [key: string]: unknown
}

export interface CoverageCount {
  completed: number
  total: number
}

export interface ChapterCoverage {
  facts?: CoverageCount
  handouts?: CoverageCount
  beats?: CoverageCount
  percent?: number
}

export interface ChapterCheckpoint {
  id?: string
  index?: number
  label?: string
  pauseLabel?: string | null
  pauseClass?: string | null
  recap?: string[]
}

export interface ChapterProgressState {
  currentCheckpoint?: ChapterCheckpoint
  checkpoints?: ChapterCheckpoint[]
  coverage?: ChapterCoverage
}

export interface ChapterFact {
  id: string
  knowledgeStatus?: string
  revealed?: boolean
  [key: string]: unknown
}

export interface ChapterHandout {
  id: string
  label?: string
  desc?: string
  source?: string
  posted?: boolean
  [key: string]: unknown
}

export interface ChapterBeat {
  id: string
  label?: string
  desc?: string
  completed?: boolean
  [key: string]: unknown
}

export interface ChapterScene {
  id: string
  kind?: string
  order?: number
  label?: string
  title?: string
  summary?: string
  [key: string]: unknown
}

export type ProposalRefStatus = 'promoted' | 'reviewed' | 'proposed' | 'missing'

export interface ChapterPlanBeat {
  id: string
  label: string
  desc: string
}

export interface ChapterPlanFact {
  id: string
  label: string
  desc?: string
}

export interface ChapterPlanHandout {
  id: string
  label: string
  desc?: string
}

export type ChapterPlanTriggerEvent = 'fact' | 'beat' | 'handout'
export type ThreadStatus = 'hot' | 'simmering' | 'dormant' | 'closed' | 'abandoned'

export interface ChapterPlanTrigger {
  on: ChapterPlanTriggerEvent
  id: string
  threadId: string
  setStatus: ThreadStatus
}

export interface ChapterPlanScene {
  id: string
  label: string
  kind: string
  order: number
  summary: string
  artifactRef?: string | null
  npcs?: string[]
  places?: string[]
  adversaries?: string[]
  items?: string[]
  beats: ChapterPlanBeat[]
  facts: ChapterPlanFact[]
  handouts: ChapterPlanHandout[]
  triggers: ChapterPlanTrigger[]
}

export interface ChapterPlanThread {
  threadId: string
  hook: string
  cueSceneIds?: string[]
}

export interface ChapterPlanCheckpoint {
  id: string
  index: number
  label: string
  sceneIds: string[]
  pauseLabel?: string | null
}

export interface ChapterPlan {
  id: string
  type: 'chapter-plan'
  campaign: string
  chapterId: string
  source: string | string[]
  importStatus: string
  title: string
  updatedAt?: string
  notes?: string
  scenes: ChapterPlanScene[]
  threads: ChapterPlanThread[]
  checkpoints: ChapterPlanCheckpoint[]
}

export interface ChapterPlanReferenceStatus {
  proposalId: string
  status: ProposalRefStatus
  title?: string
  proposalType?: string
  reviewStatus?: ReviewStatus
  promoteTarget?: string
}

export interface ChapterPlanResponse {
  plan: ChapterPlan
  referenceStatuses: ChapterPlanReferenceStatus[]
}

export interface ChapterPlanMaterializeResponse {
  chapterId: string
  bundle: ChapterBundle
  writtenFiles: string[]
}

export interface ChapterCollection {
  id: string
  type: string
  chapterId: string
  [key: string]: unknown
}

export interface ChapterFactsState extends ChapterCollection {
  facts: ChapterFact[]
}

export interface ChapterHandoutsState extends ChapterCollection {
  handouts: ChapterHandout[]
}

export interface ChapterBeatsState extends ChapterCollection {
  beats: ChapterBeat[]
}

export interface ChapterScenesState extends ChapterCollection {
  scenes: ChapterScene[]
}

export interface ChapterBundle {
  chapterId: string
  title?: string
  summary?: string
  progress?: ChapterProgressState
  facts?: ChapterFactsState
  handouts?: ChapterHandoutsState
  beats?: ChapterBeatsState
  scenes?: ChapterScenesState
  [key: string]: unknown
}

export interface ChapterListResponse {
  chapters: ChapterSummary[]
}

export interface WorldThread {
  id: string
  name: string
  currentStatus: string
  summary?: string
  [key: string]: unknown
}

export interface WorldThreadsState {
  threads: WorldThread[]
  [key: string]: unknown
}

export interface TrackerMutationResult {
  fact?: ChapterFact
  handout?: ChapterHandout
  beat?: ChapterBeat
  thread?: { id: string; currentStatus: string }
  worldThreads: WorldThreadsState
  playerKnowledge: Record<string, unknown>
  progress: ChapterProgressState | null
}

export interface CheckpointMutationResult {
  progress: ChapterProgressState
}

export interface ClockMutationResult {
  clock: CampaignClock
}

export interface SetCurrentChapterResult {
  campaign: CampaignState
  chapter: ChapterBundle
  chapterList: ChapterSummary[]
  worldThreads: WorldThreadsState
  playerKnowledge: Record<string, unknown>
}

export interface SetChapterLockResult {
  campaign: CampaignState
  chapterList: ChapterSummary[]
}

export interface SessionCloseSummary {
  chapterId: string
  sessionId: number | string | null
  clock: {
    value: number
    max: number
  }
  coverage: {
    facts: CoverageCount
    handouts: CoverageCount
    beats: CoverageCount
    percent: number
  }
  openThreads: Array<{
    id: string
    name: string
    status: string
  }>
  exportPaths: string[]
}

export interface SessionClosePreviewResponse {
  summary: SessionCloseSummary
}

export interface SessionCloseResponse {
  summary: SessionCloseSummary
  pathsWritten: string[]
  logEntry: {
    action: string
    targetId: string
  }
}
