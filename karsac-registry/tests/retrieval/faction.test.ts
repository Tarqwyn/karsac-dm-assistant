/**
 * Layer 2 — Faction retrieval tests.
 * Three assertions per scenario: Source · Completeness · Fidelity
 * Run with: npm run test:retrieval
 */

import { describe, it, beforeAll } from 'vitest'
import { resolve } from 'path'
import { runQuery, isOllamaAvailable } from './queryRunner.js'
import {
  loadCorpus, evaluate, assertAllPass,
  mustContain, mustNotContain, mustContainAny,
  sourceWasLoaded, allKeyFactsPresent, needsHumanReview,
} from './evaluator.js'

const CORPUS_ROOT = resolve(__dirname, '../../../corpus')
const HOUSE_MATHR = resolve(CORPUS_ROOT, 'collections/karsac-factions/house-mathr.md')
const LOSWEG_COUNCIL = resolve(CORPUS_ROOT, 'collections/karsac-factions/losweg-council-inner.md')

let ollamaAvailable = false
beforeAll(() => { ollamaAvailable = isOllamaAvailable() })

describe('faction — dm-only epistemic layer: House Mathr', () => {
  it('source: house-mathr file loaded · completeness: vishara+lineage+1263 · fidelity: no invented operations', () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    const q = runQuery('What does the DM need to know about House Mathr?')
    const corpus = loadCorpus([HOUSE_MATHR])

    assertAllPass(evaluate(q.text, corpus, [
      // Source
      sourceWasLoaded('house-mathr', 'House Mathr corpus file was loaded'),
      // Completeness
      allKeyFactsPresent(
        [/vishara/i, /no antecedent|no.*origin|oral history/i, /1263|founded/i, /political vehicle/i],
        'Response covers: Vishara connection, no-antecedent lineage anomaly, 1263 founding, political role',
      ),
      // Fidelity
      mustNotContain(/mathr.*founded.*losweg|mathr.*built.*council/i,
        'Response does not invent that Mathr founded the council or Lösweg'),
      needsHumanReview('No invented Vishara operational detail beyond what corpus states'),
    ], q.loadedEntityIds).filter(v => v.status === 'FAIL'))
  })
})

describe('faction — player-facing query does not leak dm-only connection', () => {
  it('source: house-mathr file loaded · completeness: observable facts · fidelity: vishara not leaked', () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    const q = runQuery('What do the players know about House Mathr at this point in the campaign?', 'canon')
    const corpus = loadCorpus([HOUSE_MATHR])

    assertAllPass(evaluate(q.text, corpus, [
      // Source
      sourceWasLoaded('house-mathr', 'House Mathr corpus file was loaded'),
      // Completeness — only player-observable facts should be present
      mustContainAny([/mathr/i], 'Response is about House Mathr'),
      // Fidelity
      mustNotContain(/vishara.*primary.*vehicle|vishara.*political|mathr.*vishara.*connection/i,
        'DM-only Vishara connection not leaked as player-known fact'),
      needsHumanReview('Response reflects only what players have observed — no DM-layer'),
    ], q.loadedEntityIds).filter(v => v.status === 'FAIL'))
  })
})

describe('faction — relationship correctly described: Lösweg council', () => {
  it('source: relevant faction files loaded · completeness: relationship framing · fidelity: no invented alliances', () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    const q = runQuery("What is House Mathr's relationship to the Lösweg inner council?")
    const corpus = loadCorpus([HOUSE_MATHR, LOSWEG_COUNCIL])

    assertAllPass(evaluate(q.text, corpus, [
      // Source
      sourceWasLoaded('mathr', 'A Mathr-related corpus file was loaded'),
      // Completeness
      allKeyFactsPresent(
        [/council|losweg|lösweg/i, /mathr/i],
        'Response mentions both the council and Mathr in relationship context',
      ),
      // Fidelity
      mustNotContain(/mathr.*created.*council|mathr.*founded.*council/i,
        'Response does not invent that Mathr created the council'),
      needsHumanReview('Relationship framing matches corpus — no invented alliances or operations added'),
    ], q.loadedEntityIds).filter(v => v.status === 'FAIL'))
  })
})
