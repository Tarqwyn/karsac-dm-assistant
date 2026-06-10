/**
 * Layer 3 — Axis 6: Prose quality
 * Automated assertions for register, performability, and negative space.
 * Human evaluation rubric is printed for manual pre-promotion review.
 * Run with: npm run test:scenarios
 */

import { describe, expect, beforeAll } from 'vitest'
import { scenario, given, when, then, and } from './bdd.js'
import { isOllamaAvailable, runScenario } from './proposalRunner.js'
import {
  assertNoAnachronisticPhrasing, assertNoGenericFantasyDescriptors,
  assertPlayerSafeUnder, printHumanEvalRubric,
} from './proposalEvaluator.js'

let ollamaAvailable = false
beforeAll(() => { ollamaAvailable = isOllamaAvailable() })

// ── Automated prose quality assertions ───────────────────────────────────────

describe('Axis 6 — Player-safe NPC description is performable', () => {
  scenario('New NPC player_safe section is under 100 words and contains concrete detail', async () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    given('I propose a new NPC: a Torweg market stall keeper')
    const result = runScenario(
      'Propose a new NPC: a Torweg market stall keeper who sells cloth and has a sharp eye for strangers.',
      { type: 'npc' },
    )

    when('the proposal is generated')

    then('the player_safe section is under 100 words')
    assertPlayerSafeUnder(result, 100)

    and('no anachronistic phrasing')
    assertNoAnachronisticPhrasing(result)

    and('no generic fantasy descriptors')
    assertNoGenericFantasyDescriptors(result)

    printHumanEvalRubric(result, 'Torweg market stall keeper')
  })
})

describe('Axis 6 — Place arrival description uses concrete detail', () => {
  scenario('New place proposal arrival description avoids abstract mood language', async () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    given('I propose a new place: a Lösweg coastal fishing village')
    const result = runScenario(
      'Propose a new place: a small Lösweg coastal fishing village on the Bay of Whales coast.',
      { type: 'place' },
    )

    when('the proposal is generated')

    then('no generic fantasy descriptors appear')
    assertNoGenericFantasyDescriptors(result)

    and('no anachronistic phrasing')
    assertNoAnachronisticPhrasing(result)

    and('body contains at least one concrete sensory detail')
    const hasConcrete = /\b(smell|sound|cold|wind|salt|smoke|mud|stone|timber|ice|rain|fog|dock|rope|fish)\b/i.test(result.body)
    if (!hasConcrete) {
      console.warn('NEEDS_REVIEW: No concrete sensory detail detected — check body manually')
    }

    printHumanEvalRubric(result, 'Coastal fishing village place')
  })
})

describe('Axis 6 — Proposal does not over-explain', () => {
  scenario('NPC proposal does not tell the DM what players will feel or think', async () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    given('I propose a new NPC: a Torweg harbour master')
    const result = runScenario(
      'Propose a new NPC: the Torweg harbour master who controls dock access and knows which cargo movements are irregular.',
      { type: 'npc' },
    )

    when('the proposal is generated')

    then('body does not explain its own significance')
    const overExplains = /this npc (is|will be|serves) (important|significant|key|crucial)/i.test(result.body)
    if (overExplains) {
      console.warn('NEEDS_REVIEW: Proposal may over-explain NPC significance')
    }

    and('body does not tell DM what players will feel')
    const tellsDMPlayerFeelings = /players? will feel|players? will think|players? will (be|find it)/i.test(result.body)
    expect(tellsDMPlayerFeelings).toBe(false)

    and('no anachronistic phrasing')
    assertNoAnachronisticPhrasing(result)

    printHumanEvalRubric(result, 'Torweg harbour master NPC')
  })
})

describe('Axis 6 — Adversary doctrine is mechanic-supported', () => {
  scenario('Adversary proposal doctrine section is supported by mechanics in the stat block', async () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    given('I propose a Shadow Walker adversary')
    const result = runScenario(
      'Propose a new adversary: a Shadow Walker courier who carries sensitive intelligence through Torweg.',
    )

    when('the proposal is generated')

    then('a Doctrine section is present')
    const hasDoctrine = /##\s+doctrine/i.test(result.body)
    expect(hasDoctrine).toBe(true)

    and('doctrine contains at least one concrete behavioural statement')
    const doctrineMatch = result.body.match(/##\s+doctrine\s*\n([\s\S]*?)(?=\n##|\s*$)/i)
    if (doctrineMatch) {
      const doctrineText = doctrineMatch[1]
      const hasBehaviour = /\b(will|will not|never|always|when|if|retreat|avoid|refuse|prioritise|prefer)\b/i.test(doctrineText)
      expect(hasBehaviour).toBe(true)
    }

    and('no anachronistic phrasing')
    assertNoAnachronisticPhrasing(result)

    printHumanEvalRubric(result, 'Shadow Walker courier adversary')
  })
})
