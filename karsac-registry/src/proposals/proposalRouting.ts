import { routeQuestion } from '../router.js'
import type { Profile } from '../router.js'
import type { ProposalType } from './proposalTypes.js'

const ADVERSARY_PROPOSAL_PATTERN =
  /\bnew\s+adversary\b|\badversary\b|\bfaction\s+(?:agent|member|operative)\b|\bmartial\s+threat\b|\bcombat\s+threat\b|\bif\s+confronted\b|\bencountered\s+(?:alone|in\s+pairs?)\b|\btraits?\s+and\s+actions?\b|\bstat\s+block\b|\bdm\s+can\s+choo?s\b|\bx\s+out\s+of\s+y\b|\bvariant\b[^.]*(?:faction|threat|danger|shadow|blend)\b|\bblending\s+in\b[^.]*(?:faction|shadow|hidden|agent)\b|\binfiltrator\b|\bnot\s+as\s+dangerous\s+as\b/i

const PLACE_INDICATOR_TERMS = [
  'new place', 'market town', 'key districts', 'key landmarks', 'key regions',
  'miles east', 'miles west', 'miles north', 'miles south',
  'fjord', 'inland',
  'population', 'located', 'landmark', 'district',
  'settlement', 'harbour', 'harbor',
  'village', 'town', 'city', 'place',
  'region',
] as const

export interface ProposalExecutionPlan {
  proposalType: ProposalType
  proposalProfile: string
  contextProfile: string
  routeReason: string
  placeMatchedTerms: string[]
  adversaryMatchedTerms: string[]
  explicitType: boolean
}

const EXPLICIT_PROPOSAL_OPENING_PATTERNS: Array<[RegExp, ProposalType]> = [
  [/^\s*(?:please\s+)?propose\s+(?:a|an)\s+new\s+npc\b/i, 'npc'],
  [/^\s*(?:please\s+)?propose\s+(?:a|an)\s+new\s+adversary\b/i, 'adversary'],
  [/^\s*(?:please\s+)?propose\s+(?:a|an)\s+new\s+place\b/i, 'place'],
  [/^\s*(?:please\s+)?propose\s+(?:a|an)\s+new\s+encounter\b/i, 'encounter'],
  [/^\s*(?:please\s+)?propose\s+(?:a|an)\s+new\s+scene\b/i, 'scene'],
  [/^\s*(?:please\s+)?propose\s+(?:a|an)\s+new\s+item\b/i, 'item'],
  [/^\s*(?:please\s+)?propose\s+(?:a|an)\s+new\s+clue\b/i, 'clue'],
  [/^\s*(?:please\s+)?propose\s+(?:a|an)\s+new\s+handout\b/i, 'handout'],
  [/^\s*(?:please\s+)?propose\s+(?:a|an)\s+new\s+state(?:\s+update)?\b/i, 'state-update'],
  [/^\s*(?:please\s+)?propose\s+(?:a|an)\s+new\s+session(?:\s+outline)?\b/i, 'session-outline'],
  [/^\s*(?:please\s+)?propose\s+(?:a|an)\s+new\s+chapter(?:\s+outline)?\b/i, 'chapter-outline'],
]

function isAdversaryProposal(prompt: string): boolean {
  return ADVERSARY_PROPOSAL_PATTERN.test(prompt)
}

export function findMatchedAdversaryTerms(prompt: string): string[] {
  const checks: Array<[RegExp, string]> = [
    [/\bnew\s+adversary\b/i, 'new adversary'],
    [/\badversary\b/i, 'adversary'],
    [/\bmartial\s+threat\b/i, 'martial threat'],
    [/\bif\s+confronted\b/i, 'if confronted'],
    [/\bencountered\s+alone\b/i, 'encountered alone'],
    [/\btraits?\s+and\s+actions?\b/i, 'traits and actions'],
    [/\bstat\s+block\b/i, 'stat block'],
    [/\bdm\s+can\s+choo?s\b/i, 'dm can choose'],
    [/\binfiltrator\b/i, 'infiltrator'],
    [/\bblending\s+in\b/i, 'blending in'],
    [/\bnot\s+as\s+dangerous\b/i, 'not as dangerous'],
    [/\bvariant\b/i, 'variant'],
  ]
  return checks.filter(([re]) => re.test(prompt)).map(([, label]) => label).slice(0, 5)
}

export function findMatchedPlaceTerms(prompt: string): string[] {
  const lq = prompt.toLowerCase()
  return PLACE_INDICATOR_TERMS.filter((t) =>
    new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?\\b`, 'i').test(lq),
  ).slice(0, 5)
}

function isPlaceProposal(prompt: string): boolean {
  return findMatchedPlaceTerms(prompt).length > 0
}

export function profileForExplicitType(t: ProposalType): string {
  if (t === 'adversary') return 'adversary-design'
  if (t === 'encounter') return 'encounter-design'
  if (t === 'npc') return 'npc-design'
  if (t === 'place') return 'place-design'
  if (t === 'chapter-outline') return 'state'
  return 'state'
}

export function detectExplicitProposalType(prompt: string): ProposalType | null {
  for (const [pattern, proposalType] of EXPLICIT_PROPOSAL_OPENING_PATTERNS) {
    if (pattern.test(prompt)) return proposalType
  }
  return null
}

export function proposalTypeFromRoute(profile: Profile, prompt: string): ProposalType {
  if (profile === 'adversary-design') return 'adversary'
  if (profile === 'encounter-design') return 'encounter'
  if (isAdversaryProposal(prompt)) return 'adversary'
  if (isPlaceProposal(prompt)) return 'place'
  if (/chapter|outline/i.test(prompt)) return 'chapter-outline'
  return 'encounter'
}

export function detectProposalExecutionPlan(
  prompt: string,
  explicitType: ProposalType | null = null,
): ProposalExecutionPlan {
  if (explicitType) {
    return {
      proposalType: explicitType,
      proposalProfile: profileForExplicitType(explicitType),
      contextProfile: profileForExplicitType(explicitType),
      routeReason: 'explicit --type',
      placeMatchedTerms: explicitType === 'place' ? findMatchedPlaceTerms(prompt) : [],
      adversaryMatchedTerms: explicitType === 'adversary' ? findMatchedAdversaryTerms(prompt) : [],
      explicitType: true,
    }
  }

  const promptExplicitType = detectExplicitProposalType(prompt)
  if (promptExplicitType) {
    const routeResult = routeQuestion(prompt)
    return {
      proposalType: promptExplicitType,
      proposalProfile: profileForExplicitType(promptExplicitType),
      contextProfile: routeResult.profile,
      routeReason: `explicit opening proposal type: ${promptExplicitType}`,
      placeMatchedTerms: promptExplicitType === 'place' ? findMatchedPlaceTerms(prompt) : [],
      adversaryMatchedTerms: promptExplicitType === 'adversary' ? findMatchedAdversaryTerms(prompt) : [],
      explicitType: true,
    }
  }

  const routeResult = routeQuestion(prompt)
  const proposalType = proposalTypeFromRoute(routeResult.profile, prompt)
  const proposalProfile = proposalType === 'place'
    ? 'place-design'
    : proposalType === 'adversary'
      ? 'adversary-design'
      : proposalType === 'encounter'
        ? 'encounter-design'
        : routeResult.profile

  return {
    proposalType,
    proposalProfile,
    contextProfile: routeResult.profile,
    routeReason: routeResult.reason,
    placeMatchedTerms: proposalType === 'place' ? findMatchedPlaceTerms(prompt) : [],
    adversaryMatchedTerms: proposalType === 'adversary' ? findMatchedAdversaryTerms(prompt) : [],
    explicitType: false,
  }
}
