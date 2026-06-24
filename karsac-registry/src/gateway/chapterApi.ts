import type { IncomingMessage, ServerResponse } from 'http'
import { readJsonBody, sendError, sendJson } from './httpUtils.js'
import { createStateService, StateService, StateServiceError } from '../state/service.js'

type Dependencies = {
  stateService?: StateService
}

function getStateService(deps: Dependencies): StateService {
  return deps.stateService ?? createStateService()
}

function parsePath(url: string): string {
  return url.split('?', 1)[0] ?? url
}

function sendStateServiceError(res: ServerResponse, error: StateServiceError): void {
  if (error.issues?.length) {
    sendJson(res, error.statusCode, {
      error: {
        message: error.message,
        type: error.type,
      },
      issues: error.issues,
    })
    return
  }
  sendError(res, error.statusCode, error.message, error.type)
}

function scaffoldFor(chapterId: string) {
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

export async function handleChapterApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  deps: Dependencies = {},
): Promise<boolean> {
  if (!req.url) return false

  const path = parsePath(req.url)
  const planMatch = path.match(/^\/api\/v1\/chapters\/(chapter-[A-Za-z0-9._-]+)\/plan$/)
  const materializeMatch = path.match(/^\/api\/v1\/chapters\/(chapter-[A-Za-z0-9._-]+)\/materialise$/)
  const stateService = getStateService(deps)

  try {
    if (req.method === 'GET' && planMatch) {
      try {
        sendJson(res, 200, stateService.readChapterPlan(planMatch[1]))
      } catch (error) {
        if (error instanceof StateServiceError && error.statusCode === 404) {
          sendJson(res, 404, {
            error: {
              message: error.message,
              type: error.type,
            },
            hint: `Create ${planMatch[1]} by saving the scaffolded plan first.`,
            scaffold: scaffoldFor(planMatch[1]),
          })
          return true
        }
        throw error
      }
      return true
    }

    if (req.method === 'PUT' && planMatch) {
      sendJson(res, 200, stateService.writeChapterPlan(planMatch[1], await readJsonBody(req)))
      return true
    }

    if (req.method === 'PATCH' && planMatch) {
      sendJson(res, 200, stateService.patchChapterPlan(planMatch[1], await readJsonBody(req)))
      return true
    }

    if (req.method === 'POST' && materializeMatch) {
      sendJson(res, 200, stateService.materializeChapterPlan(materializeMatch[1]))
      return true
    }

    return false
  } catch (error) {
    if (error instanceof StateServiceError) {
      sendStateServiceError(res, error)
      return true
    }

    throw error
  }
}
