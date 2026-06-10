/**
 * Layer 3 — Axis 2: Coverage levels
 * One scenario per coverage level verifying that the pipeline respects
 * corpus-anchor constraints.
 * Run with: npm run test:scenarios
 */

import { describe, beforeAll } from 'vitest'
import { scenario, given, when, then, and } from './bdd.js'
import { runScenario, isOllamaAvailable } from './proposalRunner.js'
import {
  assertValidationPasses, assertBodyContains, assertBodyNotContains,
  assertProposalType, assertValidationStatus,
} from './proposalEvaluator.js'

let ollamaAvailable = false
beforeAll(() => { ollamaAvailable = isOllamaAvailable() })

describe('Axis 2 — Full coverage: invention prohibited', () => {
  scenario('Jarl Beorn proposal contains only corpus-supported content and a repair log', async () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    given('a corpus-named entity with full/anchored coverage: Jarl Beorn')
    const result = runScenario('Propose a new NPC: Jarl Beorn.', { type: 'npc' })

    then('proposal is written')
    assertProposalType(result, 'npc')

    and('repair log is present in the frontmatter')
    if (!result.repairLog) {
      throw new Error('Expected repair_log to be present')
    }

    and('no section invents a Beorn childhood or origin story')
    assertBodyNotContains(result,
      /beorn.*childhood|beorn.*born|beorn.*early life|beorn.*youth/i,
      'invented childhood/origin')
  })
})

describe('Axis 2 — Stub coverage: minimal output', () => {
  scenario('Sea of Karsac (stub place) produces minimal output without invented geography', async () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    given('a corpus-named place with stub coverage: Sea of Karsac')
    const result = runScenario('Propose a new place: Sea of Karsac.', { type: 'place' })

    then('proposal is written without hard failures')
    if (result.validationStatus === 'fail') {
      const fails = result.validationNotes.filter(n => n.startsWith('FAIL:'))
      if (fails.some(f => !f.includes('suggested section'))) {
        throw new Error(`Hard failures on stub proposal:\n${fails.join('\n')}`)
      }
    }

    and('no invented districts, cities, or named settlements on the sea')
    assertBodyNotContains(result,
      /districts of the sea|port city on the sea|settlement on the|named city/i,
      'invented settlements on a stub place')

    and('no invented named routes or landmarks')
    assertBodyNotContains(result,
      /the.*route|the.*pass|named.*current|named.*landmark/i,
      'invented routes or landmarks on stub place')
  })
})

describe('Axis 2 — Stub place: no district structure', () => {
  scenario('Valweg (stub/bounded) does not expand into full district structure', async () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    given('a corpus-named place with bounded coverage: Valweg')
    const result = runScenario('Propose a new place: Valweg.', { type: 'place' })

    then('proposal is written')
    // It's OK if validation has warnings, but no hard fails on scope violation

    and('body does not invent named district subdivisions without provisional flag')
    const body = result.body
    const districtMatch = body.match(/##\s+(?:the\s+)?[A-Z][a-z]+\s+(?:district|ward|quarter)/i)
    if (districtMatch) {
      // District headings found — must be flagged provisional
      assertBodyContains(result, /provisional/i, 'Provisional flag on invented districts')
    }

    and('corpus-supported geography is present')
    assertBodyContains(result, /fjord|council|valweg/i, 'corpus-supported geography')
  })
})

describe('Axis 2 — New entity: no corpus anchor', () => {
  scenario('New NPC with no corpus anchor generates a valid proposal without canon leakage', async () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    given('a new NPC not in the canonical registry')
    const result = runScenario(
      'Propose a new NPC: Astrid Half-Stone, a female Lösweg boat-builder who repairs vessels at Halvash.',
      { type: 'npc' },
    )

    then('proposal is written without hard failures')
    if (result.validationStatus === 'fail') {
      const fails = result.validationNotes.filter(n => n.startsWith('FAIL:'))
      throw new Error(`Hard failures on new entity:\n${fails.join('\n')}`)
    }

    and('proposal type is npc')
    assertProposalType(result, 'npc')

    and('no canonical NPC is contradicted')
    assertBodyNotContains(result,
      /\bJarl Mathr\b.{0,80}(?:loves?|hates?|married|killed)/i,
      'canonical NPC contradiction')
  })
})
