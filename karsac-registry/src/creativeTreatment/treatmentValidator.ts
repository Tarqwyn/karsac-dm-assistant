import type { ProposalType } from '../proposals/proposalTypes.js'
import type { ProposalEntityPolicy } from '../proposals/proposalEntityPolicies.js'
import { getCreativeTreatmentContract } from './treatmentContracts.js'
import { policyFilteredSections } from '../proposals/proposalValidator.js'
import {
  getOrgTypeSuffixes,
  getOrgStopWords,
  getTitleTokenAlternation,
} from '../proposals/styleGuardsLoader.js'

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

// Multi-word capitalised phrase pattern — named places, groups, and landmarks
const PROPER_NOUN_PHRASE = /\b([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+)+)\b/g

// Loaded from corpus/registry/style-guards.yaml
// "House" excluded from org suffixes: too many false positives (Safe House, Guard House, etc.)
const ORG_TYPE_SUFFIXES = getOrgTypeSuffixes()

// Built from title_tokens in style-guards.yaml
const TITLE_ALT = getTitleTokenAlternation()
const ARTICLE_TITLE_PATTERN = new RegExp(`^(the|a|an)$`, 'i')
const TITLE_TOKEN_PATTERN = new RegExp(`^(${TITLE_ALT})$`, 'i')
const TITLE_STRIP_PATTERN = new RegExp(`^(${TITLE_ALT})\\s+`, 'i')

function endsWithOrgSuffix(phrase: string): boolean {
  const lastWord = phrase.split(/\s+/).pop() ?? ''
  return ORG_TYPE_SUFFIXES.has(lastWord)
}

const ORG_STOP_WORDS = getOrgStopWords()

/**
 * For an org-suffix phrase, check whether any significant content word
 * (4+ chars, non-stop-word) appears anywhere in the anchor text.
 * Prevents false positives when the snippet window doesn't include the
 * full passage that mentions the canonical group.
 */
function significantWordInAnchor(phrase: string, anchorLower: string): boolean {
  const words = phrase.toLowerCase().split(/\s+/).filter((w) => w.length >= 4 && !ORG_STOP_WORDS.has(w))
  return words.some((w) => anchorLower.includes(w))
}

function isProvisionallyMarked(block: string, phrase: string): boolean {
  // Check if the phrase appears near a Provisional: marker in the same paragraph
  const idx = block.indexOf(phrase)
  if (idx === -1) return false
  const windowStart = Math.max(0, idx - 120)
  const windowEnd = Math.min(block.length, idx + phrase.length + 120)
  const window = block.slice(windowStart, windowEnd)
  return /\bProvisional\b/i.test(window)
}

/**
 * For corpus-anchored entities: check that named proper-noun phrases in ALL
 * generated sections are traceable to the corpus anchor text.
 * Organisation-like names (Guild, Council, Order, etc.) not in the anchor are FAIL.
 * Other multi-word proper nouns not in the anchor are WARN.
 * Phrases marked Provisional near the text are downgraded to WARN.
 */
export interface AnchorContentValidationResult {
  valid: boolean
  issues: string[]
}

function extractAllSections(markdown: string): Array<{ heading: string; block: string }> {
  const headingRegex = /^(##\s+[^\n]+)$/gm
  const matches = [...markdown.matchAll(headingRegex)]
  const results: Array<{ heading: string; block: string }> = []
  for (let i = 0; i < matches.length; i++) {
    const heading = matches[i][1]!.trim()
    const start = (matches[i].index ?? 0) + matches[i][0].length
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? markdown.length) : markdown.length
    const block = markdown.slice(start, end).trim()
    results.push({ heading, block })
  }
  return results
}

export function validateAnchorBoundedContent(
  proposalType: ProposalType,
  markdown: string,
  corpusAnchor: string,
): AnchorContentValidationResult {
  const anchorLower = corpusAnchor.toLowerCase()
  const issues: string[] = []

  for (const { heading, block } of extractAllSections(markdown)) {
    if (!block) continue
    // Skip sections that are self-labelled Provisional — the content is already acknowledged
    const isSelfLabelledProvisional = /^##\s+Provisional\b/i.test(heading) || /^\s*Provisional\s*:/i.test(block)
    if (isSelfLabelledProvisional) continue

    for (const match of block.matchAll(PROPER_NOUN_PHRASE)) {
      const phrase = match[1]!
      if (phrase.length < 5) continue
      if (anchorLower.includes(phrase.toLowerCase())) continue
      // Skip generic article+title phrases: "The King", "A Jarl" — not invented names
      const phraseWords = phrase.split(/\s+/)
      if (phraseWords.length === 2 && ARTICLE_TITLE_PATTERN.test(phraseWords[0]!) &&
          TITLE_TOKEN_PATTERN.test(phraseWords[1]!)) continue
      // Strip leading title token and re-check (e.g. "Jarl Mathr" → "Mathr" in anchor)
      const titleStripped = phrase.replace(TITLE_STRIP_PATTERN, '')
      if (titleStripped !== phrase && anchorLower.includes(titleStripped.toLowerCase())) continue
      // Strip possessive and re-check (e.g. "Jarl Mathr's" → "Jarl Mathr")
      const depossessed = phrase.replace(/[''']s$/u, '')
      if (depossessed !== phrase && anchorLower.includes(depossessed.toLowerCase())) continue
      const depossessedStripped = titleStripped.replace(/[''']s$/u, '')
      if (depossessedStripped !== titleStripped && anchorLower.includes(depossessedStripped.toLowerCase())) continue

      const isOrg = endsWithOrgSuffix(phrase)
      const isProvisional = isProvisionallyMarked(block, phrase)

      if (isOrg) {
        // Word-level match: significant word of org phrase found in anchor → known group, skip
        if (significantWordInAnchor(phrase, anchorLower)) continue
        if (isProvisional) {
          issues.push(`WARN: Provisional organisation in ${heading}: "${phrase}" is not corpus-supported — review before promotion.`)
        } else {
          issues.push(`FAIL: Unsupported invented entity in ${heading}: "${phrase}" is not in the corpus anchor text and appears to be an invented organisation.`)
        }
      } else if (!isProvisional) {
        issues.push(`WARN: Anchor content check: "${phrase}" in ${heading} has no support in the corpus anchor text — may be invented.`)
      }
    }
  }

  return { valid: !issues.some((i) => i.startsWith('FAIL:')), issues }
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
  entityPolicy?: ProposalEntityPolicy | null,
): CreativeTreatmentValidationResult {
  const contract = getCreativeTreatmentContract(proposalType)
  if (!contract) {
    return { valid: true, missingSections: [], issues: [] }
  }

  // Subtract forbidden/out-of-scope sections from required sections per entity policy.
  // A section pruned by policy is not required — the validator must not fail on its absence.
  const effectiveRequired = entityPolicy
    ? policyFilteredSections(contract.requiredSections, entityPolicy)
    : contract.requiredSections

  const missingSections = effectiveRequired.filter((section) => !hasSection(markdown, section))
  const issues = missingSections.map((section) => `FAIL: creative treatment missing required section: ${section}`)
  return {
    valid: missingSections.length === 0,
    missingSections,
    issues,
  }
}
