import { normalizeEntityName } from './proposalEntityRegistry.js'
import type { ProposalType, ProposalRepairLog } from './proposalTypes.js'
import type { ProposalEntityPolicy } from './proposalEntityPolicies.js'

interface ParsedSection {
  heading: string
  content: string
}

interface ParsedProposalBody {
  prefix: string
  sections: ParsedSection[]
}

const BODY_METADATA_HEADINGS = new Set(['corpus frontmatter', 'repair log', 'validation notes', 'promotion details'])

export interface PruneProposalResult {
  body: string
  repairLog: ProposalRepairLog
}

function parseProposalBody(body: string): ParsedProposalBody {
  const headingRegex = /^##\s+(.+?)\s*$/gm
  const matches = [...body.matchAll(headingRegex)]
  if (matches.length === 0) {
    return { prefix: body.trim(), sections: [] }
  }

  const prefix = body.slice(0, matches[0]!.index).trimEnd()
  const sections: ParsedSection[] = []

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i]!
    const next = matches[i + 1]
    const start = current.index + current[0].length
    const end = next ? next.index : body.length
    sections.push({
      heading: current[1]!.trim(),
      content: body.slice(start, end).trim(),
    })
  }

  return { prefix, sections }
}

function renderProposalBody(parsed: ParsedProposalBody): string {
  const lines: string[] = []
  if (parsed.prefix.trim()) lines.push(parsed.prefix.trim())
  for (const section of parsed.sections) {
    if (lines.length > 0) lines.push('')
    lines.push(`## ${section.heading}`)
    lines.push('')
    if (section.content.trim()) lines.push(section.content.trim())
  }
  return lines.join('\n').trim()
}

function buildAmbiguitiesSection(policy: ProposalEntityPolicy): ParsedSection | null {
  if (policy.ambiguityFlags.length === 0) return null
  return {
    heading: 'Ambiguities',
    content: policy.ambiguityFlags.map((flag) => `- ${flag}`).join('\n'),
  }
}

function toFieldName(heading: string): string {
  return normalizeEntityName(heading).replace(/\s+/g, '_')
}

function shouldPruneSection(
  heading: string,
  policy: ProposalEntityPolicy | null,
): { prune: boolean; reason?: string } {
  const normalized = normalizeEntityName(heading)
  if (BODY_METADATA_HEADINGS.has(normalized)) {
    return { prune: true, reason: 'metadata_replaced' }
  }
  if (!policy) return { prune: false }

  const forbidden = new Set(policy.forbiddenSections.map((section) => normalizeEntityName(section)))
  const allowed = new Set(policy.allowedSections.map((section) => normalizeEntityName(section)))

  if (forbidden.has(normalized)) {
    return { prune: true, reason: 'forbidden_expansion_field' }
  }

  if (policy.coverageLevel === 'stub' && allowed.size > 0 && !allowed.has(normalized)) {
    return { prune: true, reason: 'stub_scope_pruning' }
  }

  return { prune: false }
}

function stripForbiddenSentences(
  content: string,
  policy: ProposalEntityPolicy,
): { content: string; stripped: string[] } {
  const failPatterns = policy.forbiddenPatterns
    .filter((p) => p.severity === 'fail')
    .map((p) => new RegExp(p.pattern, 'i'))

  if (failPatterns.length === 0) return { content, stripped: [] }

  const stripped: string[] = []
  const sentences = content.split(/(?<=[.!?])\s+/)
  const kept = sentences.filter((sentence) => {
    const matched = failPatterns.find((re) => re.test(sentence))
    if (matched) {
      stripped.push(sentence.trim())
      return false
    }
    return true
  })

  return { content: kept.join(' ').trim(), stripped }
}

export function pruneProposalOutput(
  body: string,
  proposalType: ProposalType,
  policy: ProposalEntityPolicy | null,
): PruneProposalResult {
  const parsed = parseProposalBody(body)
  const keptSections: ParsedSection[] = []
  const repairLog: ProposalRepairLog = {
    pruned_sections: [],
    auto_repairs: [],
    false_positives_suppressed: [],
  }

  for (const section of parsed.sections) {
    const decision = shouldPruneSection(section.heading, policy)
    if (decision.prune) {
      repairLog.pruned_sections.push({
        field: toFieldName(section.heading),
        reason: decision.reason ?? 'pruned',
        policy: policy ? `proposal-entity-policies.yaml#${policy.entityId}` : `proposal-type-contract#${proposalType}`,
      })
      continue
    }
    if (policy?.canonicalReferenceOnly) {
      const { content: stripped, stripped: removedSentences } = stripForbiddenSentences(section.content, policy)
      for (const sentence of removedSentences) {
        repairLog.auto_repairs.push({
          field: toFieldName(section.heading),
          reason: `forbidden_sentence_stripped: ${sentence.slice(0, 80)}`,
          policy: `proposal-entity-policies.yaml#${policy.entityId}`,
        })
      }
      keptSections.push({ heading: section.heading, content: stripped })
    } else {
      keptSections.push(section)
    }
  }

  if (policy?.requireAmbiguitySection && !keptSections.some((section) => normalizeEntityName(section.heading) === 'ambiguities')) {
    const ambiguitySection = buildAmbiguitiesSection(policy)
    if (ambiguitySection) {
      keptSections.push(ambiguitySection)
      repairLog.auto_repairs.push({
        field: 'ambiguities',
        reason: 'required_ambiguity_injected',
        policy: `proposal-entity-policies.yaml#${policy.entityId}`,
      })
    }
  }

  const prunedBody = renderProposalBody({ prefix: parsed.prefix, sections: keptSections })
  return {
    body: prunedBody,
    repairLog,
  }
}
