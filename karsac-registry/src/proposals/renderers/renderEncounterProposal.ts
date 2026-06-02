import type { ProposalSummary } from '../proposalSummaryTypes.js'
import {
  extractSection,
  formatValidationLabel,
  renderPromotionDetails,
  renderValidationDetails,
  titleCaseWords,
} from './markdownHelpers.js'

export function renderEncounterProposal(summary: Omit<ProposalSummary, 'humanMarkdown'>, body: string): string {
  const sectionNames = [
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
    'Suggested State Updates After Play',
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
