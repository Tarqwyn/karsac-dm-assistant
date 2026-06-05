/**
 * Layer 2 — Cosmology retrieval tests.
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
const DHURVAQ_FILE = resolve(CORPUS_ROOT, 'collections/karsac-forces-cosmology/dhurvaq.md')
const MAHARUQ_FILE = resolve(CORPUS_ROOT, 'collections/karsac-forces-cosmology/maharuq.md')

let ollamaAvailable = false
beforeAll(() => { ollamaAvailable = isOllamaAvailable() })

describe('cosmology retrieval — resolved cosmological fact matches corpus', () => {
  it('Dhurvaq: boundary principle, fixed star, paired with Maharuq', () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    const { text } = runQuery('What is Dhurvaq?')
    const corpus = loadCorpus([DHURVAQ_FILE])

    assertAllPass(evaluate(text, corpus, [
      mustContainAny([/dhurvaq/i], 'Response is about Dhurvaq'),
      mustContainAny(
        [/boundary|persistence|fixed star|holding|not.*maharuq/i],
        'Response reflects the core principle: boundary and persistence',
      ),
      mustContainAny(
        [/maharuq|dissolution|paired/i],
        'Response places Dhurvaq in correct relationship with Maharuq',
      ),
      mustNotContain(
        /dhurvaq.*god|dhurvaq.*deity|dhurvaq.*divine/i,
        'Response does not misclassify Dhurvaq as a god or deity',
      ),
      needsHumanReview('Description matches corpus wording — not reinterpreted or extended'),
    ]).filter(v => v.status === 'FAIL'))
  })
})

describe('cosmology retrieval — unresolved detail flagged as unresolved', () => {
  it('Dhurvaq consciousness question is left open, not resolved by the model', () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    const { text } = runQuery(
      'Does Dhurvaq have consciousness? Is it self-aware?',
    )
    const corpus = loadCorpus([DHURVAQ_FILE])

    assertAllPass(evaluate(text, corpus, [
      mustContainAny(
        [/unresolved|not.*resolved|open question|unclear|cannot.*resolve|unknown|not.*stated/i],
        'Response flags the consciousness question as explicitly unresolved in corpus',
      ),
      mustNotContain(
        /dhurvaq.*is.*conscious|dhurvaq.*definitely.*aware|dhurvaq.*has.*consciousness/i,
        'Response does not resolve the consciousness question as settled fact',
      ),
      mustContainAny(
        [/something.*adjacent|attention|not.*personhood|not.*intention/i],
        'Response uses the hedged corpus language: "something adjacent to awareness"',
      ),
      needsHumanReview('Response preserves the ambiguity rather than collapsing it'),
    ]).filter(v => v.status === 'FAIL'))
  })
})

describe('cosmology retrieval — dm-only content not leaked to player query', () => {
  it('player-facing cosmology query does not reveal DM operational layer', () => {
    if (!ollamaAvailable) { console.warn('Skipping: Ollama not available'); return }

    const { text } = runQuery(
      'What do the players know about the primordial forces in Karsac?',
      'prose',
    )
    const corpus = loadCorpus([DHURVAQ_FILE, MAHARUQ_FILE])

    assertAllPass(evaluate(text, corpus, [
      mustNotContain(
        /brynja.*dhurvaq.*operation|holding.*distributes.*protection|dhurvaq.*quiet.*operation/i,
        'Response does not reveal DM-only Brynja/Dhurvaq protection mechanism',
      ),
      needsHumanReview('Response contains only player-observable cosmological flavour'),
      needsHumanReview('DM-layer mechanistic details about Vishara or Dhurvaq operations not present'),
    ]).filter(v => v.status === 'FAIL'))
  })
})
