import type { ProposalType } from '../proposals/proposalTypes.js'
import { getCreativeTreatmentContract } from './treatmentContracts.js'

export interface CreativeTreatmentValidationResult {
  valid: boolean
  missingSections: string[]
  issues: string[]
}

export interface CreativeTreatmentQualityResult {
  valid: boolean
  issues: string[]
}

function hasSection(markdown: string, heading: string): boolean {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|\\n)${escaped}\\s*\\n`, 'i').test(markdown)
}

function extractSectionBlock(markdown: string, heading: string): string {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = markdown.match(new RegExp(`(?:^|\\n)(${escaped}\\s*\\n[\\s\\S]*?)(?=\\n##\\s|$)`, 'i'))
  return match?.[1]?.trim() ?? ''
}

function collectProseBlocks(proposalType: ProposalType, markdown: string): Array<{ heading: string; body: string }> {
  const contract = getCreativeTreatmentContract(proposalType)
  if (!contract) return []

  return contract.editableSections
    .map((heading) => ({ heading, body: extractSectionBlock(markdown, heading) }))
    .filter((block) => block.body.length > 0)
}

const HIGH_CONFIDENCE_CORRUPT_TOKENS = [
  /\bcreatecomponent\b/i,
  /\beasebitfields\b/i,
  /\bbitfields?\b/i,
  /\bvlan\b/i,
]

const LOW_CONFIDENCE_CORRUPT_TOKENS = [
  /\btoggler\b/i,
  /\bkvinn\b/i,
  /\btranslation\b/i,
  /\bsubplot\b/i,
  /\breference\b/i,
]

const UNEXPECTED_SCRIPT_PATTERN = /[\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u0900-\u097F\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/u

function sentenceFragments(value: string): string[] {
  return value
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

export function creativeTreatmentQualityCheck(
  proposalType: ProposalType,
  markdown: string,
): CreativeTreatmentQualityResult {
  const issues: string[] = []
  const proseBlocks = collectProseBlocks(proposalType, markdown)

  for (const block of proseBlocks) {
    const highConfidenceHits = HIGH_CONFIDENCE_CORRUPT_TOKENS.filter((pattern) => pattern.test(block.body))
    for (const pattern of highConfidenceHits) {
      issues.push(`FAIL: creative treatment quality gate: ${block.heading} contains corrupted code-like fragment "${pattern.source.replace(/\\b/g, '')}".`)
    }

    if (UNEXPECTED_SCRIPT_PATTERN.test(block.body)) {
      issues.push(`FAIL: creative treatment quality gate: ${block.heading} contains unexpected non-Latin script in English prose.`)
    }

    for (const sentence of sentenceFragments(block.body)) {
      const lowHits = LOW_CONFIDENCE_CORRUPT_TOKENS.filter((pattern) => pattern.test(sentence))
      const highHits = HIGH_CONFIDENCE_CORRUPT_TOKENS.filter((pattern) => pattern.test(sentence))
      const unexpectedScript = UNEXPECTED_SCRIPT_PATTERN.test(sentence)
      if (highHits.length >= 1 && lowHits.length >= 1) {
        issues.push(`FAIL: creative treatment quality gate: ${block.heading} contains corrupted mixed tokens in sentence "${sentence.slice(0, 120)}".`)
      } else if (lowHits.length >= 2 || (lowHits.length >= 1 && unexpectedScript)) {
        issues.push(`FAIL: creative treatment quality gate: ${block.heading} contains multiple corrupted tokens in sentence "${sentence.slice(0, 120)}".`)
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  }
}

export function validateCreativeTreatment(
  proposalType: ProposalType,
  markdown: string,
): CreativeTreatmentValidationResult {
  const contract = getCreativeTreatmentContract(proposalType)
  if (!contract) {
    return { valid: true, missingSections: [], issues: [] }
  }

  const missingSections = contract.requiredSections.filter((section) => !hasSection(markdown, section))
  const issues = missingSections.map((section) => `FAIL: creative treatment missing required section: ${section}`)
  return {
    valid: missingSections.length === 0,
    missingSections,
    issues,
  }
}
