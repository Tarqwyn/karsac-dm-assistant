/**
 * Layer 3 — Axis 1: Proposal types
 * One scenario per proposal type exercising the full pipeline.
 * Run with: npm run test:scenarios
 */

import { describe, beforeAll } from 'vitest'
import { scenario, given, when, then, and } from './bdd.js'
import { runScenario, isOllamaAvailable } from './proposalRunner.js'
import {
  assertValidationPasses, assertBodyContains, assertBodyNotContains,
  assertBodyContainsAll, assertProposalType, assertNoAnachronisticPhrasing,
  printHumanEvalRubric,
} from './proposalEvaluator.js'

let ollamaAvailable = false
beforeAll(() => { ollamaAvailable = isOllamaAvailable() })

describe('Axis 1 — NPC: corpus-named full coverage', () => {
  scenario('Proposing Jarl Beorn produces a corpus-anchored NPC with correct key facts', async () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    given('I propose "Jarl Beorn" as an NPC')
    const result = runScenario('Propose a new NPC: Jarl Beorn.', { type: 'npc' })

    then('validation passes')
    assertValidationPasses(result)

    and('proposal type is npc')
    assertProposalType(result, 'npc')

    and('output contains "deceived not corrupted" framing')
    assertBodyContains(result, /deceived|not corrupted|not shaped/i, 'deceived not corrupted')

    and('output does not introduce invented Beorn backstory')
    assertBodyNotContains(result, /beorn.*born.*in|beorn.*grew.*up|beorn.*father.*was/i, 'invented backstory')

    and('no anachronistic phrasing')
    assertNoAnachronisticPhrasing(result)

    printHumanEvalRubric(result, 'Jarl Beorn NPC')
  })
})

describe('Axis 1 — NPC: new entity no corpus anchor', () => {
  scenario('Proposing a new NPC not in the registry does not invent canonical entities', async () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    given('I propose a new NPC not in the canonical registry')
    const result = runScenario(
      'Propose a new NPC: a Torweg dockworker who has seen suspicious cargo movements.',
      { type: 'npc' },
    )

    then('validation passes or produces only warnings')
    if (result.validationStatus === 'fail') {
      const fails = result.validationNotes.filter(n => n.startsWith('FAIL:'))
      throw new Error(`Unexpected FAIL issues:\n${fails.join('\n')}`)
    }

    and('no canonical named NPC is referenced without a provisional flag')
    assertBodyNotContains(result,
      /\bJarl Beorn\b|\bJarl Mathr\b|\bBrynja\b/i,
      'Canonical named NPCs invented inside proposal')

    printHumanEvalRubric(result, 'New Torweg dockworker NPC')
  })
})

describe('Axis 1 — Place: corpus-named full coverage', () => {
  scenario('Proposing Valweg produces a corpus-anchored place with correct geography', async () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    given('I propose "Valweg" as a place')
    const result = runScenario('Propose a new place: Valweg.', { type: 'place' })

    then('validation passes')
    assertValidationPasses(result)

    and('output describes fjord geography not river')
    assertBodyContains(result, /fjord/i, 'fjord geography')
    assertBodyNotContains(result, /\briver\s+city\b|\briverside\s+city\b/i, 'incorrect river geography')

    and('no invented districts are present without provisional flag')
    const inventedDistrict = /##\s+(district|quarter|ward)/i.test(result.body)
    if (inventedDistrict) {
      assertBodyContains(result, /provisional/i, 'Provisional flag on invented districts')
    }

    and('no Silent Hand reference')
    assertBodyNotContains(result, /silent hand/i, 'Silent Hand invented faction')

    printHumanEvalRubric(result, 'Valweg place')
  })
})

describe('Axis 1 — Adversary: Shadow Walker faction', () => {
  scenario('Shadow Walker urban adversary has correct alignment, language, and doctrine', async () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    given('I propose a Shadow Walker urban adversary')
    const result = runScenario(
      'Propose a new adversary: a Shadow Walker urban infiltrator operating in Torweg.',
    )

    then('validation passes or produces only warnings')
    if (result.validationStatus === 'fail') {
      const fails = result.validationNotes.filter(n => n.startsWith('FAIL:'))
      throw new Error(`Unexpected FAIL issues:\n${fails.join('\n')}`)
    }

    and('alignment is neutral — not evil')
    assertBodyNotContains(result, /neutral evil|lawful evil|chaotic evil/i, 'evil alignment present')

    and('languages contain no Undercommon')
    assertBodyNotContains(result, /\bundercommon\b/i, 'Undercommon language present')

    and('no shortbow or longbow')
    assertBodyNotContains(result, /\bshortbow\b|\blongbow\b/i, 'ranged bow weapon present')

    and('doctrine contains restraint or concealment language')
    assertBodyContains(result, /restraint|conceal|blend|cover identity|doctrine/i, 'doctrine restraint')

    printHumanEvalRubric(result, 'Shadow Walker urban adversary')
  })
})

describe('Axis 1 — Encounter: social obstruction', () => {
  scenario('Road encounter for chapter 3 has bounded NPC and resolution count', async () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    given('I propose a road encounter for chapter 3')
    const result = runScenario(
      'Propose a new encounter: a social obstruction at the road checkpoint north of Torweg, chapter 3.',
    )

    then('validation passes')
    assertValidationPasses(result)

    and('no new items invented outside canonical registry without provisional flag')
    const hasUnflaggedItem = /##\s+item|a\s+new\s+item\s+called/i.test(result.body)
    if (hasUnflaggedItem) {
      assertBodyContains(result, /provisional/i, 'Provisional flag on invented items')
    }

    and('no supernatural atmosphere without corpus support')
    assertBodyNotContains(result,
      /guided fog|whispering lanterns|unexplained glow|watching fog/i,
      'Supernatural atmosphere without corpus support')

    printHumanEvalRubric(result, 'Chapter 3 road encounter')
  })
})
