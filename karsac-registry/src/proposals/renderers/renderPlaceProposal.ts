import type { ProposalSummary } from '../proposalSummaryTypes.js'
import {
  extractSection,
  formatValidationLabel,
  renderPromotionDetails,
  renderValidationDetails,
  titleCaseWords,
} from './markdownHelpers.js'

export function renderPlaceProposal(summary: Omit<ProposalSummary, 'humanMarkdown'>, body: string): string {
  const sectionNames = [
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

  const lines = [
    `# Proposal: ${summary.title}`,
    '',
    `> **Status:** ${titleCaseWords(summary.status)}  `,
    `> **Type:** ${titleCaseWords(summary.proposalType)}  `,
    `> **Validation:** ${formatValidationLabel(summary.validationStatus)}  `,
    `> **Path:** \`${summary.proposalPath}\`  `,
    `> **Promote target:** \`${summary.promoteTarget || '(none)'}\``,
    '',
    '## DM Preview',
    '',
    summary.summary,
  ]

  for (const sectionName of sectionNames) {
    const content = extractSection(body, [sectionName])
    if (!content) continue
    lines.push('')
    lines.push(`## ${sectionName}`)
    lines.push('')
    lines.push(content)
  }

  lines.push('')
  lines.push(...renderValidationDetails(summary))
  lines.push('')
  lines.push(...renderPromotionDetails(summary))
  return lines.join('\n')
}
