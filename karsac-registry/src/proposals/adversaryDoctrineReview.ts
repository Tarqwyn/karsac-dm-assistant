import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { COLLECTIONS_ROOT } from '../paths.js'
import type { AdversaryProposalConstraints, BaseFile } from '../adversary-design.js'
import type { ScoredAdversary } from '../encounter-design.js'

const FACTION_CONTEXT_PATHS: Record<string, string[]> = {
  'shadow-walkers': ['karsac-factions/shadow-walkers.md'],
  mathr: ['karsac-factions/house-mathr.md'],
  yngondi: ['karsac-factions/yngondi.md'],
  vishara: ['karsac-forces-cosmology/vishara.md'],
  yantravaq: ['karsac-factions/yantravaq.md', 'karsac-forces-cosmology/yantravaq-collective.md'],
  vane: ['karsac-factions/house-vane-mathr.md'],
}

export interface DoctrineReviewDecisionInput {
  explicitFlag: boolean | null
  proposalType: string
  lockedFaction: string | null
  doctrineModel: string | null
}

export interface DoctrineReviewPromptInput {
  prompt: string
  proposalText: string
  constraints: AdversaryProposalConstraints
  baseFile: BaseFile | null
  relatedAdversaries: ScoredAdversary[]
  validationIssues: string[]
  validationStatus: 'pass' | 'warning' | 'fail'
}

function loadFactionContext(factionSlug: string | null): string {
  if (!factionSlug) return '(No faction context loaded.)'

  const candidates = FACTION_CONTEXT_PATHS[factionSlug] ?? []
  for (const relPath of candidates) {
    const absPath = resolve(COLLECTIONS_ROOT, relPath)
    if (!existsSync(absPath)) continue
    return `FACTION CONTEXT FILE: ${relPath}\n${readFileSync(absPath, 'utf-8')}`
  }

  return `(No faction context file found for ${factionSlug}.)`
}

function renderRelatedExamples(relatedAdversaries: ScoredAdversary[]): string {
  if (relatedAdversaries.length === 0) return '(No relevant existing adversary examples loaded.)'

  return relatedAdversaries
    .slice(0, 3)
    .map((adversary) => [
      `### ${adversary.id}`,
      `Summary: ${adversary.summary}`,
      `Mechanical base: ${adversary.mechanicalBase.join(', ') || '(unspecified)'}`,
      `Tactics: ${adversary.tactics.slice(0, 3).join(' | ') || '(none)'}`,
      `DM only: ${adversary.dmOnly.slice(0, 2).join(' | ') || '(none)'}`,
    ].join('\n'))
    .join('\n\n')
}

function renderValidationBlock(
  validationStatus: 'pass' | 'warning' | 'fail',
  validationIssues: string[],
): string {
  if (validationIssues.length === 0) {
    return `FIRST PASS VALIDATION: ${validationStatus}\n- No structural issues detected.`
  }

  return [
    `FIRST PASS VALIDATION: ${validationStatus}`,
    ...validationIssues.map((issue) => `- ${issue}`),
  ].join('\n')
}

function renderShadowWalkerUrbanMechanicsGuide(
  constraints: AdversaryProposalConstraints,
  prompt: string,
  proposalText: string,
): string {
  if (constraints.lockedFaction !== 'shadow-walkers') return ''
  const contextText = `${prompt}\n${proposalText}\n${constraints.environmentContext ?? ''}`.toLowerCase()
  if (!/\burban\b|\btown\b|\bcity\b|\bsettlement\b|\bmarket\b|\bharbour\b|\bdock\b/.test(contextText)) return ''

  return `Shadow Walker urban survivability requirement:
Add at least three doctrine-supporting mechanics so the adversary can survive contact with a combat-optimised party while preserving cover and information.
If ## Doctrine-Expressive Mechanics names one of these mechanics, the same mechanic must appear in the actual Stat Block under Traits, Actions, Bonus Actions, or Reactions.

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

export function shouldRunAdversaryDoctrineReview(input: DoctrineReviewDecisionInput): boolean {
  if (input.proposalType !== 'adversary') return false
  if (!input.lockedFaction) return false
  if (!input.doctrineModel) return false
  if (input.explicitFlag === false) return false
  if (input.explicitFlag === true) return true
  return /^true$/i.test(process.env.KARSAC_ENABLE_DOCTRINE_REVIEW ?? '')
}

export function extractAdversaryDocument(outputText: string): string {
  const headingIndex = outputText.search(/^#\s+Adversary:\s+/im)
  if (headingIndex === -1) return outputText.trim()
  return outputText.slice(headingIndex).trim()
}

export function extractAdversaryTitle(outputText: string): string | null {
  return outputText.match(/^#\s+Adversary:\s+(.+)$/im)?.[1]?.trim() ?? null
}

export function extractMechanicalBaseReference(outputText: string): string | null {
  const section = outputText.match(/##\s+Mechanical\s+Base\s*\n([\s\S]*?)(?=\n##\s|\s*$)/i)?.[1] ?? ''
  const baseLine = section.match(/\bBase:\s*([^\n]+)/i)?.[1]?.trim()
  if (baseLine) return baseLine
  return section.split('\n').map((line) => line.trim()).find(Boolean) ?? null
}

export function getMissingDoctrineSections(outputText: string): string[] {
  const requiredSections = ['Doctrine', 'Doctrine Under Pressure', 'Behavioural Stages', 'Tactical Notes', 'Doctrine-Expressive Mechanics']
  return requiredSections.filter((heading) => {
    const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return !new RegExp(`(?:^|\\n)##\\s+${escaped}\\s*\\n`, 'i').test(outputText)
  })
}

export function buildAdversaryDoctrineReviewMessages(
  input: DoctrineReviewPromptInput,
): Array<{ role: string; content: string }> {
  const factionContext = loadFactionContext(input.constraints.lockedFaction)
  const mechanicalBase = extractMechanicalBaseReference(input.proposalText) ?? '(not detected)'
  const relatedExamples = renderRelatedExamples(input.relatedAdversaries)
  const validationBlock = renderValidationBlock(input.validationStatus, input.validationIssues)
  const forbiddenFactions = input.constraints.forbiddenFactions.length > 0
    ? input.constraints.forbiddenFactions.join(', ')
    : '(none)'
  const shadowWalkerUrbanGuide = renderShadowWalkerUrbanMechanicsGuide(
    input.constraints,
    input.prompt,
    input.proposalText,
  )
  const baseContext = input.baseFile
    ? `MECHANICAL BASE FILE: ${input.baseFile.id}\n${input.baseFile.content}`
    : '(No base file loaded.)'

  const system = `You are Karsac adversary-doctrine-review.

Your job is to refine an already-generated adversary proposal so it expresses faction doctrine and practical table behaviour, not just generic competence.

Return a COMPLETE revised adversary proposal markdown document.
Do not return commentary before or after the document.

You may:
- tighten prose
- improve tactics
- add doctrine sections
- replace optional abilities when needed to express doctrine

You must NOT:
- change the proposal type
- change the adversary title
- change the mechanical base reference
- change canonical status
- change the locked faction
- introduce forbidden factions
- promote the proposal

Required sections in the revised output:
- ## Doctrine
- ## Doctrine Under Pressure
- ## Behavioural Stages
- ## Tactical Notes
- ## Doctrine-Expressive Mechanics

For ## Doctrine Under Pressure, explain:
- what the adversary does on round one if attacked
- how it avoids being pinned down
- what it prioritises preserving
- when it retreats
- what it does if escape is impossible
- what it will not do even under pressure

For ## Behavioural Stages, include:
- Stage One — Mission incomplete.
- Stage Two — Exposed or blocked.
- Stage Three — Cornered or compromised.

Each stage must state:
- what the adversary wants
- what it does
- what it avoids
- what mechanics it uses

For ## Tactical Notes, include:
- opening behaviour
- target priority
- retreat logic
- escalation trigger
- what they do if captured
- what they will not do

Focus questions:
1. Does this feel like the faction, or just a generic spy/assassin?
2. What doctrine governs behaviour?
3. What problem is the adversary trying to solve?
4. What does it avoid?
5. When does it retreat?
6. What does it protect?
7. What will it not do?
8. How does it behave before initiative?
9. How does it behave when exposed?
10. Which mechanics embody restraint, discipline, concealment, observation, or mission-first behaviour?
11. Can the stated doctrine actually survive contact with a combat-optimised party?
12. Which mechanics let it retreat, conceal evidence, preserve secrecy, or refuse a last stand under pressure?

If the existing mechanics do not express doctrine, revise at most a small number of traits/actions and keep them runnable at the table.
Do not give the adversary a doctrine it cannot enact mechanically under pressure.`

  const user = `Original user prompt:
${input.prompt}

Locked constraints:
- Locked faction: ${input.constraints.lockedFaction ?? '(none)'}
- Forbidden factions: ${forbiddenFactions}
- Mechanical base reference: ${mechanicalBase}
- Preferred base: ${input.constraints.preferredBase ?? '(none)'}
- Environment: ${input.constraints.environmentContext ?? '(none)'}

${validationBlock}

Faction doctrine context:
${factionContext}

Relevant existing adversary examples:
${relatedExamples}

Base context:
${baseContext}

Current generated adversary proposal:
${input.proposalText}

${shadowWalkerUrbanGuide ? `${shadowWalkerUrbanGuide}\n\n` : ''}Revise the proposal so it feels faction-specific at the table.
Preserve title, base, and faction.
Return only the revised full proposal document.`

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}
