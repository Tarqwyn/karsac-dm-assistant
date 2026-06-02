import type { ProposalSummary } from '../proposalSummaryTypes.js'
import {
  extractSection,
  formatValidationLabel,
  renderPromotionDetails,
  renderValidationDetails,
  titleCaseWords,
} from './markdownHelpers.js'

export function renderNpcProposal(summary: Omit<ProposalSummary, 'humanMarkdown'>, body: string): string {
  const sectionNames = [
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
    '',
    '## Name',
    '',
    summary.title,
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
