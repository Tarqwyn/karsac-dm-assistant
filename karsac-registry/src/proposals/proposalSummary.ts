import { existsSync, readFileSync } from 'fs'
import { isAbsolute, relative, resolve } from 'path'
import matter from 'gray-matter'
import { PROJECT_ROOT } from '../paths.js'
import { callSummaryPolishModel } from '../creativeTreatment/creativeModel.js'
import type { ProposalSummary } from './proposalSummaryTypes.js'
import type { ProposalFrontmatter } from './proposalTypes.js'
import {
  cleanInlineMarkdown,
  extractBulletLines,
  extractNamedBullets,
  extractSection,
  extractYamlArrayFromCorpus,
  firstParagraph,
  formatValidationLabel,
  renderPromotionDetails,
  renderValidationDetails,
  titleCaseWords,
} from './renderers/markdownHelpers.js'
import { renderAdversaryProposal } from './renderers/renderAdversaryProposal.js'
import { renderChapterProposal } from './renderers/renderChapterProposal.js'
import { renderEncounterProposal } from './renderers/renderEncounterProposal.js'
import { renderNpcProposal } from './renderers/renderNpcProposal.js'
import { renderPlaceProposal } from './renderers/renderPlaceProposal.js'

const ASSISTANT_ROOT = resolve(PROJECT_ROOT, '..')

export function resolveProposalPathInput(proposalPath: string): string {
  if (isAbsolute(proposalPath)) return proposalPath

  const candidates = [
    process.env.INIT_CWD ? resolve(process.env.INIT_CWD, proposalPath) : null,
    resolve(ASSISTANT_ROOT, proposalPath),
    resolve(PROJECT_ROOT, proposalPath),
  ].filter((value): value is string => value !== null)

  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]
}

function toProjectRelativePath(proposalPath: string): string {
  const absolute = resolveProposalPathInput(proposalPath)
  const rel = relative(ASSISTANT_ROOT, absolute)
  return rel.startsWith('..') ? absolute : rel
}

function extractMechanicalBase(section: string, corpusSection: string): string | null {
  const baseLine = section.match(/\bBase:\s*([^\n]+)/i)?.[1]?.trim()
  if (baseLine) {
    const display = baseLine.split(/\s+[—-]\s+/).pop()?.trim() ?? baseLine
    return cleanInlineMarkdown(display)
  }

  const bases = extractYamlArrayFromCorpus(corpusSection, 'mechanical_base')
  if (bases.length === 0) return null
  const lastSegment = bases[0].split('/').pop() ?? bases[0]
  return cleanInlineMarkdown(lastSegment.replace(/-/g, ' '))
}

function detectAdversaryEmphasis(designIntent: string): string | null {
  const lower = designIntent.toLowerCase()
  if (lower.includes('social-led') && lower.includes('combat')) return 'social-led with combat escalation'
  if (lower.includes('social-led')) return 'social-led'
  if (lower.includes('combat-led')) return 'combat-led'
  if (lower.includes('social')) return 'social pressure'
  if (lower.includes('combat')) return 'combat pressure'
  return null
}

function extractPopulation(body: string): string | null {
  const established = extractSection(body, ['Established Proposal Facts'])
  const establishedMatch = established.match(/(?:^|\n)\s*[*-]?\s*Population:\s*([^\n]+)/i)
  if (establishedMatch) return cleanInlineMarkdown(establishedMatch[1])
  const bodyMatch = body.match(/(?:^|\n)\s*[*-]?\s*Population:\s*([^\n]+)/i)
  if (bodyMatch) return cleanInlineMarkdown(bodyMatch[1])
  const overview = extractSection(body, ['Overview'])
  const overviewMatch = overview.match(/\bpopulation\s+(?:is\s+)?(?:approximately|about)?\s*([0-9,]+)/i)
  return overviewMatch ? overviewMatch[1] : null
}

function extractLocation(body: string): string | null {
  const established = extractSection(body, ['Established Proposal Facts'])
  const establishedMatch = established.match(/(?:^|\n)\s*[*-]?\s*Location:\s*([^\n]+)/i)
  if (establishedMatch) return cleanInlineMarkdown(establishedMatch[1])
  const overview = firstParagraph(extractSection(body, ['Overview']))
  return overview || null
}

function fallbackFactionFromPrompt(sourcePrompt: string): string | null {
  const match =
    sourcePrompt.match(/\bpart\s+of\s+(?:the\s+)?([a-z][a-z\s-]+?)\s+faction\b/i) ??
    sourcePrompt.match(/\b(?:serves?|belongs?\s+to|linked\s+to|works?\s+for)\s+(?:the\s+)?([a-z][a-z\s-]+?)\b/i)

  if (!match?.[1]) return null
  return cleanInlineMarkdown(match[1]).toLowerCase().replace(/\s+/g, '-')
}

function buildNextActions(validationStatus: 'pass' | 'warning' | 'fail'): string[] {
  const actions = [
    'Review or edit the proposal.',
    'Promote only when happy.',
    'Do not treat as canon until promoted or played.',
  ]
  if (validationStatus === 'fail') {
    actions.unshift('Fix validation issues before promotion.')
  } else if (validationStatus === 'warning') {
    actions.unshift('Review validation warnings before promotion.')
  }
  return actions
}

function buildSummaryPolishMessages(input: {
  proposalType: string
  draftMarkdown: string
  proposalBody: string
}): Array<{ role: string; content: string }> {
  return [
    {
      role: 'system',
      content: `You are the prose-polish model for Karsac proposal previews.

You may improve wording, flow, emphasis, and readability.
You must not add new canon, new sections, or new factual claims not already present in the supplied summary draft or proposal body.
Preserve the markdown structure, headings, path details, validation details, and provisional status.
Return only the polished markdown.`,
    },
    {
      role: 'user',
      content: `Proposal type: ${input.proposalType}

Proposal body:
${input.proposalBody}

Summary draft:
${input.draftMarkdown}

Polish the summary wording only. Do not add facts.`,
    },
  ]
}

function summariseAdversary(frontmatter: ProposalFrontmatter, body: string): { summary: string; highlights: string[] } {
  const designIntent = firstParagraph(extractSection(body, ['Design Intent']))
  const mechanicalBase = extractMechanicalBase(
    extractSection(body, ['Mechanical Base']),
    extractSection(body, ['Corpus Frontmatter']),
  )
  const corpusSection = extractSection(body, ['Corpus Frontmatter'])
  const factions = extractYamlArrayFromCorpus(corpusSection, 'factions')
  const encounterRoles = extractYamlArrayFromCorpus(corpusSection, 'encounter_roles')
  const oppositionType = extractYamlArrayFromCorpus(corpusSection, 'opposition_type')
  const variantSection = extractSection(body, ['Variant Options'])
  const variantHighlights = variantSection
    ? variantSection
      .split('\n')
      .map((line) => cleanInlineMarkdown(line))
      .filter((line) => /^Choose \d+/i.test(line))
      .slice(0, 3)
    : []
  const emphasis = detectAdversaryEmphasis(designIntent)

  const highlights = [
    ...((factions[0] || fallbackFactionFromPrompt(frontmatter.source_prompt))
      ? [`Faction: ${factions[0] ?? fallbackFactionFromPrompt(frontmatter.source_prompt)}`]
      : []),
    ...(mechanicalBase ? [`Mechanical base: ${mechanicalBase}`] : []),
    ...(encounterRoles.length > 0 ? [`Role: ${encounterRoles.slice(0, 3).join(', ')}`] : []),
    ...(oppositionType.length > 0 ? [`Pressure profile: ${oppositionType.slice(0, 3).join(', ')}`] : []),
    ...(emphasis ? [`Emphasis: ${emphasis}`] : []),
    ...(variantHighlights.length > 0 ? [`Modular options: ${variantHighlights.join('; ')}`] : []),
  ]

  return {
    summary: designIntent || `A provisional ${frontmatter.proposal_type} proposal for ${frontmatter.title}.`,
    highlights,
  }
}

function summarisePlace(frontmatter: ProposalFrontmatter, body: string): { summary: string; highlights: string[] } {
  const overview = firstParagraph(extractSection(body, ['Overview']))
  const location = extractLocation(body)
  const population = extractPopulation(body)
  const districts = extractNamedBullets(extractSection(body, ['Key Districts'])).slice(0, 3)
  const landmarks = extractNamedBullets(extractSection(body, ['Notable Landmarks'])).slice(0, 3)
  const factions = extractNamedBullets(extractSection(body, ['Factions and Power Structures', 'Factions'])).slice(0, 3)
  const chapterUses = extractNamedBullets(extractSection(body, ['Chapter 3 Uses', 'Chapter Uses'])).slice(0, 3)
  const culturalIdentity = firstParagraph(extractSection(body, ['Cultural Identity']))
  const localContradiction = firstParagraph(extractSection(body, ['Local Contradiction']))
  const outsiderMisunderstanding = firstParagraph(extractSection(body, ['What Outsiders Misunderstand']))

  const highlights = [
    ...(location ? [`Location: ${location}`] : []),
    ...(population ? [`Population: ${population}`] : []),
    ...(districts.length > 0 ? [`Key districts: ${districts.join(', ')}`] : []),
    ...(landmarks.length > 0 ? [`Notable landmarks: ${landmarks.join(', ')}`] : []),
    ...(factions.length > 0 ? [`Factions: ${factions.join(', ')}`] : []),
    ...(culturalIdentity ? [`Cultural identity: ${culturalIdentity}`] : []),
    ...(localContradiction ? [`Local contradiction: ${localContradiction}`] : []),
    ...(outsiderMisunderstanding ? [`Outsiders misunderstand: ${outsiderMisunderstanding}`] : []),
    ...(chapterUses.length > 0 ? [`Chapter uses: ${chapterUses.join(', ')}`] : []),
  ]

  return {
    summary: overview || `A provisional ${frontmatter.proposal_type} proposal for ${frontmatter.title}.`,
    highlights,
  }
}

function summariseEncounter(frontmatter: ProposalFrontmatter, body: string): { summary: string; highlights: string[] } {
  const encounterType = firstParagraph(extractSection(body, ['Encounter Type']))
  const purpose = firstParagraph(extractSection(body, ['Campaign Purpose']))
  const cast = extractNamedBullets(extractSection(body, ['Cast'])).slice(0, 4)
  const pressure = extractBulletLines(extractSection(body, ['Pressure Ladder'])).slice(0, 3)
  const outcomes = extractBulletLines(extractSection(body, ['Outcomes'])).slice(0, 3)
  const stateUpdates = extractBulletLines(extractSection(body, ['Suggested State Updates After Play'])).slice(0, 2)
  const storyBeat = firstParagraph(extractSection(body, ['Story Beat']))
  const playerChoice = firstParagraph(extractSection(body, ['Player Choice']))
  const complication = firstParagraph(extractSection(body, ['Complication']))
  const failForwardPath = firstParagraph(extractSection(body, ['Fail-Forward Path']))

  const highlights = [
    ...(encounterType ? [`Encounter type: ${encounterType}`] : []),
    ...(purpose ? [`Campaign purpose: ${purpose}`] : []),
    ...(cast.length > 0 ? [`Cast: ${cast.join(', ')}`] : []),
    ...(storyBeat ? [`Story beat: ${storyBeat}`] : []),
    ...(pressure.length > 0 ? [`Pressure ladder: ${pressure.join(' / ')}`] : []),
    ...(playerChoice ? [`Player choice: ${playerChoice}`] : []),
    ...(complication ? [`Complication: ${complication}`] : []),
    ...(outcomes.length > 0 ? [`Outcomes: ${outcomes.join(' / ')}`] : []),
    ...(failForwardPath ? [`Fail-forward path: ${failForwardPath}`] : []),
    ...(stateUpdates.length > 0 ? [`State updates if played: ${stateUpdates.join(' / ')}`] : []),
  ]

  return {
    summary: purpose || encounterType || `A provisional ${frontmatter.proposal_type} proposal for ${frontmatter.title}.`,
    highlights,
  }
}

function summariseNpc(frontmatter: ProposalFrontmatter, body: string): { summary: string; highlights: string[] } {
  const role = firstParagraph(extractSection(body, ['Role']))
  const physicalBearing = firstParagraph(extractSection(body, ['Physical Bearing']))
  const wants = firstParagraph(extractSection(body, ['What They Want']))
  const hides = firstParagraph(extractSection(body, ['What They Hide']))
  const canKnow = extractBulletLines(extractSection(body, ['can_know'])).slice(0, 2)
  const mustNotKnow = extractBulletLines(extractSection(body, ['must_not_know'])).slice(0, 2)
  const dramaticUtility = firstParagraph(extractSection(body, ['Dramatic Utility']))
  const playerSafe = firstParagraph(extractSection(body, ['player_safe']))
  const dmOnly = firstParagraph(extractSection(body, ['dm_only']))

  const highlights = [
    ...(role ? [`Role: ${role}`] : []),
    ...(physicalBearing ? [`Physical bearing: ${physicalBearing}`] : []),
    ...(wants ? [`What they want: ${wants}`] : []),
    ...(hides ? [`What they hide: ${hides}`] : []),
    ...(canKnow.length > 0 ? [`can_know: ${canKnow.join(' / ')}`] : []),
    ...(mustNotKnow.length > 0 ? [`must_not_know: ${mustNotKnow.join(' / ')}`] : []),
    ...(dramaticUtility ? [`Dramatic utility: ${dramaticUtility}`] : []),
    ...(playerSafe ? [`player_safe: ${playerSafe}`] : []),
    ...(dmOnly ? [`dm_only: ${dmOnly}`] : []),
  ]

  return {
    summary: role || physicalBearing || `A provisional ${frontmatter.proposal_type} proposal for ${frontmatter.title}.`,
    highlights,
  }
}

function summariseChapter(frontmatter: ProposalFrontmatter, body: string): { summary: string; highlights: string[] } {
  const purpose = firstParagraph(extractSection(body, ['Chapter Purpose']))
  const startingState = firstParagraph(extractSection(body, ['Starting State']))
  const corePressure = firstParagraph(extractSection(body, ['Core Pressure']))
  const sceneSpine = extractBulletLines(extractSection(body, ['Scene Spine'])).slice(0, 3)
  const endConditions = extractBulletLines(extractSection(body, ['End Conditions'])).slice(0, 3)
  const emotionalState = firstParagraph(extractSection(body, ['Starting Emotional State']))
  const midpointTurn = firstParagraph(extractSection(body, ['Midpoint Turn']))
  const chapterChange = firstParagraph(extractSection(body, ['What This Chapter Changes']))

  const highlights = [
    ...(purpose ? [`Chapter purpose: ${purpose}`] : []),
    ...(startingState ? [`Starting state: ${startingState}`] : []),
    ...(emotionalState ? [`Starting emotional state: ${emotionalState}`] : []),
    ...(corePressure ? [`Core pressure: ${corePressure}`] : []),
    ...(sceneSpine.length > 0 ? [`Scene spine: ${sceneSpine.join(' / ')}`] : []),
    ...(midpointTurn ? [`Midpoint turn: ${midpointTurn}`] : []),
    ...(chapterChange ? [`What this chapter changes: ${chapterChange}`] : []),
    ...(endConditions.length > 0 ? [`End conditions: ${endConditions.join(' / ')}`] : []),
  ]

  return {
    summary: purpose || `A provisional ${frontmatter.proposal_type} proposal for ${frontmatter.title}.`,
    highlights,
  }
}

function summariseGeneric(frontmatter: ProposalFrontmatter, body: string): { summary: string; highlights: string[] } {
  const firstBodyParagraph = firstParagraph(body)
  return {
    summary: firstBodyParagraph || frontmatter.summary || `A provisional ${frontmatter.proposal_type} proposal for ${frontmatter.title}.`,
    highlights: [],
  }
}

function rendererNameForProposalType(proposalType: string): string {
  switch (proposalType) {
    case 'adversary':
      return 'adversary'
    case 'place':
      return 'place'
    case 'encounter':
      return 'encounter'
    case 'npc':
      return 'npc'
    case 'chapter-outline':
      return 'chapter'
    default:
      return 'generic'
  }
}

function getRenderableSections(proposalType: string): string[] {
  switch (proposalType) {
    case 'adversary':
      return [
        'DM Preview',
        'Doctrine',
        'Doctrine Under Pressure',
        'Behavioural Stages',
        'Tactical Notes',
        'Doctrine-Expressive Mechanics',
        'How to Use Them',
        'Stat Block',
        'Variant Options',
        'Player-Safe Description',
        'DM-Only Notes',
      ]
    case 'place':
      return [
        'Overview',
        'Cultural Identity',
        'Daily Life',
        'Power Structures',
        'Local Contradiction',
        'What Outsiders Misunderstand',
        'What This Place Hides',
        'Player-Safe Arrival Description',
        'Key Districts',
        'Notable Landmarks',
        'Factions and Power Structures',
        'Chapter 3 Uses',
        'Chapter Uses',
      ]
    case 'encounter':
      return [
        'Encounter Type',
        'Campaign Purpose',
        'Story Beat',
        'Pressure',
        'Player Choice',
        'Complication',
        'Consequence',
        'Fail-Forward Path',
        'Cast',
        'Pressure Ladder',
        'Checks and Mechanics',
        'Outcomes',
      ]
    case 'npc':
      return [
        'Role',
        'Physical Bearing',
        'What They Want',
        'What They Hide',
        'can_know',
        'must_not_know',
        'Lines to Inhabit',
        'Dramatic Utility',
        'player_safe',
        'dm_only',
      ]
    case 'chapter-outline':
      return [
        'Chapter Purpose',
        'Starting State',
        'Starting Emotional State',
        'Core Pressure',
        'Repeated Motif',
        'Scene Spine',
        'Midpoint Turn',
        'End Conditions',
        'What This Chapter Changes',
      ]
    default:
      return []
  }
}

function getSectionsFound(proposalType: string, body: string): string[] {
  const sectionsFound = getRenderableSections(proposalType)
    .filter((sectionName) => {
      if (sectionName === 'DM Preview' || sectionName === 'How to Use Them') return true
      return extractSection(body, [sectionName]).trim().length > 0
    })

  return [...new Set(sectionsFound)]
}

function renderProposalBodyFallback(
  summary: Omit<ProposalSummary, 'humanMarkdown'>,
  body: string,
): string {
  const lines = [
    `# Proposal: ${summary.title}`,
    '',
    `> **Status:** ${titleCaseWords(summary.status)}  `,
    `> **Type:** ${titleCaseWords(summary.proposalType)}  `,
    `> **Validation:** ${formatValidationLabel(summary.validationStatus)}  `,
    `> **Path:** \`${summary.proposalPath}\`  `,
    `> **Promote target:** \`${summary.promoteTarget || '(none)'}\``,
    '',
    '## Proposal Body',
    '',
    body.trim(),
    '',
    ...renderValidationDetails(summary),
    '',
    ...renderPromotionDetails(summary),
  ]

  return lines.join('\n')
}

function isAcceptableRichSummary(
  proposalType: string,
  humanMarkdown: string,
): boolean {
  if (!humanMarkdown.trim().startsWith('# Proposal:')) return false

  if (proposalType === 'adversary') {
    const requiredFragments = [
      '## DM Preview',
      '## Doctrine',
      '## Stat Block',
      '<summary>Validation notes</summary>',
      '<summary>Promotion details</summary>',
    ]
    return humanMarkdown.length >= 1000 && requiredFragments.every((fragment) => humanMarkdown.includes(fragment))
  }

  if (proposalType === 'npc') {
    const requiredFragments = [
      '## DM Preview',
      '## Name',
      '## Role',
      '## What They Want',
      '## What They Hide',
      '## Lines to Inhabit',
      '<summary>Validation notes</summary>',
      '<summary>Promotion details</summary>',
    ]
    return humanMarkdown.length >= 500 && requiredFragments.every((fragment) => humanMarkdown.includes(fragment))
  }

  return humanMarkdown.length >= 200
}

function renderHumanMarkdown(summary: Omit<ProposalSummary, 'humanMarkdown'>, body: string): string {
  switch (summary.proposalType) {
    case 'adversary':
      return renderAdversaryProposal(summary, body)
    case 'place':
      return renderPlaceProposal(summary, body)
    case 'encounter':
      return renderEncounterProposal(summary, body)
    case 'npc':
      return renderNpcProposal(summary, body)
    case 'chapter-outline':
      return renderChapterProposal(summary, body)
    default:
      return renderChapterProposal(summary, body)
  }
}

export async function summariseProposal(input: {
  proposalPath: string
  mode?: 'rich' | 'compact'
  includeValidationDetails?: 'collapsible' | 'inline'
  includeBodyHighlights?: boolean
  creativePolish?: boolean
}): Promise<ProposalSummary> {
  const proposalPath = toProjectRelativePath(input.proposalPath)
  const absolutePath = resolveProposalPathInput(input.proposalPath)
  const raw = readFileSync(absolutePath, { encoding: 'utf-8' })
  const parsed = matter(raw)
  const frontmatter = parsed.data as ProposalFrontmatter
  const body = parsed.content

  const typeSpecific = frontmatter.proposal_type === 'adversary'
    ? summariseAdversary(frontmatter, body)
    : frontmatter.proposal_type === 'place'
      ? summarisePlace(frontmatter, body)
      : frontmatter.proposal_type === 'encounter'
        ? summariseEncounter(frontmatter, body)
        : frontmatter.proposal_type === 'npc'
          ? summariseNpc(frontmatter, body)
        : frontmatter.proposal_type === 'chapter-outline'
          ? summariseChapter(frontmatter, body)
          : summariseGeneric(frontmatter, body)

  const baseSummary: Omit<ProposalSummary, 'humanMarkdown'> = {
    title: frontmatter.title,
    proposalType: frontmatter.proposal_type,
    status: frontmatter.status,
    canonical: frontmatter.canonical,
    validationStatus: frontmatter.validation?.status ?? 'warning',
    validationIssues: frontmatter.validation?.issues ?? [],
    sourcePrompt: frontmatter.source_prompt,
    routeProfile: frontmatter.route_profile,
    promoteTarget: frontmatter.promote_target,
    proposalPath,
    summary: typeSpecific.summary,
    highlights: input.includeBodyHighlights === false ? [] : typeSpecific.highlights,
    nextActions: buildNextActions(frontmatter.validation?.status ?? 'warning'),
  }

  const summaryMode = input.mode ?? 'rich'
  const renderer = rendererNameForProposalType(frontmatter.proposal_type)
  const sectionsFound = getSectionsFound(frontmatter.proposal_type, body)
  const humanMarkdownDraft = summaryMode === 'rich'
    ? renderHumanMarkdown(baseSummary, body)
    : baseSummary.summary
  let humanMarkdown = humanMarkdownDraft
  let usedFallback = false

  if (summaryMode === 'rich' && input.creativePolish) {
    try {
      const { text } = await callSummaryPolishModel(
        buildSummaryPolishMessages({
          proposalType: frontmatter.proposal_type,
          draftMarkdown: humanMarkdownDraft,
          proposalBody: body,
        }),
      )
      if (text.trim().length > 0 && isAcceptableRichSummary(frontmatter.proposal_type, text.trim())) {
        humanMarkdown = text.trim()
      } else {
        humanMarkdown = humanMarkdownDraft
      }
    } catch {
      humanMarkdown = humanMarkdownDraft
    }
  }

  if (summaryMode === 'rich' && !isAcceptableRichSummary(frontmatter.proposal_type, humanMarkdown)) {
    humanMarkdown = renderProposalBodyFallback(baseSummary, body)
    usedFallback = true
  }

  return {
    ...baseSummary,
    humanMarkdown,
    summaryMode,
    renderer,
    sectionsFound,
    usedFallback,
  }
}
