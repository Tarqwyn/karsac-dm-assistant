import type { IncomingMessage, ServerResponse } from 'http'
import fg from 'fast-glob'
import { readFileSync, writeFileSync } from 'fs'
import matter from 'gray-matter'
import { PROJECT_ROOT, PROPOSALS_ROOT } from '../paths.js'
import { promoteProposal } from '../proposals/proposalPromoter.js'
import { validateProposalFile } from '../proposals/proposalValidator.js'
import { readJsonBody, sendError, sendJson } from './httpUtils.js'

type ProposalReviewState = {
  reviewed: boolean
  review_status: 'approved' | 'pending' | 'changes_requested'
  reviewed_at?: string
  review_notes?: string
}

type ProposalSummary = {
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
  validation: {
    status: 'pass' | 'warning' | 'fail'
    issues: string[]
  }
  review: ProposalReviewState
  updatedAt?: string
}

type ProposalDetail = ProposalSummary & {
  body: string
  frontmatter: Record<string, unknown>
}

type ProposalReviewPayload = {
  reviewed?: boolean
  review_status?: 'approved' | 'pending' | 'changes_requested'
  review_notes?: string
}

type ProposalPromotePayload = {
  force?: boolean
  overwrite?: boolean
}

function parseReadMode(value: string | null): 'live' | 'planning' {
  return value === 'planning' ? 'planning' : 'live'
}

function proposalFiles(): string[] {
  return fg.sync('**/*.proposed.md', { cwd: PROPOSALS_ROOT, absolute: true })
}

function proposalPathForId(id: string): string | null {
  const exact = proposalFiles().find((file) => {
    try {
      const raw = readFileSync(file, 'utf-8')
      const parsed = matter(raw).data as Record<string, unknown>
      return String(parsed.id ?? '').trim() === id
    } catch {
      return false
    }
  })
  return exact ?? null
}

function proposalReviewState(frontmatter: Record<string, unknown>): ProposalReviewState {
  const reviewed = frontmatter.reviewed === true || frontmatter.review_status === 'approved'
  const reviewStatus = reviewed
    ? 'approved'
    : frontmatter.review_status === 'changes_requested'
      ? 'changes_requested'
      : 'pending'

  const state: ProposalReviewState = {
    reviewed,
    review_status: reviewStatus,
  }

  if (typeof frontmatter.reviewed_at === 'string' && frontmatter.reviewed_at.trim()) {
    state.reviewed_at = frontmatter.reviewed_at.trim()
  }

  if (typeof frontmatter.review_notes === 'string' && frontmatter.review_notes.trim()) {
    state.review_notes = frontmatter.review_notes.trim()
  }

  return state
}

function proposalSummaryFrom(filePath: string): ProposalSummary {
  const raw = readFileSync(filePath, 'utf-8')
  const parsed = matter(raw)
  const fm = parsed.data as Record<string, unknown>
  const validation = validateProposalFile(filePath)

  return {
    id: String(fm.id ?? ''),
    title: String(fm.title ?? ''),
    proposalType: String(fm.proposal_type ?? ''),
    status: String(fm.status ?? ''),
    canonical: String(fm.canonical ?? ''),
    visibility: String(fm.visibility ?? ''),
    path: filePath,
    summary: String(fm.summary ?? '').trim() || parsed.content.trim().split('\n\n', 1)[0] || 'No summary available.',
    promoteTarget: String(fm.promote_target ?? ''),
    sourcePrompt: String(fm.source_prompt ?? ''),
    validation: {
      status: validation.status,
      issues: validation.issues,
    },
    review: proposalReviewState(fm),
    updatedAt: typeof fm.promoted_at === 'string' ? fm.promoted_at : (typeof fm.reviewed_at === 'string' ? fm.reviewed_at : undefined),
  }
}

function proposalDetailFrom(filePath: string): ProposalDetail {
  const raw = readFileSync(filePath, 'utf-8')
  const parsed = matter(raw)
  const fm = parsed.data as Record<string, unknown>
  const summary = proposalSummaryFrom(filePath)
  return {
    ...summary,
    body: parsed.content.trim(),
    frontmatter: fm,
  }
}

function readProposalBody(filePath: string): { frontmatter: Record<string, unknown>; body: string } {
  const raw = readFileSync(filePath, 'utf-8')
  const parsed = matter(raw)
  return {
    frontmatter: parsed.data as Record<string, unknown>,
    body: parsed.content,
  }
}

function writeProposalFrontmatter(filePath: string, frontmatter: Record<string, unknown>, body: string): void {
  const output = matter.stringify(body, frontmatter)
  writeFileSync(filePath, output, 'utf-8')
}

function toReviewPayload(value: unknown): ProposalReviewPayload | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as ProposalReviewPayload
  if (candidate.reviewed !== undefined && typeof candidate.reviewed !== 'boolean') return null
  if (candidate.review_status !== undefined && !['approved', 'pending', 'changes_requested'].includes(candidate.review_status)) return null
  if (candidate.review_notes !== undefined && typeof candidate.review_notes !== 'string') return null
  return candidate
}

function toPromotePayload(value: unknown): ProposalPromotePayload | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as ProposalPromotePayload
  if (candidate.force !== undefined && typeof candidate.force !== 'boolean') return null
  if (candidate.overwrite !== undefined && typeof candidate.overwrite !== 'boolean') return null
  return candidate
}

export async function handleProposalApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  if (!req.url) return false

  const url = new URL(req.url, 'http://localhost')
  const pathname = url.pathname
  const path = pathname.startsWith('/api/v1/proposals')
    ? pathname
    : pathname.startsWith('/v1/proposals')
      ? pathname
      : null
  if (!path) return false

  const readMode = parseReadMode(url.searchParams.get('mode'))
  const prefix = path.startsWith('/api/v1/proposals') ? '/api/v1/proposals' : '/v1/proposals'
  const remainder = path.slice(prefix.length).replace(/^\/+/, '')
  const segments = remainder ? remainder.split('/') : []
  const proposalId = segments[0] ? decodeURIComponent(segments[0]) : ''
  const action = segments[1] ?? ''

  try {
    if (req.method === 'GET' && !proposalId) {
      const summaries = proposalFiles()
        .map((file) => proposalSummaryFrom(file))
        .sort((a, b) => a.title.localeCompare(b.title))

      sendJson(res, 200, {
        mode: readMode,
        count: summaries.length,
        proposals: summaries,
      })
      return true
    }

    const filePath = proposalPathForId(proposalId)
    if (!filePath) {
      sendError(res, 404, `Proposal not found: ${proposalId}`, 'not_found_error')
      return true
    }

    if (req.method === 'GET' && proposalId && !action) {
      sendJson(res, 200, {
        mode: readMode,
        proposal: proposalDetailFrom(filePath),
      })
      return true
    }

    if (req.method === 'PATCH' && action === 'review') {
      const payload = toReviewPayload(await readJsonBody(req))
      if (!payload) {
        sendError(res, 400, 'Invalid proposal review payload.')
        return true
      }

      const { frontmatter, body } = readProposalBody(filePath)
      const reviewed = payload.reviewed ?? true
      const nextFrontmatter: Record<string, unknown> = {
        ...frontmatter,
        reviewed,
        review_status: payload.review_status ?? (reviewed ? 'approved' : 'pending'),
        reviewed_at: new Date().toISOString(),
      }

      if (payload.review_notes !== undefined) {
        nextFrontmatter.review_notes = payload.review_notes
      }

      writeProposalFrontmatter(filePath, nextFrontmatter, body)
      sendJson(res, 200, {
        mode: readMode,
        proposal: proposalDetailFrom(filePath),
      })
      return true
    }

    if (req.method === 'POST' && action === 'promote') {
      const payload = toPromotePayload(await readJsonBody(req)) ?? {}
      const result = await promoteProposal(filePath, PROJECT_ROOT, payload.overwrite ?? false, payload.force ?? false)

      if (!result.success) {
        const statusCode = result.error?.toLowerCase().includes('validation failed') ? 409 : 400
        if (statusCode === 409) {
          sendJson(res, statusCode, {
            error: {
              message: 'Proposal promotion blocked by validation failures.',
              type: 'validation_error',
            },
            issues: result.validationIssues,
            result,
          })
        } else {
          sendError(res, statusCode, result.error || 'Proposal promotion failed.', 'invalid_request_error')
        }
        return true
      }

      sendJson(res, 200, {
        mode: readMode,
        result,
        proposal: proposalDetailFrom(filePath),
      })
      return true
    }

    sendError(res, 405, 'Method not allowed.', 'invalid_request_error')
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proposal API request failed.'
    sendError(res, 500, message, 'server_error')
    return true
  }
}
