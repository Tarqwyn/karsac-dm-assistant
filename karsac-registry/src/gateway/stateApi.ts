import type { IncomingMessage, ServerResponse } from 'http'
import { readJsonBody, sendError, sendJson } from './httpUtils.js'
import { createStateService, StateService, StateServiceError } from '../state/service.js'

type Dependencies = {
  stateService?: StateService
}

type FactMutationPayload = {
  chapterId?: string
  factId?: string
}

type HandoutMutationPayload = {
  chapterId?: string
  handoutId?: string
}

type BeatMutationPayload = {
  chapterId?: string
  beatId?: string
}

type ThreadMutationPayload = {
  chapterId?: string
  threadId?: string
  status?: string
}

type CheckpointPayload = {
  chapterId?: string
  checkpointIndex?: number
}

type ClockPayload = {
  value?: number
}

type ChapterSelectionPayload = {
  chapterId?: string
  lockCurrent?: boolean
}

type ChapterLockPayload = {
  chapterId?: string
  locked?: boolean
}

function getStateService(deps: Dependencies): StateService {
  return deps.stateService ?? createStateService()
}

function parseStatePath(url: string): string {
  return url.split('?', 1)[0] ?? url
}

function isFactMutationPayload(value: unknown): value is FactMutationPayload {
  if (!value || typeof value !== 'object') return false
  const candidate = value as FactMutationPayload
  return typeof candidate.chapterId === 'string' && typeof candidate.factId === 'string'
}

function isHandoutMutationPayload(value: unknown): value is HandoutMutationPayload {
  if (!value || typeof value !== 'object') return false
  const candidate = value as HandoutMutationPayload
  return typeof candidate.chapterId === 'string' && typeof candidate.handoutId === 'string'
}

function isBeatMutationPayload(value: unknown): value is BeatMutationPayload {
  if (!value || typeof value !== 'object') return false
  const candidate = value as BeatMutationPayload
  return typeof candidate.chapterId === 'string' && typeof candidate.beatId === 'string'
}

function isThreadMutationPayload(value: unknown): value is ThreadMutationPayload {
  if (!value || typeof value !== 'object') return false
  const candidate = value as ThreadMutationPayload
  return typeof candidate.chapterId === 'string' && typeof candidate.threadId === 'string' && typeof candidate.status === 'string'
}

function isCheckpointPayload(value: unknown): value is CheckpointPayload {
  if (!value || typeof value !== 'object') return false
  const candidate = value as CheckpointPayload
  return typeof candidate.chapterId === 'string' && typeof candidate.checkpointIndex === 'number'
}

function isClockPayload(value: unknown): value is ClockPayload {
  if (!value || typeof value !== 'object') return false
  const candidate = value as ClockPayload
  return typeof candidate.value === 'number'
}

function isChapterSelectionPayload(value: unknown): value is ChapterSelectionPayload {
  if (!value || typeof value !== 'object') return false
  const candidate = value as ChapterSelectionPayload
  return typeof candidate.chapterId === 'string' && (candidate.lockCurrent === undefined || typeof candidate.lockCurrent === 'boolean')
}

function isChapterLockPayload(value: unknown): value is ChapterLockPayload {
  if (!value || typeof value !== 'object') return false
  const candidate = value as ChapterLockPayload
  return typeof candidate.chapterId === 'string' && (candidate.locked === undefined || typeof candidate.locked === 'boolean')
}

export async function handleStateApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  deps: Dependencies = {},
): Promise<boolean> {
  if (!req.url) return false

  const path = parseStatePath(req.url)
  const stateService = getStateService(deps)

  try {
    if (req.method === 'GET' && path === '/api/state/campaign') {
      sendJson(res, 200, stateService.readCampaignState())
      return true
    }

    if (req.method === 'GET' && path === '/api/state/player-knowledge') {
      sendJson(res, 200, stateService.readPlayerKnowledge())
      return true
    }

    if (req.method === 'GET' && path === '/api/state/world-threads') {
      sendJson(res, 200, stateService.readWorldThreads())
      return true
    }

    if (req.method === 'GET' && path === '/api/v1/session/close/preview') {
      sendJson(res, 200, stateService.previewSessionClose())
      return true
    }

    if (req.method === 'GET' && path === '/api/state/chapters') {
      sendJson(res, 200, { chapters: stateService.readChapterList() })
      return true
    }

    const chapterMatch = req.method === 'GET'
      ? path.match(/^\/api\/state\/chapters\/(chapter-[A-Za-z0-9._-]+)$/)
      : null
    if (chapterMatch) {
      sendJson(res, 200, stateService.readChapterState(chapterMatch[1]))
      return true
    }

    if (req.method === 'POST' && (path === '/api/state/facts/reveal' || path === '/api/state/facts/hide')) {
      const body = await readJsonBody(req)
      if (!isFactMutationPayload(body)) {
        sendError(res, 400, 'Invalid fact mutation payload.')
        return true
      }

      const result = path.endsWith('/reveal')
        ? stateService.revealFact(body.chapterId!, body.factId!)
        : stateService.hideFact(body.chapterId!, body.factId!)

      sendJson(res, 200, result)
      return true
    }

    if (req.method === 'POST' && (path === '/api/state/handouts/post' || path === '/api/state/handouts/unpost')) {
      const body = await readJsonBody(req)
      if (!isHandoutMutationPayload(body)) {
        sendError(res, 400, 'Invalid handout mutation payload.')
        return true
      }

      const result = path.endsWith('/post')
        ? stateService.postHandout(body.chapterId!, body.handoutId!)
        : stateService.unpostHandout(body.chapterId!, body.handoutId!)

      sendJson(res, 200, result)
      return true
    }

    if (req.method === 'POST' && (path === '/api/state/beats/mark' || path === '/api/state/beats/unmark')) {
      const body = await readJsonBody(req)
      if (!isBeatMutationPayload(body)) {
        sendError(res, 400, 'Invalid beat mutation payload.')
        return true
      }

      const result = path.endsWith('/mark')
        ? stateService.markBeat(body.chapterId!, body.beatId!)
        : stateService.unmarkBeat(body.chapterId!, body.beatId!)

      sendJson(res, 200, result)
      return true
    }

    if (req.method === 'POST' && path === '/api/state/threads/set') {
      const body = await readJsonBody(req)
      if (!isThreadMutationPayload(body)) {
        sendError(res, 400, 'Invalid thread mutation payload.')
        return true
      }

      const result = stateService.setThreadStatus(body.chapterId!, body.threadId!, body.status!)
      sendJson(res, 200, result)
      return true
    }

    if (req.method === 'POST' && path === '/api/state/checkpoint/set') {
      const body = await readJsonBody(req)
      if (!isCheckpointPayload(body)) {
        sendError(res, 400, 'Invalid checkpoint payload.')
        return true
      }

      sendJson(res, 200, stateService.setCheckpoint(body.chapterId!, body.checkpointIndex!))
      return true
    }

    if (req.method === 'POST' && path === '/api/state/clock/set') {
      const body = await readJsonBody(req)
      if (!isClockPayload(body)) {
        sendError(res, 400, 'Invalid clock payload.')
        return true
      }

      sendJson(res, 200, stateService.setClock(body.value!))
      return true
    }

    if (req.method === 'POST' && path === '/api/state/campaign/chapter') {
      const body = await readJsonBody(req)
      if (!isChapterSelectionPayload(body)) {
        sendError(res, 400, 'Invalid chapter selection payload.')
        return true
      }

      sendJson(res, 200, stateService.setCurrentChapter(body.chapterId!, !!body.lockCurrent))
      return true
    }

    if (req.method === 'POST' && path === '/api/state/campaign/lock') {
      const body = await readJsonBody(req)
      if (!isChapterLockPayload(body)) {
        sendError(res, 400, 'Invalid chapter lock payload.')
        return true
      }

      sendJson(res, 200, stateService.setChapterLock(body.chapterId!, body.locked !== false))
      return true
    }

    if (req.method === 'POST' && path === '/api/v1/session/close') {
      sendJson(res, 200, stateService.closeSession())
      return true
    }

    return false
  } catch (error) {
    if (error instanceof StateServiceError) {
      sendError(res, error.statusCode, error.message, error.type)
      return true
    }

    throw error
  }
}
