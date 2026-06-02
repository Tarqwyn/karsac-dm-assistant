import type { ProposalSummary } from '../proposalSummaryTypes.js'

export function extractSection(body: string, headingNames: string[]): string {
  for (const headingName of headingNames) {
    const escaped = headingName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = body.match(new RegExp(`(?:^|\\n)##\\s+${escaped}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, 'i'))
    if (match) return match[1].trim()
  }
  return ''
}

export function firstParagraph(section: string): string {
  return section
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .find((part) => part.length > 0) ?? ''
}

export function cleanInlineMarkdown(value: string): string {
  return value
    .replace(/`/g, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/^\[([A-Z]+)\]\s*/i, '')
    .replace(/\[DM Note:.*?\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function extractBulletLines(section: string): string[] {
  return section
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[-*]|\d+\./.test(line))
    .map((line) => cleanInlineMarkdown(line.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '')))
    .filter(Boolean)
}

export function extractNamedBullets(section: string): string[] {
  return extractBulletLines(section).map((line) => {
    const boldMatch = line.match(/^([^:([.]+?)(?:\s*[:(.-]|$)/)
    return cleanInlineMarkdown(boldMatch?.[1] ?? line)
  })
}

export function extractYamlArrayFromCorpus(section: string, key: string): string[] {
  const codeBlock = section.match(/```ya?ml\s*([\s\S]*?)```/i)?.[1] ?? section
  const lineMatch = codeBlock.match(new RegExp(`\\b${key}:\\s*\\[([^\\]]*)\\]`, 'i'))
  if (!lineMatch) return []
  return lineMatch[1]
    .split(',')
    .map((value) => cleanInlineMarkdown(value))
    .filter(Boolean)
}

export function titleCaseWords(value: string): string {
  return value
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ')
}

export function formatValidationLabel(status: 'pass' | 'warning' | 'fail'): string {
  if (status === 'pass') return 'Pass'
  return 'Needs review'
}

export function formatSourcePromptForDetails(sourcePrompt: string): string {
  const primaryPrompt = sourcePrompt.split('Conversation context for continuity only.')[0]?.trim() ?? sourcePrompt.trim()
  return primaryPrompt.replace(/\s+/g, ' ').trim()
}

export function quoteMarkdownBlock(section: string): string {
  if (!section.trim()) return ''
  if (section.trimStart().startsWith('>')) return section.trim()
  return section
    .trim()
    .split('\n')
    .map((line) => (line.trim().length === 0 ? '>' : `> ${line}`))
    .join('\n')
}

export function renderValidationDetails(summary: Omit<ProposalSummary, 'humanMarkdown'>): string[] {
  const lines = [
    '<details>',
    '<summary>Validation notes</summary>',
    '',
  ]

  if (summary.validationStatus === 'pass') {
    lines.push('- No blocking validation issues.')
    lines.push('- Still provisional; review before promotion.')
  } else {
    for (const issue of summary.validationIssues) {
      lines.push(`- ${issue}`)
    }
    if (summary.validationStatus === 'fail') {
      lines.push('- Do not promote until fixed.')
    }
  }

  lines.push('')
  lines.push('</details>')
  return lines
}

export function renderPromotionDetails(summary: Omit<ProposalSummary, 'humanMarkdown'>): string[] {
  return [
    '<details>',
    '<summary>Promotion details</summary>',
    '',
    `- Proposal path: \`${summary.proposalPath}\``,
    `- Promote target: \`${summary.promoteTarget || '(none)'}\``,
    `- Canonical status: ${summary.canonical}`,
    `- Source prompt: \`${formatSourcePromptForDetails(summary.sourcePrompt)}\``,
    '',
    '</details>',
  ]
}
