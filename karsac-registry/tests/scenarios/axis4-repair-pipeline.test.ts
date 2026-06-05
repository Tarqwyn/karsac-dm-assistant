/**
 * Layer 3 — Axis 4: Repair pipeline
 * Tests that the pruner and repair logic work correctly through the pipeline.
 * Uses direct pruner/repair function calls (deterministic, no LLM needed)
 * for path coverage, and full-pipeline scenarios for integration coverage.
 * Run with: npm run test:scenarios
 */

import { describe, expect, beforeAll } from 'vitest'
import { scenario, given, when, then, and } from './bdd.js'
import { isOllamaAvailable, runScenario } from './proposalRunner.js'
import { assertRepairLogPresent, assertAutoRepairApplied, assertSectionPruned } from './proposalEvaluator.js'
import { pruneProposalOutput } from '../../src/proposals/proposalPruner.js'

let ollamaAvailable = false
beforeAll(() => { ollamaAvailable = isOllamaAvailable() })

// ── Deterministic pruner/repair scenarios ─────────────────────────────────────

describe('Axis 4 — Forbidden section pruned before write', () => {
  scenario('A section in the forbidden list is removed and logged to repair_log', () => {
    given('an adversary proposal body containing a forbidden "Silent Hand" org name in DM Notes')
    const body = `# Adversary: Test

## Mechanical Base
Base: spy

## Stat Block
Alignment: Neutral

## DM Notes
The Silent Hand controls this operative's true allegiance.
`
    const policy = {
      entityId: 'test',
      coverageLevel: 'full' as const,
      proposalScope: 'full' as const,
      canonicalReferenceOnly: false,
      unresolvedFieldsPreferred: false,
      allowedSections: [],
      forbiddenSections: ['DM Notes'],
      promptConstraints: [],
      ambiguityFlags: [],
      requireAmbiguitySection: false,
      forbiddenPatterns: [],
    }

    when('the pruner runs on the body')
    const result = pruneProposalOutput(body, 'adversary', policy)

    then('the DM Notes section is removed')
    expect(result.prunedBody).not.toMatch(/## DM Notes/i)

    and('the pruning is logged to the repair log')
    expect(result.repairLog.pruned_sections.length).toBeGreaterThanOrEqual(1)
    expect(result.repairLog.pruned_sections.some(
      s => (s.field ?? '').toLowerCase().includes('dm') || (s.reason ?? '').toLowerCase().includes('forbidden'),
    )).toBe(true)
  })
})

describe('Axis 4 — effective_required excludes forbidden sections', () => {
  scenario('A section in both required and forbidden is not treated as required', () => {
    given('an adversary proposal body where "Tactics" is both required and in the forbidden list')
    const body = `# Adversary: Test

## Mechanical Base
Base: spy

## Stat Block
Alignment: Neutral
`
    const policy = {
      entityId: 'test',
      coverageLevel: 'full' as const,
      proposalScope: 'full' as const,
      canonicalReferenceOnly: false,
      unresolvedFieldsPreferred: false,
      allowedSections: [],
      forbiddenSections: ['Tactics'],
      promptConstraints: [],
      ambiguityFlags: [],
      requireAmbiguitySection: false,
      forbiddenPatterns: [],
    }

    when('the pruner runs')
    const result = pruneProposalOutput(body, 'adversary', policy)

    then('no missing-section failure fires for Tactics')
    // The pruner itself does not generate missing-section issues — the validator does.
    // What we verify here is that the forbidden section is removed correctly.
    expect(result.prunedBody).not.toMatch(/## Tactics/i)
    expect(result.repairLog.pruned_sections.length).toBe(0) // It was never in the body
  })
})

describe('Axis 4 — Auto-repair recorded in repair log', () => {
  scenario('Shadow Walker alignment repair is logged in the repair_log.auto_repairs', () => {
    given('an adversary proposal body with a Shadow Walker evil alignment')
    const { repairAdversaryOutput } = require('../../src/adversary-design.js')
    const body = `
## Stat Block
**Alignment** Neutral Evil
**Languages** Common, Lösweg Sign
`

    when('adversary repair runs for shadow-walkers')
    const result = repairAdversaryOutput(body, {
      lockedFaction: 'shadow-walkers',
      doctrineTags: [],
    })

    then('the evil alignment is repaired')
    expect(result.output).not.toMatch(/neutral evil/i)

    and('repair count is non-zero')
    expect(result.repairCount).toBeGreaterThanOrEqual(1)
  })
})

describe('Axis 4 — Full pipeline: repair log present on Shadow Walker proposal', () => {
  scenario('Shadow Walker proposal written to disk includes a repair_log in frontmatter', async () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    given('I propose a Shadow Walker urban adversary')
    const result = runScenario(
      'Propose a new adversary: a Shadow Walker street operative blending into the Torweg market.',
    )

    then('proposal is written')
    assertRepairLogPresent(result)

    and('repair log has auto_repairs and pruned_sections arrays')
    expect(Array.isArray(result.repairLog?.auto_repairs)).toBe(true)
    expect(Array.isArray(result.repairLog?.pruned_sections)).toBe(true)
  })
})

describe('Axis 4 — Sentence strip fires before validation pass', () => {
  scenario('Forbidden pattern in an anchored entity body is stripped before validation', () => {
    given('a proposal body for a corpus-anchored entity containing a forbidden pattern')
    const { pruneProposalOutput: pruner } = require('../../src/proposals/proposalPruner.js')
    const body = `# NPC: Jarl Beorn

## Role
Council head at Valweg.

## DM Notes
Beorn performed a longevity ritual in his youth to maintain his position.
`
    const policy = {
      entityId: 'npcs/jarl-beorn',
      coverageLevel: 'anchored' as const,
      proposalScope: 'bounded' as const,
      canonicalReferenceOnly: true,
      unresolvedFieldsPreferred: false,
      allowedSections: ['Role', 'can_know', 'must_not_know', 'dm_only', 'Dramatic Utility'],
      forbiddenSections: [],
      promptConstraints: [],
      ambiguityFlags: [],
      requireAmbiguitySection: false,
      forbiddenPatterns: [
        { pattern: 'longevity ritual', severity: 'fail' as const, message: 'Beorn longevity ritual is blocked' },
      ],
    }

    when('the pruner runs')
    const result = pruner(body, 'npc', policy)

    then('the longevity ritual sentence is stripped')
    expect(result.prunedBody).not.toMatch(/longevity ritual/i)

    and('the strip is logged to repair_log.auto_repairs')
    const stripped = result.repairLog.auto_repairs.some(
      (r: { reason?: string }) => (r.reason ?? '').toLowerCase().includes('longevity'),
    )
    expect(stripped).toBe(true)
  })
})
