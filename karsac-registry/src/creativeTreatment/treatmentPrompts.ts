import type { ProposalType } from '../proposals/proposalTypes.js'
import type { ProposalEntityPolicy } from '../proposals/proposalEntityPolicies.js'
import { getCreativeTreatmentContract } from './treatmentContracts.js'

export interface LockedConstraints {
  proposalType: ProposalType
  title?: string | null
  lockedFaction?: string | null
  forbiddenFactions?: string[]
  preferredMechanicalBase?: string | null
  canonicalStatus?: string | null
  sourcePrompt?: string | null
  promoteTarget?: string | null
  routeProfile?: string | null
}

export interface BuildCreativeTreatmentPromptInput {
  proposalType: ProposalType
  draftMarkdown: string
  sourcePrompt: string
  lockedConstraints: LockedConstraints
  entityPolicy?: ProposalEntityPolicy | null
  corpusContext?: string
}

function extractExistingHeadings(markdown: string): string[] {
  return [...markdown.matchAll(/^(##\s+[^\n]+)$/gm)].map((match) => match[1].trim())
}

// Extract text for a specific section heading from a markdown document (corpus anchor text)
function extractCorpusSection(corpus: string, headingName: string): string {
  const escaped = headingName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = corpus.match(new RegExp(`(?:^|\\n)##\\s+${escaped}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, 'i'))
  return match?.[1]?.trim() ?? ''
}

// Build per-section corpus anchor constraints for canonical_reference_only entities
function buildCanonicalReferenceConstraint(
  editableSections: string[],
  corpusContext: string,
): string {
  const sectionLines = editableSections.map((heading) => {
    const name = heading.replace(/^##\s+/, '')
    const text = extractCorpusSection(corpusContext, name)
    if (text) return `${heading}: use only — ${text.slice(0, 400)}`
    return `${heading}: corpus anchor text absent — omit this section entirely.`
  })

  return `This is a canonical reference-only entity. Derive content for each section ONLY from the corpus anchor text provided below. Do not add detail not present in the anchor text. If the corpus anchor text for a section is thin, write a thin section. If it is absent, omit the section entirely.

Per-section anchor constraints:
${sectionLines.join('\n\n')}`
}

function extractSectionBlock(markdown: string, heading: string): string {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = markdown.match(new RegExp(`(?:^|\\n)(${escaped}\\s*\\n[\\s\\S]*?)(?=\\n##\\s|$)`, 'i'))
  return match?.[1]?.trim() ?? `${heading}\n[add or revise this section]`
}

function renderLockedConstraints(lockedConstraints: LockedConstraints): string {
  const lines = [
    `- proposal_type: ${lockedConstraints.proposalType}`,
    `- title: ${lockedConstraints.title ?? '(preserve existing title)'}`,
    `- canonical/provisional status: ${lockedConstraints.canonicalStatus ?? 'provisional'}`,
    `- locked faction: ${lockedConstraints.lockedFaction ?? '(none)'}`,
    `- forbidden factions: ${(lockedConstraints.forbiddenFactions ?? []).join(', ') || '(none)'}`,
    `- preferred mechanical base: ${lockedConstraints.preferredMechanicalBase ?? '(none)'}`,
    `- route profile: ${lockedConstraints.routeProfile ?? '(preserve existing route profile)'}`,
    `- promote target: ${lockedConstraints.promoteTarget ?? '(preserve existing promote target)'}`,
  ]

  return lines.join('\n')
}

function renderAdversaryMechanicsGuide(input: BuildCreativeTreatmentPromptInput): string {
  if (input.proposalType !== 'adversary') return ''

  const faction = input.lockedConstraints.lockedFaction ?? ''
  const contextText = `${input.sourcePrompt}\n${input.draftMarkdown}`.toLowerCase()
  const isShadowWalkerUrban =
    faction === 'shadow-walkers' &&
    /\burban\b|\btown\b|\bcity\b|\bsettlement\b|\bmarket\b|\bharbour\b|\bdock\b/.test(contextText)

  if (!isShadowWalkerUrban) return ''

  return `Shadow Walker urban doctrine-survivability requirement:
Add at least three doctrine-supporting mechanics so the adversary can actually retreat, preserve cover, and protect information under pressure from a combat-optimised party.
If ## Doctrine-Expressive Mechanics names one of these mechanics, keep the naming consistent with the current draft. TypeScript deterministic repair will materialise the guaranteed core mechanics into the Stat Block after treatment.

Recommended mechanics:
Traits:
- **Mapped Exits.** If the Weaver has spent at least 10 minutes in a settlement location before combat begins, it has advantage on initiative. During the first round of combat, it can move up to half its speed without provoking opportunity attacks.
- **No Last Stand.** The Weaver does not fight to the death. If reduced below half its hit points, exposed by name, or separated from its cover identity, it attempts to flee, surrender under a false identity, or create a public misdirection.

Reactions:
- **Crowd Break.** When the Weaver is hit or missed by an attack while at least two non-hostile creatures or significant cover are within 30 feet, it can move up to half its speed without provoking opportunity attacks.
- **Information First.** When the Weaver is reduced below half its hit points or exposed by name, it can use its reaction to conceal, destroy, or pass on one carried note, cipher strip, or message before moving up to 10 feet.

Mechanical cleanup rules:
- Do not write Charisma (Insight); use Wisdom (Insight) or a saving throw instead.
- If using Quick Step, tie it to succeeding on a Dexterity saving throw against an effect that allows such a save.
- If using Counter-Observation, specify that it imposes disadvantage on a Wisdom (Insight) or Intelligence (Investigation) check to expose the cover.
- Do not use abstract consequences like "citywide blackout" in DM-only notes; use grounded local disruptions instead.`
}

export function buildCreativeTreatmentMessages(
  input: BuildCreativeTreatmentPromptInput,
): Array<{ role: string; content: string }> {
  const contract = getCreativeTreatmentContract(input.proposalType)
  const existingHeadings = extractExistingHeadings(input.draftMarkdown)
  const editableSectionBlocks = contract
    ? contract.editableSections.map((heading) => extractSectionBlock(input.draftMarkdown, heading)).join('\n\n')
    : ''
  const readOnlySections = contract
    ? existingHeadings
      .filter((heading) => !contract.editableSections.includes(heading))
      .map((heading) => extractSectionBlock(input.draftMarkdown, heading))
      .join('\n\n')
    : input.draftMarkdown

  if (!contract) {
    return [
      {
        role: 'system',
        content: `You are the creative treatment model for the Karsac DM Assistant.

Your job is not to change the proposal type or canon status.
Your job is to make the proposal feel specific, usable, and alive at the table.

Preserve all locked constraints.
Do not introduce forbidden factions.
Do not promote provisional material to canon.
Do not remove validation-relevant sections.
Return the full revised proposal markdown.`,
      },
      {
        role: 'user',
        content: `Locked constraints:
${renderLockedConstraints(input.lockedConstraints)}

Proposal type:
${input.proposalType}

Draft proposal:
${input.draftMarkdown}

Revise the draft for stronger table usability while preserving the constraints.
Return the full revised proposal markdown.`,
      },
    ]
  }

  const system = `You are the creative treatment model for the Karsac DM Assistant.

Your job is not to change the proposal type or canon status.
Your job is to make the proposal feel specific, usable, and alive at the table.

Locked constraints must be preserved exactly where they govern:
- proposal type
- title
- canonical/provisional status
- locked faction
- forbidden factions
- preferred mechanical base
- source prompt intent
- promote target

Do not promote provisional material to canon.
Do not mutate campaign state.
Do not remove validation-relevant sections.
Do not remove or rename existing section headings from the draft.
You are editing a bounded section patch, not rewriting the full document.
Do not write or rewrite the Stat Block, Traits, Actions, Bonus Actions, Reactions, HP, AC, Challenge, or variant mechanics directly.
Return ONLY the editable sections listed by the user, each with its ## heading.
Do not return the title or untouched sections.`

  const canonicalConstraint =
    input.entityPolicy?.canonicalReferenceOnly && input.corpusContext
      ? buildCanonicalReferenceConstraint(contract.editableSections, input.corpusContext)
      : null

  const user = `Locked constraints:
${renderLockedConstraints(input.lockedConstraints)}

Proposal type:
${input.proposalType}

Editable sections to return:
${contract.editableSections.map((heading) => `- ${heading}`).join('\n')}

Required creative treatment:
${contract.instruction}

${contract.extraInstruction ? `${contract.extraInstruction}\n` : ''}${renderAdversaryMechanicsGuide(input) ? `${renderAdversaryMechanicsGuide(input)}\n\n` : ''}${canonicalConstraint ? `${canonicalConstraint}\n\n` : ''}${input.corpusContext ? `Relevant corpus context:
${input.corpusContext}

` : ''}Read-only reference sections from the draft:
${readOnlySections}

Current editable sections:
${editableSectionBlocks}

Source prompt:
${input.sourcePrompt}

Revise only the editable sections so they satisfy the required creative treatment.
Preserve all locked constraints.
Do not introduce forbidden factions.
Do not promote provisional material to canon.
Do not remove validation-relevant sections.
Do not add or rewrite Stat Block mechanics, HP/AC/Challenge lines, or variant-option mechanics; prose and doctrine only.
Return ONLY the patched editable sections, each with its ## heading.`

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}
