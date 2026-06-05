/**
 * Layer 2 — Faction retrieval tests.
 * Run with: npm run test:retrieval
 */

import { describe, it, beforeAll } from 'vitest'
import { resolve } from 'path'
import { runQuery, isOllamaAvailable } from './queryRunner.js'
import {
  loadCorpus, evaluate, assertAllPass,
  mustContain, mustNotContain, mustContainAny, needsHumanReview,
} from './evaluator.js'

const CORPUS_ROOT = resolve(__dirname, '../../../corpus')
const HOUSE_MATHR = resolve(CORPUS_ROOT, 'collections/karsac-factions/house-mathr.md')
const LOSWEG_COUNCIL = resolve(CORPUS_ROOT, 'collections/karsac-factions/losweg-council-inner.md')

let ollamaAvailable = false
beforeAll(() => { ollamaAvailable = isOllamaAvailable() })

describe('faction retrieval — epistemic limits respected for dm-only faction', () => {
  it('House Mathr DM query: Vishara connection and impossible lineage are present', () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    const { text } = runQuery('What does the DM need to know about House Mathr?')
    const corpus = loadCorpus([HOUSE_MATHR])

    assertAllPass(evaluate(text, corpus, [
      mustContainAny([/house mathr|mathr/i], 'Response is about House Mathr'),
      mustContainAny(
        [/vishara|political vehicle|no antecedent|impossible.*lineage|1263/i],
        'Response includes DM-layer: Vishara connection and lineage anomaly',
      ),
      mustContainAny(
        [/no.*origin|antecedent|oral history|structurally impossible/i],
        'Response reflects the "no antecedent" fact from corpus',
      ),
      needsHumanReview('Response does not invent additional Vishara operational detail'),
    ]).filter(v => v.status === 'FAIL'))
  })

  it('House Mathr player query: dm-only content is not leaked', () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    const { text } = runQuery(
      'What do the players know about House Mathr at this point in the campaign?',
      'canon',
    )
    const corpus = loadCorpus([HOUSE_MATHR])

    assertAllPass(evaluate(text, corpus, [
      mustNotContain(
        /vishara.*primary.*vehicle|vishara.*political|mathr.*vishara.*connection/i,
        'Response does not leak the DM-only Vishara connection as player-known fact',
      ),
      needsHumanReview('Response reflects only what players have observed — not DM-layer facts'),
    ]).filter(v => v.status === 'FAIL'))
  })
})

describe('faction retrieval — faction relationship correctly described', () => {
  it('Lösweg inner council relationship to House Mathr is correctly framed', () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    const { text } = runQuery(
      'What is House Mathr\'s relationship to the Lösweg inner council?',
    )
    const corpus = loadCorpus([HOUSE_MATHR, LOSWEG_COUNCIL])

    assertAllPass(evaluate(text, corpus, [
      mustContainAny([/council|losweg|lösweg/i], 'Response mentions the Lösweg council'),
      mustContainAny([/mathr/i], 'Response mentions Mathr in the context of the council'),
      mustNotContain(
        /mathr.*founded.*council|mathr.*created.*council/i,
        'Response does not invent that Mathr founded the council',
      ),
      needsHumanReview('Relationship described matches corpus — no invented alliances or operations'),
    ]).filter(v => v.status === 'FAIL'))
  })
})
