/**
 * Proposal-specific assertion helpers for Layer 3 scenario tests.
 * Extends the retrieval evaluator pattern for full-pipeline proposals.
 */

import type { ScenarioResult } from './proposalRunner.js'

// ── Result assertions ─────────────────────────────────────────────────────────

export function assertValidationPasses(result: ScenarioResult): void {
  if (result.validationStatus === 'fail') {
    const fails = result.validationNotes.filter(i => i.startsWith('FAIL:'))
    throw new Error(`Validation FAILED:\n${fails.map(f => `  ${f}`).join('\n')}`)
  }
}

export function assertValidationStatus(
  result: ScenarioResult,
  expected: 'pass' | 'warning' | 'fail',
): void {
  if (result.validationStatus !== expected) {
    throw new Error(
      `Expected validation ${expected} but got ${result.validationStatus}.\n` +
      `Issues: ${result.validationNotes.slice(0, 5).join('\n')}`,
    )
  }
}

// ── Body content assertions ───────────────────────────────────────────────────

export function assertBodyContains(result: ScenarioResult, pattern: string | RegExp, label: string): void {
  const re = typeof pattern === 'string'
    ? new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    : pattern
  if (!re.test(result.body)) {
    throw new Error(`Body missing expected content — ${label}: ${pattern}`)
  }
}

export function assertBodyNotContains(result: ScenarioResult, pattern: string | RegExp, label: string): void {
  const re = typeof pattern === 'string'
    ? new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    : pattern
  const m = result.body.match(re)
  if (m) {
    throw new Error(`Body contains forbidden content — ${label}: "${m[0]}"`)
  }
}

export function assertBodyContainsAll(result: ScenarioResult, patterns: Array<string | RegExp>, label: string): void {
  const missing: string[] = []
  for (const p of patterns) {
    const re = typeof p === 'string'
      ? new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      : p
    if (!re.test(result.body)) missing.push(String(p))
  }
  if (missing.length > 0) {
    throw new Error(`Body missing expected content (${label}):\n${missing.map(m => `  ${m}`).join('\n')}`)
  }
}

// ── Frontmatter assertions ────────────────────────────────────────────────────

export function assertProposalType(result: ScenarioResult, expected: string): void {
  const actual = result.frontmatter.proposal_type
  if (actual !== expected) {
    throw new Error(`Expected proposal_type "${expected}" but got "${actual}"`)
  }
}

export function assertFrontmatterField(
  result: ScenarioResult,
  field: string,
  expected: unknown,
): void {
  const actual = result.frontmatter[field]
  if (actual !== expected) {
    throw new Error(`frontmatter.${field}: expected "${expected}" but got "${actual}"`)
  }
}

// ── Repair log assertions ─────────────────────────────────────────────────────

export function assertRepairLogPresent(result: ScenarioResult): void {
  if (!result.repairLog) {
    throw new Error('Expected repair_log to be present in frontmatter')
  }
}

export function assertAutoRepairApplied(result: ScenarioResult, ruleFragment: string): void {
  const repairs = result.repairLog?.auto_repairs ?? []
  const found = repairs.some(r =>
    (r.rule ?? '').toLowerCase().includes(ruleFragment.toLowerCase()) ||
    (r.reason ?? '').toLowerCase().includes(ruleFragment.toLowerCase()),
  )
  if (!found) {
    const ruleList = repairs.map(r => r.rule ?? r.reason ?? '(no rule)').join(', ')
    throw new Error(
      `Expected auto-repair containing "${ruleFragment}" but found: [${ruleList}]`,
    )
  }
}

export function assertSectionPruned(result: ScenarioResult, sectionFragment: string): void {
  const pruned = result.repairLog?.pruned_sections ?? []
  const found = pruned.some(s =>
    (s.field ?? '').toLowerCase().includes(sectionFragment.toLowerCase()) ||
    (s.reason ?? '').toLowerCase().includes(sectionFragment.toLowerCase()),
  )
  if (!found) {
    const fields = pruned.map(s => s.field ?? '(no field)').join(', ')
    throw new Error(
      `Expected pruned section containing "${sectionFragment}" but found: [${fields}]`,
    )
  }
}

// ── Validation issue assertions ───────────────────────────────────────────────

export function assertHasIssueMatching(result: ScenarioResult, pattern: string | RegExp, label: string): void {
  const re = typeof pattern === 'string'
    ? new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    : pattern
  if (!result.validationNotes.some(n => re.test(n))) {
    throw new Error(
      `Expected validation issue matching "${pattern}" (${label}).\n` +
      `Actual issues: ${result.validationNotes.slice(0, 8).join('\n')}`,
    )
  }
}

export function assertNoIssueMatching(result: ScenarioResult, pattern: string | RegExp, label: string): void {
  const re = typeof pattern === 'string'
    ? new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    : pattern
  const found = result.validationNotes.find(n => re.test(n))
  if (found) {
    throw new Error(`Unexpected validation issue (${label}): "${found}"`)
  }
}

// ── Prose quality assertions ──────────────────────────────────────────────────

const MODERN_PHRASES = [
  /\bOK\b/, /\bokay\b/i, /\bguy\b/i, /\bawesome\b/i, /\bcool\b/i, /\bstress out\b/i,
  /\bfreaked?\b/i, /\bbummer\b/i, /\bgonna\b/i, /\bwanna\b/i, /\bkinda\b/i, /\bsorta\b/i,
]

const GENERIC_FANTASY_DESCRIPTORS = [
  /\benigmatic\b/i, /\bmystical\b/i, /\bancient.*evil\b/i, /\bforeboding\b/i,
  /\barcane.*secrets?\b/i, /\bdark.*lord\b/i, /\bfabled\b/i,
]

export function assertNoAnachronisticPhrasing(result: ScenarioResult): void {
  const violations: string[] = []
  for (const re of MODERN_PHRASES) {
    const m = result.body.match(re)
    if (m) violations.push(`"${m[0]}"`)
  }
  if (violations.length > 0) {
    throw new Error(`Anachronistic phrasing detected: ${violations.join(', ')}`)
  }
}

export function assertNoGenericFantasyDescriptors(result: ScenarioResult): void {
  const violations: string[] = []
  for (const re of GENERIC_FANTASY_DESCRIPTORS) {
    const m = result.body.match(re)
    if (m) violations.push(`"${m[0]}"`)
  }
  if (violations.length > 0) {
    throw new Error(`Generic fantasy descriptors detected: ${violations.join(', ')}`)
  }
}

export function assertPlayerSafeUnder(result: ScenarioResult, maxWords: number): void {
  const match = result.body.match(/##\s+player_safe\s*\n([\s\S]*?)(?=\n##\s+|\s*$)/i)
  if (!match) {
    throw new Error('No player_safe section found in proposal body')
  }
  const wordCount = match[1].trim().split(/\s+/).length
  if (wordCount > maxWords) {
    throw new Error(`player_safe section is ${wordCount} words — exceeds limit of ${maxWords}`)
  }
}

/**
 * Generate the human evaluation rubric checklist as text output.
 * Not a pass/fail assertion — produces a checklist for the DM to review pre-promotion.
 */
export function printHumanEvalRubric(result: ScenarioResult, proposalTitle: string): void {
  console.info(`\n  ── Human evaluation rubric: ${proposalTitle} ──`)
  console.info(`  Register`)
  console.info(`    [ ] Sounds like Karsac not generic fantasy`)
  console.info(`    [ ] No anachronistic phrasing`)
  console.info(`    [ ] Concrete detail over abstract mood`)
  console.info(`  Performability`)
  console.info(`    [ ] player_safe description under 100 words`)
  console.info(`    [ ] At least one specific image a DM can deliver`)
  console.info(`    [ ] Lines to inhabit are speakable not written`)
  console.info(`    [ ] DM notes answer questions not describe feelings`)
  console.info(`  Negative space`)
  console.info(`    [ ] Nothing over-explained`)
  console.info(`    [ ] Ambiguity preserved where corpus preserves it`)
  console.info(`  Proposal: ${result.proposalPath}\n`)
}
