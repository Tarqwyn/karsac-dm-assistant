import { createElement, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  ChapterBeat,
  ChapterBundle,
  ChapterFact,
  ChapterHandout,
  ChapterScene,
  ChapterSummary,
  ReadMode,
  WorldThread,
} from '@karsac/shared'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  closeSession,
  fetchCampaignState,
  fetchChapterList,
  fetchChapterState,
  fetchCorpusEntities,
  fetchCorpusEntity,
  fetchProposal,
  fetchProposals,
  fetchWorldThreads,
  hideFact,
  markBeat,
  postHandout,
  promoteProposal,
  previewSessionClose,
  revealFact,
  reviewProposal,
  setChapterLock,
  setCheckpoint,
  setClock,
  setCurrentChapter,
  setThreadStatus,
  unmarkBeat,
  unpostHandout,
} from './api'

const sections = [
  { id: 'corpus', label: 'Corpus', path: '/corpus' },
  { id: 'proposals', label: 'Proposals', path: '/proposals' },
  { id: 'chapters', label: 'Chapters', path: '/chapters' },
  { id: 'tracker', label: 'Tracker', path: '/tracker' },
  { id: 'session', label: 'Session', path: '/session' },
] as const

const DEFAULT_SECTION_PATH = '/corpus'
const READ_MODE_STORAGE_KEY = 'karsac-ui-read-mode'

type SectionId = (typeof sections)[number]['id']

type DraftChapterState = {
  draftId: string
  sourceChapterId: string
  chapterId: string
  title: string
  summary: string
  progress: NonNullable<ChapterBundle['progress']>
  facts: NonNullable<ChapterBundle['facts']>
  handouts: NonNullable<ChapterBundle['handouts']>
  beats: NonNullable<ChapterBundle['beats']>
  scenes: NonNullable<ChapterBundle['scenes']>
}

function sectionFromPath(pathname: string): SectionId {
  const section = sections.find((entry) => pathname === entry.path || pathname.startsWith(`${entry.path}/`))
  return section?.id ?? 'corpus'
}

function typeClassName(type: string | undefined): string {
  const normalized = String(type || 'unknown').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return `entity-type type-${normalized || 'unknown'}`
}

function validationClassName(status: string | undefined): string {
  const normalized = String(status || 'unknown').trim().toLowerCase()
  return `status-chip validation-${normalized}`
}

function percentLabel(value: unknown): string {
  const number = Number(value)
  if (!Number.isFinite(number)) return '0%'
  return `${Math.max(0, Math.min(100, Math.round(number)))}%`
}

function renderInlineMarkdown(text: string): Array<string | JSX.Element> | string {
  const segments: Array<string | JSX.Element> = []
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
  let lastIndex = 0

  for (const match of text.matchAll(pattern)) {
    if ((match.index ?? 0) > lastIndex) {
      segments.push(text.slice(lastIndex, match.index))
    }

    const token = match[0]
    if (token.startsWith('**') || token.startsWith('__')) {
      segments.push(<strong key={`${match.index}-strong`}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('`')) {
      segments.push(<code key={`${match.index}-code`}>{token.slice(1, -1)}</code>)
    } else if (token.startsWith('[')) {
      const splitIndex = token.lastIndexOf('](')
      const label = token.slice(1, splitIndex)
      const href = token.slice(splitIndex + 2, -1)
      segments.push(
        <a key={`${match.index}-link`} href={href} target="_blank" rel="noreferrer">
          {label}
        </a>,
      )
    } else {
      segments.push(token)
    }

    lastIndex = (match.index ?? 0) + token.length
  }

  if (lastIndex < text.length) {
    segments.push(text.slice(lastIndex))
  }

  return segments.length ? segments : text
}

function renderMarkdown(content: string | undefined): JSX.Element[] {
  const lines = String(content || '').replace(/\r\n/g, '\n').split('\n')
  const blocks: JSX.Element[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      i += 1
      continue
    }

    if (trimmed.startsWith('```')) {
      const codeLines: string[] = []
      i += 1
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i += 1
      }
      if (i < lines.length) i += 1
      blocks.push(
        <pre key={`code-${blocks.length}`}>
          <code>{codeLines.join('\n')}</code>
        </pre>,
      )
      continue
    }

    if (/^#{1,6}\s+/.test(trimmed)) {
      const level = trimmed.match(/^#{1,6}/)?.[0].length ?? 1
      const text = trimmed.replace(/^#{1,6}\s+/, '')
      const tagName = `h${Math.min(level + 1, 6)}`
      blocks.push(createElement(tagName, { key: `heading-${blocks.length}` }, renderInlineMarkdown(text)))
      i += 1
      continue
    }

    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      blocks.push(<hr key={`hr-${blocks.length}`} />)
      i += 1
      continue
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''))
        i += 1
      }
      blocks.push(
        <blockquote key={`quote-${blocks.length}`}>
          {quoteLines.map((quoteLine, index) => (
            <p key={index}>{renderInlineMarkdown(quoteLine)}</p>
          ))}
        </blockquote>,
      )
      continue
    }

    if (/^([-*+]\s+|\d+\.\s+)/.test(trimmed)) {
      const ordered = /^\d+\.\s+/.test(trimmed)
      const items: string[] = []
      while (i < lines.length && /^([-*+]\s+|\d+\.\s+)/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^([-*+]\s+|\d+\.\s+)/, ''))
        i += 1
      }

      if (ordered) {
        blocks.push(
          <ol key={`list-${blocks.length}`}>
            {items.map((item, index) => (
              <li key={index}>{renderInlineMarkdown(item)}</li>
            ))}
          </ol>,
        )
      } else {
        blocks.push(
          <ul key={`list-${blocks.length}`}>
            {items.map((item, index) => (
              <li key={index}>{renderInlineMarkdown(item)}</li>
            ))}
          </ul>,
        )
      }
      continue
    }

    const paragraphLines = [trimmed]
    i += 1
    while (i < lines.length) {
      const next = lines[i].trim()
      if (!next) break
      if (/^#{1,6}\s+/.test(next) || /^>\s?/.test(next) || /^([-*+]\s+|\d+\.\s+)/.test(next) || next.startsWith('```')) break
      paragraphLines.push(next)
      i += 1
    }
    blocks.push(
      <p key={`p-${blocks.length}`}>
        {renderInlineMarkdown(paragraphLines.join(' '))}
      </p>,
    )
  }

  return blocks
}

function cloneJson<T>(value: T): T {
  return value == null ? value : JSON.parse(JSON.stringify(value)) as T
}

function nextChapterId(sourceChapterId: string): string {
  const match = String(sourceChapterId || '').match(/^chapter-(\d+)$/i)
  if (!match) return 'chapter-4'
  return `chapter-${Number(match[1]) + 1}`
}

function createEmptyChapterDraft(sourceChapterId = ''): DraftChapterState {
  const chapterId = nextChapterId(sourceChapterId)
  return {
    draftId: `draft-${Date.now()}`,
    sourceChapterId,
    chapterId,
    title: '',
    summary: '',
    progress: {
      currentCheckpoint: {
        id: 'checkpoint-0',
        index: 0,
        label: 'Opening beat',
        pauseLabel: 'Soft pause only',
        pauseClass: null,
        recap: [],
      },
      checkpoints: [],
      coverage: {
        facts: { completed: 0, total: 0 },
        handouts: { completed: 0, total: 0 },
        beats: { completed: 0, total: 0 },
        percent: 0,
      },
    },
    facts: { id: `${chapterId}-facts`, type: 'chapter-facts', chapterId, facts: [] },
    handouts: { id: `${chapterId}-handouts`, type: 'chapter-handouts', chapterId, handouts: [] },
    beats: { id: `${chapterId}-beats`, type: 'chapter-beats', chapterId, beats: [] },
    scenes: { id: `${chapterId}-scenes`, type: 'chapter-scenes', chapterId, scenes: [] },
  }
}

function chapterBundleToDraft(bundle: ChapterBundle | undefined | null, sourceChapterId = ''): DraftChapterState {
  const draft = createEmptyChapterDraft(sourceChapterId || bundle?.chapterId || '')
  if (!bundle) return draft
  const chapterId = bundle.chapterId || draft.chapterId
  return {
    ...draft,
    sourceChapterId: sourceChapterId || bundle.chapterId || draft.sourceChapterId,
    chapterId,
    title: bundle.title || bundle.chapterId || draft.title,
    summary: bundle.summary || '',
    progress: cloneJson(bundle.progress) || draft.progress,
    facts: cloneJson(bundle.facts) || { ...draft.facts, chapterId },
    handouts: cloneJson(bundle.handouts) || { ...draft.handouts, chapterId },
    beats: cloneJson(bundle.beats) || { ...draft.beats, chapterId },
    scenes: cloneJson(bundle.scenes) || { ...draft.scenes, chapterId },
  }
}

function uniqueDraftId(prefix: string, existingIds: string[]): string {
  let counter = 1
  let candidate = `${prefix}-${counter}`
  while (existingIds.includes(candidate)) {
    counter += 1
    candidate = `${prefix}-${counter}`
  }
  return candidate
}

function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

async function copyJsonToClipboard(data: unknown): Promise<void> {
  await navigator.clipboard.writeText(JSON.stringify(data, null, 2))
}

function currentMode(): ReadMode {
  const stored = window.localStorage.getItem(READ_MODE_STORAGE_KEY)
  return stored === 'planning' ? 'planning' : 'live'
}

function errorMessage(value: unknown, fallback: string): string {
  return value instanceof Error ? value.message : fallback
}

function errorWithIssues(value: unknown): string {
  if (!(value instanceof Error)) return 'Request failed.'
  const issues = (value as Error & { issues?: string[] }).issues
  if (!issues?.length) return value.message
  return `${value.message}\n${issues.map((issue) => `- ${issue}`).join('\n')}`
}

export default function App(): JSX.Element {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const activeSection = sectionFromPath(location.pathname)
  const [readMode, setReadMode] = useState<ReadMode>(() => currentMode())
  const [query, setQuery] = useState('')
  const [entityType, setEntityType] = useState('all')
  const [proposalQuery, setProposalQuery] = useState('')
  const [selectedCorpusId, setSelectedCorpusId] = useState('')
  const [selectedProposalId, setSelectedProposalId] = useState('')
  const [selectedChapterId, setSelectedChapterId] = useState('')
  const [selectedChapterView, setSelectedChapterView] = useState<'overview' | 'facts' | 'handouts' | 'beats' | 'scenes'>('overview')
  const [chapterWorkspaceMode, setChapterWorkspaceMode] = useState<'state' | 'planning'>(() => (currentMode() === 'planning' ? 'planning' : 'state'))
  const [proposalActionError, setProposalActionError] = useState('')
  const [proposalForceReady, setProposalForceReady] = useState(false)
  const [trackerActionError, setTrackerActionError] = useState('')
  const [trackerBusyKey, setTrackerBusyKey] = useState('')
  const [sessionActionError, setSessionActionError] = useState('')
  const [sessionActionNotice, setSessionActionNotice] = useState('')
  const [sessionCloseConfirming, setSessionCloseConfirming] = useState(false)
  const [chapterDraftView, setChapterDraftView] = useState<'overview' | 'facts' | 'handouts' | 'beats' | 'scenes'>('overview')
  const [chapterDraftSelection, setChapterDraftSelection] = useState({
    facts: '',
    handouts: '',
    beats: '',
    scenes: '',
  })
  const [chapterDraftState, setChapterDraftState] = useState<DraftChapterState>(() => createEmptyChapterDraft('chapter-3'))
  const [chapterDraftNotice, setChapterDraftNotice] = useState('')

  useEffect(() => {
    if (location.pathname === '/') {
      navigate(DEFAULT_SECTION_PATH, { replace: true })
    }
  }, [location.pathname, navigate])

  useEffect(() => {
    window.localStorage.setItem(READ_MODE_STORAGE_KEY, readMode)
  }, [readMode])

  const subtitle = useMemo(() => {
    if (activeSection === 'corpus') {
      return readMode === 'planning'
        ? 'Planning mode exposes future chapter material explicitly.'
        : 'Live mode shows the current corpus surface only.'
    }
    if (activeSection === 'proposals') {
      return 'Review proposal drafts, inspect validation state, and promote approved work into the corpus.'
    }
    if (activeSection === 'chapters') {
      return chapterWorkspaceMode === 'planning'
        ? 'Work on chapter prep explicitly: draft the next shape of the chapter without mixing it into the live tracker view.'
        : 'Inspect chapter state, progress, and scene structure from the live service.'
    }
    if (activeSection === 'tracker') {
      return 'Run the live session from the state API: reveal facts, post handouts, mark beats, manage threads, checkpoint, and clock.'
    }
    return 'Close the live session explicitly and export a session summary back into corpus/state/.'
  }, [activeSection, chapterWorkspaceMode, readMode])

  const trackerMode: ReadMode = 'live'

  const campaignQuery = useQuery({
    queryKey: ['campaign-state', readMode],
    queryFn: () => fetchCampaignState(readMode),
  })

  const corpusListQuery = useQuery({
    queryKey: ['corpus', readMode],
    queryFn: () => fetchCorpusEntities(readMode),
    enabled: activeSection === 'corpus',
  })

  const proposalListQuery = useQuery({
    queryKey: ['proposals', readMode],
    queryFn: () => fetchProposals(readMode),
    enabled: activeSection === 'proposals',
  })

  const chapterListQuery = useQuery({
    queryKey: ['chapters', readMode],
    queryFn: () => fetchChapterList(readMode),
    enabled: activeSection === 'chapters' || activeSection === 'tracker',
  })

  const worldThreadsQuery = useQuery({
    queryKey: ['world-threads', trackerMode],
    queryFn: () => fetchWorldThreads(trackerMode),
    enabled: activeSection === 'tracker',
  })

  const sessionClosePreviewQuery = useQuery({
    queryKey: ['session-close-preview', trackerMode],
    queryFn: () => previewSessionClose(trackerMode),
    enabled: activeSection === 'session',
  })

  const corpusEntities = corpusListQuery.data?.entities || []
  const proposals = proposalListQuery.data?.proposals || []
  const chapters = chapterListQuery.data?.chapters || []

  useEffect(() => {
    if (activeSection !== 'corpus') return
    const ids = corpusEntities.map((entity) => entity.id)
    if (!ids.length) {
      setSelectedCorpusId('')
      return
    }
    setSelectedCorpusId((current) => (ids.includes(current) ? current : ids[0]))
  }, [activeSection, corpusEntities])

  useEffect(() => {
    if (activeSection !== 'proposals') return
    const ids = proposals.map((proposal) => proposal.id)
    if (!ids.length) {
      setSelectedProposalId('')
      return
    }
    setSelectedProposalId((current) => (ids.includes(current) ? current : ids[0]))
  }, [activeSection, proposals])

  useEffect(() => {
    if (activeSection !== 'chapters' && activeSection !== 'tracker') return
    const currentChapter = chapters.find((chapter) => chapter.current)?.id
    const fallback = currentChapter || chapters[0]?.id || ''
    setSelectedChapterId((current) => {
      if (!fallback) return ''
      const ids = chapters.map((chapter) => chapter.id)
      return ids.includes(current) ? current : fallback
    })
  }, [activeSection, chapters])

  const corpusDetailQuery = useQuery({
    queryKey: ['corpus-detail', readMode, selectedCorpusId],
    queryFn: () => fetchCorpusEntity(selectedCorpusId, readMode),
    enabled: activeSection === 'corpus' && Boolean(selectedCorpusId),
  })

  const proposalDetailQuery = useQuery({
    queryKey: ['proposal-detail', readMode, selectedProposalId],
    queryFn: () => fetchProposal(selectedProposalId, readMode),
    enabled: activeSection === 'proposals' && Boolean(selectedProposalId),
  })

  const chapterDetailQuery = useQuery({
    queryKey: ['chapter-detail', activeSection === 'tracker' ? trackerMode : readMode, selectedChapterId],
    queryFn: () => fetchChapterState(selectedChapterId, activeSection === 'tracker' ? trackerMode : readMode),
    enabled: (activeSection === 'chapters' || activeSection === 'tracker') && Boolean(selectedChapterId),
  })

  const reviewMutation = useMutation({
    mutationFn: () => reviewProposal(selectedProposalId, readMode, { reviewed: true, review_status: 'approved' }),
    onSuccess: async () => {
      setProposalActionError('')
      setProposalForceReady(false)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['proposals', readMode] }),
        queryClient.invalidateQueries({ queryKey: ['proposal-detail', readMode, selectedProposalId] }),
      ])
    },
    onError: (error) => {
      setProposalActionError(errorMessage(error, 'Failed to review proposal.'))
    },
  })

  const promoteMutation = useMutation({
    mutationFn: (force: boolean) => promoteProposal(selectedProposalId, readMode, { force, overwrite: false }),
    onSuccess: async () => {
      setProposalActionError('')
      setProposalForceReady(false)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['proposals', readMode] }),
        queryClient.invalidateQueries({ queryKey: ['proposal-detail', readMode, selectedProposalId] }),
        queryClient.invalidateQueries({ queryKey: ['corpus', readMode] }),
      ])
    },
    onError: (error) => {
      if (error instanceof Error && /blocked by validation failures/i.test(error.message)) {
        setProposalForceReady(true)
      }
      setProposalActionError(errorWithIssues(error))
    },
  })

  const visibleEntities = corpusEntities.filter((entity) => {
    const q = query.trim().toLowerCase()
    const matchesQuery = !q
      || [entity.id, entity.title, entity.type, entity.summary, ...(entity.aliases || [])].join(' ').toLowerCase().includes(q)
    const matchesType = entityType === 'all' || entity.type === entityType
    return matchesQuery && matchesType
  })

  const visibleProposals = proposals.filter((proposal) => {
    const q = proposalQuery.trim().toLowerCase()
    return !q || [proposal.id, proposal.title, proposal.proposalType, proposal.status, proposal.summary].join(' ').toLowerCase().includes(q)
  })

  const corpusDetail = corpusDetailQuery.data?.entity || null
  const proposalDetail = proposalDetailQuery.data?.proposal || null
  const chapterDetail = chapterDetailQuery.data || null
  const selectedChapterSummary = chapters.find((chapter) => chapter.id === selectedChapterId)
    || chapters.find((chapter) => chapter.current)
    || chapters[0]
    || null

  const chapterViews = [
    { id: 'overview', label: 'Overview' },
    { id: 'facts', label: 'Facts' },
    { id: 'handouts', label: 'Handouts' },
    { id: 'beats', label: 'Beats' },
    { id: 'scenes', label: 'Scenes' },
    { id: 'draft', label: 'Draft' },
  ] as const

  const chapterFacts = chapterDetail?.facts?.facts || []
  const chapterHandouts = chapterDetail?.handouts?.handouts || []
  const chapterBeats = chapterDetail?.beats?.beats || []
  const chapterScenes = chapterDetail?.scenes?.scenes || []
  const chapterCheckpoint = chapterDetail?.progress?.currentCheckpoint || null
  const chapterDraftFacts = chapterDraftState.facts?.facts || []
  const chapterDraftHandouts = chapterDraftState.handouts?.handouts || []
  const chapterDraftBeats = chapterDraftState.beats?.beats || []
  const chapterDraftScenes = chapterDraftState.scenes?.scenes || []
  const chapterDraftCheckpoint = chapterDraftState.progress?.currentCheckpoint || null
  const selectedDraftFact = chapterDraftFacts.find((fact) => fact.id === chapterDraftSelection.facts) || chapterDraftFacts[0] || null
  const selectedDraftHandout = chapterDraftHandouts.find((handout) => handout.id === chapterDraftSelection.handouts) || chapterDraftHandouts[0] || null
  const selectedDraftBeat = chapterDraftBeats.find((beat) => beat.id === chapterDraftSelection.beats) || chapterDraftBeats[0] || null
  const selectedDraftScene = chapterDraftScenes.find((scene) => scene.id === chapterDraftSelection.scenes) || chapterDraftScenes[0] || null
  const worldThreads = worldThreadsQuery.data?.threads || []
  const trackerChapterId = selectedChapterId || selectedChapterSummary?.id || ''
  const trackerCheckpoints = chapterDetail?.progress?.checkpoints || []

  async function invalidateStateQueries(chapterId = trackerChapterId): Promise<void> {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['campaign-state'] }),
      queryClient.invalidateQueries({ queryKey: ['chapters'] }),
      queryClient.invalidateQueries({ queryKey: ['chapter-detail', trackerMode, chapterId] }),
      queryClient.invalidateQueries({ queryKey: ['world-threads', trackerMode] }),
      queryClient.invalidateQueries({ queryKey: ['session-close-preview', trackerMode] }),
    ])
  }

  async function runTrackerAction(key: string, action: () => Promise<unknown>): Promise<void> {
    setTrackerBusyKey(key)
    setTrackerActionError('')
    try {
      await action()
      await invalidateStateQueries()
    } catch (error) {
      setTrackerActionError(errorMessage(error, 'Tracker action failed.'))
    } finally {
      setTrackerBusyKey('')
    }
  }

  async function handleSessionClose(): Promise<void> {
    setSessionActionError('')
    setSessionActionNotice('')
    try {
      const result = await closeSession(trackerMode)
      setSessionActionNotice(`Exported: ${result.pathsWritten.join(', ')}`)
      setSessionCloseConfirming(false)
      await invalidateStateQueries()
    } catch (error) {
      setSessionActionError(errorMessage(error, 'Session close failed.'))
    }
  }

  function loadChapterDraftFromBundle(bundle: ChapterBundle | null, sourceChapterId = ''): void {
    setChapterDraftState(chapterBundleToDraft(bundle, sourceChapterId))
    setChapterDraftView('overview')
    setChapterDraftSelection({
      facts: bundle?.facts?.facts?.[0]?.id || '',
      handouts: bundle?.handouts?.handouts?.[0]?.id || '',
      beats: bundle?.beats?.beats?.[0]?.id || '',
      scenes: bundle?.scenes?.scenes?.[0]?.id || '',
    })
    setChapterDraftNotice('Loaded live chapter into an in-memory draft.')
    setChapterWorkspaceMode('planning')
    navigate('/chapters')
  }

  function createBlankChapterDraft(): void {
    const sourceChapterId = selectedChapterSummary?.id
      || chapterDetail?.chapterId
      || (campaignQuery.data?.currentChapter ? `chapter-${campaignQuery.data.currentChapter}` : 'chapter-3')
    setChapterDraftState(createEmptyChapterDraft(sourceChapterId))
    setChapterDraftView('overview')
    setChapterDraftSelection({ facts: '', handouts: '', beats: '', scenes: '' })
    setChapterDraftNotice('Created a new blank in-memory chapter draft.')
    setChapterWorkspaceMode('planning')
    navigate('/chapters')
  }

  function forkSelectedChapterIntoDraft(): void {
    const bundle = chapterDetail || null
    if (!bundle) return
    loadChapterDraftFromBundle(bundle, bundle.chapterId || selectedChapterSummary?.id || '')
    setChapterDraftNotice(`Forked ${bundle.chapterId || 'chapter'} into a draft.`)
    setChapterWorkspaceMode('planning')
  }

  function selectChapterDraftItem(kind: 'facts' | 'handouts' | 'beats' | 'scenes', id: string): void {
    setChapterDraftSelection((current) => ({ ...current, [kind]: id }))
  }

  function updateChapterDraftField(field: 'title' | 'summary', value: string): void {
    setChapterDraftState((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function updateChapterDraftId(value: string): void {
    setChapterDraftState((current) => {
      const chapterId = String(value || '').trim() || current.chapterId || 'chapter-draft'
      return {
        ...current,
        chapterId,
        facts: { ...current.facts, chapterId, id: `${chapterId}-facts` },
        handouts: { ...current.handouts, chapterId, id: `${chapterId}-handouts` },
        beats: { ...current.beats, chapterId, id: `${chapterId}-beats` },
        scenes: { ...current.scenes, chapterId, id: `${chapterId}-scenes` },
      }
    })
  }

  function updateChapterDraftCollection(
    collectionKey: 'facts' | 'handouts' | 'beats' | 'scenes',
    itemId: string,
    patch: Record<string, unknown>,
  ): void {
    setChapterDraftState((current) => {
      const next = cloneJson(current)
      const collection = next[collectionKey]
      const items = Array.isArray((collection as Record<string, unknown>)[collectionKey])
        ? ((collection as Record<string, unknown>)[collectionKey] as Array<Record<string, unknown>>)
        : []
      ;(collection as Record<string, unknown>)[collectionKey] = items.map((item) => (item.id === itemId ? { ...item, ...patch } : item))
      return next
    })
  }

  function appendChapterDraftItem(collectionKey: 'facts' | 'handouts' | 'beats' | 'scenes', defaults: Record<string, unknown>): void {
    setChapterDraftState((current) => {
      const next = cloneJson(current)
      const collection = next[collectionKey]
      const items = Array.isArray((collection as Record<string, unknown>)[collectionKey])
        ? ((collection as Record<string, unknown>)[collectionKey] as Array<Record<string, unknown>>)
        : []
      const existingIds = items.map((item) => String(item.id))
      const itemId = typeof defaults.id === 'string' ? defaults.id : uniqueDraftId(`${next.chapterId}-${collectionKey.slice(0, -1)}`, existingIds)
      const nextItem = { id: itemId, ...defaults }
      ;(collection as Record<string, unknown>).chapterId = next.chapterId
      ;(collection as Record<string, unknown>)[collectionKey] = [...items, nextItem]
      return next
    })
  }

  function removeChapterDraftItem(collectionKey: 'facts' | 'handouts' | 'beats' | 'scenes', itemId: string): void {
    setChapterDraftState((current) => {
      const next = cloneJson(current)
      const collection = next[collectionKey]
      const items = Array.isArray((collection as Record<string, unknown>)[collectionKey])
        ? ((collection as Record<string, unknown>)[collectionKey] as Array<Record<string, unknown>>)
        : []
      ;(collection as Record<string, unknown>)[collectionKey] = items.filter((item) => item.id !== itemId)
      return next
    })
  }

  function exportChapterDraft(): void {
    downloadJson(`${chapterDraftState.chapterId || 'chapter-draft'}.json`, chapterDraftState)
    setChapterDraftNotice('Exported draft JSON.')
  }

  async function copyChapterDraft(): Promise<void> {
    try {
      await copyJsonToClipboard(chapterDraftState)
      setChapterDraftNotice('Copied draft JSON to clipboard.')
    } catch {
      setChapterDraftNotice('Clipboard copy failed. Use Export draft JSON instead.')
    }
  }

  function navigateTo(path: string): void {
    navigate(path)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="tb-row">
          <div className="brand-stack">
            <div className="eyebrow">Karsac DM Assistant</div>
            <h1>Karsac UI</h1>
          </div>
          <nav className="mode-tabs">
            {sections.map((section) => (
              <button
                key={section.id}
                data-mode-tab={section.id}
                className={activeSection === section.id ? 'active' : ''}
                onClick={() => navigateTo(section.path)}
              >
                {section.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="tb-row tb-row-secondary">
          <div className="toolbar-chip">
            {activeSection === 'corpus'
              ? (readMode === 'planning' ? 'Planning corpus is visible' : 'Live corpus is visible')
              : activeSection === 'proposals'
                ? 'Proposals are reviewable in the current read mode'
                : activeSection === 'chapters'
                  ? 'Chapter state is loaded from the live service'
                  : activeSection === 'tracker'
                    ? 'Tracker is operating on live state only'
                    : 'Session close exports a live-state summary'}
          </div>
          <div className="mode-switch">
            <span className="mode-label">Read mode</span>
            <button className={readMode === 'live' ? 'active' : ''} onClick={() => setReadMode('live')}>
              Live
            </button>
            <button className={readMode === 'planning' ? 'active' : ''} onClick={() => setReadMode('planning')}>
              Planning
            </button>
          </div>
        </div>
      </header>

      <main className="layout">
        <nav className="sidebar">
          {sections.map((section) => (
            <button
              key={section.id}
              className={activeSection === section.id ? 'nav-item active' : 'nav-item'}
              onClick={() => navigateTo(section.path)}
            >
              {section.label}
            </button>
          ))}
        </nav>

        <section className="workspace">
          <div className="workspace-head">
            <div>
              <div className="workspace-kicker">Task 0002</div>
              <h2>{sections.find((section) => section.id === activeSection)?.label}</h2>
            </div>
            <div className="status-chip">{readMode.toUpperCase()}</div>
          </div>

          {activeSection === 'corpus' ? (
            <div className="panel">
              <p className="lede">{subtitle}</p>
              <div className="meta-row">
                <span className="meta-pill">{corpusListQuery.isLoading ? 'Loading corpus' : `${visibleEntities.length} entities`}</span>
                <span className="meta-pill">{campaignQuery.isLoading ? 'Loading campaign' : `Chapter ${campaignQuery.data?.currentChapter ?? 'n/a'}`}</span>
              </div>
              {(corpusListQuery.error || corpusDetailQuery.error || campaignQuery.error) && (
                <div className="error-card">
                  {errorMessage(corpusListQuery.error || corpusDetailQuery.error || campaignQuery.error, 'Failed to load corpus.')}
                </div>
              )}
              <div className="corpus-toolbar">
                <input
                  className="search-input"
                  type="search"
                  placeholder="Search entities"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <select className="select" value={entityType} onChange={(event) => setEntityType(event.target.value)}>
                  <option value="all">All types</option>
                  {Array.from(new Set(corpusEntities.map((entity) => entity.type).filter(Boolean))).sort().map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div className="corpus-grid">
                <div className="entity-list">
                  {visibleEntities.length ? visibleEntities.map((entity) => (
                    <button
                      key={entity.id}
                      className={selectedCorpusId === entity.id ? 'entity-card active' : 'entity-card'}
                      onClick={() => setSelectedCorpusId(entity.id)}
                    >
                      <div className="entity-card-top">
                        <div>
                          <strong>{entity.title}</strong>
                          <div className="proposal-chip-row">
                            <span className={typeClassName(entity.type)}>{entity.type}</span>
                            <span className={entity.source === 'planning' ? 'source-chip source-planning' : 'source-chip source-collections'}>
                              {entity.source}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="entity-id">{entity.id}</div>
                      <div className="entity-summary">{entity.summary || 'No summary available.'}</div>
                    </button>
                  )) : (
                    <div className="placeholder-card">No corpus entities matched the current filters.</div>
                  )}
                </div>
                <div className="entity-detail">
                  {corpusDetail ? (
                    <>
                      <div className="entity-detail-head">
                        <div>
                          <div className="workspace-kicker">{corpusDetail.type}</div>
                          <h3>{corpusDetail.title}</h3>
                          <div className={typeClassName(corpusDetail.type)}>{corpusDetail.type}</div>
                        </div>
                        <div className="proposal-chip-row">
                          <div className="status-chip subtle">{corpusDetail.canonical || 'unknown'}</div>
                          <div className={corpusDetail.source === 'planning' ? 'source-chip source-planning' : 'source-chip source-collections'}>
                            {corpusDetail.source}
                          </div>
                        </div>
                      </div>
                      <div className="detail-grid">
                        <div><span>Source</span><strong>{corpusDetail.source}</strong></div>
                        <div><span>Visibility</span><strong>{corpusDetail.visibility || 'n/a'}</strong></div>
                        <div><span>Path</span><strong>{corpusDetail.path}</strong></div>
                        <div><span>Related</span><strong>{Object.entries(corpusDetail.related || {}).filter(([, value]) => Array.isArray(value) && value.length).map(([key]) => key).join(', ') || 'none'}</strong></div>
                      </div>
                      <div className="content-block markdown-block">
                        {renderMarkdown(corpusDetail.content || 'No content loaded.')}
                      </div>
                    </>
                  ) : corpusDetailQuery.isLoading ? (
                    <div className="placeholder-card">Loading entity detail…</div>
                  ) : (
                    <div className="placeholder-card">Select an entity to inspect its corpus record.</div>
                  )}
                </div>
              </div>
            </div>
          ) : activeSection === 'proposals' ? (
            <div className="panel">
              <p className="lede">{subtitle}</p>
              <div className="meta-row">
                <span className="meta-pill">{proposalListQuery.isLoading ? 'Loading proposals' : `${visibleProposals.length} proposals`}</span>
                <span className="meta-pill">{proposalDetail?.review?.review_status || 'pending review'}</span>
              </div>
              {(proposalListQuery.error || proposalDetailQuery.error || proposalActionError) && (
                <div className="error-card">
                  {proposalActionError || errorMessage(proposalListQuery.error || proposalDetailQuery.error, 'Failed to load proposals.')}
                </div>
              )}
              <div className="corpus-toolbar">
                <input
                  className="search-input"
                  type="search"
                  placeholder="Search proposals"
                  value={proposalQuery}
                  onChange={(event) => setProposalQuery(event.target.value)}
                />
              </div>
              <div className="proposal-grid">
                <div className="proposal-list">
                  {visibleProposals.length ? visibleProposals.map((proposal) => (
                    <button
                      key={proposal.id}
                      className={selectedProposalId === proposal.id ? 'proposal-card active' : 'proposal-card'}
                      onClick={() => setSelectedProposalId(proposal.id)}
                    >
                      <div className="entity-card-top">
                        <strong>{proposal.title}</strong>
                        <span className={typeClassName(proposal.proposalType)}>{proposal.proposalType}</span>
                      </div>
                      <div className="proposal-chip-row">
                        <span className="status-chip">{proposal.status}</span>
                        <span className={validationClassName(proposal.validation.status)}>{proposal.validation.status}</span>
                      </div>
                      <div className="entity-id">{proposal.id}</div>
                      <div className="entity-summary">{proposal.summary}</div>
                    </button>
                  )) : (
                    <div className="placeholder-card">No proposals matched the current filters.</div>
                  )}
                </div>
                <div className="entity-detail">
                  {proposalDetail ? (
                    <>
                      <div className="entity-detail-head">
                        <div>
                          <div className="workspace-kicker">{proposalDetail.proposalType}</div>
                          <h3>{proposalDetail.title}</h3>
                          <div className={typeClassName(proposalDetail.proposalType)}>{proposalDetail.proposalType}</div>
                        </div>
                        <div className={validationClassName(proposalDetail.validation.status)}>{proposalDetail.validation.status}</div>
                      </div>
                      <div className="detail-grid">
                        <div><span>Status</span><strong>{proposalDetail.status}</strong></div>
                        <div><span>Review</span><strong>{proposalDetail.review.review_status}</strong></div>
                        <div><span>Promote target</span><strong>{proposalDetail.promoteTarget || 'n/a'}</strong></div>
                        <div><span>Validation</span><strong>{proposalDetail.validation.issues.length ? `${proposalDetail.validation.issues.length} issue(s)` : 'clean'}</strong></div>
                      </div>
                      <div className="proposal-actions">
                        <button className="nav-item" onClick={() => reviewMutation.mutate()} disabled={reviewMutation.isPending}>
                          Mark reviewed
                        </button>
                        <button className="nav-item" onClick={() => promoteMutation.mutate(false)} disabled={promoteMutation.isPending}>
                          Promote
                        </button>
                        {proposalForceReady && (
                          <button className="nav-item" onClick={() => promoteMutation.mutate(true)} disabled={promoteMutation.isPending}>
                            Force promote
                          </button>
                        )}
                      </div>
                      <div className="detail-grid">
                        <div><span>Source prompt</span><strong>{proposalDetail.sourcePrompt || 'n/a'}</strong></div>
                        <div><span>Path</span><strong>{proposalDetail.path}</strong></div>
                      </div>
                      <div className="content-block markdown-block">
                        {renderMarkdown(proposalDetail.body || 'No proposal body loaded.')}
                      </div>
                      <div className="content-block markdown-block">
                        <h4>Frontmatter</h4>
                        <pre><code>{JSON.stringify(proposalDetail.frontmatter || {}, null, 2)}</code></pre>
                      </div>
                      {proposalDetail.validation.issues.length > 0 && (
                        <div className="content-block markdown-block">
                          {renderMarkdown(`## Validation\n${proposalDetail.validation.issues.map((issue) => `- ${issue}`).join('\n')}`)}
                        </div>
                      )}
                    </>
                  ) : proposalDetailQuery.isLoading ? (
                    <div className="placeholder-card">Loading proposal detail…</div>
                  ) : (
                    <div className="placeholder-card">Select a proposal to review or promote it.</div>
                  )}
                </div>
              </div>
            </div>
          ) : activeSection === 'chapters' ? (
            <div className="panel">
              <p className="lede">{subtitle}</p>
              <div className="meta-row">
                <span className="meta-pill">{chapterListQuery.isLoading ? 'Loading chapters' : `${chapters.length} chapters`}</span>
                <span className="meta-pill">{chapterDetail?.chapterId || 'No chapter selected'}</span>
                <span className="meta-pill">{chapterDetail?.progress?.currentCheckpoint?.label || 'No checkpoint'}</span>
                <span className="meta-pill">{percentLabel(chapterDetail?.progress?.coverage?.percent)}</span>
              </div>
              {(chapterListQuery.error || chapterDetailQuery.error) && (
                <div className="error-card">
                  {errorMessage(chapterListQuery.error || chapterDetailQuery.error, 'Failed to load chapters.')}
                </div>
              )}
              <div className="chapter-workspace-layout">
                <div className="chapter-control-bar">
                  <label className="tracker-select-field">
                    <span>Chapter workspace</span>
                    <select
                      value={selectedChapterId}
                      onChange={(event) => {
                        setSelectedChapterId(event.target.value)
                        setSelectedChapterView('overview')
                      }}
                    >
                      {chapters.map((chapter) => (
                        <option key={chapter.id} value={chapter.id}>
                          {chapter.id.replace('chapter-', 'Chapter ')}
                          {chapter.current ? ' · current' : chapter.locked ? ' · locked' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="tracker-status-group">
                    <span className={selectedChapterSummary?.current ? 'status-chip' : 'status-chip subtle'}>
                      {selectedChapterSummary?.current ? 'Current chapter' : 'Reference chapter'}
                    </span>
                    <span className={selectedChapterSummary?.locked ? 'status-chip subtle' : 'status-chip'}>
                      {selectedChapterSummary?.locked ? 'Locked' : 'Editable'}
                    </span>
                  </div>
                  <div className="chapter-workspace-switch">
                    <button
                      className={chapterWorkspaceMode === 'state' ? 'chapter-tab active' : 'chapter-tab'}
                      onClick={() => setChapterWorkspaceMode('state')}
                    >
                      Live State
                    </button>
                    <button
                      className={chapterWorkspaceMode === 'planning' ? 'chapter-tab active' : 'chapter-tab'}
                      onClick={() => setChapterWorkspaceMode('planning')}
                    >
                      Planning Draft
                    </button>
                  </div>
                </div>
                <div className="chapter-workspace-detail">
                  {chapterDetail || selectedChapterSummary ? (
                    <>
                      <div className="entity-detail-head">
                        <div>
                          <div className="workspace-kicker">Selected chapter</div>
                          <h3>{chapterDetail?.chapterId || selectedChapterSummary?.id || 'Chapter workspace'}</h3>
                          <div className={typeClassName('chapter')}>chapter</div>
                        </div>
                        <div className={chapterCheckpoint ? 'status-chip' : 'status-chip subtle'}>
                          {chapterCheckpoint?.label || 'No checkpoint'}
                        </div>
                      </div>
                      <div className="chapter-action-row">
                        <button className="chapter-mini-btn" onClick={createBlankChapterDraft}>
                          New draft
                        </button>
                        <button className="chapter-mini-btn" onClick={forkSelectedChapterIntoDraft} disabled={!chapterDetail}>
                          Fork live chapter
                        </button>
                        <button className="chapter-mini-btn" onClick={exportChapterDraft}>
                          Export draft JSON
                        </button>
                        <button className="chapter-mini-btn" onClick={() => void copyChapterDraft()}>
                          Copy JSON
                        </button>
                      </div>
                      {chapterDraftNotice && (
                        <div className="placeholder-card">{chapterDraftNotice}</div>
                      )}
                      {chapterWorkspaceMode === 'state' ? (
                        <>
                          <div className="chapter-tab-row">
                            {chapterViews.map((view) => (
                              <button
                                key={view.id}
                                className={selectedChapterView === view.id ? 'chapter-tab active' : 'chapter-tab'}
                                onClick={() => setSelectedChapterView(view.id)}
                              >
                                {view.label}
                              </button>
                            ))}
                          </div>
                          {selectedChapterView === 'facts' ? (
                        <div className="chapter-lane">
                          {chapterFacts.length ? chapterFacts.map((fact: ChapterFact) => (
                            <div key={fact.id} className="chapter-drill-card">
                              <div className="chapter-drill-head">
                                <strong>{fact.id}</strong>
                                <span className={fact.revealed ? 'status-chip' : 'status-chip subtle'}>
                                  {fact.revealed ? 'Revealed' : 'Hidden'}
                                </span>
                              </div>
                              <div className="chapter-drill-meta">{fact.knowledgeStatus || 'unknown'}</div>
                            </div>
                          )) : <div className="placeholder-card">No facts are defined for this chapter.</div>}
                        </div>
                          ) : selectedChapterView === 'handouts' ? (
                        <div className="chapter-lane">
                          {chapterHandouts.length ? chapterHandouts.map((handout: ChapterHandout) => (
                            <div key={handout.id} className="chapter-drill-card">
                              <div className="chapter-drill-head">
                                <strong>{handout.label || handout.id}</strong>
                                <span className={handout.posted ? 'status-chip' : 'status-chip subtle'}>
                                  {handout.posted ? 'Posted' : 'Unposted'}
                                </span>
                              </div>
                              <div className="chapter-drill-meta">{handout.desc || handout.source || 'No description available.'}</div>
                            </div>
                          )) : <div className="placeholder-card">No handouts are defined for this chapter.</div>}
                        </div>
                          ) : selectedChapterView === 'beats' ? (
                        <div className="chapter-lane">
                          {chapterBeats.length ? chapterBeats.map((beat: ChapterBeat) => (
                            <div key={beat.id} className="chapter-drill-card">
                              <div className="chapter-drill-head">
                                <strong>{beat.label || beat.id}</strong>
                                <span className={beat.completed ? 'status-chip' : 'status-chip subtle'}>
                                  {beat.completed ? 'Complete' : 'Pending'}
                                </span>
                              </div>
                              <div className="chapter-drill-meta">{beat.desc || 'No description available.'}</div>
                            </div>
                          )) : <div className="placeholder-card">No beats are defined for this chapter.</div>}
                        </div>
                          ) : selectedChapterView === 'scenes' ? (
                        <div className="chapter-lane">
                          {chapterScenes.length ? chapterScenes.map((scene: ChapterScene) => (
                            <div key={scene.id} className="chapter-scene-card">
                              <div className="chapter-scene-meta">{scene.kind || 'scene'} · {scene.id}</div>
                              <strong>{scene.label || scene.title || scene.id}</strong>
                              <div>{scene.summary || 'No summary available.'}</div>
                              <div className="chapter-scene-actions">
                                {scene.kind === 'thread' ? 'Thread scene' : scene.kind === 'support' ? 'Support scene' : 'Core scene'}
                              </div>
                            </div>
                          )) : <div className="placeholder-card">No scenes are defined for this chapter.</div>}
                        </div>
                          ) : (
                        <>
                          <div className="detail-grid">
                            <div><span>Facts</span><strong>{chapterFacts.length}</strong></div>
                            <div><span>Handouts</span><strong>{chapterHandouts.length}</strong></div>
                            <div><span>Beats</span><strong>{chapterBeats.length}</strong></div>
                            <div><span>Scenes</span><strong>{chapterScenes.length}</strong></div>
                          </div>
                          <div className="chapter-progress">
                            <div className="chapter-progress-head">
                              <span>Coverage</span>
                              <strong>{percentLabel(chapterDetail?.progress?.coverage?.percent)}</strong>
                            </div>
                            <div className="chapter-progress-bar">
                              <div className="chapter-progress-fill" style={{ width: percentLabel(chapterDetail?.progress?.coverage?.percent) }} />
                            </div>
                            <div className="chapter-progress-grid">
                              <div className="chapter-progress-item">
                                <span>Facts</span>
                                <strong>{chapterDetail?.progress?.coverage?.facts?.completed || 0}/{chapterDetail?.progress?.coverage?.facts?.total || 0}</strong>
                              </div>
                              <div className="chapter-progress-item">
                                <span>Handouts</span>
                                <strong>{chapterDetail?.progress?.coverage?.handouts?.completed || 0}/{chapterDetail?.progress?.coverage?.handouts?.total || 0}</strong>
                              </div>
                              <div className="chapter-progress-item">
                                <span>Beats</span>
                                <strong>{chapterDetail?.progress?.coverage?.beats?.completed || 0}/{chapterDetail?.progress?.coverage?.beats?.total || 0}</strong>
                              </div>
                              <div className="chapter-progress-item">
                                <span>Checkpoint</span>
                                <strong>{chapterDetail?.progress?.currentCheckpoint?.index ?? 0}</strong>
                              </div>
                            </div>
                          </div>
                          <div className="content-block markdown-block">
                            <h4>Checkpoint recap</h4>
                            {(chapterCheckpoint?.recap || []).length ? (
                              <ul>
                                {(chapterCheckpoint?.recap || []).map((line, index) => (
                                  <li key={index}>{line}</li>
                                ))}
                              </ul>
                            ) : (
                              <p>No checkpoint recap is available.</p>
                            )}
                          </div>
                          <div className="content-block markdown-block">
                            <h4>Scene index</h4>
                            <div className="chapter-scene-grid">
                              {chapterScenes.map((scene: ChapterScene) => (
                                <div key={scene.id} className="chapter-scene-card">
                                  <div className="chapter-scene-meta">{scene.kind || 'scene'} · {scene.id}</div>
                                  <strong>{scene.label || scene.title || scene.id}</strong>
                                  <div>{scene.summary || 'No summary available.'}</div>
                                  <div className="chapter-scene-actions">
                                    {scene.kind === 'thread' ? 'Thread scene' : scene.kind === 'support' ? 'Support scene' : 'Core scene'}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                          )}
                        </>
                      ) : (
                        <div className="chapter-draft-layout">
                          <div className="chapter-draft-sidebar">
                            <div className="placeholder-card">
                              Planning draft mode is explicit here. Use this surface for chapter prep without confusing it with the live tracked bundle.
                            </div>
                            <div className="chapter-draft-grid">
                              <label className="chapter-draft-field">
                                <span>Source chapter</span>
                                <input value={chapterDraftState.sourceChapterId} readOnly />
                              </label>
                              <label className="chapter-draft-field">
                                <span>Chapter ID</span>
                                <input value={chapterDraftState.chapterId} onChange={(event) => updateChapterDraftId(event.target.value)} />
                              </label>
                              <label className="chapter-draft-field chapter-draft-field-wide">
                                <span>Title</span>
                                <input value={chapterDraftState.title} onChange={(event) => updateChapterDraftField('title', event.target.value)} />
                              </label>
                              <label className="chapter-draft-field chapter-draft-field-wide">
                                <span>Summary</span>
                                <textarea rows={3} value={chapterDraftState.summary} onChange={(event) => updateChapterDraftField('summary', event.target.value)} />
                              </label>
                            </div>
                            <div className="chapter-tab-row">
                              {(['overview', 'facts', 'handouts', 'beats', 'scenes'] as const).map((view) => (
                                <button
                                  key={view}
                                  className={chapterDraftView === view ? 'chapter-tab active' : 'chapter-tab'}
                                  onClick={() => setChapterDraftView(view)}
                                >
                                  {view[0].toUpperCase()}{view.slice(1)}
                                </button>
                              ))}
                            </div>
                            {chapterDraftView === 'overview' ? (
                              <>
                                <div className="detail-grid">
                                  <div><span>Facts</span><strong>{chapterDraftFacts.length}</strong></div>
                                  <div><span>Handouts</span><strong>{chapterDraftHandouts.length}</strong></div>
                                  <div><span>Beats</span><strong>{chapterDraftBeats.length}</strong></div>
                                  <div><span>Scenes</span><strong>{chapterDraftScenes.length}</strong></div>
                                </div>
                                <div className="content-block markdown-block">
                                  <h4>Draft checkpoint</h4>
                                  <p>{chapterDraftCheckpoint?.label || 'No checkpoint label yet.'}</p>
                                </div>
                              </>
                            ) : chapterDraftView === 'facts' ? (
                              <div className="chapter-lane">
                                <div className="chapter-draft-actions">
                                  <button className="chapter-mini-btn" onClick={() => appendChapterDraftItem('facts', { knowledgeStatus: 'available', revealed: false })}>
                                    Add fact
                                  </button>
                                </div>
                                {chapterDraftFacts.length ? chapterDraftFacts.map((fact: ChapterFact) => (
                                  <div
                                    key={fact.id}
                                    className={chapterDraftSelection.facts === fact.id ? 'chapter-drill-card active' : 'chapter-drill-card'}
                                    onClick={() => selectChapterDraftItem('facts', fact.id)}
                                  >
                                    <div className="chapter-drill-head">
                                      <strong>{fact.id}</strong>
                                      <div className="chapter-scene-actions">
                                        <button className="chapter-mini-btn" onClick={(event) => { event.stopPropagation(); removeChapterDraftItem('facts', fact.id) }}>
                                          Remove
                                        </button>
                                      </div>
                                    </div>
                                    <div className="chapter-drill-meta">{fact.knowledgeStatus || 'available'} · {fact.revealed ? 'revealed' : 'hidden'}</div>
                                  </div>
                                )) : <div className="placeholder-card">No draft facts yet.</div>}
                              </div>
                            ) : chapterDraftView === 'handouts' ? (
                              <div className="chapter-lane">
                                <div className="chapter-draft-actions">
                                  <button className="chapter-mini-btn" onClick={() => appendChapterDraftItem('handouts', { posted: false })}>
                                    Add handout
                                  </button>
                                </div>
                                {chapterDraftHandouts.length ? chapterDraftHandouts.map((handout: ChapterHandout) => (
                                  <div
                                    key={handout.id}
                                    className={chapterDraftSelection.handouts === handout.id ? 'chapter-drill-card active' : 'chapter-drill-card'}
                                    onClick={() => selectChapterDraftItem('handouts', handout.id)}
                                  >
                                    <div className="chapter-drill-head">
                                      <strong>{handout.id}</strong>
                                      <div className="chapter-scene-actions">
                                        <button className="chapter-mini-btn" onClick={(event) => { event.stopPropagation(); removeChapterDraftItem('handouts', handout.id) }}>
                                          Remove
                                        </button>
                                      </div>
                                    </div>
                                    <div className="chapter-drill-meta">{handout.label || handout.id} · {handout.posted ? 'posted' : 'unposted'}</div>
                                  </div>
                                )) : <div className="placeholder-card">No draft handouts yet.</div>}
                              </div>
                            ) : chapterDraftView === 'beats' ? (
                              <div className="chapter-lane">
                                <div className="chapter-draft-actions">
                                  <button className="chapter-mini-btn" onClick={() => appendChapterDraftItem('beats', { completed: false })}>
                                    Add beat
                                  </button>
                                </div>
                                {chapterDraftBeats.length ? chapterDraftBeats.map((beat: ChapterBeat) => (
                                  <div
                                    key={beat.id}
                                    className={chapterDraftSelection.beats === beat.id ? 'chapter-drill-card active' : 'chapter-drill-card'}
                                    onClick={() => selectChapterDraftItem('beats', beat.id)}
                                  >
                                    <div className="chapter-drill-head">
                                      <strong>{beat.id}</strong>
                                      <div className="chapter-scene-actions">
                                        <button className="chapter-mini-btn" onClick={(event) => { event.stopPropagation(); removeChapterDraftItem('beats', beat.id) }}>
                                          Remove
                                        </button>
                                      </div>
                                    </div>
                                    <div className="chapter-drill-meta">{beat.label || beat.id} · {beat.completed ? 'complete' : 'pending'}</div>
                                  </div>
                                )) : <div className="placeholder-card">No draft beats yet.</div>}
                              </div>
                            ) : (
                              <div className="chapter-lane">
                                <div className="chapter-draft-actions">
                                  <button
                                    className="chapter-mini-btn"
                                    onClick={() => appendChapterDraftItem('scenes', { kind: 'scene', order: chapterDraftScenes.length + 1, facts: [], handouts: [], beats: [] })}
                                  >
                                    Add scene
                                  </button>
                                </div>
                                {chapterDraftScenes.length ? chapterDraftScenes.map((scene: ChapterScene) => (
                                  <div
                                    key={scene.id}
                                    className={chapterDraftSelection.scenes === scene.id ? 'chapter-drill-card active' : 'chapter-drill-card'}
                                    onClick={() => selectChapterDraftItem('scenes', scene.id)}
                                  >
                                    <div className="chapter-drill-head">
                                      <strong>{scene.id}</strong>
                                      <div className="chapter-scene-actions">
                                        <button className="chapter-mini-btn" onClick={(event) => { event.stopPropagation(); removeChapterDraftItem('scenes', scene.id) }}>
                                          Remove
                                        </button>
                                      </div>
                                    </div>
                                    <div className="chapter-drill-meta">{scene.label || scene.id} · {scene.kind || 'scene'} · {scene.order ?? 0}</div>
                                  </div>
                                )) : <div className="placeholder-card">No draft scenes yet.</div>}
                              </div>
                            )}
                          </div>
                          <div className="chapter-inspector">
                            {chapterDraftView === 'facts' && selectedDraftFact && (
                              <div className="chapter-inspector-card">
                                <div className="chapter-drill-head">
                                  <strong>Edit fact</strong>
                                  <span className="status-chip subtle">{selectedDraftFact.id}</span>
                                </div>
                                <div className="chapter-draft-grid">
                                  <label className="chapter-draft-field">
                                    <span>Knowledge status</span>
                                    <select
                                      value={selectedDraftFact.knowledgeStatus || 'available'}
                                      onChange={(event) => updateChapterDraftCollection('facts', selectedDraftFact.id, { knowledgeStatus: event.target.value })}
                                    >
                                      <option value="available">available</option>
                                      <option value="known">known</option>
                                      <option value="revealed">revealed</option>
                                    </select>
                                  </label>
                                  <label className="chapter-draft-field">
                                    <span>Revealed</span>
                                    <select
                                      value={selectedDraftFact.revealed ? 'true' : 'false'}
                                      onChange={(event) => updateChapterDraftCollection('facts', selectedDraftFact.id, { revealed: event.target.value === 'true' })}
                                    >
                                      <option value="false">false</option>
                                      <option value="true">true</option>
                                    </select>
                                  </label>
                                </div>
                              </div>
                            )}
                            {chapterDraftView === 'handouts' && selectedDraftHandout && (
                              <div className="chapter-inspector-card">
                                <div className="chapter-drill-head">
                                  <strong>Edit handout</strong>
                                  <span className="status-chip subtle">{selectedDraftHandout.id}</span>
                                </div>
                                <div className="chapter-draft-grid">
                                  <label className="chapter-draft-field">
                                    <span>Label</span>
                                    <input
                                      value={selectedDraftHandout.label || ''}
                                      onChange={(event) => updateChapterDraftCollection('handouts', selectedDraftHandout.id, { label: event.target.value })}
                                    />
                                  </label>
                                  <label className="chapter-draft-field">
                                    <span>Posted</span>
                                    <select
                                      value={selectedDraftHandout.posted ? 'true' : 'false'}
                                      onChange={(event) => updateChapterDraftCollection('handouts', selectedDraftHandout.id, { posted: event.target.value === 'true' })}
                                    >
                                      <option value="false">false</option>
                                      <option value="true">true</option>
                                    </select>
                                  </label>
                                  <label className="chapter-draft-field chapter-draft-field-wide">
                                    <span>Description</span>
                                    <textarea
                                      rows={3}
                                      value={selectedDraftHandout.desc || ''}
                                      onChange={(event) => updateChapterDraftCollection('handouts', selectedDraftHandout.id, { desc: event.target.value })}
                                    />
                                  </label>
                                </div>
                              </div>
                            )}
                            {chapterDraftView === 'beats' && selectedDraftBeat && (
                              <div className="chapter-inspector-card">
                                <div className="chapter-drill-head">
                                  <strong>Edit beat</strong>
                                  <span className="status-chip subtle">{selectedDraftBeat.id}</span>
                                </div>
                                <div className="chapter-draft-grid">
                                  <label className="chapter-draft-field">
                                    <span>Label</span>
                                    <input
                                      value={selectedDraftBeat.label || ''}
                                      onChange={(event) => updateChapterDraftCollection('beats', selectedDraftBeat.id, { label: event.target.value })}
                                    />
                                  </label>
                                  <label className="chapter-draft-field">
                                    <span>Completed</span>
                                    <select
                                      value={selectedDraftBeat.completed ? 'true' : 'false'}
                                      onChange={(event) => updateChapterDraftCollection('beats', selectedDraftBeat.id, { completed: event.target.value === 'true' })}
                                    >
                                      <option value="false">false</option>
                                      <option value="true">true</option>
                                    </select>
                                  </label>
                                  <label className="chapter-draft-field chapter-draft-field-wide">
                                    <span>Description</span>
                                    <textarea
                                      rows={3}
                                      value={selectedDraftBeat.desc || ''}
                                      onChange={(event) => updateChapterDraftCollection('beats', selectedDraftBeat.id, { desc: event.target.value })}
                                    />
                                  </label>
                                </div>
                              </div>
                            )}
                            {chapterDraftView === 'scenes' && selectedDraftScene && (
                              <div className="chapter-inspector-card">
                                <div className="chapter-drill-head">
                                  <strong>Edit scene</strong>
                                  <span className="status-chip subtle">{selectedDraftScene.id}</span>
                                </div>
                                <div className="chapter-draft-grid">
                                  <label className="chapter-draft-field">
                                    <span>Kind</span>
                                    <input
                                      value={selectedDraftScene.kind || 'scene'}
                                      onChange={(event) => updateChapterDraftCollection('scenes', selectedDraftScene.id, { kind: event.target.value })}
                                    />
                                  </label>
                                  <label className="chapter-draft-field">
                                    <span>Order</span>
                                    <input
                                      type="number"
                                      value={selectedDraftScene.order ?? 0}
                                      onChange={(event) => updateChapterDraftCollection('scenes', selectedDraftScene.id, { order: Number(event.target.value) })}
                                    />
                                  </label>
                                  <label className="chapter-draft-field chapter-draft-field-wide">
                                    <span>Label</span>
                                    <input
                                      value={selectedDraftScene.label || ''}
                                      onChange={(event) => updateChapterDraftCollection('scenes', selectedDraftScene.id, { label: event.target.value })}
                                    />
                                  </label>
                                  <label className="chapter-draft-field chapter-draft-field-wide">
                                    <span>Summary</span>
                                    <textarea
                                      rows={4}
                                      value={selectedDraftScene.summary || ''}
                                      onChange={(event) => updateChapterDraftCollection('scenes', selectedDraftScene.id, { summary: event.target.value })}
                                    />
                                  </label>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  ) : chapterDetailQuery.isLoading ? (
                    <div className="placeholder-card">Loading chapter detail…</div>
                  ) : (
                    <div className="placeholder-card">Select a chapter to inspect its state bundle.</div>
                  )}
                </div>
              </div>
            </div>
          ) : activeSection === 'tracker' ? (
            <div className="panel">
              <p className="lede">{subtitle}</p>
              {readMode === 'planning' && (
                <div className="placeholder-card">Tracker always operates on live state. The global mode toggle does not expose planning content here.</div>
              )}
              <div className="meta-row">
                <span className="meta-pill">{campaignQuery.isLoading ? 'Loading campaign' : `Chapter ${campaignQuery.data?.currentChapter ?? 'n/a'}`}</span>
                <span className="meta-pill">{campaignQuery.isLoading ? 'Loading session' : `Session ${campaignQuery.data?.currentSession ?? 'n/a'}`}</span>
                <span className="meta-pill">{chapterDetail?.progress?.currentCheckpoint?.label || 'No checkpoint'}</span>
                <span className="meta-pill">{campaignQuery.data?.clock ? `${campaignQuery.data.clock.value}/${campaignQuery.data.clock.max ?? 16}` : 'No clock'}</span>
                <span className="meta-pill">{worldThreads.length} threads</span>
              </div>
              {(campaignQuery.error || chapterListQuery.error || chapterDetailQuery.error || worldThreadsQuery.error || trackerActionError) && (
                <div className="error-card">
                  {trackerActionError || errorMessage(campaignQuery.error || chapterListQuery.error || chapterDetailQuery.error || worldThreadsQuery.error, 'Failed to load tracker data.')}
                </div>
              )}
              <div className="tracker-layout">
                <div className="tracker-control-bar">
                  <label className="tracker-select-field">
                    <span>Tracker chapter</span>
                    <select value={trackerChapterId} onChange={(event) => setSelectedChapterId(event.target.value)}>
                      {chapters.map((chapter) => (
                        <option key={chapter.id} value={chapter.id}>
                          {chapter.id.replace('chapter-', 'Chapter ')}
                          {chapter.current ? ' · current' : chapter.locked ? ' · locked' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="tracker-status-group">
                    <span className={selectedChapterSummary?.current ? 'status-chip' : 'status-chip subtle'}>
                      {selectedChapterSummary?.current ? 'Current chapter' : 'Not current'}
                    </span>
                    <span className={selectedChapterSummary?.locked ? 'status-chip subtle' : 'status-chip'}>
                      {selectedChapterSummary?.locked ? 'Locked' : 'Unlocked'}
                    </span>
                  </div>
                  <div className="chapter-action-row">
                    <button
                      className="chapter-mini-btn"
                      disabled={trackerBusyKey !== '' || !trackerChapterId}
                      onClick={() => void runTrackerAction(`chapter-${trackerChapterId}`, () => setCurrentChapter(trackerChapterId, false, trackerMode))}
                    >
                      Switch current
                    </button>
                    <button
                      className="chapter-mini-btn"
                      disabled={trackerBusyKey !== '' || !trackerChapterId}
                      onClick={() => void runTrackerAction(`lock-${trackerChapterId}`, () => setChapterLock(trackerChapterId, !selectedChapterSummary?.locked, trackerMode))}
                    >
                      {selectedChapterSummary?.locked ? 'Unlock chapter' : 'Lock chapter'}
                    </button>
                  </div>
                </div>
                <div className="tracker-detail">
                  {chapterDetail ? (
                    <>
                      <div className="entity-detail-head">
                        <div>
                          <div className="workspace-kicker">Live tracker</div>
                          <h3>{chapterDetail.chapterId}</h3>
                          <div className={typeClassName('chapter')}>chapter</div>
                        </div>
                        <div className="status-chip">{percentLabel(chapterDetail.progress?.coverage?.percent)}</div>
                      </div>
                      <div className="detail-grid">
                        <div><span>Current chapter</span><strong>{campaignQuery.data?.currentChapter ?? 'n/a'}</strong></div>
                        <div><span>Session</span><strong>{campaignQuery.data?.currentSession ?? 'n/a'}</strong></div>
                        <div><span>Checkpoint</span><strong>{chapterDetail.progress?.currentCheckpoint?.label || 'n/a'}</strong></div>
                        <div><span>Clock</span><strong>{campaignQuery.data?.clock ? `${campaignQuery.data.clock.value}/${campaignQuery.data.clock.max ?? 16}` : 'n/a'}</strong></div>
                        <div><span>Open threads</span><strong>{worldThreads.filter((thread) => thread.currentStatus !== 'closed' && thread.currentStatus !== 'abandoned').length}</strong></div>
                      </div>
                      <div className="proposal-actions">
                        <button
                          className="nav-item"
                          disabled={trackerBusyKey !== '' || !campaignQuery.data?.clock}
                          onClick={() => void runTrackerAction('clock-down', () => setClock((Number(campaignQuery.data?.clock?.value) || 0) - 1, trackerMode))}
                        >
                          Clock -1
                        </button>
                        <button
                          className="nav-item"
                          disabled={trackerBusyKey !== '' || !campaignQuery.data?.clock}
                          onClick={() => void runTrackerAction('clock-up', () => setClock((Number(campaignQuery.data?.clock?.value) || 0) + 1, trackerMode))}
                        >
                          Clock +1
                        </button>
                      </div>
                      <div className="content-block markdown-block">
                        <h4>Checkpoints</h4>
                        <div className="proposal-actions">
                          {trackerCheckpoints.map((checkpoint) => (
                            <button
                              key={checkpoint.id || checkpoint.index}
                              className={chapterDetail.progress?.currentCheckpoint?.index === checkpoint.index ? 'nav-item active' : 'nav-item'}
                              disabled={trackerBusyKey !== ''}
                              onClick={() => void runTrackerAction(`checkpoint-${checkpoint.index}`, () => setCheckpoint(chapterDetail.chapterId, checkpoint.index ?? 0, trackerMode))}
                            >
                              {checkpoint.label || `Checkpoint ${checkpoint.index ?? 0}`}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="tracker-sections">
                        <div className="tracker-section-column">
                          <div className="content-block markdown-block">
                            <h4>Facts</h4>
                            {chapterFacts.length ? chapterFacts.map((fact) => (
                              <div key={fact.id} className="chapter-drill-card">
                                <div className="chapter-drill-head">
                                  <strong>{fact.id}</strong>
                                  <span className={fact.revealed ? 'status-chip' : 'status-chip subtle'}>{fact.revealed ? 'Revealed' : 'Hidden'}</span>
                                </div>
                                <div className="proposal-actions">
                                  <button
                                    className="chapter-mini-btn"
                                    disabled={trackerBusyKey !== ''}
                                    onClick={() => void runTrackerAction(`fact-${fact.id}`, () => (fact.revealed ? hideFact(chapterDetail.chapterId, fact.id, trackerMode) : revealFact(chapterDetail.chapterId, fact.id, trackerMode)))}
                                  >
                                    {fact.revealed ? 'Hide' : 'Reveal'}
                                  </button>
                                </div>
                              </div>
                            )) : <div className="placeholder-card">No facts for this chapter.</div>}
                          </div>
                          <div className="content-block markdown-block">
                            <h4>Handouts</h4>
                            {chapterHandouts.length ? chapterHandouts.map((handout) => (
                              <div key={handout.id} className="chapter-drill-card">
                                <div className="chapter-drill-head">
                                  <strong>{handout.label || handout.id}</strong>
                                  <span className={handout.posted ? 'status-chip' : 'status-chip subtle'}>{handout.posted ? 'Posted' : 'Unposted'}</span>
                                </div>
                                <div className="proposal-actions">
                                  <button
                                    className="chapter-mini-btn"
                                    disabled={trackerBusyKey !== ''}
                                    onClick={() => void runTrackerAction(`handout-${handout.id}`, () => (handout.posted ? unpostHandout(chapterDetail.chapterId, handout.id, trackerMode) : postHandout(chapterDetail.chapterId, handout.id, trackerMode)))}
                                  >
                                    {handout.posted ? 'Unpost' : 'Post'}
                                  </button>
                                </div>
                              </div>
                            )) : <div className="placeholder-card">No handouts for this chapter.</div>}
                          </div>
                          <div className="content-block markdown-block">
                            <h4>Beats</h4>
                            {chapterBeats.length ? chapterBeats.map((beat) => (
                              <div key={beat.id} className="chapter-drill-card">
                                <div className="chapter-drill-head">
                                  <strong>{beat.label || beat.id}</strong>
                                  <span className={beat.completed ? 'status-chip' : 'status-chip subtle'}>{beat.completed ? 'Complete' : 'Pending'}</span>
                                </div>
                                <div className="proposal-actions">
                                  <button
                                    className="chapter-mini-btn"
                                    disabled={trackerBusyKey !== ''}
                                    onClick={() => void runTrackerAction(`beat-${beat.id}`, () => (beat.completed ? unmarkBeat(chapterDetail.chapterId, beat.id, trackerMode) : markBeat(chapterDetail.chapterId, beat.id, trackerMode)))}
                                  >
                                    {beat.completed ? 'Unmark' : 'Mark'}
                                  </button>
                                </div>
                              </div>
                            )) : <div className="placeholder-card">No beats for this chapter.</div>}
                          </div>
                        </div>
                        <div className="tracker-section-column">
                          <div className="content-block markdown-block">
                            <h4>World Threads</h4>
                            {worldThreads.length ? worldThreads.map((thread: WorldThread) => (
                              <div key={thread.id} className="chapter-drill-card">
                                <div className="chapter-drill-head">
                                  <strong>{thread.name || thread.id}</strong>
                                  <span className="status-chip subtle">{thread.currentStatus}</span>
                                </div>
                                <p>{thread.summary || 'No summary available.'}</p>
                                <div className="proposal-actions">
                                  {['hot', 'simmering', 'dormant', 'closed', 'abandoned'].map((status) => (
                                    <button
                                      key={status}
                                      className={thread.currentStatus === status ? 'nav-item active' : 'nav-item'}
                                      disabled={trackerBusyKey !== ''}
                                      onClick={() => void runTrackerAction(`thread-${thread.id}-${status}`, () => setThreadStatus(chapterDetail.chapterId, thread.id, status, trackerMode))}
                                    >
                                      {status}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )) : <div className="placeholder-card">No world threads available.</div>}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : chapterDetailQuery.isLoading ? (
                    <div className="placeholder-card">Loading tracker chapter…</div>
                  ) : (
                    <div className="placeholder-card">Select a chapter to run the tracker.</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="panel">
              <p className="lede">{subtitle}</p>
              {readMode === 'planning' && (
                <div className="placeholder-card">Session close always exports the live state summary, regardless of the global read mode toggle.</div>
              )}
              <div className="meta-row">
                <span className="meta-pill">{sessionClosePreviewQuery.isLoading ? 'Preparing summary' : `Chapter ${sessionClosePreviewQuery.data?.summary.chapterId || 'n/a'}`}</span>
                <span className="meta-pill">{sessionClosePreviewQuery.data?.summary.sessionId != null ? `Session ${sessionClosePreviewQuery.data.summary.sessionId}` : 'Session unknown'}</span>
                <span className="meta-pill">{sessionClosePreviewQuery.data ? `${sessionClosePreviewQuery.data.summary.coverage.percent}% coverage` : 'No coverage yet'}</span>
              </div>
              {(sessionClosePreviewQuery.error || sessionActionError) && (
                <div className="error-card">
                  {sessionActionError || errorMessage(sessionClosePreviewQuery.error, 'Failed to prepare session close summary.')}
                </div>
              )}
              {sessionActionNotice && (
                <div className="placeholder-card">{sessionActionNotice}</div>
              )}
              {sessionClosePreviewQuery.data ? (
                <>
                  <div className="detail-grid">
                    <div><span>Chapter</span><strong>{sessionClosePreviewQuery.data.summary.chapterId}</strong></div>
                    <div><span>Session</span><strong>{sessionClosePreviewQuery.data.summary.sessionId ?? 'unknown'}</strong></div>
                    <div><span>Clock</span><strong>{sessionClosePreviewQuery.data.summary.clock.value}/{sessionClosePreviewQuery.data.summary.clock.max}</strong></div>
                    <div><span>Open threads</span><strong>{sessionClosePreviewQuery.data.summary.openThreads.length}</strong></div>
                  </div>
                  <div className="content-block markdown-block">
                    <h4>Export Preview</h4>
                    <ul>
                      <li>Facts: {sessionClosePreviewQuery.data.summary.coverage.facts.completed}/{sessionClosePreviewQuery.data.summary.coverage.facts.total}</li>
                      <li>Handouts: {sessionClosePreviewQuery.data.summary.coverage.handouts.completed}/{sessionClosePreviewQuery.data.summary.coverage.handouts.total}</li>
                      <li>Beats: {sessionClosePreviewQuery.data.summary.coverage.beats.completed}/{sessionClosePreviewQuery.data.summary.coverage.beats.total}</li>
                    </ul>
                    <h4>Paths</h4>
                    <ul>
                      {sessionClosePreviewQuery.data.summary.exportPaths.map((path) => (
                        <li key={path}>{path}</li>
                      ))}
                    </ul>
                    <h4>Open Threads</h4>
                    <ul>
                      {sessionClosePreviewQuery.data.summary.openThreads.map((thread) => (
                        <li key={thread.id}>{thread.name} ({thread.status})</li>
                      ))}
                    </ul>
                  </div>
                  <div className="proposal-actions">
                    {!sessionCloseConfirming ? (
                      <button className="nav-item" disabled={trackerBusyKey !== ''} onClick={() => setSessionCloseConfirming(true)}>
                        Start Session Close
                      </button>
                    ) : (
                      <>
                        <button className="nav-item active" disabled={trackerBusyKey !== ''} onClick={() => void handleSessionClose()}>
                          Confirm Session Close Export
                        </button>
                        <button className="nav-item" disabled={trackerBusyKey !== ''} onClick={() => setSessionCloseConfirming(false)}>
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <div className="placeholder-card">No session close summary is available yet.</div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
