import type { ProposalSummary } from '../proposalSummaryTypes.js'
import {
  extractSection,
  formatValidationLabel,
  quoteMarkdownBlock,
  renderPromotionDetails,
  renderValidationDetails,
  titleCaseWords,
} from './markdownHelpers.js'

function buildUsageBullets(summary: Omit<ProposalSummary, 'humanMarkdown'>, body: string): string[] {
  const bullets: string[] = []
  const designIntent = `${summary.summary} ${extractSection(body, ['Tactics', 'Social / Investigation Use'])}`.toLowerCase()
  const roleLine = summary.highlights.find((line) => line.startsWith('Role: '))
  const pressureLine = summary.highlights.find((line) => line.startsWith('Pressure profile: '))

  if (/urban|town|market|harbour|dock|crowd|city/.test(designIntent)) {
    bullets.push('Use them in markets, harbours, inns, queue lines, or other ordinary public spaces.')
  }
  if (roleLine) {
    bullets.push(`Use them as ${roleLine.replace(/^Role:\s*/i, '').toLowerCase()}.`)
  }
  if (pressureLine) {
    bullets.push(`They function best as ${pressureLine.replace(/^Pressure profile:\s*/i, '').toLowerCase()}.`)
  }
  if (/social-led|social pressure|social threat/.test(designIntent)) {
    bullets.push('Use them as a social threat first, with combat as escalation when cornered.')
  }
  if (/cell|network|shadow walker/.test(designIntent)) {
    bullets.push('They work well alone, in pairs, or as part of a small embedded cell.')
  }

  return [...new Set(bullets)].slice(0, 4)
}

export function renderAdversaryProposal(
  summary: Omit<ProposalSummary, 'humanMarkdown'>,
  body: string,
): string {
  const doctrine = extractSection(body, ['Doctrine'])
  const doctrineUnderPressure = extractSection(body, ['Doctrine Under Pressure'])
  const behaviouralStages = extractSection(body, ['Behavioural Stages'])
  const tacticalNotes = extractSection(body, ['Tactical Notes'])
  const doctrineExpressiveMechanics = extractSection(body, ['Doctrine-Expressive Mechanics'])
  const statBlock = extractSection(body, ['Stat Block'])
  const variantOptions = extractSection(body, ['Variant Options'])
  const playerSafeDescription = extractSection(body, ['Player-Safe Description'])
  const dmOnlyNotes = extractSection(body, ['DM-Only Notes'])
  const usageBullets = buildUsageBullets(summary, body)

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

  if (doctrine) {
    lines.push('')
    lines.push('## Doctrine')
    lines.push('')
    lines.push(doctrine)
  }

  if (doctrineUnderPressure) {
    lines.push('')
    lines.push('## Doctrine Under Pressure')
    lines.push('')
    lines.push(doctrineUnderPressure)
  }

  if (behaviouralStages) {
    lines.push('')
    lines.push('## Behavioural Stages')
    lines.push('')
    lines.push(behaviouralStages)
  }

  if (tacticalNotes) {
    lines.push('')
    lines.push('## Tactical Notes')
    lines.push('')
    lines.push(tacticalNotes)
  }

  if (doctrineExpressiveMechanics) {
    lines.push('')
    lines.push('## Doctrine-Expressive Mechanics')
    lines.push('')
    lines.push(doctrineExpressiveMechanics)
  }

  lines.push('')
  lines.push('## How to Use Them')
  lines.push('')
  lines.push(
    ...(usageBullets.length > 0
      ? usageBullets.map((bullet) => `- ${bullet}`)
      : ['- Review the proposal body for encounter placement and pressure use.']),
  )

  lines.push('')
  lines.push('## Stat Block')
  lines.push('')
  lines.push(statBlock || '_Stat block not extracted._')

  if (variantOptions) {
    lines.push('')
    lines.push('## Variant Options')
    lines.push('')
    lines.push(variantOptions)
  }

  if (playerSafeDescription) {
    lines.push('')
    lines.push('## Player-Safe Description')
    lines.push('')
    lines.push(quoteMarkdownBlock(playerSafeDescription))
  }

  if (dmOnlyNotes) {
    lines.push('')
    lines.push('## DM-Only Notes')
    lines.push('')
    lines.push(dmOnlyNotes)
  }

  lines.push('')
  lines.push(...renderValidationDetails(summary))
  lines.push('')
  lines.push(...renderPromotionDetails(summary))
  return lines.join('\n')
}
