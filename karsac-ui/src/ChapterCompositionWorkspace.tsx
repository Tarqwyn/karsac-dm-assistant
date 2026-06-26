import { useEffect, useMemo, useState } from 'react'
import type React from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  closestCenter,
  type CollisionDetection,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type {
  ChapterBundle,
  ChapterSummary,
  ChapterPlan,
  ChapterPlanBeat,
  ChapterPlanCheckpoint,
  ChapterPlanFact,
  ChapterPlanHandout,
  ChapterPlanScene,
  ChapterPlanTrigger,
  ProposalResolveItem,
  ProposalSummary,
  ThreadStatus,
  WorldThread,
  ProposalType,
} from '@karsac/shared'
import { CHAPTER_SCENE_RELATIONSHIPS } from '@karsac/shared'
import { createProposal, fetchProposal, generateProposal, resolveProposals } from './api'
import { ProposalFormShell } from './ProposalFormShell'

type WorkspaceError = Error & { scaffold?: Record<string, unknown>; statusCode?: number }
type TriggerEvent = ChapterPlanTrigger['on']

const THREAD_STATUSES: ThreadStatus[] = ['dormant', 'simmering', 'hot', 'closed', 'abandoned']

type Props = {
  chapterId: string
  chapters: ChapterSummary[]
  onSelectChapter: (chapterId: string) => void
  chapterDetail: ChapterBundle | null
  chapterPlanData: { plan: ChapterPlan } | null
  chapterPlanError: unknown
  chapterPlanLoading: boolean
  proposals: ProposalSummary[]
  worldThreads: WorldThread[]
  notice: string
  error: string
  busy: boolean
  onSave: (plan: ChapterPlan) => Promise<void>
  onMaterialize: () => Promise<void>
}

type CatalogFilter = 'all' | 'chapter-outline' | 'scene' | 'encounter' | 'npc' | 'place' | 'adversary' | 'item' | 'clue' | 'handout' | 'faction'
type DragData = { kind: 'scene'; sceneId: string } | { kind: 'proposal'; proposalId: string; proposalType: string }
type Readiness = 'ready' | 'needs-review' | 'needs-promotion' | 'no-artifact'

const CATALOG_FILTERS: CatalogFilter[] = ['all', 'chapter-outline', 'scene', 'encounter', 'npc', 'place', 'adversary', 'item', 'clue', 'handout', 'faction']
const RELATIONSHIP_TYPES = new Set(CHAPTER_SCENE_RELATIONSHIPS.map((rel) => rel.proposalType))
const ARTIFACT_TYPES = new Set(['scene', 'encounter'])
const CHAPTER_SOURCE_TYPES = new Set(['chapter-outline'])

const atelierCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args)
  return pointerCollisions.length > 0 ? pointerCollisions : closestCenter(args)
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
    workingSet: [],
    scenes: [],
    threads: [],
    checkpoints: [],
  }
}

function proposalRefStatus(proposal: ProposalSummary | undefined): 'promoted' | 'reviewed' | 'proposed' | 'missing' {
  if (!proposal) return 'missing'
  if (proposal.status === 'promoted') return 'promoted'
  if (proposal.review?.reviewed || proposal.review?.review_status === 'approved') return 'reviewed'
  return 'proposed'
}

function proposalStatusClass(status: string): string {
  return status === 'promoted'
    ? 'status-chip proposal-promoted'
    : status === 'reviewed'
      ? 'status-chip proposal-reviewed'
      : status === 'proposed'
        ? 'status-chip proposal-proposed'
        : 'status-chip proposal-missing'
}

function proposalValidationClass(status: string): string {
  return `status-chip validation-${status || 'warning'}`
}

function proposalSlug(value: string): string {
  const parts = value.split('/').filter(Boolean)
  return parts[parts.length - 1] || value
}

function relationshipForSlot(slot: string): typeof CHAPTER_SCENE_RELATIONSHIPS[number] | undefined {
  return CHAPTER_SCENE_RELATIONSHIPS.find((r) => r.relatedKey === slot || r.planField === slot)
}

function clonePlan<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function nextSceneId(scenes: ChapterPlanScene[]): string {
  const next = scenes.length + 1
  return `scene-${next}`
}

function nextItemId(prefix: string, items: Array<{ id: string }>): string {
  let index = items.length + 1
  let candidate = `${prefix}-${index}`
  const used = new Set(items.map((item) => item.id))
  while (used.has(candidate)) {
    index += 1
    candidate = `${prefix}-${index}`
  }
  return candidate
}

function appendUniqueRef(refs: string[] | undefined, proposalId: string): string[] {
  const current = refs ?? []
  return current.includes(proposalId) ? current : [...current, proposalId]
}

function appendRelationshipRef(scene: ChapterPlanScene, planField: keyof ChapterPlanScene, proposalId: string): void {
  switch (planField) {
    case 'npcs':
      scene.npcs = appendUniqueRef(scene.npcs, proposalId)
      return
    case 'places':
      scene.places = appendUniqueRef(scene.places, proposalId)
      return
    case 'adversaries':
      scene.adversaries = appendUniqueRef(scene.adversaries, proposalId)
      return
    case 'items':
      scene.items = appendUniqueRef(scene.items, proposalId)
      return
    case 'clueRefs':
      scene.clueRefs = appendUniqueRef(scene.clueRefs, proposalId)
      return
    case 'handoutRefs':
      scene.handoutRefs = appendUniqueRef(scene.handoutRefs, proposalId)
      return
    case 'factionRefs':
      scene.factionRefs = appendUniqueRef(scene.factionRefs, proposalId)
      return
    default:
      return
  }
}

function removeRelationshipRef(scene: ChapterPlanScene, planField: keyof ChapterPlanScene, proposalId: string): void {
  switch (planField) {
    case 'npcs':
      scene.npcs = (scene.npcs ?? []).filter((id) => id !== proposalId)
      return
    case 'places':
      scene.places = (scene.places ?? []).filter((id) => id !== proposalId)
      return
    case 'adversaries':
      scene.adversaries = (scene.adversaries ?? []).filter((id) => id !== proposalId)
      return
    case 'items':
      scene.items = (scene.items ?? []).filter((id) => id !== proposalId)
      return
    case 'clueRefs':
      scene.clueRefs = (scene.clueRefs ?? []).filter((id) => id !== proposalId)
      return
    case 'handoutRefs':
      scene.handoutRefs = (scene.handoutRefs ?? []).filter((id) => id !== proposalId)
      return
    case 'factionRefs':
      scene.factionRefs = (scene.factionRefs ?? []).filter((id) => id !== proposalId)
      return
    default:
      return
  }
}

function glyphForType(type: string): string {
  if (type === 'scene') return 'Sc'
  if (type === 'chapter-outline') return 'Ch'
  if (type === 'encounter') return 'En'
  if (type === 'npc') return 'NPC'
  if (type === 'place') return 'Pl'
  if (type === 'adversary') return 'Adv'
  if (type === 'item') return 'It'
  if (type === 'clue') return 'Cl'
  if (type === 'handout') return 'Ho'
  if (type === 'faction') return 'Fa'
  return type.slice(0, 2).toUpperCase()
}

function readinessClass(readiness: Readiness): string {
  if (readiness === 'ready') return 'readiness readiness-ready'
  if (readiness === 'needs-review') return 'readiness readiness-review'
  if (readiness === 'needs-promotion') return 'readiness readiness-promotion'
  return 'readiness readiness-empty'
}

function readinessLabel(readiness: Readiness): string {
  if (readiness === 'ready') return 'Ready'
  if (readiness === 'needs-review') return 'Needs review'
  if (readiness === 'needs-promotion') return 'Needs promotion'
  return 'No artifact'
}

function DroppableZone({
  id,
  accepts,
  activeProposalType,
  children,
}: {
  id: string
  accepts: Set<string>
  activeProposalType: string
  children: React.ReactNode
}): JSX.Element {
  const { isOver, setNodeRef } = useDroppable({ id })
  const active = Boolean(activeProposalType && accepts.has(activeProposalType))
  return (
    <div ref={setNodeRef} className={`atelier-drop-zone ${active ? 'can-drop' : ''} ${isOver && active ? 'over' : ''}`}>
      {children}
    </div>
  )
}

function ProposalCard({ proposal }: { proposal: ProposalSummary }): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `proposal:${proposal.id}`,
    data: { kind: 'proposal', proposalId: proposal.id, proposalType: proposal.proposalType } satisfies DragData,
  })
  const status = proposalRefStatus(proposal)
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined
  return (
    <div
      ref={setNodeRef}
      className={`atelier-prop-card prop-${status} ${isDragging ? 'dragging' : ''}`}
      style={style}
      {...attributes}
      {...listeners}
    >
      <div className="atelier-prop-glyph">{glyphForType(proposal.proposalType)}</div>
      <div className="atelier-prop-main">
        <strong>{proposal.title}</strong>
        <span className="entity-id">{proposal.id}</span>
        <span>{proposal.summary || 'No summary.'}</span>
      </div>
      <div className="atelier-prop-status">
        <span className={proposalStatusClass(status)}>{status}</span>
        <span className={proposalValidationClass(proposal.validation.status)}>
          {proposal.validation.status}{proposal.validation.issues.length ? ` ${proposal.validation.issues.length}` : ''}
        </span>
      </div>
    </div>
  )
}

function SortableSceneCard({
  scene,
  children,
}: {
  scene: ChapterPlanScene
  children: React.ReactNode
}): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `scene:${scene.id}`,
    data: { kind: 'scene', sceneId: scene.id } satisfies DragData,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  return (
    <article ref={setNodeRef} className={`atelier-scene-card ${isDragging ? 'dragging' : ''}`} style={style}>
      <button className="atelier-drag-handle" type="button" {...attributes} {...listeners} aria-label={`Reorder ${scene.label}`}>
        ::
      </button>
      {children}
    </article>
  )
}

function errorScaffold(error: unknown, chapterId: string): ChapterPlan {
  const candidate = (error as WorkspaceError | null)?.scaffold
  if (candidate && typeof candidate === 'object') {
    return candidate as ChapterPlan
  }
  return createPlanScaffold(chapterId)
}

function errorMessage(value: unknown, fallback: string): string {
  return value instanceof Error ? value.message : fallback
}

function parseSceneSpine(body: string): Array<{ label: string; summary: string }> {
  const spineStart = body.search(/^##\s+Scene Spine\s*$/im)
  if (spineStart < 0) return []
  const spineBody = body.slice(spineStart)
  const nextSection = spineBody.slice(1).search(/^##\s+/m)
  const section = nextSection >= 0 ? spineBody.slice(0, nextSection + 1) : spineBody
  const scenes: Array<{ heading: string; lines: string[] }> = []
  for (const line of section.split('\n')) {
    const heading = line.match(/^###\s+(.+?)\s*$/)
    if (heading) {
      scenes.push({ heading: heading[1].trim(), lines: [] })
      continue
    }
    scenes[scenes.length - 1]?.lines.push(line)
  }
  return scenes.map((scene) => {
    const label = scene.heading.replace(/^Scene\s+\d+\s+[—-]\s+/i, '').trim() || scene.heading
    const summary = scene.lines
      .map((line) => line.replace(/^[-*]\s*/, '').trim())
      .filter(Boolean)
      .slice(0, 3)
      .join(' ')
    return { label, summary }
  }).filter((scene) => scene.label)
}

export function ChapterCompositionWorkspace({
  chapterId,
  chapters,
  onSelectChapter,
  chapterDetail,
  chapterPlanData,
  chapterPlanError,
  chapterPlanLoading,
  proposals,
  worldThreads,
  notice,
  error,
  busy,
  onSave,
  onMaterialize,
}: Props): JSX.Element {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const urlSegment = searchParams.get('segment') ?? ''
  const urlRelationship = searchParams.get('relationship') ?? ''
  const urlCreatedProposal = searchParams.get('createdProposal') ?? ''
  const urlParent = searchParams.get('parent') ?? ''

  const [plan, setPlan] = useState<ChapterPlan>(() => createPlanScaffold(chapterId))
  const [selectedSceneId, setSelectedSceneId] = useState('')
  const [expandedSceneIds, setExpandedSceneIds] = useState<Set<string>>(new Set())
  const [catalogFilter, setCatalogFilter] = useState<CatalogFilter>('all')
  const [enrolOpen, setEnrolOpen] = useState(false)
  const [enrolQuery, setEnrolQuery] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerType, setDrawerType] = useState<ProposalType>('npc')
  const [drawerError, setDrawerError] = useState('')
  const [drawerPending, setDrawerPending] = useState(false)
  const [localProposals, setLocalProposals] = useState<ProposalSummary[]>([])
  const [dirty, setDirty] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'issues'>('idle')
  const [validationIssues, setValidationIssues] = useState<string[]>([])
  const [activeProposalType, setActiveProposalType] = useState('')
  const [activeProposalId, setActiveProposalId] = useState('')
  const [resolvedRelations, setResolvedRelations] = useState<ProposalResolveItem[]>([])

  useEffect(() => {
    if (chapterPlanData?.plan) {
      setPlan(chapterPlanData.plan)
      setDirty(false)
      setSaveState('idle')
      setValidationIssues([])
      setSelectedSceneId((current) => {
        if (urlSegment && chapterPlanData.plan.scenes.some((s) => s.id === urlSegment)) return urlSegment
        return current || chapterPlanData.plan.scenes[0]?.id || ''
      })
      return
    }
    if ((chapterPlanError as WorkspaceError | null)?.statusCode === 404) {
      const scaffold = errorScaffold(chapterPlanError, chapterId)
      setPlan(scaffold)
      setDirty(false)
      setSelectedSceneId(scaffold.scenes[0]?.id || '')
      return
    }
    setPlan(createPlanScaffold(chapterId))
    setDirty(false)
    setSelectedSceneId('')
  }, [chapterId, chapterPlanData, chapterPlanError, urlSegment])

  const allProposals = useMemo(() => {
    const merged = new Map(proposals.map((proposal) => [proposal.id, proposal]))
    for (const proposal of localProposals) merged.set(proposal.id, proposal)
    return Array.from(merged.values())
  }, [localProposals, proposals])
  const proposalMap = useMemo(() => new Map(allProposals.map((proposal) => [proposal.id, proposal])), [allProposals])
  const sceneProposals = useMemo(() => allProposals.filter((proposal) => proposal.proposalType === 'scene'), [allProposals])
  const encounterProposals = useMemo(() => allProposals.filter((proposal) => proposal.proposalType === 'encounter'), [allProposals])
  const npcProposals = useMemo(() => allProposals.filter((proposal) => proposal.proposalType === 'npc'), [allProposals])
  const placeProposals = useMemo(() => allProposals.filter((proposal) => proposal.proposalType === 'place'), [allProposals])
  const adversaryProposals = useMemo(() => allProposals.filter((proposal) => proposal.proposalType === 'adversary'), [allProposals])
  const itemProposals = useMemo(() => allProposals.filter((proposal) => proposal.proposalType === 'item'), [allProposals])
  const clueProposals = useMemo(() => allProposals.filter((proposal) => proposal.proposalType === 'clue'), [allProposals])
  const handoutRefProposals = useMemo(() => allProposals.filter((proposal) => proposal.proposalType === 'handout'), [allProposals])
  const factionProposals = useMemo(() => allProposals.filter((proposal) => proposal.proposalType === 'faction'), [allProposals])
  const assignedArtifactIds = useMemo(
    () => new Set(plan.scenes.flatMap((scene) => scene.artifactRef ? [scene.artifactRef] : [])),
    [plan.scenes],
  )
  const availableSceneProposals = useMemo(
    () => sceneProposals.filter((proposal) => !assignedArtifactIds.has(proposal.id)),
    [assignedArtifactIds, sceneProposals],
  )
  const availableEncounterProposals = useMemo(
    () => encounterProposals.filter((proposal) => !assignedArtifactIds.has(proposal.id)),
    [assignedArtifactIds, encounterProposals],
  )
  const selectedScene = plan.scenes.find((scene) => scene.id === selectedSceneId) || plan.scenes[0] || null
  const selectedArtifact = selectedScene?.artifactRef ? proposalMap.get(selectedScene.artifactRef) : undefined

  const artifactRelatedIds = useMemo(() => {
    if (!selectedArtifact) return []
    return CHAPTER_SCENE_RELATIONSHIPS.flatMap((rel) => selectedArtifact.related?.[rel.relatedKey] ?? [])
  }, [selectedArtifact])

  useEffect(() => {
    if (!artifactRelatedIds.length) {
      setResolvedRelations([])
      return
    }
    let cancelled = false
    resolveProposals(artifactRelatedIds).then((result) => {
      if (!cancelled) setResolvedRelations(result.items)
    }).catch(() => { /* resolver failure is non-fatal */ })
    return () => { cancelled = true }
  }, [artifactRelatedIds])

  const unresolvedArtifactRelations = useMemo(() => {
    if (!selectedArtifact || !selectedScene) return []
    return CHAPTER_SCENE_RELATIONSHIPS.flatMap((rel) => {
      const related = selectedArtifact.related?.[rel.relatedKey] ?? []
      if (!related.length) return []
      const sceneField = selectedScene[rel.planField]
      const attached = new Set(Array.isArray(sceneField) ? (sceneField as string[]) : [])
      return related
        .filter((rawId) => {
          const resolved = resolvedRelations.find((item) => item.queryId === rawId)
          if (!resolved || resolved.state === 'missing' || resolved.state === 'ambiguous') return true
          return !attached.has(resolved.id)
        })
        .map((rawId) => {
          const resolved = resolvedRelations.find((item) => item.queryId === rawId)
          return {
            slot: rel.relatedKey,
            planField: rel.planField,
            rawId,
            resolvedId: resolved && (resolved.state === 'proposal' || resolved.state === 'promoted') ? resolved.id : rawId,
            title: resolved?.title ?? rawId,
            proposalType: rel.proposalType,
            state: resolved?.state ?? 'missing',
          }
        })
    })
  }, [resolvedRelations, selectedArtifact, selectedScene])

  const unresolvedRefs = useMemo(() => {
    const refs = plan.scenes.flatMap((scene) => [
      scene.artifactRef,
      ...(scene.npcs ?? []),
      ...(scene.places ?? []),
      ...(scene.adversaries ?? []),
      ...(scene.items ?? []),
      ...(scene.clueRefs ?? []),
      ...(scene.handoutRefs ?? []),
      ...(scene.factionRefs ?? []),
    ].filter((value): value is string => Boolean(value)))
    return refs.filter((proposalId) => proposalRefStatus(proposalMap.get(proposalId)) !== 'promoted')
  }, [plan.scenes, proposalMap])

  const pendingAttach = useMemo(() => {
    if (!urlCreatedProposal || !urlRelationship || !urlSegment) return null
    const rel = relationshipForSlot(urlRelationship)
    if (!rel) return null
    const scene = plan.scenes.find((s) => s.id === urlSegment)
    if (!scene) return null
    const current = scene[rel.planField]
    if (Array.isArray(current) && (current as string[]).includes(urlCreatedProposal)) return null
    return { proposalId: urlCreatedProposal, planField: rel.planField, sceneId: urlSegment, label: rel.label }
  }, [urlCreatedProposal, urlRelationship, urlSegment, plan.scenes])

  const workingSet = plan.workingSet ?? []
  const workingSetProposals = useMemo(
    () => workingSet.map((id) => proposalMap.get(id)).filter((proposal): proposal is ProposalSummary => Boolean(proposal)),
    [proposalMap, workingSet],
  )
  const catalogProposals = useMemo(
    () => workingSetProposals.filter((proposal) => catalogFilter === 'all' || proposal.proposalType === catalogFilter),
    [catalogFilter, workingSetProposals],
  )
  const enrolCandidates = useMemo(() => {
    const query = enrolQuery.trim().toLowerCase()
    return allProposals.filter((proposal) => {
      if (workingSet.includes(proposal.id)) return false
      if (!query) return true
      return `${proposal.title} ${proposal.id} ${proposal.proposalType}`.toLowerCase().includes(query)
    })
  }, [allProposals, enrolQuery, workingSet])
  const selectedChapter = chapters.find((chapter) => chapter.id === chapterId)
  const readOnly = selectedChapter?.locked === true
  const readySceneCount = useMemo(
    () => plan.scenes.filter((scene) => sceneReadiness(scene).state === 'ready').length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan.scenes, proposalMap],
  )
  const beatCount = useMemo(() => plan.scenes.reduce((total, scene) => total + scene.beats.length, 0), [plan.scenes])
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function updatePlan(mutator: (current: ChapterPlan) => ChapterPlan): void {
    setPlan((current) => mutator(clonePlan(current)))
    setDirty(true)
    setSaveState('idle')
  }

  function updateScene(sceneId: string, mutator: (scene: ChapterPlanScene) => void): void {
    updatePlan((current) => {
      const scene = current.scenes.find((entry) => entry.id === sceneId)
      if (scene) mutator(scene)
      return current
    })
  }

  function ensureWorkingSet(proposalId: string): void {
    updatePlan((current) => {
      current.workingSet = appendUniqueRef(current.workingSet, proposalId)
      return current
    })
  }

  function sceneRefs(scene: ChapterPlanScene): Array<{ label: string; proposalId: string; status: ReturnType<typeof proposalRefStatus> }> {
    const refs: Array<{ label: string; proposalId: string; status: ReturnType<typeof proposalRefStatus> }> = []
    if (scene.artifactRef) {
      refs.push({ label: 'Artifact', proposalId: scene.artifactRef, status: proposalRefStatus(proposalMap.get(scene.artifactRef)) })
    }
    for (const rel of CHAPTER_SCENE_RELATIONSHIPS) {
      const values = scene[rel.planField]
      if (!Array.isArray(values)) continue
      for (const proposalId of values as string[]) {
        refs.push({ label: rel.label, proposalId, status: proposalRefStatus(proposalMap.get(proposalId)) })
      }
    }
    return refs
  }

  function sceneReadiness(scene: ChapterPlanScene): { state: Readiness; refs: ReturnType<typeof sceneRefs> } {
    const refs = sceneRefs(scene)
    if (!scene.artifactRef) return { state: 'no-artifact', refs }
    if (refs.some((ref) => ref.status === 'proposed' || ref.status === 'missing')) return { state: 'needs-review', refs }
    if (refs.some((ref) => ref.status === 'reviewed')) return { state: 'needs-promotion', refs }
    return { state: 'ready', refs }
  }

  function toggleExpanded(sceneId: string): void {
    setExpandedSceneIds((current) => {
      const next = new Set(current)
      if (next.has(sceneId)) next.delete(sceneId)
      else next.add(sceneId)
      return next
    })
  }

  async function resolveRelatedIds(proposal: ProposalSummary | undefined, relation: typeof CHAPTER_SCENE_RELATIONSHIPS[number]): Promise<string[]> {
    const rawIds = proposal?.related?.[relation.relatedKey] ?? []
    if (!rawIds.length) return []
    try {
      const result = await resolveProposals(rawIds)
      return result.items
        .filter((item) => (item.state === 'proposal' || item.state === 'promoted') && item.proposalType === relation.proposalType)
        .map((item) => item.id)
    } catch {
      return []
    }
  }

  async function addSegment(proposal?: ProposalSummary): Promise<void> {
    const sceneId = nextSceneId(plan.scenes)
    const relatedEntries = await Promise.all(
      CHAPTER_SCENE_RELATIONSHIPS.map(async (relation) => [relation.planField, await resolveRelatedIds(proposal, relation)] as const),
    )
    const related = Object.fromEntries(relatedEntries) as Record<string, string[]>
    updatePlan((current) => {
      current.scenes.push({
        id: sceneId,
        label: proposal?.title || `Segment ${current.scenes.length + 1}`,
        kind: current.scenes.length === 0 ? 'opening' : 'middle',
        order: (current.scenes[current.scenes.length - 1]?.order ?? 0) + 10,
        summary: proposal?.summary || '',
        artifactRef: proposal?.id || null,
        npcs: related.npcs ?? [],
        places: related.places ?? [],
        adversaries: related.adversaries ?? [],
        items: related.items ?? [],
        clueRefs: related.clueRefs ?? [],
        handoutRefs: related.handoutRefs ?? [],
        factionRefs: related.factionRefs ?? [],
        beats: [],
        facts: [],
        handouts: [],
        triggers: [],
      })
      return current
    })
    setSelectedSceneId(sceneId)
  }

  function addBlankSegment(): void {
    const sceneId = nextSceneId(plan.scenes)
    updatePlan((current) => {
      current.scenes.push({
        id: sceneId,
        label: `Segment ${current.scenes.length + 1}`,
        kind: current.scenes.length === 0 ? 'opening' : 'middle',
        order: (current.scenes[current.scenes.length - 1]?.order ?? 0) + 10,
        summary: '',
        artifactRef: null,
        npcs: [],
        places: [],
        adversaries: [],
        items: [],
        clueRefs: [],
        handoutRefs: [],
        factionRefs: [],
        beats: [],
        facts: [],
        handouts: [],
        triggers: [],
      })
      return current
    })
    setSelectedSceneId(sceneId)
    setExpandedSceneIds((current) => new Set(current).add(sceneId))
  }

  async function importChapterOutline(proposal: ProposalSummary): Promise<void> {
    try {
      const detail = await fetchProposal(proposal.id, 'planning')
      const outlineScenes = parseSceneSpine(detail.proposal.body)
      const scenesToAdd = outlineScenes.length > 0
        ? outlineScenes
        : [{ label: proposal.title, summary: proposal.summary || 'Chapter outline dropped from the working set.' }]
      let firstCreatedSceneId = ''

      updatePlan((current) => {
        const startIndex = current.scenes.length
        for (const [index, outlineScene] of scenesToAdd.entries()) {
          const sceneId = nextSceneId(current.scenes)
          if (!firstCreatedSceneId) firstCreatedSceneId = sceneId
          current.scenes.push({
            id: sceneId,
            label: outlineScene.label,
            kind: startIndex + index === 0 ? 'opening' : index === scenesToAdd.length - 1 ? 'closing' : 'middle',
            order: (current.scenes[current.scenes.length - 1]?.order ?? 0) + 10,
            summary: outlineScene.summary,
            artifactRef: null,
            npcs: [],
            places: [],
            adversaries: [],
            items: [],
            clueRefs: [],
            handoutRefs: [],
            factionRefs: [],
            beats: [],
            facts: [],
            handouts: [],
            triggers: [],
          })
        }
        current.workingSet = appendUniqueRef(current.workingSet, proposal.id)
        return current
      })
      if (firstCreatedSceneId) {
        setSelectedSceneId(firstCreatedSceneId)
        setExpandedSceneIds((current) => new Set(current).add(firstCreatedSceneId))
      }
    } catch (err) {
      setValidationIssues((current) => [...current, errorMessage(err, `Failed to import ${proposal.title}.`)])
      setSaveState('issues')
    }
  }

  async function attachPendingProposal(): Promise<void> {
    if (!pendingAttach) return
    const updated = clonePlan(plan)
    const scene = updated.scenes.find((s) => s.id === pendingAttach.sceneId)
    if (!scene) return
    appendRelationshipRef(scene, pendingAttach.planField, pendingAttach.proposalId)
    await onSave(updated)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('createdProposal')
      next.delete('relationship')
      next.delete('parent')
      return next
    }, { replace: true })
  }

  function attachRelationshipToSelected(planField: keyof ChapterPlanScene, proposalId: string): void {
    if (!selectedScene) return
    updateScene(selectedScene.id, (scene) => {
      appendRelationshipRef(scene, planField, proposalId)
    })
  }

  function removeScene(sceneId: string): void {
    updatePlan((current) => {
      current.scenes = current.scenes.filter((scene) => scene.id !== sceneId)
      current.checkpoints = current.checkpoints.map((checkpoint) => ({
        ...checkpoint,
        sceneIds: checkpoint.sceneIds.filter((id) => id !== sceneId),
      }))
      current.threads = current.threads.map((thread) => ({
        ...thread,
        cueSceneIds: (thread.cueSceneIds ?? []).filter((id) => id !== sceneId),
      }))
      return current
    })
    if (selectedSceneId === sceneId) {
      setSelectedSceneId(plan.scenes.find((scene) => scene.id !== sceneId)?.id || '')
    }
  }

  function moveScene(sceneId: string, direction: -1 | 1): void {
    updatePlan((current) => {
      const index = current.scenes.findIndex((scene) => scene.id === sceneId)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= current.scenes.length) return current
      const [scene] = current.scenes.splice(index, 1)
      current.scenes.splice(nextIndex, 0, scene)
      current.scenes = current.scenes.map((entry, sceneIndex) => ({ ...entry, order: (sceneIndex + 1) * 10 }))
      return current
    })
  }

  function addBeat(): void {
    if (!selectedScene) return
    updateScene(selectedScene.id, (scene) => {
      scene.beats.push({ id: nextItemId('beat', scene.beats), label: 'New beat', desc: '' })
    })
  }

  function addFact(): void {
    if (!selectedScene) return
    updateScene(selectedScene.id, (scene) => {
      scene.facts.push({ id: nextItemId('fact', scene.facts), label: 'New fact', desc: '' })
    })
  }

  function addHandout(): void {
    if (!selectedScene) return
    updateScene(selectedScene.id, (scene) => {
      scene.handouts.push({ id: nextItemId('handout', scene.handouts), label: 'New handout', desc: '' })
    })
  }

  function updateNestedItem<T extends ChapterPlanBeat | ChapterPlanFact | ChapterPlanHandout>(
    key: 'beats' | 'facts' | 'handouts',
    itemId: string,
    patch: Partial<T>,
  ): void {
    if (!selectedScene) return
    updateScene(selectedScene.id, (scene) => {
      scene[key] = scene[key].map((item) => (item.id === itemId ? { ...item, ...patch } : item)) as ChapterPlanScene[typeof key]
      if (typeof patch.id === 'string' && patch.id !== itemId) {
        const eventType: TriggerEvent = key === 'beats' ? 'beat' : key === 'facts' ? 'fact' : 'handout'
        scene.triggers = (scene.triggers ?? []).map((trigger) => (
          trigger.on === eventType && trigger.id === itemId ? { ...trigger, id: patch.id as string } : trigger
        ))
      }
    })
  }

  function removeNestedItem(key: 'beats' | 'facts' | 'handouts', itemId: string): void {
    if (!selectedScene) return
    updateScene(selectedScene.id, (scene) => {
      scene[key] = scene[key].filter((item) => item.id !== itemId) as ChapterPlanScene[typeof key]
      const eventType: TriggerEvent = key === 'beats' ? 'beat' : key === 'facts' ? 'fact' : 'handout'
      scene.triggers = (scene.triggers ?? []).filter((trigger) => !(trigger.on === eventType && trigger.id === itemId))
    })
  }

  function triggerTargets(scene: ChapterPlanScene, on: TriggerEvent): Array<{ id: string; label: string }> {
    if (on === 'beat') return scene.beats
    if (on === 'fact') return scene.facts
    return scene.handouts
  }

  function addTrigger(): void {
    if (!selectedScene || !plan.threads.length) return
    const firstTarget = selectedScene.beats[0]
      ? { on: 'beat' as const, id: selectedScene.beats[0].id }
      : selectedScene.facts[0]
        ? { on: 'fact' as const, id: selectedScene.facts[0].id }
        : selectedScene.handouts[0]
          ? { on: 'handout' as const, id: selectedScene.handouts[0].id }
          : null
    if (!firstTarget) return
    updateScene(selectedScene.id, (scene) => {
      scene.triggers = [
        ...(scene.triggers ?? []),
        {
          ...firstTarget,
          threadId: plan.threads[0].threadId,
          setStatus: 'simmering',
        },
      ]
    })
  }

  function updateTrigger(index: number, patch: Partial<ChapterPlanTrigger>): void {
    if (!selectedScene) return
    updateScene(selectedScene.id, (scene) => {
      scene.triggers = scene.triggers ?? []
      const current = scene.triggers[index]
      if (!current) return
      const next = { ...current, ...patch }
      if (patch.on && patch.on !== current.on) {
        next.id = triggerTargets(scene, patch.on)[0]?.id || ''
      }
      scene.triggers[index] = next
    })
  }

  function removeTrigger(index: number): void {
    if (!selectedScene) return
    updateScene(selectedScene.id, (scene) => {
      scene.triggers = scene.triggers ?? []
      scene.triggers.splice(index, 1)
    })
  }

  function addThread(): void {
    updatePlan((current) => {
      current.threads.push({
        threadId: worldThreads[0]?.id || 'thread-id',
        hook: '',
        cueSceneIds: selectedScene ? [selectedScene.id] : [],
      })
      return current
    })
  }

  function addCheckpoint(): void {
    updatePlan((current) => {
      current.checkpoints.push({
        id: nextItemId('checkpoint', current.checkpoints),
        index: current.checkpoints.length,
        label: `Checkpoint ${current.checkpoints.length + 1}`,
        sceneIds: selectedScene ? [selectedScene.id] : [],
        pauseLabel: null,
      })
      return current
    })
  }

  async function handleSave(): Promise<void> {
    setValidationIssues([])
    try {
      await onSave(plan)
      setDirty(false)
      setSaveState('saved')
    } catch (err) {
      const issues = (err as Error & { issues?: string[] })?.issues ?? []
      setValidationIssues(issues)
      setSaveState('issues')
      throw err
    }
  }

  function handleDragStart(event: DragStartEvent): void {
    const data = event.active.data.current as DragData | undefined
    setActiveProposalType(data?.kind === 'proposal' ? data.proposalType : '')
    setActiveProposalId(data?.kind === 'proposal' ? data.proposalId : '')
  }

  function handleDragEnd(event: DragEndEvent): void {
    setActiveProposalType('')
    setActiveProposalId('')
    const activeData = event.active.data.current as DragData | undefined
    if (!activeData || !event.over) return
    if (activeData.kind === 'scene') {
      const oldIndex = plan.scenes.findIndex((scene) => `scene:${scene.id}` === event.active.id)
      const newIndex = plan.scenes.findIndex((scene) => `scene:${scene.id}` === event.over?.id)
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return
      updatePlan((current) => {
        current.scenes = arrayMove(current.scenes, oldIndex, newIndex).map((scene, index) => ({ ...scene, order: (index + 1) * 10 }))
        return current
      })
      return
    }

    const overId = String(event.over.id)
    const [zone, sceneId] = overId.split(':')
    const proposal = proposalMap.get(activeData.proposalId)
    if (!proposal || !sceneId) return
    if (zone === 'chapter-outline' && CHAPTER_SOURCE_TYPES.has(proposal.proposalType)) {
      void importChapterOutline(proposal)
      return
    }
    if (zone === 'artifact' && ARTIFACT_TYPES.has(proposal.proposalType)) {
      updateScene(sceneId, (scene) => {
        scene.artifactRef = proposal.id
        scene.label = scene.label || proposal.title
        scene.summary = scene.summary || proposal.summary || ''
      })
      ensureWorkingSet(proposal.id)
      return
    }
    if (zone === 'joins' && RELATIONSHIP_TYPES.has(proposal.proposalType)) {
      const rel = CHAPTER_SCENE_RELATIONSHIPS.find((entry) => entry.proposalType === proposal.proposalType)
      if (!rel) return
      updateScene(sceneId, (scene) => appendRelationshipRef(scene, rel.planField, proposal.id))
      ensureWorkingSet(proposal.id)
    }
  }

  async function createDrawerProposal(type: ProposalType, title: string, summary: string): Promise<void> {
    setDrawerPending(true)
    setDrawerError('')
    try {
      const result = await createProposal({ type, title, summary }, 'planning')
      setLocalProposals((current) => [...current, result.proposal])
      ensureWorkingSet(result.proposal.id)
      setDrawerOpen(false)
    } catch (err) {
      setDrawerError(errorMessage(err, 'Failed to create proposal.'))
    } finally {
      setDrawerPending(false)
    }
  }

  async function generateDrawerProposal(type: ProposalType, prompt: string): Promise<void> {
    setDrawerPending(true)
    setDrawerError('')
    try {
      const result = await generateProposal({ type, prompt }, 'planning')
      setLocalProposals((current) => [...current, result.proposal])
      ensureWorkingSet(result.proposal.id)
      setDrawerOpen(false)
    } catch (err) {
      setDrawerError(errorMessage(err, 'Failed to generate proposal.'))
    } finally {
      setDrawerPending(false)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={atelierCollisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveProposalType('')
        setActiveProposalId('')
      }}
    >
      <div className="atelier composition-shell">
        <div className="atelier-header">
          <div>
            <div className="workspace-kicker">Atelier</div>
            <h3>{plan.title}</h3>
            <p className="chapter-draft-meta">Compose a chapter working set into scene-like segments, then save and materialise when refs are promoted.</p>
          </div>
          <div className="atelier-header-actions">
            <select value={chapterId} onChange={(event) => onSelectChapter(event.target.value)}>
              {chapters.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.id}{chapter.locked ? ' (locked)' : ''}{chapter.current ? ' (current)' : ''}
                </option>
              ))}
            </select>
            <button className="chapter-mini-btn" disabled={busy || readOnly} onClick={() => void handleSave()}>
              {saveState === 'saved' ? 'Saved' : saveState === 'issues' ? `${validationIssues.length} issue(s)` : dirty ? 'Save plan' : 'Saved'}
            </button>
            <button className="chapter-mini-btn" disabled={busy || readOnly || dirty || validationIssues.length > 0} onClick={() => void onMaterialize()}>
              Materialise
            </button>
          </div>
        </div>

        {(notice || error) && <div className={error ? 'error-card' : 'placeholder-card'}>{error || notice}</div>}
        {readOnly && <div className="placeholder-card">This chapter is locked. You can inspect the plan but cannot save or materialise changes.</div>}
        {validationIssues.length > 0 && (
          <div className="composition-validation-callout">
            <strong>Plan validation issues</strong>
            <ul>{validationIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
          </div>
        )}

        {pendingAttach && (
          <div className="composition-attach-banner">
            <span>Ready to attach <strong>{pendingAttach.proposalId}</strong> to {pendingAttach.label} in segment <strong>{pendingAttach.sceneId}</strong>.</span>
            <button className="chapter-mini-btn" disabled={busy || readOnly} onClick={() => void attachPendingProposal()}>Attach</button>
            <button className="chapter-mini-btn" onClick={() => setSearchParams((prev) => {
              const next = new URLSearchParams(prev)
              next.delete('createdProposal')
              next.delete('relationship')
              next.delete('parent')
              return next
            }, { replace: true })}>Dismiss</button>
          </div>
        )}

        {chapterPlanLoading ? (
          <div className="placeholder-card">Loading chapter plan...</div>
        ) : (
          <div className="atelier-grid">
            <aside className="atelier-catalog">
              <div className="atelier-catalog-head">
                <div>
                  <span className="workspace-kicker">Working set</span>
                  <strong>{workingSet.length} enrolled</strong>
                </div>
                <button
                  className="chapter-mini-btn"
                  disabled={readOnly}
                  onClick={() => {
                    setDrawerType(catalogFilter !== 'all' ? catalogFilter as ProposalType : 'npc')
                    setDrawerOpen(true)
                  }}
                >
                  + New
                </button>
              </div>
              <div className="atelier-tabs">
                {CATALOG_FILTERS.map((filter) => (
                  <button key={filter} className={catalogFilter === filter ? 'active' : ''} onClick={() => setCatalogFilter(filter)}>
                    {filter}
                  </button>
                ))}
              </div>
              <div className="atelier-prop-list">
                {catalogProposals.length ? catalogProposals.map((proposal) => <ProposalCard key={proposal.id} proposal={proposal} />) : (
                  <div className="placeholder-card">No enrolled proposals for this filter. Enrol from corpus or create one inline.</div>
                )}
              </div>
              <button className="atelier-enrol-btn" disabled={readOnly} onClick={() => setEnrolOpen(true)}>+ Enrol from corpus</button>
            </aside>

            <main className="atelier-canvas">
              <div className="atelier-title-row">
                <label className="chapter-draft-field">
                  <span>Chapter title</span>
                  <input disabled={readOnly} value={plan.title} onChange={(event) => updatePlan((current) => ({ ...current, title: event.target.value }))} />
                </label>
                <div className="atelier-stats">
                  <span>{plan.scenes.length} scenes</span>
                  <span>{beatCount} beats</span>
                  <span>{readySceneCount} ready</span>
                </div>
              </div>
              <label className="chapter-draft-field">
                <span>Plan notes</span>
                <textarea disabled={readOnly} rows={2} value={plan.notes || ''} onChange={(event) => updatePlan((current) => ({ ...current, notes: event.target.value }))} />
              </label>
              <div className="atelier-rail-head">
                <h4>Scene rail</h4>
                <button className="chapter-mini-btn" disabled={readOnly} onClick={addBlankSegment}>Add blank segment</button>
              </div>
              <DroppableZone id="chapter-outline:rail" accepts={CHAPTER_SOURCE_TYPES} activeProposalType={activeProposalType}>
                <div className="atelier-zone-title">Chapter outline drop zone</div>
                <span>Drop a chapter-outline proposal here to append its Scene Spine as blank segments.</span>
              </DroppableZone>
              <SortableContext items={plan.scenes.map((scene) => `scene:${scene.id}`)} strategy={verticalListSortingStrategy}>
                <div className="atelier-scene-rail">
                  {plan.scenes.length ? plan.scenes.map((scene) => {
                    const readiness = sceneReadiness(scene)
                    const expanded = expandedSceneIds.has(scene.id) || selectedSceneId === scene.id
                    const artifact = scene.artifactRef ? proposalMap.get(scene.artifactRef) : undefined
                    return (
                      <SortableSceneCard key={scene.id} scene={scene}>
                        <div className="atelier-scene-content" onClick={() => setSelectedSceneId(scene.id)}>
                          <div className="atelier-scene-top">
                            <div>
                              <span className="status-chip subtle">{scene.kind}</span>
                              <h4>{scene.label}</h4>
                              <span className="entity-id">{scene.id}</span>
                            </div>
                            <div className="atelier-scene-actions">
                              <span className={readinessClass(readiness.state)}>{readinessLabel(readiness.state)}</span>
                              <button className="chapter-mini-btn" onClick={(event) => { event.stopPropagation(); toggleExpanded(scene.id) }}>
                                {expanded ? 'Collapse' : 'Expand'}
                              </button>
                              <button className="chapter-mini-btn" disabled={readOnly} onClick={(event) => { event.stopPropagation(); removeScene(scene.id) }}>
                                Remove
                              </button>
                            </div>
                          </div>
                          <p>{scene.summary || 'No segment summary yet.'}</p>

                          {expanded && (
                            <div className="atelier-scene-expanded">
                              <div className="chapter-draft-grid">
                                <label className="chapter-draft-field">
                                  <span>Label</span>
                                  <input disabled={readOnly} value={scene.label} onChange={(event) => updateScene(scene.id, (entry) => { entry.label = event.target.value })} />
                                </label>
                                <label className="chapter-draft-field">
                                  <span>Kind</span>
                                  <select disabled={readOnly} value={scene.kind} onChange={(event) => updateScene(scene.id, (entry) => { entry.kind = event.target.value })}>
                                    <option value="opening">opening</option>
                                    <option value="middle">middle</option>
                                    <option value="climax">climax</option>
                                    <option value="interlude">interlude</option>
                                    <option value="closing">closing</option>
                                    <option value="optional">optional</option>
                                  </select>
                                </label>
                                <label className="chapter-draft-field chapter-draft-field-wide">
                                  <span>Summary</span>
                                  <textarea disabled={readOnly} rows={3} value={scene.summary} onChange={(event) => updateScene(scene.id, (entry) => { entry.summary = event.target.value })} />
                                </label>
                              </div>

                              <DroppableZone id={`artifact:${scene.id}`} accepts={ARTIFACT_TYPES} activeProposalType={activeProposalType}>
                                <div className="atelier-zone-title">Artifact drop zone</div>
                                {artifact ? (
                                  <div className="composition-selected-ref">
                                    <span>{artifact.title}</span>
                                    <span className={proposalStatusClass(proposalRefStatus(artifact))}>{proposalRefStatus(artifact)}</span>
                                  </div>
                                ) : <span>Drop a scene or encounter proposal here.</span>}
                              </DroppableZone>

                              <DroppableZone id={`joins:${scene.id}`} accepts={RELATIONSHIP_TYPES} activeProposalType={activeProposalType}>
                                <div className="atelier-zone-title">Joins drop zone</div>
                                <div className="atelier-join-list">
                                  {CHAPTER_SCENE_RELATIONSHIPS.map((rel) => {
                                    const values = Array.isArray(scene[rel.planField]) ? scene[rel.planField] as string[] : []
                                    return (
                                      <div key={rel.planField} className="atelier-join-group">
                                        <strong>{rel.label}</strong>
                                        {values.length ? values.map((proposalId) => {
                                          const proposal = proposalMap.get(proposalId)
                                          const status = proposalRefStatus(proposal)
                                          return (
                                            <span key={proposalId} className="atelier-join-pill">
                                              {proposal?.title ?? proposalId}
                                              <span className={proposalStatusClass(status)}>{status}</span>
                                              <button disabled={readOnly} onClick={() => updateScene(scene.id, (entry) => removeRelationshipRef(entry, rel.planField, proposalId))}>x</button>
                                            </span>
                                          )
                                        }) : <em>None</em>}
                                      </div>
                                    )
                                  })}
                                </div>
                              </DroppableZone>

                              <div className="atelier-readiness-detail">
                                <strong>Readiness detail</strong>
                                {readiness.refs.length ? readiness.refs.map((ref) => (
                                  <span key={`${ref.label}:${ref.proposalId}`}>
                                    {ref.label}: <code>{ref.proposalId}</code> <span className={proposalStatusClass(ref.status)}>{ref.status}</span>
                                  </span>
                                )) : <span>No proposal references yet.</span>}
                              </div>

                              {validationIssues.filter((issue) => issue.includes(scene.id)).map((issue) => (
                                <div key={issue} className="composition-validation-callout">{issue}</div>
                              ))}

                              <div className="atelier-local-items">
                                <div className="chapter-drill-head"><h4>Beats</h4><button disabled={readOnly} className="chapter-mini-btn" onClick={addBeat}>Add beat</button></div>
                                {scene.beats.map((beat) => (
                                  <div key={beat.id} className="chapter-drill-card">
                                    <input disabled={readOnly} value={beat.id} onChange={(event) => updateNestedItem('beats', beat.id, { id: event.target.value })} />
                                    <input disabled={readOnly} value={beat.label} onChange={(event) => updateNestedItem('beats', beat.id, { label: event.target.value })} />
                                    <button disabled={readOnly} className="chapter-mini-btn" onClick={() => removeNestedItem('beats', beat.id)}>Remove</button>
                                  </div>
                                ))}
                                <div className="chapter-drill-head"><h4>Facts</h4><button disabled={readOnly} className="chapter-mini-btn" onClick={addFact}>Add fact</button></div>
                                {scene.facts.map((fact) => (
                                  <div key={fact.id} className="chapter-drill-card">
                                    <input disabled={readOnly} value={fact.id} onChange={(event) => updateNestedItem('facts', fact.id, { id: event.target.value })} />
                                    <input disabled={readOnly} value={fact.label} onChange={(event) => updateNestedItem('facts', fact.id, { label: event.target.value })} />
                                    <button disabled={readOnly} className="chapter-mini-btn" onClick={() => removeNestedItem('facts', fact.id)}>Remove</button>
                                  </div>
                                ))}
                                <div className="chapter-drill-head"><h4>Handouts</h4><button disabled={readOnly} className="chapter-mini-btn" onClick={addHandout}>Add handout</button></div>
                                {scene.handouts.map((handout) => (
                                  <div key={handout.id} className="chapter-drill-card">
                                    <input disabled={readOnly} value={handout.id} onChange={(event) => updateNestedItem('handouts', handout.id, { id: event.target.value })} />
                                    <input disabled={readOnly} value={handout.label} onChange={(event) => updateNestedItem('handouts', handout.id, { label: event.target.value })} />
                                    <button disabled={readOnly} className="chapter-mini-btn" onClick={() => removeNestedItem('handouts', handout.id)}>Remove</button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </SortableSceneCard>
                    )
                  }) : <div className="placeholder-card">No segments yet. Add a blank segment or drop in scene proposals after enrolling them.</div>}
                </div>
              </SortableContext>
            </main>
          </div>
        )}

        {enrolOpen && (
          <div className="atelier-modal-backdrop">
            <div className="atelier-modal">
              <div className="chapter-drill-head">
                <h4>Enrol from corpus</h4>
                <button className="chapter-mini-btn" onClick={() => setEnrolOpen(false)}>Close</button>
              </div>
              <input className="search-input" value={enrolQuery} onChange={(event) => setEnrolQuery(event.target.value)} placeholder="Search proposals by title, id, or type" />
              <div className="atelier-enrol-list">
                {enrolCandidates.map((proposal) => (
                  <div key={proposal.id} className="composition-ref-card">
                    <div><strong>{proposal.title}</strong><div className="entity-id">{proposal.id}</div></div>
                    <div className="composition-ref-actions">
                      <span className="status-chip subtle">{proposal.proposalType}</span>
                      <span className={proposalStatusClass(proposalRefStatus(proposal))}>{proposalRefStatus(proposal)}</span>
                      <button className="chapter-mini-btn" disabled={readOnly} onClick={() => ensureWorkingSet(proposal.id)}>Enrol</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {drawerOpen && (
          <div className="atelier-drawer">
            <ProposalFormShell
              mode="create"
              initialType={drawerType}
              isPending={drawerPending}
              error={drawerError}
              contextBanner={`Creating a ${drawerType} proposal for ${chapterId}. It will be enrolled in this chapter working set.`}
              onCancel={() => setDrawerOpen(false)}
              onCreate={(type, title, summary) => void createDrawerProposal(type, title, summary)}
              onGenerate={(type, prompt) => void generateDrawerProposal(type, prompt)}
            />
          </div>
        )}
      </div>
      <DragOverlay>
        {activeProposalId ? (
          <div className="atelier-prop-card atelier-drag-overlay">
            <div className="atelier-prop-glyph">{glyphForType(proposalMap.get(activeProposalId)?.proposalType ?? '')}</div>
            <div className="atelier-prop-main">
              <strong>{proposalMap.get(activeProposalId)?.title ?? activeProposalId}</strong>
              <span className="entity-id">{activeProposalId}</span>
              <span>{proposalMap.get(activeProposalId)?.summary || 'Dragging proposal.'}</span>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )

}
