import type { ProposalSummary } from '../proposalSummaryTypes.js'
import {
  extractSection,
  formatValidationLabel,
  renderPromotionDetails,
  renderValidationDetails,
  titleCaseWords,
} from './markdownHelpers.js'

export function renderChapterProposal(summary: Omit<ProposalSummary, 'humanMarkdown'>, body: string): string {
  const sectionNames = [
    'Chapter Purpose',
    'Starting State',
    'Starting Emotional State',
    'Core Pressure',
    'Repeated Motif',
    'Scene Spine',
    'Midpoint Turn',
    'End Conditions',
    'What This Chapter Changes',
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
