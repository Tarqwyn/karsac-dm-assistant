export type ProposalType =
  | 'adversary' | 'encounter' | 'chapter-outline'
  | 'session-outline' | 'scene' | 'npc' | 'place'
  | 'item' | 'clue' | 'handout' | 'state-update'

export const PROPOSAL_FOLDERS: Record<ProposalType, string> = {
  adversary: 'adversaries',
  encounter: 'encounters',
  'chapter-outline': 'chapters',
  'session-outline': 'sessions',
  scene: 'scenes',
  npc: 'npcs',
  place: 'places',
  item: 'items',
  clue: 'clues',
  handout: 'handouts',
  'state-update': 'state-updates',
}

export const PROMOTE_TARGETS: Record<ProposalType, string | null> = {
  adversary: 'corpus/adversary-corpus/karsac-adversaries',
  encounter: 'corpus/planning/scenes',
  'chapter-outline': 'corpus/planning/chapters',
  'session-outline': 'corpus/planning/sessions',
  scene: 'corpus/planning/scenes',
  npc: 'corpus/planning/npcs',
  place: 'corpus/planning/places',
  item: 'corpus/planning/items',
  clue: 'corpus/planning/clues',
  handout: 'corpus/planning/handouts',
  'state-update': null,
}

export interface ProposalValidation {
  status: 'pass' | 'warning' | 'fail'
  issues: string[]
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
  source_prompt: string
  route_profile: string
  validation: ProposalValidation
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
