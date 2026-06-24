import type { IncomingMessage, ServerResponse } from 'http'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import fg from 'fast-glob'
import matter from 'gray-matter'
import { PROJECT_ROOT, PROPOSALS_ROOT } from '../paths.js'
import { getProposalFolder, getPromoteTarget } from '../proposals/proposalContractsLoader.js'
import { promoteProposal } from '../proposals/proposalPromoter.js'
import { PROPOSAL_TYPE_VALUES } from '../proposals/proposalTypes.js'
import type { ProposalType } from '../proposals/proposalTypes.js'
import { validateProposalFile } from '../proposals/proposalValidator.js'
import { generateProposalFromPrompt } from './karsacRunner.js'
import { readJsonBody, sendError, sendJson } from './httpUtils.js'

const VALID_PROPOSAL_TYPES = new Set<string>(PROPOSAL_TYPE_VALUES)

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
  related: Record<string, string[]>
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
  const related = fm.related && typeof fm.related === 'object' && !Array.isArray(fm.related)
    ? Object.fromEntries(
      Object.entries(fm.related as Record<string, unknown>)
        .filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].every((value) => typeof value === 'string')),
    )
    : {}

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
    related,
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

type ProposalGeneratePayload = { type: ProposalType; prompt: string }
type ProposalCreatePayload = { type: ProposalType; title: string; summary?: string }
type ProposalUpdatePayload = {
  title?: string
  summary?: string
  body?: string
  related?: Record<string, string[]>
}

function toGeneratePayload(value: unknown): ProposalGeneratePayload | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Record<string, unknown>
  if (typeof candidate.type !== 'string' || !VALID_PROPOSAL_TYPES.has(candidate.type)) return null
  if (typeof candidate.prompt !== 'string' || !candidate.prompt.trim()) return null
  return { type: candidate.type as ProposalType, prompt: candidate.prompt.trim() }
}

function toCreatePayload(value: unknown): ProposalCreatePayload | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Record<string, unknown>
  if (typeof candidate.type !== 'string' || !VALID_PROPOSAL_TYPES.has(candidate.type)) return null
  if (typeof candidate.title !== 'string' || !candidate.title.trim()) return null
  const payload: ProposalCreatePayload = {
    type: candidate.type as ProposalType,
    title: candidate.title.trim(),
  }
  if (typeof candidate.summary === 'string') payload.summary = candidate.summary
  return payload
}

function isStringArrayRecord(value: unknown): value is Record<string, string[]> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  return Object.values(value).every(
    (v) => Array.isArray(v) && v.every((item) => typeof item === 'string'),
  )
}

function toUpdatePayload(value: unknown): ProposalUpdatePayload | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Record<string, unknown>
  const payload: ProposalUpdatePayload = {}
  if (candidate.title !== undefined) {
    if (typeof candidate.title !== 'string') return null
    payload.title = candidate.title
  }
  if (candidate.summary !== undefined) {
    if (typeof candidate.summary !== 'string') return null
    payload.summary = candidate.summary
  }
  if (candidate.body !== undefined) {
    if (typeof candidate.body !== 'string') return null
    payload.body = candidate.body
  }
  if (candidate.related !== undefined) {
    if (!isStringArrayRecord(candidate.related)) return null
    payload.related = candidate.related
  }
  return payload
}

function titleToSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function scaffoldProposal(payload: ProposalCreatePayload): { filePath: string } | { conflict: string } {
  const folder = getProposalFolder(payload.type)
  const slug = titleToSlug(payload.title)
  const id = `proposals/${folder}/${slug}`
  const dir = join(PROPOSALS_ROOT, folder)
  const filePath = join(dir, `${slug}.proposed.md`)

  if (existsSync(filePath)) {
    return { conflict: `A proposal with slug '${slug}' already exists in ${folder}.` }
  }

  mkdirSync(dir, { recursive: true })

  const frontmatter: Record<string, unknown> = {
    id,
    proposal_type: payload.type,
    title: payload.title,
    status: 'proposed',
    canonical: 'provisional',
    visibility: 'dm-only',
    created_at: new Date().toISOString(),
    promote_target: getPromoteTarget(payload.type) ?? '',
    summary: payload.summary ?? '',
  }

  const body = `# ${payload.title}\n\n<!-- Add proposal content here. -->\n`
  writeProposalFrontmatter(filePath, frontmatter, body)
  return { filePath }
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

    if (req.method === 'POST' && proposalId === 'generate' && !action) {
      const payload = toGeneratePayload(await readJsonBody(req))
      if (!payload) {
        sendError(res, 400, 'Invalid generate payload. Expected { type, prompt }.', 'invalid_request_error')
        return true
      }
      const generated = await generateProposalFromPrompt(payload.prompt, payload.type)
      if (!generated.proposalPath) {
        sendError(res, 500, 'Proposal generation did not produce an output file.', 'server_error')
        return true
      }
      sendJson(res, 200, {
        mode: readMode,
        validationStatus: generated.validationStatus,
        proposal: proposalDetailFrom(generated.proposalPath),
      })
      return true
    }

    if (req.method === 'POST' && !proposalId) {
      const payload = toCreatePayload(await readJsonBody(req))
      if (!payload) {
        sendError(res, 400, 'Invalid create payload. Expected { type, title }.', 'invalid_request_error')
        return true
      }
      const scaffold = scaffoldProposal(payload)
      if ('conflict' in scaffold) {
        sendError(res, 409, scaffold.conflict, 'conflict_error')
        return true
      }
      sendJson(res, 201, {
        mode: readMode,
        proposal: proposalDetailFrom(scaffold.filePath),
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

    if (req.method === 'PUT' && proposalId && !action) {
      const { frontmatter, body } = readProposalBody(filePath)
      if (String(frontmatter.status) === 'promoted') {
        sendError(res, 409, 'Cannot update a promoted proposal.', 'invalid_request_error')
        return true
      }
      const payload = toUpdatePayload(await readJsonBody(req))
      if (!payload) {
        sendError(res, 400, 'Invalid update payload.', 'invalid_request_error')
        return true
      }
      const nextFrontmatter: Record<string, unknown> = { ...frontmatter }
      if (payload.title !== undefined) nextFrontmatter.title = payload.title
      if (payload.summary !== undefined) nextFrontmatter.summary = payload.summary
      if (payload.related !== undefined) nextFrontmatter.related = payload.related
      const nextBody = payload.body !== undefined ? payload.body : body
      writeProposalFrontmatter(filePath, nextFrontmatter, nextBody)
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
