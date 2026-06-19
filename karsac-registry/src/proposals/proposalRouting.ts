import { routeQuestion } from '../router.js'
import type { Profile } from '../router.js'
import type { ProposalType } from './proposalTypes.js'
import {
  getAdversaryProposalPattern,
  getAdversaryTermChecks,
  getPlaceIndicatorTerms,
  getExplicitProposalOpeningPatterns,
} from '../routerConfigLoader.js'

export interface ProposalExecutionPlan {
  proposalType: ProposalType
  proposalProfile: string
  contextProfile: string
  routeReason: string
  placeMatchedTerms: string[]
  adversaryMatchedTerms: string[]
  explicitType: boolean
}

function isAdversaryProposal(prompt: string): boolean {
  return getAdversaryProposalPattern().test(prompt)
}

export function findMatchedAdversaryTerms(prompt: string): string[] {
  return getAdversaryTermChecks()
    .filter(({ regex }) => regex.test(prompt))
    .map(({ label }) => label)
    .slice(0, 5)
}

export function findMatchedPlaceTerms(prompt: string): string[] {
  const lq = prompt.toLowerCase()
  return getPlaceIndicatorTerms().filter((t) =>
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
  if (t === 'item' || t === 'handout' || t === 'clue') return 'item-design'
  if (t === 'chapter-outline') return 'state'
  return 'state'
}

export function detectExplicitProposalType(prompt: string): ProposalType | null {
  for (const { regex, proposalType } of getExplicitProposalOpeningPatterns()) {
    if (regex.test(prompt)) return proposalType as ProposalType
  }
  return null
}

export function proposalTypeFromRoute(profile: Profile, prompt: string): ProposalType {
  if (profile === 'adversary-design') return 'adversary'
  if (profile === 'encounter-design') return 'encounter'
  if (/chapter|outline/i.test(prompt)) return 'chapter-outline'
  if (isAdversaryProposal(prompt)) return 'adversary'
  if (isPlaceProposal(prompt)) return 'place'
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
