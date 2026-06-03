export type ProposalType =
  | 'adversary' | 'encounter' | 'chapter-outline'
  | 'session-outline' | 'scene' | 'npc' | 'place'
  | 'item' | 'clue' | 'handout' | 'state-update'

import { getProposalFolder, getPromoteTarget } from './proposalContractsLoader.js'

const ALL_PROPOSAL_TYPES: ProposalType[] = [
  'adversary', 'encounter', 'chapter-outline', 'session-outline',
  'scene', 'npc', 'place', 'item', 'clue', 'handout', 'state-update',
]

export const PROPOSAL_FOLDERS: Record<ProposalType, string> = Object.fromEntries(
  ALL_PROPOSAL_TYPES.map((t) => [t, getProposalFolder(t)]),
) as Record<ProposalType, string>

export const PROMOTE_TARGETS: Record<ProposalType, string | null> = Object.fromEntries(
  ALL_PROPOSAL_TYPES.map((t) => [t, getPromoteTarget(t)]),
) as Record<ProposalType, string | null>

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
  }
  promote_target: string
  summary: string
}
