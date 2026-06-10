/**
 * Layer 2 — Cosmology retrieval tests.
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
const DHURVAQ = resolve(CORPUS_ROOT, 'collections/karsac-forces-cosmology/dhurvaq.md')
const MAHARUQ = resolve(CORPUS_ROOT, 'collections/karsac-forces-cosmology/maharuq.md')

let ollamaAvailable = false
beforeAll(() => { ollamaAvailable = isOllamaAvailable() })

describe('cosmology — resolved fact: Dhurvaq nature', () => {
  it('source: dhurvaq file loaded · completeness: boundary+fixed-star+paired+awareness · fidelity: not a god', () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    const q = runQuery('What is Dhurvaq?')
    const corpus = loadCorpus([DHURVAQ])

    assertAllPass(evaluate(q.text, corpus, [
      // Source
      sourceWasLoaded('dhurvaq', 'Dhurvaq corpus file was loaded'),
      // Completeness
      allKeyFactsPresent(
        [/boundary|persistence/i, /fixed star/i, /maharuq|dissolution/i, /awareness|attention/i],
        'Response covers: boundary principle, fixed-star image, Maharuq pairing, adjacent awareness',
      ),
      // Fidelity
      mustNotContain(/dhurvaq.*god|dhurvaq.*deity|dhurvaq.*divine.*being/i,
        'Response does not misclassify Dhurvaq as a god or deity'),
      mustNotContain(/dhurvaq.*fights|dhurvaq.*battles|dhurvaq.*opposes/i,
        'Response does not invent active opposition — Dhurvaq simply does not move'),
      needsHumanReview('Description matches corpus wording, not reinterpreted or extended'),
    ], q.loadedEntityIds).filter(v => v.status === 'FAIL'))
  })
})

describe('cosmology — unresolved detail flagged as unresolved', () => {
  it('source: dhurvaq file loaded · completeness: adjacent-awareness language · fidelity: consciousness not resolved', () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    const q = runQuery('Does Dhurvaq have consciousness? Is it self-aware?')
    const corpus = loadCorpus([DHURVAQ])

    assertAllPass(evaluate(q.text, corpus, [
      // Source
      sourceWasLoaded('dhurvaq', 'Dhurvaq corpus file was loaded'),
      // Completeness
      allKeyFactsPresent(
        [/unresolved|not.*resolved|open|unclear|cannot.*resolve/i,
         /adjacent|something.*like|not.*personhood|attention/i],
        'Response flags consciousness as unresolved AND uses the hedged "adjacent to awareness" corpus language',
      ),
      // Fidelity
      mustNotContain(/dhurvaq.*is.*conscious|dhurvaq.*definitely.*aware|yes.*dhurvaq.*has.*consciousness/i,
        'Response does not resolve the consciousness question as settled'),
      needsHumanReview('Ambiguity preserved — response does not collapse an explicitly open question'),
    ], q.loadedEntityIds).filter(v => v.status === 'FAIL'))
  })
})

describe('cosmology — dm-only content not leaked to player query', () => {
  it('source: cosmology files loaded · completeness: flavour present · fidelity: no dm-layer mechanics', () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    const q = runQuery('What do the players know about the primordial forces in Karsac?', 'prose')
    const corpus = loadCorpus([DHURVAQ, MAHARUQ])

    assertAllPass(evaluate(q.text, corpus, [
      // Source — at least one cosmology file should be loaded
      sourceWasLoaded('dhurvaq', 'A cosmology corpus file was loaded'),
      // Completeness — player-observable flavour should be present
      mustContainAny([/boundary|dissolution|primordial|force/i],
        'Response contains at least one player-facing cosmological concept'),
      // Fidelity
      mustNotContain(/brynja.*dhurvaq.*operation|holding.*distributes.*protection/i,
        'DM-only Brynja/Dhurvaq protection operation not leaked'),
      mustNotContain(/vishara.*currently.*operating.*through.*mathr/i,
        'DM-only Vishara/Mathr operational detail not leaked'),
      needsHumanReview('Only player-observable cosmological atmosphere is present, not the DM layer'),
    ], q.loadedEntityIds).filter(v => v.status === 'FAIL'))
  })
})
