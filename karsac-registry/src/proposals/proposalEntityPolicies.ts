import { existsSync, readFileSync } from 'fs'
import matter from 'gray-matter'
import { REGISTRY_ROOT } from '../paths.js'

export type CorpusCoverageLevel = 'stub' | 'anchored' | 'bounded' | 'full'
export type ProposalScopeRule = 'minimal' | 'bounded' | 'full'
export type PolicySeverity = 'warn' | 'fail'

export interface ProposalEntityForbiddenPattern {
  pattern: string
  severity: PolicySeverity
  message: string
}

export interface ProposalEntityPolicy {
  entityId: string
  coverageLevel: CorpusCoverageLevel
  proposalScope: ProposalScopeRule
  canonicalReferenceOnly: boolean
  unresolvedFieldsPreferred: boolean
  allowedSections: string[]
  forbiddenSections: string[]
  promptConstraints: string[]
  ambiguityFlags: string[]
  requireAmbiguitySection: boolean
  forbiddenPatterns: ProposalEntityForbiddenPattern[]
}

interface ParsedPolicyFile {
  entity_policies?: Array<Record<string, unknown>>
}

const ENTITY_POLICY_PATH = `${REGISTRY_ROOT}/proposal-entity-policies.yaml`

let cachedPolicies: Map<string, ProposalEntityPolicy> | null = null

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : []
}

function parsePolicyRow(row: Record<string, unknown>): ProposalEntityPolicy | null {
  const entityId = String(row.entity_id ?? '').trim()
  if (!entityId) return null

  const forbiddenPatterns = Array.isArray(row.forbidden_patterns)
    ? row.forbidden_patterns
        .map((entry) => {
          if (!entry || typeof entry !== 'object') return null
          const pattern = String((entry as Record<string, unknown>).pattern ?? '').trim()
          const severity = String((entry as Record<string, unknown>).severity ?? 'fail').trim() as PolicySeverity
          const message = String((entry as Record<string, unknown>).message ?? '').trim()
          if (!pattern || !message || (severity !== 'warn' && severity !== 'fail')) return null
          return { pattern, severity, message }
        })
        .filter((entry): entry is ProposalEntityForbiddenPattern => Boolean(entry))
    : []

  const coverageLevel = String(row.coverage_level ?? 'full').trim() as CorpusCoverageLevel
  const proposalScope = String(row.proposal_scope ?? 'full').trim() as ProposalScopeRule

  return {
    entityId,
    coverageLevel: coverageLevel === 'stub' || coverageLevel === 'anchored' || coverageLevel === 'bounded' ? coverageLevel : 'full',
    proposalScope: proposalScope === 'minimal' || proposalScope === 'bounded' ? proposalScope : 'full',
    canonicalReferenceOnly: row.canonical_reference_only === true,
    unresolvedFieldsPreferred: row.unresolved_fields_preferred === true,
    allowedSections: toStringArray(row.allowed_sections),
    forbiddenSections: toStringArray(row.forbidden_sections),
    promptConstraints: toStringArray(row.prompt_constraints),
    ambiguityFlags: toStringArray(row.ambiguity_flags),
    requireAmbiguitySection: row.require_ambiguity_section === true,
    forbiddenPatterns,
  }
}

export function loadProposalEntityPolicies(): Map<string, ProposalEntityPolicy> {
  if (cachedPolicies) return cachedPolicies
  const map = new Map<string, ProposalEntityPolicy>()
  if (!existsSync(ENTITY_POLICY_PATH)) {
    cachedPolicies = map
    return map
  }

  const raw = readFileSync(ENTITY_POLICY_PATH, 'utf-8')
  const parsed = matter(`---\n${raw}\n---`).data as ParsedPolicyFile
  for (const row of parsed.entity_policies ?? []) {
    const policy = parsePolicyRow(row)
    if (!policy) continue
    map.set(policy.entityId, policy)
  }
  cachedPolicies = map
  return map
}

export function getProposalEntityPolicy(entityId: string | null | undefined): ProposalEntityPolicy | null {
  if (!entityId) return null
  return loadProposalEntityPolicies().get(entityId) ?? null
}

export function clearProposalEntityPolicyCachesForTests(): void {
  cachedPolicies = null
}
