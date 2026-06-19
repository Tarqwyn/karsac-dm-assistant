/**
 * Promote-intent parsing and proposal resolution for the chat gateway.
 *
 * Pure + filesystem-read only (no spawning) so it is deterministically
 * testable. The actual promotion runs the karsac:promote-proposal CLI from
 * karsacRunner; this module decides *what* to promote and renders the
 * conversational replies.
 *
 * Guard: promotion is blocked-by-default. A freshly generated proposal usually
 * validates as `fail`, so the CLI will refuse without --force. We only pass
 * --force when the user explicitly asks ("force promote <slug>").
 */

import fg from 'fast-glob'
import { readFileSync } from 'fs'
import matter from 'gray-matter'

export const PROMOTE_REQUEST_PATTERN = /\bpromote\b/i

export function isPromoteRequest(message: string): boolean {
  return PROMOTE_REQUEST_PATTERN.test(message)
}

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{Diacritic}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export interface PromoteIntent {
  /** Cleaned entity text the user named, e.g. "astrid half stone" */
  targetText: string
  /** Slug derived from targetText, e.g. "astrid-half-stone" */
  slug: string
  /** User explicitly requested promotion past validation failures */
  force: boolean
  /** User explicitly requested overwriting an existing canonical file */
  overwrite: boolean
}

export function parsePromoteIntent(message: string): PromoteIntent {
  const force = /\b(force|--force)\b/i.test(message)
  const overwrite = /\b(overwrite|--overwrite|replace)\b/i.test(message)

  const targetText = message
    .replace(/<chat_history>[\s\S]*?<\/chat_history>/gi, ' ')
    .replace(/\b(please|can you|could you|i want to|i'd like to|let'?s|go ahead and|now|then|also|too|as well)\b/gi, ' ')
    .replace(/\b(force|--force|overwrite|--overwrite|replace)\b/gi, ' ')
    .replace(/\bpromote\b/gi, ' ')
    // drop leftover connectors that would otherwise leak into the slug
    .replace(/\b(and|it|the one|that one)\b/gi, ' ')
    .replace(/\b(into|to)\s+(the\s+)?(corpus|canon)\b/gi, ' ')
    .replace(/\b(the|a|an|this|that|my|our)\b/gi, ' ')
    .replace(/\bproposal\b/gi, ' ')
    // keep word characters, spaces, and hyphens (so an exact slug survives)
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return { targetText, slug: slugify(targetText), force, overwrite }
}

export interface ProposalMatch {
  /** Absolute path to the .proposed.md file */
  path: string
  /** Filename slug (without .proposed.md) */
  slug: string
  title: string
  proposalType: string
  status: string
}

export function listProposals(proposalsRoot: string): ProposalMatch[] {
  const files = fg.sync('**/*.proposed.md', { cwd: proposalsRoot, absolute: true })
  const out: ProposalMatch[] = []
  for (const path of files) {
    try {
      const { data } = matter(readFileSync(path, 'utf-8'))
      const fileSlug = (path.split('/').pop() ?? '').replace(/\.proposed\.md$/, '')
      out.push({
        path,
        slug: fileSlug,
        title: String(data.title ?? ''),
        proposalType: String(data.proposal_type ?? ''),
        status: String(data.status ?? ''),
      })
    } catch {
      // skip unreadable/unparseable files
    }
  }
  return out
}

export type PromoteResolution =
  | { kind: 'match'; match: ProposalMatch; intent: PromoteIntent }
  | { kind: 'ambiguous'; candidates: ProposalMatch[]; intent: PromoteIntent }
  | { kind: 'none'; available: ProposalMatch[]; intent: PromoteIntent }

export function resolveProposalForPromotion(
  message: string,
  proposalsRoot: string,
): PromoteResolution {
  const intent = parsePromoteIntent(message)
  const proposals = listProposals(proposalsRoot)

  if (!intent.slug) {
    return { kind: 'none', available: proposals, intent }
  }

  // Match precedence: exact filename slug → exact title slug → partial contains.
  const tiers: Array<(p: ProposalMatch) => boolean> = [
    (p) => p.slug === intent.slug,
    (p) => slugify(p.title) === intent.slug,
    (p) => p.slug.includes(intent.slug) || slugify(p.title).includes(intent.slug),
  ]

  for (const matches of tiers) {
    const hits = proposals.filter(matches)
    if (hits.length === 1) return { kind: 'match', match: hits[0], intent }
    if (hits.length > 1) return { kind: 'ambiguous', candidates: hits, intent }
  }

  return { kind: 'none', available: proposals, intent }
}

// ── Conversational rendering (pure) ─────────────────────────────────────────

function bullet(p: ProposalMatch): string {
  const bits = [p.proposalType, p.status].filter(Boolean).join(', ')
  return `- \`${p.slug}\`${bits ? ` (${bits})` : ''}${p.title ? ` — ${p.title}` : ''}`
}

export function renderNoMatch(resolution: Extract<PromoteResolution, { kind: 'none' }>): string {
  const { available, intent } = resolution
  if (available.length === 0) {
    return 'No proposals are waiting to be promoted. Generate one first, then say `promote <name>`.'
  }
  const named = intent.slug ? ` matching "${intent.targetText}"` : ''
  return [
    `I couldn't find a proposal${named}. Available proposals:`,
    '',
    ...available.map(bullet),
    '',
    'Reply `promote <name>` with one of these.',
  ].join('\n')
}

export function renderAmbiguous(
  resolution: Extract<PromoteResolution, { kind: 'ambiguous' }>,
): string {
  return [
    `"${resolution.intent.targetText}" matches more than one proposal:`,
    '',
    ...resolution.candidates.map(bullet),
    '',
    'Reply `promote <slug>` with the exact slug you mean.',
  ].join('\n')
}

/**
 * Rendered when the CLI refuses promotion (validation failures, no --force).
 * `details` is the CLI's stderr/stdout describing the failures.
 */
export function renderBlocked(match: ProposalMatch, details: string): string {
  return [
    `🚫 Promotion of \`${match.slug}\` was blocked by validation.`,
    '',
    details.trim(),
    '',
    `Review the issues above. If you want to promote it anyway, reply \`force promote ${match.slug}\`.`,
  ].join('\n')
}
