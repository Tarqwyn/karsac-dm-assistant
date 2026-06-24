export const PROPOSAL_TYPE_VALUES = [
  'adversary', 'encounter', 'chapter-outline', 'session-outline',
  'scene', 'npc', 'place', 'item', 'clue', 'handout', 'state-update',
] as const

export type ProposalType = typeof PROPOSAL_TYPE_VALUES[number]

export interface ProposalValidation {
  status: 'pass' | 'warning' | 'fail'
  issues: string[]
}

export interface ProposalRepairLogEntry {
  field: string
  reason: string
  policy?: string
  original?: string
  repaired?: string
  rule?: string
}

export interface ProposalRepairLog {
  pruned_sections: ProposalRepairLogEntry[]
  auto_repairs: ProposalRepairLogEntry[]
  false_positives_suppressed: Array<{
    token: string
    rule: string
    reason: string
  }>
}

export interface ProposalFrontmatter {
  id: string
  proposal_type: ProposalType
  title: string
  status: 'proposed' | 'promoted' | 'rejected'
  canonical: 'provisional'
  visibility: 'dm-only'
  created_at: string
  gateway_build?: string
  corpus_named?: boolean
  corpus_anchor_entity?: string
  corpus_stub_level?: boolean
  corpus_coverage_level?: string
  corpus_policy_id?: string
  source_prompt: string
  route_profile: string
  validation: ProposalValidation
  repair_log?: ProposalRepairLog
  related: {
    chapters: string[]
    sessions: string[]
    factions: string[]
    places: string[]
    npcs: string[]
    items: string[]
    scenes?: string[]
    adversaries?: string[]
    threads?: string[]
    events?: string[]
  }
  promote_target: string
  summary: string
  structured_outline?: Record<string, unknown>
}
