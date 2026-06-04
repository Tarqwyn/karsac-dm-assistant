import { getFactionProfile } from '../faction-profiles.js'
import {
  getAdversaryConstraintHeader,
  getEncounterConstraintLines,
  getNpcConstraintLines,
  getPlaceConstraintLines,
  getCorpusAnchorBaseLines,
  getCorpusAnchorCanonicalReferenceOnlyLines,
  getCorpusAnchorStubLines,
  getCorpusAnchorStubPlaceLines,
  getCorpusAnchorStubCloseLines,
  getCorpusAnchorBoundedLines,
  getCorpusAnchorSnippetsHeader,
} from './generationConstraintsLoader.js'
import type { ProposalType } from './proposalTypes.js'
import type { ProposalCorpusAnchor } from './proposalEntityRegistry.js'

interface SharedStateData {
  campaignState?: Record<string, unknown> | null
  worldThreads?: Record<string, unknown> | null
  playerKnowledge?: Record<string, unknown> | null
  npcsState?: Record<string, unknown> | null
  sessionFacts?: Record<string, unknown> | null
}

export interface ProposalConstraintInput {
  proposalType: ProposalType
  prompt: string
  stateData?: SharedStateData
  lockedFaction?: string | null
  forbiddenFactions?: string[]
  preferredMechanicalBase?: string | null
  corpusAnchor?: ProposalCorpusAnchor | null
}

function stringifyList(label: string, items: string[]): string[] {
  if (items.length === 0) return []
  return [`${label}:`, ...items.map((item) => `- ${item}`)]
}

function toThreadLines(worldThreads: Record<string, unknown> | null | undefined, statuses: string[]): string[] {
  const threads = Array.isArray((worldThreads as any)?.threads) ? (worldThreads as any).threads : []
  return threads
    .filter((thread: any) => statuses.includes(String(thread.currentStatus ?? '').toLowerCase()))
    .slice(0, 6)
    .map((thread: any) => `${thread.name}: ${thread.summary ?? 'no summary'}`)
}

function buildStateTrackerBlock(
  proposalType: ProposalType,
  stateData: SharedStateData | undefined,
  lockedFaction: string | null | undefined,
): string[] {
  if (!stateData) return []

  const campaignState = (stateData.campaignState as any) ?? {}
  const playerKnowledge = (stateData.playerKnowledge as any) ?? {}
  const worldThreads = stateData.worldThreads ?? null
  const sessionFacts = (stateData.sessionFacts as any) ?? {}
  const header = [
    `Session ${campaignState.currentSession ?? '?'} / Chapter ${campaignState.currentChapter ?? '?'}`,
    campaignState.clock ? `Clock ${campaignState.clock.value}/${campaignState.clock.max}` : null,
  ].filter(Boolean).join(' | ')

  const hot = toThreadLines(worldThreads, ['hot'])
  const simmering = toThreadLines(worldThreads, ['simmering'])
  const resolved = toThreadLines(worldThreads, ['resolved', 'complete', 'completed'])
  const established = Array.isArray(playerKnowledge.knownFacts) ? playerKnowledge.knownFacts.slice(0, 5) : []
  const mustNotReveal = Array.isArray(sessionFacts.dmOnlyFacts) ? sessionFacts.dmOnlyFacts.slice(0, 4) : []

  const lines = [
    'CHAPTER STATE TRACKER',
    header || 'Session / chapter unknown',
    ...stringifyList('Established facts', established.map(String)),
    ...stringifyList('Hot threads', hot),
    ...(proposalType === 'encounter' || proposalType === 'npc' || proposalType === 'place'
      ? stringifyList('Contingent / simmering threads', simmering)
      : []),
    ...(proposalType === 'encounter' || proposalType === 'npc'
      ? stringifyList('Resolved threads to preserve continuity against', resolved)
      : []),
    ...stringifyList('Must not reveal', mustNotReveal.map(String)),
  ]

  if (proposalType === 'adversary' && lockedFaction) {
    const factionNeedle = lockedFaction.toLowerCase().replace(/-/g, ' ')
    const factionRelevant = [...hot, ...simmering]
      .filter((line) => line.toLowerCase().includes(factionNeedle))
      .slice(0, 4)
    if (factionRelevant.length > 0) {
      lines.push(...stringifyList('Faction-relevant threads', factionRelevant))
    }
  }

  return lines
}

function buildAdversaryConstraintLines(input: ProposalConstraintInput): string[] {
  const lines = [...getAdversaryConstraintHeader()]

  if (input.preferredMechanicalBase) {
    lines.push(`- Requested mechanical base: ${input.preferredMechanicalBase}. Use it as a scaffold, not authority.`)
  }
  if (input.lockedFaction) {
    lines.push(`- Locked faction: ${input.lockedFaction}. Preserve it.`)
    const factionProfile = getFactionProfile(input.lockedFaction)
    if (factionProfile) {
      if (factionProfile.defaultAlignment) lines.push(`- Alignment convention: ${factionProfile.defaultAlignment}.`)
      if (factionProfile.languageWhitelist.length > 0) {
        lines.push(`- Language whitelist: ${factionProfile.languageWhitelist.join(', ')}.`)
      }
      if (factionProfile.spellcasting.default === 'prohibited') {
        lines.push('- Spellcasting is prohibited unless explicitly justified by override.')
      }
      if (factionProfile.requiredDoctrineThemes.length > 0) {
        lines.push(`- Required doctrine themes: ${factionProfile.requiredDoctrineThemes.join(', ')}.`)
      }
      if (factionProfile.styleNotes.length > 0) {
        lines.push(`- Style notes: ${factionProfile.styleNotes.join(' ')}`)
      }
      for (const constraint of factionProfile.generationConstraints) {
        lines.push(`- ${constraint}`)
      }
    }
  }
  if (input.forbiddenFactions && input.forbiddenFactions.length > 0) {
    lines.push(`- Forbidden faction affiliations: ${input.forbiddenFactions.join(', ')}.`)
  }

  return lines
}

function buildEncounterConstraintLines(): string[] {
  return getEncounterConstraintLines()
}

function buildNpcConstraintLines(): string[] {
  return getNpcConstraintLines()
}

function buildPlaceConstraintLines(): string[] {
  return getPlaceConstraintLines()
}

function buildCorpusAnchorLines(input: ProposalConstraintInput): string[] {
  const anchor = input.corpusAnchor
  if (!anchor?.corpusNamed || !anchor.entity) return []
  const policy = anchor.policy

  const lines = [...getCorpusAnchorBaseLines(anchor.entity.type)]

  if (policy?.canonicalReferenceOnly) {
    lines.push(...getCorpusAnchorCanonicalReferenceOnlyLines())
  }

  if (policy?.coverageLevel === 'stub' || (anchor.stubLevel && input.proposalType === 'place')) {
    lines.push(...getCorpusAnchorStubLines())
    if (input.proposalType === 'place') {
      lines.push(...getCorpusAnchorStubPlaceLines())
    }
    lines.push(...getCorpusAnchorStubCloseLines())
  }

  if (policy?.coverageLevel === 'bounded') {
    lines.push(...getCorpusAnchorBoundedLines())
  }

  if (policy?.allowedSections.length) {
    lines.push(`- Preferred proposal sections for this entity: ${policy.allowedSections.join(', ')}.`)
  }

  if (policy?.forbiddenSections.length) {
    lines.push(`- Do not fill unsupported sections for this entity: ${policy.forbiddenSections.join(', ')}.`)
  }

  if (policy?.unresolvedFieldsPreferred) {
    lines.push('- Unsupported character fields should remain unresolved rather than being invented.')
  }

  if (policy?.ambiguityFlags.length) {
    lines.push('- Preserve these canonical ambiguities:')
    for (const flag of policy.ambiguityFlags) lines.push(`  - ${flag}`)
  }

  if (policy?.promptConstraints.length) {
    lines.push('- Entity-specific scope rules:')
    for (const rule of policy.promptConstraints) lines.push(`  - ${rule}`)
  }

  if (anchor.exactSnippets.length > 0) {
    lines.push(getCorpusAnchorSnippetsHeader())
    for (const snippet of anchor.exactSnippets) lines.push(`- ${snippet}`)
  }

  return lines
}

export function buildConstrainedProposalPrompt(input: ProposalConstraintInput): string {
  const stateLines = buildStateTrackerBlock(input.proposalType, input.stateData, input.lockedFaction)
  const anchorLines = buildCorpusAnchorLines(input)
  const constraintLines =
    input.proposalType === 'adversary'
      ? buildAdversaryConstraintLines(input)
      : input.proposalType === 'encounter'
        ? buildEncounterConstraintLines()
        : input.proposalType === 'npc'
          ? buildNpcConstraintLines()
          : input.proposalType === 'place'
        ? buildPlaceConstraintLines()
        : ['PRE-GENERATION CONSTRAINTS', '- Keep output within the requested proposal type and supplied state context.']

  return [
    ...stateLines,
    ...(stateLines.length > 0 ? [''] : []),
    ...anchorLines,
    ...(anchorLines.length > 0 ? [''] : []),
    '',
    ...constraintLines,
    '',
    'ORIGINAL USER REQUEST',
    input.prompt,
  ].join('\n')
}
