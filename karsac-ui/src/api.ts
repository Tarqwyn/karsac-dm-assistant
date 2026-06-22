import type {
  CampaignState,
  CheckpointMutationResult,
  ChapterBundle,
  ChapterListResponse,
  ClockMutationResult,
  CorpusEntitiesResponse,
  CorpusEntityResponse,
  ProposalDetailResponse,
  ProposalListResponse,
  ProposalPromotionResponse,
  ReadMode,
  SessionClosePreviewResponse,
  SessionCloseResponse,
  SetChapterLockResult,
  SetCurrentChapterResult,
  TrackerMutationResult,
  WorldThreadsState,
} from '@karsac/shared'

const DEFAULT_PROXY_BASE = ''

function getBaseUrl(): string {
  return (import.meta.env.VITE_KARSAC_API_BASE_URL || DEFAULT_PROXY_BASE).replace(/\/$/, '')
}

function authHeaders(): Record<string, string> {
  const apiKey = import.meta.env.VITE_KARSAC_API_KEY
  return apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  })

  if (!response.ok) {
    let message = `Request failed: ${response.status}`
    let issues: string[] | undefined

    try {
      const payload = await response.json()
      if (payload?.error?.message) message = payload.error.message
      if (Array.isArray(payload?.issues)) issues = payload.issues
    } catch {
      // Ignore parse errors on non-JSON error responses.
    }

    const error = new Error(message) as Error & { issues?: string[] }
    if (issues) error.issues = issues
    throw error
  }

  return response.json() as Promise<T>
}

export function fetchCorpusEntities(mode: ReadMode): Promise<CorpusEntitiesResponse> {
  return request(`/v1/corpus/entities?mode=${encodeURIComponent(mode)}`)
}

export function fetchCorpusEntity(id: string, mode: ReadMode): Promise<CorpusEntityResponse> {
  return request(`/v1/corpus/entities/${encodeURIComponent(id)}?mode=${encodeURIComponent(mode)}`)
}

export function fetchCampaignState(mode: ReadMode): Promise<CampaignState> {
  return request(`/api/state/campaign?mode=${encodeURIComponent(mode)}`)
}

export function fetchChapterList(mode: ReadMode): Promise<ChapterListResponse> {
  return request(`/api/state/chapters?mode=${encodeURIComponent(mode)}`)
}

export function fetchChapterState(chapterId: string, mode: ReadMode): Promise<ChapterBundle> {
  return request(`/api/state/chapters/${encodeURIComponent(chapterId)}?mode=${encodeURIComponent(mode)}`)
}

export function fetchWorldThreads(mode: ReadMode): Promise<WorldThreadsState> {
  return request(`/api/state/world-threads?mode=${encodeURIComponent(mode)}`)
}

export function fetchProposals(mode: ReadMode): Promise<ProposalListResponse> {
  return request(`/api/v1/proposals?mode=${encodeURIComponent(mode)}`)
}

export function fetchProposal(id: string, mode: ReadMode): Promise<ProposalDetailResponse> {
  return request(`/api/v1/proposals/${encodeURIComponent(id)}?mode=${encodeURIComponent(mode)}`)
}

export function reviewProposal(
  id: string,
  mode: ReadMode,
  payload: Record<string, unknown> = {},
): Promise<ProposalDetailResponse> {
  return request(`/api/v1/proposals/${encodeURIComponent(id)}/review?mode=${encodeURIComponent(mode)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function promoteProposal(
  id: string,
  mode: ReadMode,
  payload: Record<string, unknown> = {},
): Promise<ProposalPromotionResponse> {
  return request(`/api/v1/proposals/${encodeURIComponent(id)}/promote?mode=${encodeURIComponent(mode)}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function revealFact(chapterId: string, factId: string, mode: ReadMode): Promise<TrackerMutationResult> {
  return request(`/api/state/facts/reveal?mode=${encodeURIComponent(mode)}`, {
    method: 'POST',
    body: JSON.stringify({ chapterId, factId }),
  })
}

export function hideFact(chapterId: string, factId: string, mode: ReadMode): Promise<TrackerMutationResult> {
  return request(`/api/state/facts/hide?mode=${encodeURIComponent(mode)}`, {
    method: 'POST',
    body: JSON.stringify({ chapterId, factId }),
  })
}

export function postHandout(chapterId: string, handoutId: string, mode: ReadMode): Promise<TrackerMutationResult> {
  return request(`/api/state/handouts/post?mode=${encodeURIComponent(mode)}`, {
    method: 'POST',
    body: JSON.stringify({ chapterId, handoutId }),
  })
}

export function unpostHandout(chapterId: string, handoutId: string, mode: ReadMode): Promise<TrackerMutationResult> {
  return request(`/api/state/handouts/unpost?mode=${encodeURIComponent(mode)}`, {
    method: 'POST',
    body: JSON.stringify({ chapterId, handoutId }),
  })
}

export function markBeat(chapterId: string, beatId: string, mode: ReadMode): Promise<TrackerMutationResult> {
  return request(`/api/state/beats/mark?mode=${encodeURIComponent(mode)}`, {
    method: 'POST',
    body: JSON.stringify({ chapterId, beatId }),
  })
}

export function unmarkBeat(chapterId: string, beatId: string, mode: ReadMode): Promise<TrackerMutationResult> {
  return request(`/api/state/beats/unmark?mode=${encodeURIComponent(mode)}`, {
    method: 'POST',
    body: JSON.stringify({ chapterId, beatId }),
  })
}

export function setThreadStatus(chapterId: string, threadId: string, status: string, mode: ReadMode): Promise<TrackerMutationResult> {
  return request(`/api/state/threads/set?mode=${encodeURIComponent(mode)}`, {
    method: 'POST',
    body: JSON.stringify({ chapterId, threadId, status }),
  })
}

export function setCheckpoint(chapterId: string, checkpointIndex: number, mode: ReadMode): Promise<CheckpointMutationResult> {
  return request(`/api/state/checkpoint/set?mode=${encodeURIComponent(mode)}`, {
    method: 'POST',
    body: JSON.stringify({ chapterId, checkpointIndex }),
  })
}

export function setClock(value: number, mode: ReadMode): Promise<ClockMutationResult> {
  return request(`/api/state/clock/set?mode=${encodeURIComponent(mode)}`, {
    method: 'POST',
    body: JSON.stringify({ value }),
  })
}

export function setCurrentChapter(chapterId: string, lockCurrent: boolean, mode: ReadMode): Promise<SetCurrentChapterResult> {
  return request(`/api/state/campaign/chapter?mode=${encodeURIComponent(mode)}`, {
    method: 'POST',
    body: JSON.stringify({ chapterId, lockCurrent }),
  })
}

export function setChapterLock(chapterId: string, locked: boolean, mode: ReadMode): Promise<SetChapterLockResult> {
  return request(`/api/state/campaign/lock?mode=${encodeURIComponent(mode)}`, {
    method: 'POST',
    body: JSON.stringify({ chapterId, locked }),
  })
}

export function previewSessionClose(mode: ReadMode): Promise<SessionClosePreviewResponse> {
  return request(`/api/v1/session/close/preview?mode=${encodeURIComponent(mode)}`)
}

export function closeSession(mode: ReadMode): Promise<SessionCloseResponse> {
  return request(`/api/v1/session/close?mode=${encodeURIComponent(mode)}`, {
    method: 'POST',
  })
}
