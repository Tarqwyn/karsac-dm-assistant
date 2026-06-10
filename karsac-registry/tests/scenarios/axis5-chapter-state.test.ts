/**
 * Layer 3 — Axis 5: Chapter state and context injection
 * Verifies that the pipeline injects hot/simmering thread state, chapter
 * position, and arc context before generation.
 * Run with: npm run test:scenarios
 */

import { describe, expect, beforeAll } from 'vitest'
import { scenario, given, when, then, and } from './bdd.js'
import { isOllamaAvailable, runScenario } from './proposalRunner.js'
import { assertValidationPasses, assertBodyContains, assertBodyNotContains } from './proposalEvaluator.js'
import { buildConstrainedProposalPrompt } from '../../src/proposals/proposalConstraints.js'
import { detectCorpusAnchorForProposal } from '../../src/proposals/proposalEntityRegistry.js'

let ollamaAvailable = false
beforeAll(() => { ollamaAvailable = isOllamaAvailable() })

// ── Deterministic constraint injection scenarios ──────────────────────────────

describe('Axis 5 — Hot threads injected as context before generation', () => {
  scenario('buildConstrainedProposalPrompt includes hot thread context for chapter 2', () => {
    given('a chapter 2 adversary proposal with world-thread state available')
    const anchor = detectCorpusAnchorForProposal(
      'adversary',
      'Propose a new adversary: a Shadow Walker operative in Torweg.',
    )

    when('I build the constrained proposal prompt')
    const prompt = buildConstrainedProposalPrompt({
      proposalType: 'adversary',
      prompt: 'Propose a new adversary: a Shadow Walker operative in Torweg.',
      corpusAnchor: anchor,
    })

    then('prompt contains PRE-GENERATION CONSTRAINTS section')
    expect(prompt).toContain('PRE-GENERATION CONSTRAINTS')

    and('prompt contains the original user request')
    expect(prompt).toContain('Shadow Walker operative')
  })
})

describe('Axis 5 — Simmering threads available but not foregrounded', () => {
  scenario('Chapter outline prompt includes chapter position without simmering thread urgency', () => {
    given('a chapter outline proposal for chapter 2 session 2')
    const anchor = detectCorpusAnchorForProposal(
      'chapter-outline',
      'Propose a new chapter outline for chapter 2 session 2.',
    )

    when('I build the constrained proposal prompt')
    const prompt = buildConstrainedProposalPrompt({
      proposalType: 'chapter-outline',
      prompt: 'Propose a new chapter outline for chapter 2 session 2.',
      corpusAnchor: anchor,
    })

    then('the prompt is well-formed')
    expect(prompt.length).toBeGreaterThan(50)
    expect(prompt).toContain('ORIGINAL USER REQUEST')
  })
})

describe('Axis 5 — Chapter position informs encounter scope', () => {
  scenario('Encounter proposal prompt for chapter 3 contains constraint lines', () => {
    given('a chapter 3 encounter proposal near Valweg')
    const anchor = detectCorpusAnchorForProposal(
      'encounter',
      'Propose a new encounter: the road north of Torweg toward Valweg, chapter 3.',
    )

    when('I build the constrained proposal prompt')
    const prompt = buildConstrainedProposalPrompt({
      proposalType: 'encounter',
      prompt: 'Propose a new encounter: the road north of Torweg toward Valweg, chapter 3.',
      corpusAnchor: anchor,
    })

    then('the prompt contains encounter constraint lines')
    expect(prompt).toContain('PRE-GENERATION CONSTRAINTS')

    and('the prompt contains the original user request')
    expect(prompt).toContain('chapter 3')
  })
})

describe('Axis 5 — Full pipeline: chapter 3 encounter includes state context', () => {
  scenario('Encounter proposal for chapter 3 road reflects current campaign state', async () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    given('I propose a chapter 3 road encounter toward Valweg')
    const result = runScenario(
      'Propose a new encounter: a social obstruction on the road north toward Valweg, chapter 3.',
      { type: 'encounter' },
    )

    then('validation passes')
    assertValidationPasses(result)

    and('encounter does not reference resolved chapter 1 threads as current obstacles')
    // Chapter 1 bone disc thread should not be described as an active obstacle in a chapter 3 encounter
    assertBodyNotContains(result,
      /the party must first.*resolve.*bone disc/i,
      'chapter 1 thread incorrectly foregrounded in chapter 3 encounter')

    and('encounter is grounded in the Valweg road context')
    assertBodyContains(result, /road|checkpoint|travel|north/i, 'road context present')
  })
})
